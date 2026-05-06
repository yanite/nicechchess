# ChChess 重构执行计划

**创建日期**: 2026-05-06  
**分支**: `refactor/architecture-optimization`  
**目标**: 统一资源访问、界面主题化、代码结构优化、Web兼容、可测试性提升

---

## 📋 重构目标总览

### 核心目标
1. **资源访问统一化** - 建立统一的ResourceManager，支持Tauri和纯Web双模式
2. **界面主题化** - 实现主题系统，支持动态切换UI风格
3. **代码结构优化** - 分层架构清晰，业务逻辑与渲染逻辑解耦
4. **Web兼容性** - 移除Tauri硬依赖，使用适配器模式隔离平台代码
5. **功能精简** - 清理冗余功能，保持核心稳定
6. **可测试性** - 核心逻辑抽离为纯函数，便于单元测试

### 设计原则
- ✅ **单一职责**: 每个模块只负责一个明确的功能
- ✅ **依赖倒置**: 高层模块不依赖低层模块的具体实现
- ✅ **开闭原则**: 对扩展开放，对修改关闭
- ✅ **接口隔离**: 提供最小化的接口定义
- ✅ **组合优于继承**: 使用组合方式构建复杂功能

---

## 🎯 第一阶段：统一资源访问层（Resource Manager）

**预计时间**: 2-3天  
**优先级**: 🔴 最高（基础架构）

### 1.1 创建资源管理器核心接口

**文件**: `src/services/resourceManager.ts`

**职责**:
- 定义统一的资源加载接口
- 抽象Tauri和Web两种模式的差异
- 提供资源缓存机制
- 支持异步加载和错误处理

**核心接口设计**:
```typescript
// 资源类型枚举
export enum ResourceType {
  TEXTURE = 'texture',
  FONT = 'font',
  CHESS_SCORE = 'chess_score',
  MODEL = 'model',
  IMAGE = 'image',
}

// 资源管理器接口
export interface IResourceManager {
  // 加载资源
  loadResource<T>(type: ResourceType, path: string): Promise<T>;
  
  // 批量加载
  loadResources<T>(type: ResourceType, paths: string[]): Promise<Map<string, T>>;
  
  // 获取缓存的资源
  getCachedResource<T>(type: ResourceType, path: string): T | null;
  
  // 清除缓存
  clearCache(type?: ResourceType): void;
  
  // 列出资源（仅适用于目录型资源）
  listResources(type: ResourceType, directory?: string): Promise<string[]>;
}

// 平台适配器接口
export interface IPlatformAdapter {
  // 转换资源路径为可访问的URL
  resolvePath(path: string): Promise<string>;
  
  // 读取文本文件
  readTextFile(path: string): Promise<string>;
  
  // 列出目录内容
  listDirectory(path: string): Promise<string[]>;
  
  // 判断是否为Tauri环境
  isTauri(): boolean;
}
```

**实现要点**:
1. 创建 `TauriAdapter` 和 `WebAdapter` 两个适配器
2. ResourceManager根据环境自动选择合适的适配器
3. 使用LRU缓存策略管理已加载资源
4. 提供进度回调和取消机制

### 1.2 迁移现有资源加载代码

**需要迁移的文件**:
- `src/components/3d/usePieces.ts` - 字体加载
- `src/components/3d/useBoard.ts` - 棋盘纹理加载
- `src/services/chessScoreService.ts` - 棋谱读取
- `src/services/configService.ts` - 配置相关资源扫描

**迁移步骤**:
1. 在usePieces.ts中替换 `convertFileSrc` 和 `resolveResource` 调用
2. 在useBoard.ts中替换纹理加载逻辑
3. 重写chessScoreService使用ResourceManager
4. 更新configService中的资源扫描功能

**验证标准**:
- ✅ 所有字体正常加载
- ✅ 棋盘纹理正确显示
- ✅ 棋谱可以读取
- ✅ 无控制台错误

### 1.3 添加单元测试

**测试文件**: `tests/unit/resourceManager.test.ts`

**测试用例**:
```typescript
describe('ResourceManager', () => {
  it('应该正确加载纹理资源', async () => {
    const texture = await rm.loadResource(ResourceType.TEXTURE, 'tx1/diff.jpg');
    expect(texture).toBeDefined();
  });
  
  it('应该缓存已加载的资源', async () => {
    await rm.loadResource(ResourceType.FONT, '隶书.ttf');
    const cached = rm.getCachedResource(ResourceType.FONT, '隶书.ttf');
    expect(cached).not.toBeNull();
  });
  
  it('应该在Web模式下正常工作', async () => {
    // Mock Web环境
    const webRM = new ResourceManager(new WebAdapter());
    // 测试逻辑...
  });
});
```

---

## 🎨 第二阶段：界面主题系统（Theme System）

**预计时间**: 2天  
**优先级**: 🟡 高

### 2.1 设计主题数据结构

**文件**: `src/services/themeService.ts`

**主题配置结构**:
```typescript
export interface ThemeColors {
  // 主色调
  primary: string;
  secondary: string;
  accent: string;
  
  // 背景色
  background: string;
  surface: string;
  
  // 文字颜色
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
  
  // 边框和分割线
  border: string;
  divider: string;
  
  // 状态颜色
  success: string;
  warning: string;
  error: string;
  info: string;
  
  // 棋盘特定
  boardBackground: string;
  boardLines: string;
  redPiece: string;
  blackPiece: string;
}

export interface ThemeTypography {
  fontFamily: string;
  fontSize: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
}

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

export interface Theme {
  name: string;
  displayName: string;
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  borderRadius: number;
  boxShadow: string;
}

// 预设主题
export const LIGHT_THEME: Theme = { /* ... */ };
export const DARK_THEME: Theme = { /* ... */ };
export const CLASSIC_THEME: Theme = { /* ... */ };
```

### 2.2 实现主题服务

**功能**:
- 主题加载和切换
- CSS变量动态更新
- 主题持久化（保存到config.yaml）
- 主题预览功能

**API设计**:
```typescript
export class ThemeService {
  // 获取当前主题
  getCurrentTheme(): Theme;
  
  // 切换主题
  setTheme(themeName: string): Promise<void>;
  
  // 注册自定义主题
  registerTheme(theme: Theme): void;
  
  // 获取所有可用主题
  getAvailableThemes(): string[];
  
  // 应用主题到DOM
  applyTheme(theme: Theme): void;
}
```

### 2.3 更新UI组件使用主题

**需要更新的组件**:
- `src/App.vue` - 主应用容器
- `src/components/NewGameDialog.vue` - 新建游戏对话框
- `src/components/SettingsDialog.vue` - 设置对话框
- `src/components/GameNotationDialog.vue` - 棋谱对话框

**更新方式**:
1. 使用CSS变量替代硬编码颜色值
2. 在组件中使用computed属性获取主题值
3. 添加主题切换按钮到设置对话框

**示例**:
```vue
<style scoped>
.dialog-container {
  background-color: var(--theme-surface);
  color: var(--theme-text-primary);
  border: 1px solid var(--theme-border);
}
</style>
```

### 2.4 添加主题切换UI

**位置**: SettingsDialog中添加"外观"选项卡

**功能**:
- 主题预览卡片
- 一键切换按钮
- 实时预览效果

---

## 🏗️ 第三阶段：代码结构重构

**预计时间**: 3-4天  
**优先级**: 🟡 高

### 3.1 重新组织目录结构

**新目录结构**:
```
src/
├── core/                    # 核心业务逻辑（纯JS/TS，无框架依赖）
│   ├── chess/              # 象棋规则引擎
│   │   ├── types.ts        # 类型定义
│   │   ├── constants.ts    # 常量
│   │   ├── rules.ts        # 规则验证
│   │   ├── moveGenerator.ts # 着法生成
│   │   └── fen.ts          # FEN解析/生成
│   ├── game/               # 游戏状态管理
│   │   ├── gameState.ts    # 游戏状态
│   │   ├── moveHistory.ts  # 着法历史
│   │   └── timer.ts        # 计时器
│   └── ai/                 # AI接口定义
│       ├── aiEngine.ts     # AI引擎接口
│       └── uciProtocol.ts  # UCI协议实现
│
├── services/               # 服务层
│   ├── resourceManager.ts  # 资源管理器
│   ├── themeService.ts     # 主题服务
│   ├── configService.ts    # 配置服务
│   └── engineService.ts    # 引擎服务（UCI通信）
│
├── adapters/               # 平台适配器
│   ├── tauri/             # Tauri适配器
│   │   ├── fileAdapter.ts
│   │   ├── windowAdapter.ts
│   │   └── ipcAdapter.ts
│   └── web/               # Web适配器
│       ├── fileAdapter.ts
│       └── storageAdapter.ts
│
├── ui/                     # UI层（Vue组件）
│   ├── components/        # 通用组件
│   │   ├── ChessBoard/    # 棋盘组件
│   │   │   ├── Board2D.vue
│   │   │   └── Board3D.vue
│   │   ├── Dialogs/       # 对话框
│   │   └── Controls/      # 控制组件
│   ├── composables/       # Vue组合式函数
│   │   ├── useGame.ts
│   │   ├── useAI.ts
│   │   └── useTheme.ts
│   └── layouts/           # 布局组件
│
├── utils/                  # 工具函数
│   ├── validators.ts      # 验证工具
│   ├── formatters.ts      # 格式化工具
│   └── helpers.ts         # 辅助函数
│
└── styles/                # 样式文件
    ├── themes/            # 主题样式
    ├── variables.css      # CSS变量
    └── global.css         # 全局样式
```

### 3.2 抽离纯业务逻辑

**目标**: 将象棋规则、状态管理等逻辑从Vue组件中完全分离

**具体任务**:
1. **移动 `chessStore.ts` 到 `core/game/`**
   - 移除Pinia依赖，改为纯TypeScript类
   - 提供状态订阅机制（观察者模式）
   
2. **完善 `rules.ts`**
   - 实现完整的规则验证
   - 添加单元测试
   
3. **创建 `moveGenerator.ts`**
   - 实现合法着法生成
   - 用于AI引擎和规则验证

**示例 - 纯游戏状态类**:
```typescript
// src/core/game/gameState.ts
export class GameState {
  private board: Board;
  private currentPlayer: 'red' | 'black';
  private moveHistory: MoveRecord[];
  private observers: Array<(state: GameState) => void> = [];
  
  constructor(initialFen?: string) {
    this.board = initBoard();
    this.currentPlayer = 'red';
    this.moveHistory = [];
    
    if (initialFen) {
      this.loadFromFEN(initialFen);
    }
  }
  
  movePiece(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    // 验证移动
    if (!isValidMove(this.board, fromRow, fromCol, toRow, toCol)) {
      return false;
    }
    
    // 执行移动
    const piece = this.board[fromRow][fromCol];
    this.board[toRow][toCol] = piece;
    this.board[fromRow][fromCol] = 0;
    
    // 记录历史
    this.moveHistory.push({
      from: { row: fromRow, col: fromCol },
      to: { row: toRow, col: toCol },
      piece,
      timestamp: Date.now(),
    });
    
    // 切换玩家
    this.currentPlayer = this.currentPlayer === 'red' ? 'black' : 'red';
    
    // 通知观察者
    this.notifyObservers();
    
    return true;
  }
  
  subscribe(callback: (state: GameState) => void): () => void {
    this.observers.push(callback);
    return () => {
      const index = this.observers.indexOf(callback);
      if (index > -1) this.observers.splice(index, 1);
    };
  }
  
  private notifyObservers(): void {
    this.observers.forEach(cb => cb(this));
  }
  
  // ... 其他方法
}
```

### 3.3 创建Vue适配器

**目的**: 让纯业务逻辑可以在Vue中使用

**文件**: `src/ui/composables/useGame.ts`

```typescript
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { GameState } from '../../core/game/gameState';

export function useGame() {
  const gameState = new GameState();
  const board = ref<Board>(gameState.getBoard());
  const currentPlayer = ref<'red' | 'black'>(gameState.getCurrentPlayer());
  
  // 订阅状态变化
  const unsubscribe = gameState.subscribe((state) => {
    board.value = state.getBoard();
    currentPlayer.value = state.getCurrentPlayer();
  });
  
  onUnmounted(() => {
    unsubscribe();
  });
  
  return {
    board,
    currentPlayer,
    movePiece: (fromRow, fromCol, toRow, toCol) => 
      gameState.movePiece(fromRow, fromCol, toRow, toCol),
    undo: () => gameState.undo(),
    reset: () => gameState.reset(),
  };
}
```

### 3.4 重构3D组件

**当前问题**: `ChessBoard3D.vue` 仍然过大（~1000行）

**拆分方案**:
```
src/ui/components/ChessBoard/
├── Board3D.vue              # 主组件（协调器，<200行）
├── Scene3D.vue              # Three.js场景管理
├── BoardRenderer.vue        # 棋盘渲染
├── PieceRenderer.vue        # 棋子渲染
├── InteractionHandler.vue   # 交互处理
└── AIDisplay.vue           # AI思考提示
```

**Board3D.vue职责**:
- 协调各个子组件
- 监听游戏状态变化
- 处理用户输入事件

---

## 🌐 第四阶段：Web兼容性改造

**预计时间**: 2天  
**优先级**: 🟢 中

### 4.1 创建平台检测工具

**文件**: `src/adapters/platformDetector.ts`

```typescript
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' && 
         '__TAURI_INTERNALS__' in window;
}

export function getPlatformAdapter() {
  if (isTauriEnvironment()) {
    return new TauriAdapter();
  } else {
    return new WebAdapter();
  }
}
```

### 4.2 实现Web适配器

**文件**: `src/adapters/web/fileAdapter.ts`

**功能**:
- 使用Fetch API加载资源
- 使用localStorage存储配置
- 使用IndexedDB存储棋谱（可选）

**示例**:
```typescript
export class WebFileAdapter implements IPlatformAdapter {
  async resolvePath(path: string): Promise<string> {
    // Web环境下，路径直接作为URL使用
    if (path.startsWith('http')) {
      return path;
    }
    // 相对路径转换为完整URL
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
    // Web环境下无法直接列出目录
    // 返回预定义的文件列表或使用manifest文件
    throw new Error('Directory listing not supported in Web environment');
  }
  
  isTauri(): boolean {
    return false;
  }
}
```

### 4.3 条件编译或运行时分支

**策略**: 使用运行时检测而非编译时宏

**示例**:
```typescript
// 在engineService.ts中
import { getPlatformAdapter } from '../adapters/platformDetector';

const adapter = getPlatformAdapter();

export async function startEngine(): Promise<void> {
  if (adapter.isTauri()) {
    // Tauri环境：调用Rust后端
    await invoke('start_engine');
  } else {
    // Web环境：使用Web Worker或外部API
    console.warn('AI engine not available in Web mode');
  }
}
```

### 4.4 移除Tauri特定依赖

**需要处理的依赖**:
- `@tauri-apps/api` - 保留但条件使用
- `@tauri-apps/plugin-opener` - Web环境下禁用
- Rust后端调用 - 提供Mock实现

---

## 🧹 第五阶段：功能精简

**预计时间**: 1天  
**优先级**: 🟢 中

### 5.1 识别并移除冗余功能

**待评估功能**:
1. **3D文字几何体方案** - 已移除（Bug #19），确认代码已清理
2. **未使用的导入和函数** - 运行tree-shaking分析
3. **调试日志** - 移除或改为条件输出
4. **过时的注释** - 清理TODO和FIXME

### 5.2 优化依赖

**检查项**:
- 移除未使用的npm包
- 更新过时依赖
- 合并重复的工具函数

### 5.3 简化配置

**目标**: 减少配置项数量，提高易用性

**建议**:
- 合并相关的配置项
- 提供合理的默认值
- 移除 rarely-used 的高级选项

---

## 🧪 第六阶段：单元测试框架

**预计时间**: 2-3天  
**优先级**: 🟡 高

### 6.1 搭建测试环境

**技术选型**: Vitest + @vue/test-utils

**安装**:
```bash
npm install -D vitest @vue/test-utils jsdom
```

**配置文件**: `vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

### 6.2 编写核心逻辑测试

**测试优先级**:
1. **象棋规则验证** (`core/chess/rules.ts`)
2. **FEN解析/生成** (`core/chess/fen.ts`)
3. **游戏状态管理** (`core/game/gameState.ts`)
4. **资源管理器** (`services/resourceManager.ts`)

**示例测试**:
```typescript
// tests/unit/rules.test.ts
import { describe, it, expect } from 'vitest';
import { isValidMove, isInCheck } from '../../src/core/chess/rules';
import { initBoard } from '../../src/core/chess/constants';

describe('象棋规则验证', () => {
  it('车应该可以直线移动', () => {
    const board = initBoard();
    // 红方车在(9, 0)
    expect(isValidMove(board, 9, 0, 9, 3)).toBe(true);
    expect(isValidMove(board, 9, 0, 6, 0)).toBe(true);
  });
  
  it('马走日字', () => {
    const board = initBoard();
    // 红方马在(9, 1)
    expect(isValidMove(board, 9, 1, 7, 2)).toBe(true);
    expect(isValidMove(board, 9, 1, 7, 0)).toBe(true);
  });
  
  it('不能移动到己方棋子位置', () => {
    const board = initBoard();
    expect(isValidMove(board, 9, 0, 9, 1)).toBe(false); // 目标是己方马
  });
});
```

### 6.3 组件测试

**测试Vue组件**:
```typescript
// tests/unit/ChessBoard.test.ts
import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import Board3D from '../../src/ui/components/ChessBoard/Board3D.vue';

describe('Board3D组件', () => {
  it('应该正确渲染棋盘', () => {
    const wrapper = mount(Board3D);
    expect(wrapper.exists()).toBe(true);
  });
});
```

### 6.4 集成测试

**测试完整流程**:
- 新建游戏 → 走棋 → AI响应 → 将军检测
- 导入棋谱 → 回放 → 导出

---

## 📊 实施时间表

| 阶段 | 任务 | 预计时间 | 优先级 | 状态 |
|------|------|---------|--------|------|
| 1 | 统一资源访问层 | 2-3天 | 🔴 最高 | ⏳ 待开始 |
| 2 | 界面主题系统 | 2天 | 🟡 高 | ⏳ 待开始 |
| 3 | 代码结构重构 | 3-4天 | 🟡 高 | ⏳ 待开始 |
| 4 | Web兼容性改造 | 2天 | 🟢 中 | ⏳ 待开始 |
| 5 | 功能精简 | 1天 | 🟢 中 | ⏳ 待开始 |
| 6 | 单元测试框架 | 2-3天 | 🟡 高 | ⏳ 待开始 |
| **总计** | | **12-15天** | | |

---

## ✅ 验收标准

### 功能性验收
- [ ] 所有现有功能正常工作
- [ ] 资源加载无错误
- [ ] 主题切换流畅
- [ ] AI对战正常
- [ ] 棋谱导入/导出正常

### 代码质量验收
- [ ] 核心逻辑单元测试覆盖率 > 80%
- [ ] 无TypeScript编译错误
- [ ] ESLint检查通过
- [ ] 无明显的性能退化

### 架构验收
- [ ] 资源访问统一通过ResourceManager
- [ ] 业务逻辑与UI框架解耦
- [ ] 支持Tauri和Web双模式
- [ ] 主题系统可扩展

### 文档验收
- [ ] 更新README.md
- [ ] 编写架构说明文档
- [ ] 更新API文档
- [ ] 记录Breaking Changes

---

## ⚠️ 风险与应对

### 风险1: 重构过程中引入Bug
**应对**:
- 每完成一个小模块立即测试
- 保持Git提交频繁，便于回滚
- 编写回归测试

### 风险2: 性能下降
**应对**:
- 性能基准测试（重构前后对比）
- 使用Chrome DevTools监控性能
- 优化资源加载策略

### 风险3: 时间超支
**应对**:
- 优先完成P0级任务（资源管理、代码结构）
- P1/P2任务可延后
- 分阶段交付

---

## 📝 执行记录模板

每个阶段完成后填写：

### 阶段X: [阶段名称]
**完成时间**: YYYY-MM-DD  
**实际耗时**: X天  

**完成的任务**:
- [x] 任务1
- [x] 任务2

**遇到的问题**:
1. 问题描述
   - 解决方案: ...

**测试结果**:
- 单元测试: XX/XX 通过
- 手动测试: 通过/失败

**下一步计划**:
- ...

---

## 🔄 后续优化方向

1. **性能优化**
   - WebGL渲染优化
   - 资源懒加载
   - Web Worker处理AI计算

2. **功能增强**
   - 多人在线对战
   - 棋谱云端同步
   - AI训练功能

3. **用户体验**
   - 动画效果优化
   - 音效系统
   - 快捷键支持

4. **国际化**
   - 多语言支持
   - RTL布局

---

**最后更新**: 2026-05-06  
**维护者**: ChChess 开发团队  
**分支**: `refactor/architecture-optimization`
