# 中国象棋客户端 - 执行进度记录

## 📅 当前日期：2026-05-03

---

## 🐛 Bug 修复记录

### Bug #1：Vue 组件导入路径错误 ✓
**发现时间：** 2026-05-03 20:00  
**严重等级：** 🔴 高（导致应用无法启动）

**问题描述：**
```
Failed to resolve import "../store/chessStore" from "src/components/3d/ChessBoard3D.vue"
```

**根本原因：**
从 `src/components/3d/` 目录引用 `src/store/` 和 `src/logic/` 时，使用了错误的相对路径 `../`，应该是 `../../`。

**影响范围：**
- `src/components/3d/ChessBoard3D.vue` 无法加载
- Vite 开发服务器报错
- 前端页面无法显示

**解决方案：**
修改 `ChessBoard3D.vue` 中的导入语句：
``typescript
// 修改前 ❌
import { useChessStore } from '../store/chessStore';
import { PIECES } from '../logic/chess/constants';

// 修改后 ✅
import { useChessStore } from '../../store/chessStore';
import { PIECES, type PieceType } from '../../logic/chess/constants';
```

**验证方法：**
刷新浏览器，确认没有导入错误。

**状态：** ✅ 已修复

---

### Bug #2：棋盘底座尺寸计算错误 ✓
**发现时间：** 2026-05-03 20:05  
**严重等级：** 🟡 中（视觉效果问题）

**问题描述：**
用户反馈"棋盘多一行多一列"，棋盘底座比实际棋盘线大，边界不匹配。

**根本原因：**
棋盘底座尺寸计算公式错误：
``typescript
// 错误公式
const boardWidth = BOARD_WIDTH * CELL_SIZE + BOARD_MARGIN * 2;
const boardHeight = BOARD_HEIGHT * CELL_SIZE + BOARD_MARGIN * 2;
```

这个公式计算的是 9×10 个单元格的总宽度，但实际棋盘线只有 8 个间隔（9条线）和 9 个间隔（10条线）。

**影响范围：**
- 棋盘底座超出棋盘线边界
- 视觉效果不协调
- 棋子位置可能偏移

**解决方案：**
修正棋盘底座尺寸计算：
``typescript
// 正确公式 ✅
// 棋盘有 9 列（8个间隔），10 行（9个间隔）
const boardWidth = (BOARD_WIDTH - 1) * CELL_SIZE + BOARD_MARGIN * 2;
const boardHeight = (BOARD_HEIGHT - 1) * CELL_SIZE + BOARD_MARGIN * 2;
```

**验证方法：**
检查棋盘底座边缘是否与最外侧的棋盘线对齐。

**状态：** ✅ 已修复

---

### Bug #3：棋子上缺少文字标识 ✓
**发现时间：** 2026-05-03 20:10  
**严重等级：** 🟡 中（功能缺失）

**问题描述：**
用户反馈"棋子上没有字体"，所有棋子都是纯色圆柱体，无法区分具体棋子类型。

**根本原因：**
初始实现只创建了纯色圆柱体几何体，没有添加文字贴图。

**影响范围：**
- 无法识别棋子类型（车、马、炮等）
- 游戏体验差
- 不符合中国象棋传统

**解决方案：**
实现了完整的棋子文字贴图系统：

1. **创建文字纹理生成函数** `createPieceTexture()`：
``typescript
function createPieceTexture(piece: PieceType, isRed: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const size = 128;
  canvas.width = size;
  canvas.height = size;
  
  const ctx = canvas.getContext('2d');
  
  // 米黄色背景
  ctx.fillStyle = '#F5DEB3';
  ctx.fillRect(0, 0, size, size);
  
  // 圆形边框
  ctx.strokeStyle = isRed ? '#CC0000' : '#000000';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
  ctx.stroke();
  
  // 中文棋子名称
  const pieceName = getPieceChineseName(piece);
  ctx.font = 'bold 72px "KaiTi", "STKaiti", "SimSun", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isRed ? '#CC0000' : '#000000';
  ctx.fillText(pieceName, size / 2, size / 2 + 4);
  
  return new THREE.CanvasTexture(canvas);
}
```

2. **实现中文字符映射** `getPieceChineseName()`：
``typescript
function getPieceChineseName(piece: PieceType): string {
  const names: Record<number, string> = {
    1: '帅', 2: '车', 3: '马', 4: '炮', 5: '仕', 6: '相', 7: '兵',
    '-1': '将', '-2': '车', '-3': '马', '-4': '炮', 
    '-5': '士', '-6': '象', '-7': '卒',
  };
  return names[piece] || '';
}
```

3. **应用多材质**：
   - 顶部：带文字的 CanvasTexture
   - 侧面：渐变色材质
   - 底部：深色基底

**验证方法：**
检查每个棋子顶部是否显示正确的中文字符。

**状态：** ✅ 已修复

---

### Bug #4：棋盘线数量绘制错误 ✓
**发现时间：** 2026-05-03 20:15  
**严重等级：** 🔴 高（核心功能错误）

**问题描述：**
用户反馈"棋盘画了十个格子线，线画的不对"。棋盘线数量错误，导致棋盘结构不正确。

**根本原因：**
中国象棋棋盘的正确结构是：
- **9 条竖线**（从左到右，索引 0-8）
- **10 条横线**（从上到下，索引 0-9）
- 形成 **8列 × 9行** 的格子
- 棋子放在 **9 × 10 = 90 个交叉点**上

但之前的代码错误地绘制了：
``typescript
// 错误代码 ❌
// 绘制了 11 条横线（0-10）
for (let i = 0; i <= BOARD_HEIGHT; i++) { ... }

// 绘制了 10 条竖线（0-9）
for (let i = 0; i <= BOARD_WIDTH; i++) { ... }
```

**影响范围：**
- 棋盘线数量错误
- 棋盘边界不正确
- 棋子位置与棋盘线不对齐
- 九宫格位置错误
- 楚河汉界位置错误

**解决方案：**
全面修正棋盘线绘制逻辑：

``typescript
// 正确代码 ✅
function drawBoardLines() {
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
  
  // 棋盘线的起始位置
  const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
  const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;

  // 绘制横线（10条，从 0 到 9）
  for (let i = 0; i < BOARD_HEIGHT; i++) {
    const points = [];
    points.push(new THREE.Vector3(startX, 0.01, startZ + i * CELL_SIZE));
    points.push(new THREE.Vector3(
      startX + (BOARD_WIDTH - 1) * CELL_SIZE, 
      0.01, 
      startZ + i * CELL_SIZE
    ));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, lineMaterial);
    boardGroup.add(line);
  }

  // 绘制竖线（9条，从 0 到 8）
  for (let i = 0; i < BOARD_WIDTH; i++) {
    const points = [];
    
    // 上半部分（从第 0 行到第 4 行）
    points.push(new THREE.Vector3(startX + i * CELL_SIZE, 0.01, startZ));
    points.push(new THREE.Vector3(startX + i * CELL_SIZE, 0.01, startZ + 4 * CELL_SIZE));
    let geometry = new THREE.BufferGeometry().setFromPoints(points);
    let line = new THREE.Line(geometry, lineMaterial);
    boardGroup.add(line);
    
    // 下半部分（从第 5 行到第 9 行）
    points.length = 0;
    points.push(new THREE.Vector3(startX + i * CELL_SIZE, 0.01, startZ + 5 * CELL_SIZE));
    points.push(new THREE.Vector3(
      startX + i * CELL_SIZE, 
      0.01, 
      startZ + (BOARD_HEIGHT - 1) * CELL_SIZE
    ));
    geometry = new THREE.BufferGeometry().setFromPoints(points);
    line = new THREE.Line(geometry, lineMaterial);
    boardGroup.add(line);
  }
  
  // ... 九宫格和楚河汉界
}
```

同时同步修正棋子位置计算：
``typescript
// updatePieces() 中的起始位置也要一致
const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;
```

**验证方法：**
1. 数一下棋盘线：应该是 9 条竖线 + 10 条横线
2. 检查棋子是否准确落在交叉点上
3. 检查九宫格是否在第 3-5 列、第 0-2 行和第 7-9 行
4. 检查楚河汉界是否在第 4-5 行之间

**状态：** ✅ 已修复

---

### Bug #5：楚河汉界绘制不明显 ✓
**发现时间：** 2026-05-03 20:20  
**严重等级：** 🟢 低（视觉效果优化）

**问题描述：**
用户反馈"楚河汉界画的不对"。楚河汉界只显示为一条细线，不够明显。

**根本原因：**
Three.js 的 `LineBasicMaterial` 不支持 `linewidth` 属性（在 WebGL 中通常被忽略），所以设置的线宽无效。

**影响范围：**
- 楚河汉界不够醒目
- 不符合传统象棋棋盘样式

**解决方案：**
使用两条平行线来表示楚河汉界，使其更加明显：

``typescript
// 改进后的楚河汉界绘制 ✅
const riverY = startZ + 4.5 * CELL_SIZE;
const riverOffset = 0.15; // 两条线的偏移量

// 第一条线（上方）
const riverPoints1 = [];
riverPoints1.push(new THREE.Vector3(startX, 0.01, riverY - riverOffset));
riverPoints1.push(new THREE.Vector3(
  startX + (BOARD_WIDTH - 1) * CELL_SIZE, 
  0.01, 
  riverY - riverOffset
));
const riverGeometry1 = new THREE.BufferGeometry().setFromPoints(riverPoints1);
const riverLine1 = new THREE.Line(riverGeometry1, lineMaterial);
boardGroup.add(riverLine1);

// 第二条线（下方）
const riverPoints2 = [];
riverPoints2.push(new THREE.Vector3(startX, 0.01, riverY + riverOffset));
riverPoints2.push(new THREE.Vector3(
  startX + (BOARD_WIDTH - 1) * CELL_SIZE, 
  0.01, 
  riverY + riverOffset
));
const riverGeometry2 = new THREE.BufferGeometry().setFromPoints(riverPoints2);
const riverLine2 = new THREE.Line(riverGeometry2, lineMaterial);
boardGroup.add(riverLine2);
```

**效果：**
- 两条平行线间距 0.3 个单位
- 视觉上更像一个"河道"
- 更符合传统象棋棋盘的楚河汉界样式

**验证方法：**
检查楚河汉界是否显示为两条平行线，位于第 4 行和第 5 行之间。

**状态：** ✅ 已修复

---

### Bug #6：棋子文字朝向错误 ✓
**发现时间：** 2026-05-03 20:25  
**严重等级：** 🟡 中（用户体验问题）

**问题描述：**
用户反馈"棋子字体的方向不对，字体朝向都是向右的，正确的字体应该是都朝向楚河汉界"。

第一次修复后，用户再次反馈："你把红色的旋转了 180度，黑色没有变"，说明旋转逻辑反了。

**根本原因：**
Three.js 中圆柱体的顶部纹理默认朝向需要正确理解。在俯视视角下：
- **黑方棋子**（在棋盘上方，row 0-4）：文字应该朝下（朝向楚河汉界），需要旋转 180°
- **红方棋子**（在棋盘下方，row 5-9）：文字应该朝上（朝向楚河汉界），不需要旋转

第一次修复时逻辑搞反了，导致红方被旋转而黑方没有。

**影响范围：**
- 棋子文字方向不正确
- 不符合传统象棋习惯
- 用户体验差

**解决方案：**
修正 `updatePieces()` 函数中的旋转逻辑：

``typescript
// 设置棋子文字朝向：都朝向楚河汉界（棋盘中心）
const isRed = piece > 0;

if (!isRed && row < 5) {
  // 黑方棋子在上半部分，文字需要朝下（朝向楚河汉界）
  pieceMesh.rotation.y = Math.PI;  // ✅ 旋转 180 度
} else if (isRed && row >= 5) {
  // 红方棋子在下半部分，文字需要朝上（朝向楚河汉界）
  pieceMesh.rotation.y = 0;  // ✅ 不旋转
} else if (!isRed && row >= 5) {
  // 黑方棋子在下半部分（特殊情况），文字朝上
  pieceMesh.rotation.y = 0;
} else {
  // 红方棋子在上半部分（特殊情况），文字朝下
  pieceMesh.rotation.y = Math.PI;
}
```

**关键修正点：**
- ❌ 之前：红方旋转 180°，黑方不旋转（错误）
- ✅ 现在：黑方旋转 180°，红方不旋转（正确）

**验证方法：**
1. 黑方棋子（上半部分）的文字应该朝下（面向玩家）
2. 红方棋子（下半部分）的文字应该朝上（面向玩家）
3. 从相机俯视角度看，所有文字都应该正立可读

**状态：** ✅ 已修复（第二次修正）

---

## 📊 Bug 修复统计

| Bug ID | 严重程度 | 状态 | 修复时间 |
|--------|---------|------|---------|
| #1 | 🔴 高 | ✅ 已修复 | 20:00 |
| #2 | 🟡 中 | ✅ 已修复 | 20:05 |
| #3 | 🟡 中 | ✅ 已修复 | 20:10 |
| #4 | 🔴 高 | ✅ 已修复 | 20:15 |
| #5 | 🟢 低 | ✅ 已修复 | 20:20 |
| #6 | 🟡 中 | ✅ 已修复 | 20:25 |

**总计：** 6 个 Bug，全部修复完成 ✅

---

## ✅ 已完成的工作

### **第一阶段：项目初始化与基础框架** ✓

#### 步骤 1.1：初始化 Tauri + Vue 项目结构 ✓
- ✅ 使用 `npm create tauri-app` 创建了 Tauri + Vue + TypeScript 项目
- ✅ 项目名称：tauri-app
- ✅ 标识符：com.yanite.chchess

#### 步骤 1.2：创建项目目录结构 ✓
已创建以下目录：
```
src/
├── components/
│   └── 3d/                    # Three.js 3D 组件
│       └── ChessBoard3D.vue  # 3D 棋盘组件
├── logic/
│   └── chess/                 # 象棋逻辑
│       ├── constants.ts      # 常量定义
│       └── rules.ts          # 规则校验（空实现）
├── store/                     # Pinia 状态管理
│   ├── index.ts              # Store 入口
│   └── chessStore.ts         # 棋局状态管理
├── layouts/                   # 布局组件（预留）
├── composables/               # 组合式函数（预留）
└── assets/
    └── models/                # 3D 模型（预留）
```

#### 步骤 1.3：安装必要的依赖包 ✓
已安装的依赖：
- ✅ three (0.184.0) - 3D 渲染
- ✅ @types/three - Three.js 类型定义
- ✅ pinia (3.0.4) - 状态管理
- ✅ vue-router (5.0.6) - 路由（预留）
- ✅ @tauri-apps/api (2.x) - Tauri API
- ✅ @tauri-apps/plugin-opener (2.x) - Tauri 插件

---

### **第二阶段：前端核心 - 棋盘数据结构与状态管理** ✓

#### 步骤 2.1：实现棋盘常量定义和数据结构 ✓
文件：`src/logic/chess/constants.ts`
- ✅ 定义了 PIECES 常量（红方正数，黑方负数）
- ✅ 定义了棋子名称映射 PIECE_NAMES
- ✅ 定义了棋盘尺寸常量（BOARD_ROWS = 10, BOARD_COLS = 9）
- ✅ 实现了 initBoard() 函数初始化棋盘
- ✅ 实现了坐标转换函数：boardToUCI() 和 UCIToBoard()
- ✅ 实现了 getPieceColor() 获取棋子颜色

#### 步骤 2.2：实现棋局状态管理（Pinia）✓
文件：`src/store/chessStore.ts`
- ✅ 定义了 MoveRecord 接口（着法记录）
- ✅ 定义了 GameState 接口（游戏状态）
- ✅ 实现了核心状态：
  - board: 棋盘数组
  - currentPlayer: 当前行棋方
  - moveHistory: 着法历史
  - selectedPiece: 选中的棋子
  - gameStatus: 游戏状态
  - winner: 获胜方
  - redTime/blackTime: 双方时间
- ✅ 实现了计算属性：
  - fen: FEN 串生成
  - canUndo: 是否可悔棋
- ✅ 实现了核心方法：
  - selectPiece(): 选择棋子
  - movePiece(): 移动棋子（基础版本）
  - undoMove(): 悔棋
  - resetGame(): 重置游戏
  - generateFEN(): 生成 FEN 串
  - loadFromFEN(): 从 FEN 加载（TODO）

#### 步骤 2.3：实现基础的行棋接口 ✓
- ✅ 走棋功能（movePiece）
- ✅ 悔棋功能（undoMove）
- ⏸️ 让一手功能（待实现）
- ⏸️ 走棋计时功能（状态已定义，逻辑待实现）
- ⏸️ 摆棋功能（待实现）

#### 步骤 2.4：实现 FEN 串解析和生成 ✓
- ✅ 实现了 generateFEN() 生成 FEN 串
- ⏸️ loadFromFEN() 已创建框架，待完善实现

---

### **第三阶段：前端核心 - 规则校验（空实现占位）** ✓

#### 步骤 3.1：创建规则校验接口框架 ✓
文件：`src/logic/chess/rules.ts`
- ✅ isValidMove(): 验证移动合法性（空实现，返回 true）
- ✅ isInCheck(): 检查是否被将军（空实现，返回 false）
- ✅ checkGameEnd(): 检查游戏结束（空实现，返回 'playing'）
- ✅ getValidMoves(): 获取合法移动列表（空实现）
- 📝 所有函数都有详细的 TODO 注释说明需要实现的功能

---

### **第四阶段：Three.js 3D 渲染基础** ✓

#### 步骤 4.1：搭建 Three.js 基础场景 ✓
文件：`src/components/3d/ChessBoard3D.vue`
- ✅ 创建了 Scene、Camera、Renderer
- ✅ 添加了 OrbitControls 轨道控制器
- ✅ 设置了灯光系统（环境光 + 方向光）

#### 步骤 4.2：渲染棋盘 ✓
- ✅ 使用 BoxGeometry 创建棋盘底座
- ✅ 绘制了棋盘线（横线、竖线）
- ✅ 绘制了九宫格斜线
- ✅ 绘制了楚河汉界
- ✅ 棋盘边缘留了半个棋子尺寸的边距
- ✅ **已修复**：棋盘底座尺寸计算，使其与棋盘线正确匹配

#### 步骤 4.3：渲染棋子 ✓
- ✅ 使用 CylinderGeometry 创建圆柱体棋子
- ✅ 根据棋子颜色设置不同颜色（红方红色，黑方黑色）
- ✅ 棋子尺寸按棋盘大小计算
- ✅ **已添加**：棋子文字贴图功能
  - 使用 CanvasTexture 动态生成带文字的纹理
  - 顶部显示中文棋子名称（帅、将、车、马等）
  - 圆形边框装饰
  - 红方红色文字，黑方黑色文字
- ✅ **已优化**：棋子使用多材质（顶部、侧面、底部不同颜色）

#### 步骤 4.4：实现射线检测交互 ✓
- ✅ 实现了 Raycaster 射线检测
- ✅ 实现了鼠标点击选子功能
- ✅ 实现了点击落子功能
- ✅ 实现了选中棋子高亮效果
- ✅ 集成了 chessStore 的状态管理

---

### **第五阶段：UI 布局框架** ✓

#### 步骤 5.1：实现自适应布局 ✓
文件：`src/App.vue`
- ✅ 顶部菜单栏：新游戏、悔棋按钮、游戏信息显示
- ✅ 左侧边栏：着法记录列表
- ✅ 中间主窗口：3D 棋盘
- ✅ 右侧边栏：局势分析（预留）
- ✅ 底部状态栏：时间显示、着法数、游戏状态

#### 步骤 5.2：实现 3D/2D 切换功能 ⏸️
- ⏸️ 目前只实现了 3D 模式
- ⏸️ 2D SVG 模式预留（后续实现）

---

## 🔧 已修复的问题

### 问题 1：导入路径错误 ✓
**错误信息：**
```
Failed to resolve import "../store/chessStore" from "src/components/3d/ChessBoard3D.vue"
```

**原因：** 
从 `src/components/3d/` 目录引用 `src/store/` 和 `src/logic/` 时，相对路径应该是 `../../` 而不是 `../`

**解决方案：**
修改了 `ChessBoard3D.vue` 中的导入路径：
``typescript
// 修改前
import { useChessStore } from '../store/chessStore';
import { PIECES } from '../logic/chess/constants';

// 修改后
import { useChessStore } from '../../store/chessStore';
import { PIECES } from '../../logic/chess/constants';
```

**状态：** ✅ 已修复

---

### 问题 2：棋盘线绘制错误 ✓
**问题描述：**
用户反馈棋盘画了十个格子线，线画得不对

**原因分析：**
中国象棋棋盘应该是：
- **9 条竖线**（形成 8 列）
- **10 条横线**（形成 9 行）
- 棋子放在 **9 × 10 = 90 个交叉点**上

但之前的代码错误地绘制了：
- 11 条横线（`i <= BOARD_HEIGHT`，即 0-10）
- 10 条竖线（`i <= BOARD_WIDTH`，即 0-9）

**解决方案：**
修正了 `drawBoardLines()` 函数：

```
// 修改前（错误）
const startX = -(BOARD_WIDTH * CELL_SIZE) / 2;
const startZ = -(BOARD_HEIGHT * CELL_SIZE) / 2;

// 绘制横线（11条）
for (let i = 0; i <= BOARD_HEIGHT; i++) { ... }

// 绘制竖线（10条）
for (let i = 0; i <= BOARD_WIDTH; i++) { ... }

// 修改后（正确）
const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;

// 绘制横线（10条，从 0 到 9）
for (let i = 0; i < BOARD_HEIGHT; i++) { ... }

// 绘制竖线（9条，从 0 到 8）
for (let i = 0; i < BOARD_WIDTH; i++) { ... }
```

同时修正了棋子位置计算，使其与棋盘线对齐。

**状态：** ✅ 已修复

---

### 问题 3：棋子上没有字体 ✓
**问题描述：**
用户反馈棋子上没有显示中文字符

**原因：**
初始实现只创建了纯色圆柱体，没有添加文字贴图

**解决方案：**
实现了完整的棋子文字贴图功能：

1. **创建文字纹理函数** `createPieceTexture()`：
   - 使用 HTML5 Canvas 动态生成纹理
   - 绘制米黄色背景
   - 绘制圆形边框（红方红色，黑方黑色）
   - 绘制中文棋子名称（使用楷体字体）
   - 返回 CanvasTexture

2. **创建棋子网格函数** `createPieceMesh()`：
   - 为圆柱体的不同面应用不同材质
   - 顶部：带文字的纹理贴图
   - 侧面：渐变色（红方浅红，黑方深灰）
   - 底部：深色（增加立体感）

3. **中文字符映射** `getPieceChineseName()`：
   - 红方：帅、车、马、炮、仕、相、兵
   - 黑方：将、车、马、炮、士、象、卒

**状态：** ✅ 已修复

---

## ⚠️ 当前阻塞问题

### Rust 编译链接器错误
**错误信息：**
```
error: linking with `link.exe` failed: exit code: 1
note: /usr/bin/link: extra operand
```

**原因：** 
系统使用了 Git Bash 的 `/usr/bin/link.exe` 而不是 Visual Studio 的 MSVC 链接器

**影响：**
- Tauri 桌面应用无法启动
- 但 Vite 前端开发服务器正常运行（http://localhost:1420/）

**解决方案（待实施）：**
1. 确保安装了 Visual Studio Build Tools
2. 配置环境变量，使 MSVC 工具链优先于 Git 工具
3. 或者在 PowerShell/CMD 中运行而非 Git Bash

**临时方案：**
可以先通过浏览器访问 http://localhost:1420/ 测试前端功能

---

## 📋 下一步计划

### **第六阶段：Rust 后端 - UCI 引擎通信**

#### 前置条件：解决 Rust 编译环境问题
- [ ] 确认 Visual Studio Build Tools 已安装
- [ ] 配置正确的链接器路径
- [ ] 重新编译 Tauri 项目

#### 步骤 6.1：创建 Rust 引擎交互模块
- [ ] 创建 `src-tauri/src/engine.rs`
- [ ] 定义 EngineState 结构体
- [ ] 实现启动引擎函数

#### 步骤 6.2：实现启动/停止引擎功能
- [ ] 使用 std::process::Command 启动 pikafish.exe
- [ ] 实现 stdin/stdout 异步监听
- [ ] 实现停止引擎功能

#### 步骤 6.3：实现发送着法和接收分析功能
- [ ] 实现 send_move() 发送着法
- [ ] 实现 get_analysis() 获取分析
- [ ] 解析 UCI 协议响应

#### 步骤 6.4：注册 Tauri Commands
- [ ] 在 main.rs 中注册命令
- [ ] start_engine
- [ ] stop_engine
- [ ] send_move
- [ ] get_analysis

---

## 📊 技术要点记录

### 坐标系统
- 前端棋盘：board[row][col]，row: 0-9, col: 0-8
- UCI 坐标：文件 a-i（x），等级 0-9（y）
- 转换函数：boardToUCI() 和 UCIToBoard()

### 棋子表示
- 红方：正数（1-7）
- 黑方：负数（-1 到 -7）
- 空位：0

### Three.js 场景配置
- 相机位置：(0, 12, 12)，俯视角度
- 棋盘尺寸：9 × 10 个单元格
- 单元格大小：CELL_SIZE = 1
- 边缘留白：BOARD_MARGIN = 0.5

### Vue 组件路径规范
- 从 `src/components/3d/` 引用 `src/store/` 或 `src/logic/` 需要使用 `../../`
- 从 `src/components/` 引用同级目录使用 `./`
- 从 `src/components/` 引用父级目录使用 `../`

### CanvasTexture 文字贴图技术
- 使用 HTML5 Canvas 动态生成纹理
- 支持自定义字体、颜色、大小
- 适用于需要在 3D 对象上显示文字的场景
- 注意：Canvas 尺寸最好是 2 的幂次方（如 128x128、256x256）以获得最佳性能

### 棋盘尺寸计算要点
- 中国象棋棋盘：9 列 × 10 行
- 棋盘线数量：10 条竖线（0-9），11 条横线（0-10）
- 棋盘交叉点：9 × 10 = 90 个
- 底座尺寸应基于交叉点间距计算：`(列数-1) * CELL_SIZE`

---

## 🎯 当前状态总结

### ✅ 已完成
1. **前端完整框架搭建完成**
   - 项目结构和依赖安装
   - 棋盘数据结构和状态管理
   - 3D 渲染和交互
   - UI 布局和组件

2. **关键 Bug 修复**
   - 导入路径错误已修复
   - 棋盘尺寸问题已修复
   - 棋子文字贴图已添加

3. **视觉效果优化**
   - 棋子带中文名称显示
   - 多材质应用（顶部、侧面、底部）
   - 圆形边框装饰
   - 红黑双方颜色区分

### ⏳ 进行中
- Rust 编译环境问题待解决

### 🌐 可测试功能
虽然 Tauri 桌面应用暂时无法启动，但可以通过浏览器访问前端：
- **URL**: http://localhost:1420/
- **可测试功能**：
  - ✅ 3D 棋盘渲染（正确尺寸）
  - ✅ 带文字的棋子（中文名称）
  - ✅ 点击选子和落子
  - ✅ 基本的走棋功能
  - ✅ 悔棋功能
  - ✅ 着法记录显示
  - ✅ FEN 串生成
  - ✅ 鼠标旋转和缩放视角

### 📝 备注
- Pikafish 引擎路径未写死，后期可通过配置调整
- 规则校验采用渐进式开发，先空实现占位
- 3D 模型使用基本几何体 + Canvas 文字贴图
- 代码遵循模块化原则，便于后续扩展
- **下一步重点**：解决 Rust 编译环境问题，然后继续开发后端 UCI 引擎通信模块
