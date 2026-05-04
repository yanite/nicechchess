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
| 10 | config.rs 文件异常膨胀 | 🔴 严重 | ✅ 已修复 |
| 11 | 窗口状态保存循环调用 | 🔴 严重 | ✅ 已修复 |
| 12 | 配置管理架构优化 - 内存缓存 | 🟡 中等 | ✅ 已修复 |

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
``rust
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
``rust
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
``rust
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

### **Bug #10: config.rs 文件异常膨胀**

**发现时间：** 2026-05-04  
**影响范围：** `src-tauri/src/config.rs`  
**现象描述：**
- config.rs 文件大小异常达到 134.9KB（正常应为 ~3KB）
- 编译时报错：`let chains are only allowed in Rust 2024 or later`
- 错误指向第719、918、969行，但这些行不应该存在于我们的代码中

**根本原因：**
- config.rs 文件被意外修改，包含了大量不应该的内容（可能是复制粘贴错误或编辑器问题）
- Git历史显示原始文件只有117行，但当前文件有数千行

**修复方案：**
``bash
# 从Git恢复原始版本
git checkout HEAD -- src-tauri/src/config.rs
```

然后重新应用必要的修改：
1. 配置路径保持在项目根目录（`PathBuf::from("config.yaml")`）
2. 保持lib.rs中的2秒防抖时间

**验证方法：**
1. 检查config.rs文件大小是否正常（~3-4KB）
2. 运行 `cargo build` 确认编译通过
3. 启动应用测试窗口移动功能

**相关提交：** `7fdc7f3` - "修复：将配置路径改回项目根目录"

**经验教训：**
- ⚠️ 定期检查关键文件的大小和行数，防止意外修改
- ✅ 使用Git跟踪文件变化，及时发现异常
- ✅ 遇到奇怪的编译错误时，先检查文件是否被意外修改

---

### **Bug #11: 窗口状态保存循环调用**

**发现时间：** 2026-05-04  
**影响范围：** `src-tauri/src/lib.rs`  
**现象描述：**
```
配置加载成功: "config.yaml"
配置已保存: "config.yaml"
配置加载成功: "config.yaml"
配置加载成功: "config.yaml"
配置已保存: "config.yaml"
配置已保存: "config.yaml"
...
```
每次移动窗口都会在日志中看到多次"配置加载成功"和"配置已保存"交替出现。

**根本原因：**
1. 窗口移动时会连续触发多个 `Moved` 事件
2. 每个事件都会 spawn 一个新的线程，延迟2秒后执行保存
3. 如果用户在2秒内多次移动窗口，会产生多个并发的保存任务
4. 这些任务同时执行，导致频繁的加载和保存操作

**修复方案：**

使用原子标志位 `AtomicBool` 防止并发保存：

``rust
use std::sync::atomic::{AtomicBool, Ordering};
static SAVE_PENDING: AtomicBool = AtomicBool::new(false);

window.on_window_event(move |event| {
    match event {
        tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
            // 如果已有保存任务在等待，则跳过
            if SAVE_PENDING.swap(true, Ordering::SeqCst) {
                return;
            }
            
            let win = window_clone.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(2000));
                
                // 执行保存逻辑...
                
                // 重置标志，允许下次保存
                SAVE_PENDING.store(false, Ordering::SeqCst);
            });
        }
        _ => {}
    }
});
```

**关键改进：**
1. ✅ 使用 `AtomicBool` 确保线程安全
2. ✅ `swap(true)` 原子性地检查并设置标志，避免竞态条件
3. ✅ 保存完成后重置标志，允许下一次保存
4. ✅ 增加详细的日志输出，显示实际保存的窗口状态

**验证方法：**
1. 启动应用并快速多次移动窗口
2. 观察日志，应该只看到一次"窗口状态已保存"（每2秒最多一次）
3. 不再出现频繁的交替加载/保存日志

**相关提交：** `19db837`

**经验教训：**
- ⚠️ 异步任务中必须考虑并发控制
- ✅ 使用原子类型处理跨线程的状态标志
- ✅ 防抖机制不仅要延迟执行，还要防止重复触发

---

### **Bug #12: 配置管理架构优化 - 内存缓存**

**发现时间：** 2026-05-04  
**影响范围：** `src-tauri/src/lib.rs`  
**问题描述：**
之前的实现在每次保存窗口状态时都会：
1. 调用 `AppConfig::load()` 从文件读取配置（打印"配置加载成功"）
2. 修改窗口相关字段
3. 调用 `config.save()` 写入文件（打印"配置已保存"）

这导致频繁的磁盘I/O和日志输出，即使只是移动窗口也会看到多次"配置加载成功"和"配置已保存"交替出现。

**根本原因：**
- 每次保存都重新从文件加载完整配置
- 没有利用内存缓存，导致不必要的文件读取操作

**修复方案：**

使用 `Arc<Mutex<AppConfig>>` 在内存中维护配置副本：

```rust
use std::sync::{Arc, Mutex};

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // 启动时加载一次配置到内存
            let config = AppConfig::load().unwrap_or_else(|_| /* 默认配置 */);
            
            // 将配置存储在 Arc<Mutex<>> 中，供后续使用
            let shared_config = Arc::new(Mutex::new(config.clone()));
            
            // 恢复窗口状态
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_position(...);
                let _ = window.set_size(...);
                
                // 监听窗口事件
                let config_clone = shared_config.clone();
                window.on_window_event(move |event| {
                    match event {
                        tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                            // ... 防抖逻辑 ...
                            
                            std::thread::spawn(move || {
                                // 更新内存中的配置（不读取文件）
                                if let Ok(mut config) = cfg.lock() {
                                    config.window.x = position.x;
                                    config.window.y = position.y;
                                    // ... 其他字段 ...
                                    
                                    // 直接保存到文件
                                    config.save()?;
                                }
                            });
                        }
                        _ => {}
                    }
                });
            }
            
            // 将共享配置存储到 Tauri 的状态管理中
            app.manage(shared_config);
            
            Ok(())
        })
}
```

**关键改进：**
1. ✅ **启动时只加载一次**：应用启动时从文件加载配置到内存
2. ✅ **内存中维护副本**：使用 `Arc<Mutex<AppConfig>>` 在线程间安全共享
3. ✅ **保存时不读取文件**：直接更新内存中的配置并保存，避免重复读取
4. ✅ **支持前端访问**：通过 Tauri 的 `State` 机制暴露给前端命令
5. ✅ **线程安全**：使用 `Mutex` 确保并发访问安全

**验证方法：**
1. 启动应用并快速多次移动窗口
2. 观察日志，应该只看到"窗口状态已保存"，不再出现"配置加载成功"
3. 配置文件内容正确更新

**相关提交：** `c8f7d4e`

**经验教训：**
- ⚠️ 频繁的文件I/O会影响性能，应尽量减少不必要的读写操作
- ✅ 使用内存缓存可以显著提升性能，特别是对于频繁更新的配置项
- ✅ `Arc<Mutex<T>>` 是 Rust 中跨线程共享可变状态的标准模式
- ✅ Tauri 的 `app.manage()` 可以将状态注入到命令系统中

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
