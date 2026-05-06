# ChChess 重构执行计划（修订版）

**创建日期**: 2026-05-06  
**分支**: `refactor/architecture-optimization`  
**目标**: 代码结构重构 → 统一资源访问 → Web兼容 → 主题系统 → 功能精简 → 单元测试

---

## 📋 重构目标总览

### 核心目标（按优先级排序）
1. **代码结构重构** - 🔴 最高优先级，模块化、低耦合、可调用、少依赖
2. **统一资源访问层** - 🟡 高优先级，基于新架构实现
3. **Web兼容性** - 🟢 自然获得，通过适配器模式
4. **界面主题化** - 🟢 延后实施，优先保证功能稳定性
5. **功能精简** - 🟢 清理冗余
6. **单元测试** - 🟡 基于纯函数逻辑编写

### 关键设计原则
- ✅ **避免 Vue watch**: 使用纯函数和回调，便于调用和测试
- ✅ **上下文传递**: 通过参数或显式上下文对象，而非隐式响应式状态
- ✅ **模块化**: 每个模块职责单一，接口清晰
- ✅ **低耦合**: 模块间通过接口交互，不直接依赖实现
- ✅ **可测试性**: 核心逻辑为纯函数，不依赖框架特性

---

## 🎯 第一阶段：代码结构重构（基础架构）

**预计时间**: 4-5天  
**优先级**: 🔴 最高（所有后续工作的基础）

### 1.1 重新组织目录结构

**新目录结构**:
```
src/
├── core/                    # 核心业务逻辑（纯TS，无框架依赖）
│   ├── chess/              # 象棋规则引擎
│   │   ├── types.ts        # 类型定义（Board, PieceType, Move等）
│   │   ├── constants.ts    # 常量（棋子映射、棋盘尺寸等）
│   │   ├── rules.ts        # 规则验证（纯函数）
│   │   ├── moveGenerator.ts # 着法生成（纯函数）
│   │   └── fen.ts          # FEN解析/生成（纯函数）
│   ├── game/               # 游戏状态管理
│   │   ├── gameState.ts    # 游戏状态类（纯TS类）
│   │   ├── moveHistory.ts  # 着法历史（纯TS类）
│   │   └── timer.ts        # 计时器（纯TS类）
│   └── ai/                 # AI接口定义
│       ├── aiEngine.ts     # AI引擎接口（interface）
│       └── uciProtocol.ts  # UCI协议解析（纯函数）
│
├── services/               # 服务层（平台无关）
│   ├── resourceManager.ts  # 资源管理器（接口+实现）
│   ├── configService.ts    # 配置服务（纯TS类）
│   └── engineService.ts    # 引擎服务（接口定义）
│
├── adapters/               # 平台适配器
│   ├── tauri/             # Tauri适配器
│   │   ├── fileAdapter.ts
│   │   ├── engineAdapter.ts
│   │   └── windowAdapter.ts
│   └── web/               # Web适配器
│       ├── fileAdapter.ts
│       └── engineAdapter.ts
│
├── ui/                     # UI层（Vue组件 + Composables）
│   ├── components/        # Vue组件
│   │   ├── ChessBoard/    
│   │   │   ├── Board3D.vue
│   │   │   └── BoardRenderer.ts  # Three.js渲染逻辑（纯TS）
│   │   ├── Dialogs/       
│   │   └── Controls/      
│   ├── composables/       # Vue组合式函数（薄封装层）
│   │   ├── useGame.ts      # 仅做响应式包装
│   │   ├── useAI.ts        
│   │   └── useInteraction.ts
│   └── layouts/           
│
├── utils/                  # 工具函数（纯函数）
│   ├── validators.ts      
│   ├── formatters.ts      
│   └── helpers.ts         
│
└── styles/                
    ├── themes/            
    ├── variables.css      
    └── global.css         
```

### 1.2 核心业务逻辑抽离（纯函数/纯类）

#### 任务1: 创建类型定义文件

**文件**: `src/core/chess/types.ts`

```typescript
// 棋子类型
export type PieceType = number; // 红方正数，黑方负数

// 棋盘类型
export type Board = PieceType[][];

// 坐标
export interface Position {
  row: number;
  col: number;
}

// 移动记录
export interface MoveRecord {
  from: Position;
  to: Position;
  piece: PieceType;
  captured?: PieceType;
  timestamp: number;
  notation?: string; // 中文着法
}

// 游戏状态枚举
export type GameStatus = 'playing' | 'check' | 'checkmate' | 'stalemate';

// 玩家类型
export type Player = 'red' | 'black';

// 游戏配置
export interface GameConfig {
  redUseAI: boolean;
  blackUseAI: boolean;
  redAILevel: number;
  blackAILevel: number;
  timePerMove: number;
}
```

#### 任务2: 迁移常量和基础函数

**文件**: `src/core/chess/constants.ts`

从现有的 `src/logic/chess/constants.ts` 迁移，保持纯导出：

```typescript
import type { PieceType, Board } from './types';

// 棋子名称映射
export const PIECE_NAMES: Record<number, string> = {
  1: '帅', 2: '车', 3: '马', 4: '炮', 5: '仕', 6: '相', 7: '兵',
  '-1': '将', '-2': '车', '-3': '马', '-4': '炮', 
  '-5': '士', '-6': '象', '-7': '卒',
};

// 棋盘尺寸
export const BOARD_ROWS = 10;
export const BOARD_COLS = 9;

/**
 * 初始化棋盘（纯函数）
 */
export function initBoard(): Board {
  const board: Board = Array(BOARD_ROWS).fill(null).map(() => Array(BOARD_COLS).fill(0));
  
  // 黑方棋子（上方）
  board[0] = [-2, -3, -6, -5, -1, -5, -6, -3, -2];
  board[2][1] = -4;
  board[2][7] = -4;
  for (let i = 0; i < 9; i += 2) {
    board[3][i] = -7;
  }
  
  // 红方棋子（下方）
  board[9] = [2, 3, 6, 5, 1, 5, 6, 3, 2];
  board[7][1] = 4;
  board[7][7] = 4;
  for (let i = 0; i < 9; i += 2) {
    board[6][i] = 7;
  }
  
  return board;
}

/**
 * 获取棋子颜色（纯函数）
 */
export function getPieceColor(piece: PieceType): Player | null {
  if (piece === 0) return null;
  return piece > 0 ? 'red' : 'black';
}

/**
 * 坐标转换为UCI格式（纯函数）
 */
export function boardToUCI(row: number, col: number): string {
  const files = 'abcdefghi';
  const uciRow = 9 - row; // 行号反转
  return `${files[col]}${uciRow}`;
}

/**
 * UCI格式转换为坐标（纯函数）
 */
export function UCIToBoard(uci: string): { row: number; col: number } {
  const files = 'abcdefghi';
  const col = files.indexOf(uci[0]);
  const uciRow = parseInt(uci[1]);
  const row = 9 - uciRow;
  return { row, col };
}
```

#### 任务3: 实现纯函数的规则验证

**文件**: `src/core/chess/rules.ts`

```typescript
import type { Board, Position, PieceType } from './types';
import { getPieceColor } from './constants';

/**
 * 验证移动是否合法（纯函数）
 * @returns true表示合法，false表示非法
 */
export function isValidMove(
  board: Board,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): boolean {
  const piece = board[fromRow][fromCol];
  const targetPiece = board[toRow][toCol];
  
  // 基本验证
  if (piece === 0) return false; // 起点无棋子
  if (getPieceColor(piece) === getPieceColor(targetPiece)) return false; // 不能吃己方棋子
  
  // 根据棋子类型验证
  const absPiece = Math.abs(piece);
  switch (absPiece) {
    case 2: // 车
      return validateRook(board, fromRow, fromCol, toRow, toCol);
    case 3: // 马
      return validateHorse(board, fromRow, fromCol, toRow, toCol);
    case 4: // 炮
      return validateCannon(board, fromRow, fromCol, toRow, toCol);
    case 5: // 仕/士
      return validateAdvisor(board, fromRow, fromCol, toRow, toCol, piece > 0);
    case 6: // 相/象
      return validateElephant(board, fromRow, fromCol, toRow, toCol, piece > 0);
    case 7: // 兵/卒
      return validateSoldier(board, fromRow, fromCol, toRow, toCol, piece > 0);
    case 1: // 帅/将
      return validateGeneral(board, fromRow, fromCol, toRow, toCol, piece > 0);
    default:
      return false;
  }
}

/**
 * 车的移动验证（纯函数）
 */
function validateRook(
  board: Board,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): boolean {
  // 必须在同一直线上
  if (fromRow !== toRow && fromCol !== toCol) return false;
  
  // 计算路径上的棋子数
  let count = 0;
  if (fromRow === toRow) {
    // 横向移动
    const minCol = Math.min(fromCol, toCol);
    const maxCol = Math.max(fromCol, toCol);
    for (let col = minCol + 1; col < maxCol; col++) {
      if (board[fromRow][col] !== 0) count++;
    }
  } else {
    // 纵向移动
    const minRow = Math.min(fromRow, toRow);
    const maxRow = Math.max(fromRow, toRow);
    for (let row = minRow + 1; row < maxRow; row++) {
      if (board[row][fromCol] !== 0) count++;
    }
  }
  
  return count === 0; // 路径上不能有棋子
}

/**
 * 马的移动验证（纯函数）
 */
function validateHorse(
  board: Board,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): boolean {
  const rowDiff = Math.abs(toRow - fromRow);
  const colDiff = Math.abs(toCol - fromCol);
  
  // 必须走日字
  if (!((rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2))) {
    return false;
  }
  
  // 检查蹩马腿
  if (rowDiff === 2) {
    // 竖直方向走两步，检查中间是否有棋子
    const midRow = fromRow + (toRow > fromRow ? 1 : -1);
    if (board[midRow][fromCol] !== 0) return false;
  } else {
    // 水平方向走两步，检查中间是否有棋子
    const midCol = fromCol + (toCol > fromCol ? 1 : -1);
    if (board[fromRow][midCol] !== 0) return false;
  }
  
  return true;
}

// ... 其他棋子验证函数

/**
 * 检查是否被将军（纯函数）
 */
export function isInCheck(board: Board, player: 'red' | 'black'): boolean {
  // 找到将/帅的位置
  const generalValue = player === 'red' ? 1 : -1;
  let generalPos: Position | null = null;
  
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === generalValue) {
        generalPos = { row, col };
        break;
      }
    }
    if (generalPos) break;
  }
  
  if (!generalPos) return false;
  
  // 检查对方所有棋子是否能攻击到将/帅
  const opponent = player === 'red' ? 'black' : 'red';
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col];
      if (piece !== 0 && getPieceColor(piece) === opponent) {
        if (isValidMove(board, row, col, generalPos.row, generalPos.col)) {
          return true;
        }
      }
    }
  }
  
  return false;
}
```

#### 任务4: 实现游戏状态类（无Vue依赖）

**文件**: `src/core/game/gameState.ts`

```typescript
import type { Board, MoveRecord, Player, GameStatus, GameConfig } from '../chess/types';
import { initBoard, getPieceColor } from '../chess/constants';
import { isValidMove, isInCheck } from '../chess/rules';

/**
 * 游戏状态类（纯TypeScript，无Vue依赖）
 * 使用回调通知状态变化，而非响应式系统
 */
export class GameState {
  private board: Board;
  private currentPlayer: Player;
  private moveHistory: MoveRecord[];
  private status: GameStatus;
  private config: GameConfig;
  private observers: Array<(state: GameState) => void> = [];
  
  constructor(config?: Partial<GameConfig>) {
    this.board = initBoard();
    this.currentPlayer = 'red';
    this.moveHistory = [];
    this.status = 'playing';
    this.config = {
      redUseAI: false,
      blackUseAI: true,
      redAILevel: 15,
      blackAILevel: 15,
      timePerMove: 30,
      ...config,
    };
  }
  
  /**
   * 移动棋子
   * @returns 是否成功
   */
  movePiece(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    // 验证移动
    if (!isValidMove(this.board, fromRow, fromCol, toRow, toCol)) {
      console.warn('非法移动');
      return false;
    }
    
    // 执行移动
    const piece = this.board[fromRow][fromCol];
    const captured = this.board[toRow][toCol];
    this.board[toRow][toCol] = piece;
    this.board[fromRow][fromCol] = 0;
    
    // 记录历史
    this.moveHistory.push({
      from: { row: fromRow, col: fromCol },
      to: { row: toRow, col: toCol },
      piece,
      captured: captured !== 0 ? captured : undefined,
      timestamp: Date.now(),
    });
    
    // 检查将军/绝杀
    const opponent = this.currentPlayer === 'red' ? 'black' : 'red';
    if (isInCheck(this.board, opponent)) {
      this.status = 'check';
      // TODO: 检查是否绝杀
    } else {
      this.status = 'playing';
    }
    
    // 切换玩家
    this.currentPlayer = opponent;
    
    // 通知观察者
    this.notifyObservers();
    
    return true;
  }
  
  /**
   * 悔棋
   */
  undo(): boolean {
    if (this.moveHistory.length === 0) return false;
    
    const lastMove = this.moveHistory.pop();
    if (!lastMove) return false;
    
    // 恢复棋盘
    this.board[lastMove.from.row][lastMove.from.col] = lastMove.piece;
    this.board[lastMove.to.row][lastMove.to.col] = lastMove.captured || 0;
    
    // 切换回上一个玩家
    this.currentPlayer = this.currentPlayer === 'red' ? 'black' : 'red';
    this.status = 'playing';
    
    this.notifyObservers();
    return true;
  }
  
  /**
   * 重置游戏
   */
  reset(): void {
    this.board = initBoard();
    this.currentPlayer = 'red';
    this.moveHistory = [];
    this.status = 'playing';
    this.notifyObservers();
  }
  
  /**
   * 订阅状态变化（替代Vue watch）
   * @param callback 状态变化时的回调函数
   * @returns 取消订阅的函数
   */
  subscribe(callback: (state: GameState) => void): () => void {
    this.observers.push(callback);
    return () => {
      const index = this.observers.indexOf(callback);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }
  
  /**
   * 通知所有观察者
   */
  private notifyObservers(): void {
    this.observers.forEach(cb => cb(this));
  }
  
  // Getter方法（提供只读访问）
  getBoard(): Board {
    return this.board.map(row => [...row]); // 返回副本
  }
  
  getCurrentPlayer(): Player {
    return this.currentPlayer;
  }
  
  getMoveHistory(): MoveRecord[] {
    return [...this.moveHistory]; // 返回副本
  }
  
  getStatus(): GameStatus {
    return this.status;
  }
  
  getConfig(): GameConfig {
    return { ...this.config }; // 返回副本
  }
  
  generateFEN(): string {
    // FEN生成逻辑
    // ...
    return '';
  }
  
  loadFromFEN(fen: string): void {
    // FEN解析逻辑
    // ...
    this.notifyObservers();
  }
}
```

### 1.3 创建Vue薄封装层

**目的**: 让纯业务逻辑可以在Vue中使用，但不污染核心逻辑

**文件**: `src/ui/composables/useGame.ts`

```typescript
import { ref, computed, onUnmounted } from 'vue';
import { GameState } from '../../core/game/gameState';
import type { Board, Player } from '../../core/chess/types';

/**
 * Vue组合式函数（薄封装层）
 * 仅负责将纯TS类的状态转换为响应式
 */
export function useGame() {
  const gameState = new GameState();
  
  // 响应式状态
  const board = ref<Board>(gameState.getBoard());
  const currentPlayer = ref<Player>(gameState.getCurrentPlayer());
  const status = ref(gameState.getStatus());
  const moveHistory = ref(gameState.getMoveHistory());
  
  // 订阅状态变化
  const unsubscribe = gameState.subscribe((state) => {
    board.value = state.getBoard();
    currentPlayer.value = state.getCurrentPlayer();
    status.value = state.getStatus();
    moveHistory.value = state.getMoveHistory();
  });
  
  onUnmounted(() => {
    unsubscribe();
  });
  
  // 暴露方法（直接调用纯TS类的方法）
  return {
    // 响应式状态
    board,
    currentPlayer,
    status,
    moveHistory,
    
    // 方法（直接透传）
    movePiece: (fromRow: number, fromCol: number, toRow: number, toCol: number) => 
      gameState.movePiece(fromRow, fromCol, toRow, toCol),
    undo: () => gameState.undo(),
    reset: () => gameState.reset(),
    generateFEN: () => gameState.generateFEN(),
    loadFromFEN: (fen: string) => gameState.loadFromFEN(fen),
    
    // 原始实例（供高级用法）
    gameState,
  };
}
```

### 1.4 重构Three.js渲染逻辑

**目标**: 将Three.js逻辑从Vue组件中分离为纯TS模块

**文件**: `src/ui/components/ChessBoard/BoardRenderer.ts`

```typescript
import * as THREE from 'three';
import type { Board } from '../../../core/chess/types';

/**
 * 棋盘渲染器（纯TS类，无Vue依赖）
 * 通过回调与外部通信
 */
export class BoardRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private piecesGroup: THREE.Group;
  private boardGroup: THREE.Group;
  
  constructor(container: HTMLElement) {
    // 初始化Three.js场景
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.piecesGroup = new THREE.Group();
    this.boardGroup = new THREE.Group();
    
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);
    
    this.scene.add(this.boardGroup);
    this.scene.add(this.piecesGroup);
  }
  
  /**
   * 同步棋盘状态（带动画）
   * @param board 新的棋盘状态
   * @param onComplete 动画完成回调
   */
  syncBoardState(board: Board, onComplete?: () => void): void {
    // 计算需要移动的棋子
    // 执行动画
    // 完成后调用回调
    if (onComplete) {
      setTimeout(onComplete, 400); // 模拟动画时长
    }
  }
  
  /**
   * 设置棋子点击回调
   */
  setOnPieceClick(callback: (row: number, col: number) => void): void {
    // 实现射线检测和事件绑定
  }
  
  /**
   * 销毁资源
   */
  dispose(): void {
    this.renderer.dispose();
  }
  
  // ... 其他渲染方法
}
```

### 1.5 更新现有代码使用新架构

**迁移步骤**:
1. 在 `ChessBoard3D.vue` 中使用 `useGame()` 替代 `useChessStore()`
2. 使用 `BoardRenderer` 类管理Three.js场景
3. 移除所有 `watch` 调用，改用 `subscribe` 回调
4. 逐步迁移其他组件

**示例**:
```vue
<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue';
import { useGame } from '../../composables/useGame';
import { BoardRenderer } from './BoardRenderer';

const { board, movePiece, undo, reset } = useGame();
let renderer: BoardRenderer | null = null;

onMounted(() => {
  const container = document.getElementById('chess-container');
  if (container) {
    renderer = new BoardRenderer(container);
    
    // 设置回调
    renderer.setOnPieceClick((row, col) => {
      // 处理点击
    });
    
    // 订阅棋盘变化
    // 注意：这里不需要watch，因为board已经是响应式的
    // 如果需要更细粒度的控制，可以使用subscribe
  }
});

onBeforeUnmount(() => {
  renderer?.dispose();
});
</script>
```

---

## 🎯 第二阶段：统一资源访问层

**预计时间**: 2天  
**优先级**: 🟡 高（基于新架构）

### 2.1 创建资源管理器

**文件**: `src/services/resourceManager.ts`

```typescript
import type { IPlatformAdapter } from '../adapters/platformAdapter';

export enum ResourceType {
  TEXTURE = 'texture',
  FONT = 'font',
  CHESS_SCORE = 'chess_score',
  IMAGE = 'image',
}

export interface IResourceManager {
  loadResource<T>(type: ResourceType, path: string): Promise<T>;
  getCachedResource<T>(type: ResourceType, path: string): T | null;
  clearCache(type?: ResourceType): void;
  listResources(type: ResourceType, directory?: string): Promise<string[]>;
}

export class ResourceManager implements IResourceManager {
  private adapter: IPlatformAdapter;
  private cache = new Map<string, any>();
  
  constructor(adapter: IPlatformAdapter) {
    this.adapter = adapter;
  }
  
  async loadResource<T>(type: ResourceType, path: string): Promise<T> {
    const cacheKey = `${type}:${path}`;
    
    // 检查缓存
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    // 加载资源
    const url = await this.adapter.resolvePath(path);
    let resource: T;
    
    switch (type) {
      case ResourceType.TEXTURE:
        resource = await this.loadTexture(url) as unknown as T;
        break;
      case ResourceType.FONT:
        resource = await this.loadFont(url) as unknown as T;
        break;
      case ResourceType.CHESS_SCORE:
        resource = await this.adapter.readTextFile(path) as unknown as T;
        break;
      default:
        throw new Error(`Unsupported resource type: ${type}`);
    }
    
    // 缓存
    this.cache.set(cacheKey, resource);
    return resource;
  }
  
  private async loadTexture(url: string): Promise<any> {
    // Three.js纹理加载逻辑
    return new Promise((resolve, reject) => {
      const loader = new THREE.TextureLoader();
      loader.load(url, resolve, undefined, reject);
    });
  }
  
  private async loadFont(url: string): Promise<void> {
    // 字体加载逻辑
    const font = new FontFace('ChessFont', `url(${url})`);
    await font.load();
    document.fonts.add(font);
  }
  
  getCachedResource<T>(type: ResourceType, path: string): T | null {
    const cacheKey = `${type}:${path}`;
    return this.cache.get(cacheKey) || null;
  }
  
  clearCache(type?: ResourceType): void {
    if (type) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${type}:`)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
  
  async listResources(type: ResourceType, directory?: string): Promise<string[]> {
    // 委托给适配器
    return this.adapter.listDirectory(directory || '');
  }
}
```

### 2.2 创建平台适配器

**文件**: `src/adapters/tauri/fileAdapter.ts`

```typescript
import { convertFileSrc } from '@tauri-apps/api/core';
import { resolveResource } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import type { IPlatformAdapter } from '../platformAdapter';

export class TauriFileAdapter implements IPlatformAdapter {
  async resolvePath(path: string): Promise<string> {
    const resourcePath = await resolveResource(path);
    return convertFileSrc(resourcePath);
  }
  
  async readTextFile(path: string): Promise<string> {
    // 对于棋谱文件，调用Rust后端
    if (path.includes('chess_score')) {
      const filename = path.split('/').pop();
      return invoke('read_chess_score', { filename });
    }
    
    // 其他文件使用fetch
    const url = await this.resolvePath(path);
    const response = await fetch(url);
    return response.text();
  }
  
  async listDirectory(path: string): Promise<string[]> {
    // 调用Rust后端扫描目录
    return invoke('scan_texture_directories');
  }
  
  isTauri(): boolean {
    return true;
  }
}
```

**文件**: `src/adapters/web/fileAdapter.ts`

```typescript
import type { IPlatformAdapter } from '../platformAdapter';

export class WebFileAdapter implements IPlatformAdapter {
  async resolvePath(path: string): Promise<string> {
    if (path.startsWith('http')) {
      return path;
    }
    return new URL(path, window.location.origin).href;
  }
  
  async readTextFile(path: string): Promise<string> {
    const url = await this.resolvePath(path);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load file: ${path}`);
    }
    return response.text();
  }
  
  async listDirectory(path: string): Promise<string[]> {
    // Web环境下无法列出目录，返回预定义列表或使用manifest
    throw new Error('Directory listing not supported in Web environment');
  }
  
  isTauri(): boolean {
    return false;
  }
}
```

---

## 🌐 第三阶段：Web兼容性（自然获得）

由于采用了适配器模式，Web兼容性在第一、二阶段完成后已经自然实现。

**验证清单**:
- [ ] 资源管理器在Web环境下正常工作
- [ ] 游戏状态类不依赖Tauri API
- [ ] Three.js渲染在浏览器中正常
- [ ] 配置使用localStorage而非Tauri配置

---

## 🎨 第四阶段：界面主题化

**预计时间**: 1-2天  
**优先级**: 🟢 中（延后实施）

*注：根据用户偏好，非核心视觉优化建议延后*

---

## 🧹 第五阶段：功能精简

**预计时间**: 1天  

---

## 🧪 第六阶段：单元测试

**预计时间**: 2-3天  
**优先级**: 🟡 高

### 6.1 测试纯函数逻辑

**优势**: 由于核心逻辑已抽离为纯函数，测试非常简单

**示例**:
```typescript
import { describe, it, expect } from 'vitest';
import { isValidMove, isInCheck } from '../src/core/chess/rules';
import { initBoard } from '../src/core/chess/constants';

describe('象棋规则验证', () => {
  it('车应该可以直线移动', () => {
    const board = initBoard();
    expect(isValidMove(board, 9, 0, 9, 3)).toBe(true);
  });
  
  it('不能移动到己方棋子位置', () => {
    const board = initBoard();
    expect(isValidMove(board, 9, 0, 9, 1)).toBe(false);
  });
});

describe('游戏状态类', () => {
  it('应该正确执行移动', () => {
    const gameState = new GameState();
    const result = gameState.movePiece(9, 0, 7, 0);
    expect(result).toBe(true);
    expect(gameState.getCurrentPlayer()).toBe('black');
  });
  
  it('应该可以悔棋', () => {
    const gameState = new GameState();
    gameState.movePiece(9, 0, 7, 0);
    gameState.undo();
    expect(gameState.getCurrentPlayer()).toBe('red');
  });
});
```

---

## 📊 修订后的实施时间表

| 阶段 | 任务 | 预计时间 | 优先级 | 状态 |
|------|------|---------|--------|------|
| 1 | **代码结构重构** | 4-5天 | 🔴 最高 | ⏳ 待开始 |
| 2 | **统一资源访问层** | 2天 | 🟡 高 | ⏳ 待开始 |
| 3 | **Web兼容性** | 0天 | ✅ 自然获得 | ⏳ 待开始 |
| 4 | 界面主题系统 | 1-2天 | 🟢 中 | ⏳ 待开始 |
| 5 | 功能精简 | 1天 | 🟢 中 | ⏳ 待开始 |
| 6 | 单元测试框架 | 2-3天 | 🟡 高 | ⏳ 待开始 |
| **总计** | | **10-13天** | | |

---

## ✅ 验收标准

### 代码结构验收
- [ ] 核心逻辑完全独立于Vue框架
- [ ] 所有业务逻辑为纯函数或纯类
- [ ] 无Vue watch用于业务逻辑
- [ ] 模块间通过接口交互，低耦合
- [ ] 可通过上下文传递状态，无需全局变量

### 可测试性验收
- [ ] 核心逻辑单元测试覆盖率 > 80%
- [ ] 测试不依赖DOM或Three.js
- [ ] 测试运行速度快（< 1秒）

---

## 📝 执行记录模板

（同前）

---

**最后更新**: 2026-05-06  
**维护者**: ChChess 开发团队  
**分支**: `refactor/architecture-optimization`
