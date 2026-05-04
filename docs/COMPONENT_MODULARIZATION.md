# ChessBoard3D 组件模块化架构说明

## 概述

为了提升代码可维护性和可读性，已将 `ChessBoard3D.vue` (超过1500行) 拆分为多个功能模块。每个模块专注于单一职责，便于测试和维护。

## 文件结构

```
src/components/3d/
├── ChessBoard3D.vue          # 原始大文件（保留作为备份）
├── ChessBoard3D_new.vue      # 重构后的主组件（整合所有模块）
├── useScene.ts               # Three.js 场景管理
├── useBoard.ts               # 棋盘创建和绘制
├── usePieces.ts              # 棋子创建和管理
├── useInteraction.ts         # 鼠标交互和拖动
├── useAI.ts                  # AI 引擎集成
└── useGameState.ts           # 游戏状态管理（将军/绝杀提示）
```

## 模块详细说明

### 1. useScene.ts - 场景管理模块

**职责**: Three.js 场景初始化、渲染循环、相机控制

**导出函数**:
- `useScene(container)`: 创建场景管理器
  - `initScene()`: 初始化场景、相机、渲染器、控制器
  - `onWindowResize()`: 处理窗口大小变化
  - `resetCameraView()`: 重置相机视角到默认位置
  - `dispose()`: 清理资源

**使用示例**:
```typescript
const sceneManager = useScene(container);
const sceneData = await sceneManager.initScene();
```

### 2. useBoard.ts - 棋盘管理模块

**职责**: 棋盘几何体创建、纹理加载、线条绘制

**导出常量**:
- `BOARD_WIDTH`, `BOARD_HEIGHT`, `CELL_SIZE`: 棋盘尺寸配置

**导出函数**:
- `createBoard(scene, texturePath, container, lineMaterials)`: 创建棋盘
- `createThickLine(points, color, lineWidth, container, lineMaterials)`: 创建粗线
- `createWoodTexture()`: 创建木纹纹理

**特点**:
- 支持 PBR 材质（法线贴图、粗糙度贴图）
- 异步加载 EXR 格式纹理
- 自动降级到默认颜色

### 3. usePieces.ts - 棋子管理模块

**职责**: 棋子几何体创建、纹理生成、位置同步

**导出函数**:
- `createPieceMesh(piece, row, col, pieceShape, opponentTextDirection)`: 创建单个棋子
- `createPieces(scene, board, pieceShape, opponentTextDirection)`: 创建所有棋子
- `syncPiecesWithBoard(piecesGroup, scene, board, pieceShape, opponentTextDirection)`: 同步棋盘状态
- `resetPiecePosition(pieceMesh, pieceShape)`: 重置棋子位置
- `animatePieceMove(pieceMesh, targetX, targetZ, duration)`: 平滑移动动画
- `getPieceChineseName(piece)`: 获取棋子中文名称
- `createPieceTexture(piece, isRed)`: 创建棋子文字纹理

**支持的棋子形状**:
- `cylinder`: 柱型（圆柱体）
- `standard`: 鼓型（旋转曲面）

### 4. useInteraction.ts - 交互管理模块

**职责**: 鼠标事件处理、射线检测、棋子拖动

**导出函数**:
- `useInteraction(...)`: 创建交互管理器
  - `setupEventListeners()`: 设置鼠标事件监听
  - `cleanup()`: 清理事件监听
  - `getDraggedPiece()`: 获取当前拖动的棋子

**交互流程**:
1. `mousedown`: 检测棋子，开始拖动
2. `mousemove`: 更新棋子位置
3. `mouseup`: 验证移动，执行或取消

**特性**:
- 支持修饰键控制相机（Alt/Ctrl/Shift）
- 自动禁用死子拖动
- 验证行棋合法性

### 5. useAI.ts - AI 引擎模块

**职责**: Pikafish 引擎通信、着法执行

**导出函数**:
- `useAI(chessStore, piecesGroup, executeMoveCallback, checkCheckAndCheckmateCallback)`: 创建 AI 管理器
  - `triggerAIMove()`: 触发 AI 行棋
  - `executeAIMove(fromRow, fromCol, toRow, toCol)`: 执行 AI 移动
  - `isAIThinking`: 响应式变量，表示 AI 是否正在思考

**工作流程**:
1. 启动引擎（如果未启动）
2. 获取当前 FEN
3. 调用 `getBestMove()` 获取最佳着法
4. 转换 UCI 坐标为内部坐标
5. 执行移动并检查将军/绝杀
6. 支持双 AI 连续对战

### 6. useGameState.ts - 游戏状态模块

**职责**: 将军/绝杀检测、提示显示

**导出函数**:
- `useGameState(chessStore)`: 创建状态管理器
  - `checkCheckAndCheckmate(movedToRow, movedToCol)`: 检查将军/绝杀
  - `displayCheckAlert()`: 显示将军提示
  - `displayCheckmateAlert()`: 显示绝杀提示
  - `showAIThinkingHint()`: 显示 AI 思考提示
  - `hideCheckAlert()`: 隐藏提示
  - `cleanup()`: 清理定时器

**响应式变量**:
- `showCheckAlert`: 是否显示将军/绝杀提示
- `alertImage`: 提示图片路径
- `showAIHint`: 是否显示 AI 思考提示

## 主组件 ChessBoard3D_new.vue

**职责**: 整合所有模块，协调各模块间的交互

**主要功能**:
1. 初始化场景和模块
2. 监听棋盘状态变化，同步 3D 视图
3. 监听配置变化，动态更新纹理和棋子形状
4. 监听玩家切换，自动触发 AI 行棋
5. 处理键盘快捷键（Ctrl+H 重置视角）

**模块依赖关系**:
```
ChessBoard3D_new.vue
├── useScene (场景初始化)
├── useBoard (创建棋盘)
├── usePieces (创建棋子)
├── useInteraction (处理交互)
├── useAI (AI 引擎)
└── useGameState (状态提示)
```

## 迁移指南

### 从旧版本迁移

1. **备份原文件**:
   ```bash
   cp ChessBoard3D.vue ChessBoard3D_backup.vue
   ```

2. **替换主组件**:
   ```bash
   mv ChessBoard3D_new.vue ChessBoard3D.vue
   ```

3. **验证功能**:
   - 测试棋盘渲染
   - 测试棋子拖动
   - 测试 AI 对战
   - 测试将军/绝杀提示

### 优势

✅ **代码量减少**: 主组件从 1500+ 行减少到 ~400 行  
✅ **职责清晰**: 每个模块专注于单一功能  
✅ **易于测试**: 可以独立测试每个模块  
✅ **便于维护**: 修改某个功能只需关注对应模块  
✅ **类型安全**: TypeScript 类型定义完整  

## 注意事项

1. **模块间通信**: 通过回调函数和共享状态实现
2. **资源清理**: 确保在 `onBeforeUnmount` 中清理所有定时器和事件监听
3. **异步操作**: 注意 `async/await` 的错误处理
4. **响应式更新**: 使用 Vue 的 `watch` 监听状态变化

## 未来优化方向

1. **提取常量**: 将魔法数字提取为常量
2. **单元测试**: 为每个模块编写单元测试
3. **性能优化**: 使用 Web Worker 处理 AI 计算
4. **国际化**: 支持多语言提示文本
5. **主题系统**: 支持动态切换棋盘主题

---

**创建日期**: 2026-05-05  
**作者**: Lingma Assistant  
**版本**: 1.0.0
