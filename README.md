# Tauri + Vue + TypeScript - 中国象棋 3D 游戏

这是一个基于 Tauri + Vue 3 + Three.js 构建的 3D 中国象棋游戏，支持人机对战（AI 使用 Pikafish 引擎）。

## pikafish 选项

https://www.pikafish.com/wiki/index.php?title=UCI%E9%80%89%E9%A1%B9

uci：初始化指令。发送后，引擎会返回作者信息、选项列表，并以 uciok 结尾表示准备就绪。
isready：同步指令。引擎处理完之前的任务后会返回 readyok。
setoption name <选项名> value <值>：
   配置参数。
   例如：setoption name Threads value 16（设置线程数为 16）。
   例如：setoption name Hash value 2048（设置哈希表大小）
   
position startpos moves <走法列表>：设置局面。
moves 后接已经走过的招法（如 e2e4），引擎会自动推导出当前盘面。
也可以直接输入 FEN 串position fen <FEN字符串>。
go：开始计算。
go movetime 1000：计算 1000 毫秒后输出结果。
go depth 20：计算到深度 20 层。
stop：强制引擎停止计算并立即返回结果。
quit：关闭并退出引擎程序。
3. 解析输出引擎在接收到 go 指令后，会持续输出搜索进度（info depth ... score cp ...）。
当计算完成时，它会发送：bestmove <走法>：告诉你它认为的最佳着法。

## 🎮 功能特性

![屏幕截图](./docs/屏幕截图%202026-05-06%20171512.png "屏幕截图")

- ✅ 完整的 3D 棋盘渲染和交互
- ✅ 中国象棋规则验证（包括将军、绝杀检测）
- ✅ AI 对战支持（Pikafish 引擎）
- ✅ UCI 协议通信
- ✅ 实时着法记录
- ✅ 棋子拖拽移动

## 🚀 快速开始

### 前置要求

- Node.js 16+
- Rust 工具链（包含 MSVC 编译器）
- Visual Studio Build Tools（Windows）

### 安装依赖

```bash
npm install
```

### 开发模式

**重要：** 必须在 PowerShell、CMD 或 Visual Studio Developer Command Prompt 中运行，**不要使用 Git Bash**。

```bash
npm run tauri dev
```

### 构建发布版本

```bash
npm run tauri build
```

## 🤖 AI 引擎集成

### Pikafish 引擎

本项目集成了 [Pikafish](http://pikafish.com) 中国象棋引擎，这是目前最强大的免费开源象棋引擎之一。

**引擎文件位置：** `public/pikafish/pikafish-vnni512.exe`

**支持的 CPU 指令集：**
- vnni512（推荐，性能最佳）
- avx512, avxvnni, bmi2, avx2, sse41-popcnt

根据您的 CPU 选择合适的引擎版本。

### AI 对战模式

- **红方：** 人类玩家
- **黑方：** AI（Pikafish）
- **搜索深度：** 默认 15 层

### 技术实现

#### 架构设计

```
前端 (Vue 3)          后端 (Rust/Tauri)        外部进程
┌─────────────┐      ┌────────────────┐      ┌──────────────┐
│ ChessBoard  │──────│ engine.rs      │──────│ Pikafish     │
│ 3D.vue      │      │ - start_engine │      │ .exe         │
│             │◄─────│ - get_best_move│◄─────│ (UCI Protocol)│
│ engineS...  │      │ - stop_engine  │      └──────────────┘
└─────────────┘      └────────────────┘
```

#### 关键组件

1. **Rust 后端 (`src-tauri/src/engine.rs`)**
   - 管理 Pikafish 进程生命周期
   - 实现 UCI 协议通信
   - 提供 Tauri Commands：`start_engine`, `stop_engine`, `get_best_move`

2. **前端服务 (`src/services/engineService.ts`)**
   - 封装 Tauri invoke 调用
   - 提供简洁的 API：`startEngine()`, `getBestMove()`

3. **坐标转换 (`src/logic/chess/constants.ts`)**
   - `boardToUCI()` - 内部坐标转 UCI 格式
   - `UCIToBoard()` - UCI 格式转内部坐标
   - **关键：** 行号需要反转（内部 row=9 ↔ UCI row=0）

4. **FEN 生成 (`src/store/chessStore.ts`)**
   - 从黑方底线（row=0）到红方底线（row=9）
   - 使用国际象棋标准棋子符号（N=马，B=相）
   - 行棋方标识：w=红方，b=黑方

#### 数据流

```
1. 红方走棋 → chessStore.movePiece()
2. 切换到黑方 → currentPlayer = 'black'
3. 触发 AI → triggerAIMove()
4. 生成 FEN → generateFEN()
5. 调用后端 → getBestMove(fen, depth)
6. Rust 发送 → position fen {fen}\ngo depth {depth}
7. Pikafish 返回 → bestmove h9g7
8. 坐标转换 → UCIToMove("h9g7") → [0,7,2,6]
9. 规则验证 → isValidMove(board, ...)
10. 执行移动 → executeAIMove(...)
```

### 常见问题

#### Q1: AI 不响应或返回非法着法

**可能原因：**
1. FEN 格式错误（行序颠倒、棋子符号错误）
2. 坐标转换不正确
3. 引擎未正确初始化

**调试方法：**
- 检查控制台日志中的 FEN 串
- 查看 Rust 终端输出的引擎响应
- 确认坐标转换后的棋子颜色正确

#### Q2: 编译错误 "no method named `lock`"

**原因：** Rust Mutex 嵌套顺序错误  
**解决：** 确保使用 `Mutex<Option<Child>>` 而非 `Option<Mutex<Child>>`

#### Q3: 启动引擎失败

**原因：** 工作目录不正确  
**解决：** 确认当前工作目录是 `src-tauri/`，路径 `public/pikafish/...` 相对于此目录

详细 Bug 修复记录请参见：[docs/AI_ENGINE_BUG_FIXES.md](./docs/AI_ENGINE_BUG_FIXES.md)

## 📁 项目结构

```
chchess/
├── src/                      # 前端代码
│   ├── components/3d/        # 3D 组件
│   │   └── ChessBoard3D.vue  # 主游戏组件
│   ├── logic/chess/          # 象棋逻辑
│   │   ├── constants.ts      # 常量、坐标转换
│   │   └── rules.ts          # 规则验证
│   ├── store/                # 状态管理
│   │   └── chessStore.ts     # 棋盘状态、FEN 生成
│   ├── services/             # 服务层
│   │   └── engineService.ts  # AI 引擎服务
│   └── App.vue
├── src-tauri/                # Rust 后端
│   ├── src/
│   │   ├── engine.rs         # UCI 引擎通信
│   │   ├── lib.rs            # Tauri 命令注册
│   │   └── main.rs
│   └── Cargo.toml
├── public/                   # 静态资源
│   └── pikafish/             # AI 引擎
│       └── pikafish-vnni512.exe
└── docs/                     # 文档
    └── AI_ENGINE_BUG_FIXES.md
```

## 🛠️ 技术栈

- **前端框架：** Vue 3 + TypeScript
- **3D 渲染：** Three.js
- **桌面应用：** Tauri
- **后端语言：** Rust
- **AI 引擎：** Pikafish (UCI 协议)
- **构建工具：** Vite

## 📝 开发规范

### 棋子名称
- 红方：俥、傌、相、仕、帅、炮、兵
- 黑方：車、馬、象、士、将、砲、卒

### FEN 格式
- 行序：从黑方底线到红方底线
- 棋子符号：N（马）、B（相）、A（士）、K（将/帅）、R（车）、C（炮）、P（兵/卒）
- 行棋方：w（红方）、b（黑方）

### 坐标系统
- 内部坐标：board[0] = 黑方底线，board[9] = 红方底线
- UCI 坐标：row=0 = 红方底线，row=9 = 黑方底线
- 转换公式：`uciRow = 9 - internalRow`

## 📄 License

MIT

---

**最后更新：** 2026-05-04  
**维护者：** ChChess 开发团队
