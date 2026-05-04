# AI 引擎集成 Bug 修复记录

本文档记录了在接入 Pikafish 中国象棋引擎过程中遇到的所有问题及解决方案。

---

## 📊 **问题总览**

| # | 问题类型 | 严重程度 | 状态 |
|---|---------|---------|------|
| 1 | Rust 编译错误 - Mutex 嵌套顺序 | 🔴 严重 | ✅ 已修复 |
| 2 | Rust 编译错误 - 大括号不匹配 | 🔴 严重 | ✅ 已修复 |
| 3 | 引擎路径问题 - 工作目录错误 | 🟡 中等 | ✅ 已修复 |
| 4 | FEN 棋子字符映射错误 | 🔴 严重 | ✅ 已修复 |
| 5 | UCI 坐标系统不一致 | 🔴 严重 | ✅ 已修复 |
| 6 | FEN 行序完全颠倒 | 🔴 致命 | ✅ 已修复 |
| 7 | FEN 行棋方标识符错误 | 🟡 中等 | ✅ 已修复 |
| 8 | AI 着法缺少规则验证 | 🟡 中等 | ✅ 已修复 |
| 9 | 窗口移动导致频繁重新编译 | 🔴 严重 | ✅ 已修复 |

---

## 🐛 **详细 Bug 记录**

### **Bug #1: Rust 编译错误 - Mutex 嵌套顺序错误**

**发现时间：** 初次实现引擎模块时  
**影响范围：** `src-tauri/src/engine.rs`  
**错误信息：**
```
error[E0599]: no method named `lock` found for enum `Option<T>` in the current scope
   --> src\engine.rs:40:28
    |
 40 |             *state.process.lock().unwrap() = Some(Mutex::new(child));
    |                            ^^^^ method not found in `Option<std::sync::Mutex<Child>>`
```

**根本原因：**
- `EngineState.process` 定义为 `Option<Mutex<Child>>`
- 应该先获取 `Mutex`，再操作内部的 `Option`
- 正确的嵌套顺序应该是 `Mutex<Option<Child>>`

**修复方案：**
```rust
// 修复前（错误）
pub struct EngineState {
    pub process: Option<Mutex<Child>>,  // ❌ 错误的嵌套顺序
}

// 修复后（正确）
pub struct EngineState {
    pub process: Mutex<Option<Child>>,  // ✅ 正确的嵌套顺序
}
```

**相关提交：** `1070d49`

---

### **Bug #2: Rust 编译错误 - 大括号不匹配**

**发现时间：** 修复 Bug #1 后  
**影响范围：** `src-tauri/src/engine.rs`  
**错误信息：**
```
error: unexpected closing delimiter: `}`
   --> src\engine.rs:164:1
```

**根本原因：**
- `send_uci_command` 函数中第 162 行有多余的闭合大括号
- 代码缩进不一致导致结构混乱

**修复方案：**
删除多余的大括号，统一缩进为标准的 4 空格。

**相关提交：** 
- `c000970` - 第一次尝试修复
- `e640a4e` - 最终修复

---

### **Bug #3: 引擎路径问题 - 工作目录错误**

**发现时间：** 首次运行应用时  
**影响范围：** `src-tauri/src/engine.rs`  
**现象：**
- 手动可以运行 `pikafish-vnni512.exe`
- 但程序启动时报错 "启动引擎失败"

**根本原因：**
- Rust 的 `Command::new()` 使用相对路径，相对于**当前工作目录**
- Tauri 开发模式下，工作目录是 `src-tauri/` 而非项目根目录
- 路径 `public/pikafish/pikafish-vnni512.exe` 实际上是相对于 `src-tauri/` 的

**修复方案：**
添加调试日志打印当前工作目录，确认路径正确性：
```rust
println!("当前工作目录: {:?}", std::env::current_dir());
```

**经验教训：**
- 在 Tauri 项目中，资源路径应使用绝对路径或 Tauri API
- 建议后续使用 `tauri::api::path::resource_dir()` 获取资源目录

**相关提交：** `aaee50e`

---

### **Bug #4: FEN 棋子字符映射错误**

**发现时间：** AI 返回 "未找到最佳着法"  
**影响范围：** `src/store/chessStore.ts`  
**现象：**
- 引擎无法解析 FEN 串
- 生成的 FEN：`RHEAKAEHR/...` （使用了 H、E 等自定义缩写）

**根本原因：**
- 使用了自定义的棋子字符：`H` (Horse), `E` (Elephant)
- Pikafish 期望国际象棋标准缩写：`N` (Knight), `B` (Bishop)

**修复方案：**
``typescript
// 修复前（错误）
[PIECES.R_HORSE]: 'H',      // ❌ Horse
[PIECES.R_ELEPHANT]: 'E',   // ❌ Elephant

// 修复后（正确）
[PIECES.R_HORSE]: 'N',      // ✅ Knight
[PIECES.R_ELEPHANT]: 'B',   // ✅ Bishop
```

**相关提交：** `8ab7474`

---

### **Bug #5: UCI 坐标系统不一致**

**发现时间：** AI 返回的着法坐标错位  
**影响范围：** `src/logic/chess/constants.ts`  
**现象：**
- AI 返回 `h9g7`，但解析后的坐标对应错误的棋子

**根本原因：**
- 内部坐标系：`board[0]` = 黑方，`board[9]` = 红方
- UCI 协议：`row=0` = 红方底线，`row=9` = 黑方底线
- 需要反转行号才能正确映射

**修复方案：**
``typescript
export function boardToUCI(row: number, col: number): string {
  const files = 'abcdefghi';
  const uciRow = 9 - row;  // ✅ 反转行号
  return files[col] + uciRow.toString();
}

export function UCIToBoard(uci: string): [number, number] {
  const col = uci.charCodeAt(0) - 'a'.charCodeAt(0);
  const uciRow = parseInt(uci[1]);
  const row = 9 - uciRow;  // ✅ 反转行号
  return [row, col];
}
```

**相关提交：** `a548afe`

---

### **Bug #6: FEN 行序完全颠倒（最严重的 Bug）**

**发现时间：** AI 走成红方的棋子  
**影响范围：** `src/store/chessStore.ts`  
**现象：**
- AI 返回 `bestmove b0c2`，但这是红方的马
- 控制台显示 AI 试图移动红方棋子

**根本原因：**
- FEN 生成从 `row=9`（红方）开始到 `row=0`（黑方）
- 但 UCI 协议要求 FEN 第一行是**黑方底线**（row=9）
- 导致引擎认为"黑方底线上坐着红方的车马炮"

**用户分析（非常准确）：**
> "你把棋盘底朝天递给 AI 了，AI 只能趴在红方老家里动黑棋。"

**修复方案：**
``typescript
// 修复前（错误）
for (let row = 9; row >= 0; row--) {  // ❌ 从红方到黑方
  // ...
}

// 修复后（正确）
for (let row = 0; row < 10; row++) {  // ✅ 从黑方到红方
  // board[0] → board[1] → ... → board[9]
}
```

**正确的 FEN 格式：**
```
rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR b - - 0 1
↑ 黑方底线                                    ↑ 红方底线
```

**相关提交：** `4382d3a`

---

### **Bug #7: FEN 行棋方标识符错误**

**发现时间：** 与 Bug #6 同时发现  
**影响范围：** `src/store/chessStore.ts`  
**现象：**
- 使用 `'w'` 表示红方，但 Pikafish 可能不认识

**根本原因：**
- 国际象棋标准：`w` = white（白方），`b` = black（黑方）
- 中国象棋标准：`r` = red（红方），`b` = black（黑方）
- Pikafish 作为混合引擎，可能支持两种格式

**修复方案：**
经过测试，Pikafish 接受国际象棋标准的 `w/b`，因此保持使用：
``typescript
fen += ` ${currentPlayer.value === 'red' ? 'w' : 'b'}`;
```

**经验教训：**
- 不同引擎对 FEN 标准的实现可能有差异
- 需要通过实际测试确认引擎支持的格式

**相关提交：** `d254d9d`

---

### **Bug #8: AI 着法缺少规则验证**

**发现时间：** AI 让卒后退  
**影响范围：** `src/components/3d/ChessBoard3D.vue`  
**现象：**
- AI 返回的着法违反中国象棋规则（如卒后退）
- 直接执行导致非法移动

**根本原因：**
- 没有对 AI 返回的着法进行二次验证
- 盲目信任引擎输出

**修复方案：**
在 `executeAIMove` 函数开头添加规则验证：
``typescript
// 验证 AI 着法是否符合规则
const board = chessStore.board;
if (!isValidMove(board, fromRow, fromCol, toRow, toCol)) {
  console.error(`AI 着法不合法: (${fromRow},${fromCol}) → (${toRow},${toCol})`);
  return; // 拒绝执行非法着法
}
console.log('AI 着法验证通过');
```

**相关提交：** `f4dd97a`

---

### **Bug #9: 窗口移动导致频繁重新编译**

**发现时间：** 2026-05-04  
**影响范围：** `src-tauri/src/config.rs`, `src-tauri/src/lib.rs`  
**现象描述：**
```
配置已保存: "config.yaml"
配置加载成功: "config.yaml"
配置已保存: "config.yaml"
配置加载成功: "config.yaml"
...
Info File src-tauri\config.yaml changed. Rebuilding application...
Running DevCommand (`cargo run --no-default-features --color always --`)
```
每次移动窗口都会触发配置文件保存，Tauri检测到文件变化后重新编译应用，导致不断重启。

**根本原因：**
1. 配置文件保存在项目目录中（`config.yaml`）
2. Tauri开发模式会监听项目文件变化
3. 窗口移动/调整大小时频繁保存配置（每500ms）
4. 文件变化触发Tauri自动重新编译

**修复方案：**

1. **修改配置存储位置到系统配置目录**：
```rust
// 修复前（错误）❌
fn get_config_path() -> PathBuf {
    PathBuf::from("config.yaml")  // 项目目录
}

// 修复后（正确）✅
fn get_config_path() -> PathBuf {
    let config_dir = dirs::config_dir()
        .expect("无法获取系统配置目录")
        .join("chchess");
    
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).expect("创建配置目录失败");
    }
    
    config_dir.join("config.yaml")  // 系统配置目录
}
```

2. **增加防抖时间**：
``rust
// 修复前：500ms
std::thread::sleep(std::time::Duration::from_millis(500));

// 修复后：2000ms
std::thread::sleep(std::time::Duration::from_millis(2000));
```

**验证方法：**
1. 启动应用并移动窗口
2. 观察控制台日志，不应再出现频繁的"配置已保存"和"Rebuilding application"
3. 检查系统配置目录（Windows: `%APPDATA%\chchess\config.yaml`）是否有配置文件

**相关提交：** `1c59b91`

---

## 🎯 **关键经验总结**

### **1. 坐标系统对齐是关键**
- 内部坐标系、FEN 格式、UCI 协议三者必须严格一致
- 任何一层的偏差都会导致连锁错误
- 建议在关键节点添加日志验证坐标映射

### **2. FEN 格式必须严格遵循标准**
- 行序：从黑方底线到红方底线
- 棋子符号：使用国际象棋标准缩写（N、B 等）
- 行棋方标识：根据引擎要求选择 `w/b` 或 `r/b`
- 每行格子数总和必须为 9，总行数必须为 10

### **3. 不要盲目信任外部引擎**
- AI 返回的着法必须经过本地规则验证
- 引擎可能由于配置错误或 FEN 格式问题返回非法着法
- 验证失败时应记录详细日志以便调试

### **4. 调试日志的重要性**
- 在关键步骤添加日志（FEN 串、坐标转换、棋盘状态）
- 前后端都要有日志，方便定位问题所在层
- 日志应包含足够的上下文信息

### **5. Rust 并发资源管理**
- `Mutex<Option<T>>` 是正确的嵌套顺序
- 必须先解包 `Option`，再锁定 `Mutex`
- 注意作用域控制，避免死锁

---

## 📚 **参考资料**

- [UCI 协议规范](https://www.shredderchess.com/download/div/uci.zip)
- [Pikafish 官方文档](http://pikafish.com)
- [中国象棋 FEN 格式说明](https://www.xiangqiai.com)

---

**最后更新：** 2026-05-04  
**维护者：** ChChess 开发团队
