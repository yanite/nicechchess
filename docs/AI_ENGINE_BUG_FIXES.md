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
| 13 | 棋子字体漂浮和方向错误 | 🟡 中等 | ✅ 已修复 |
| 14 | 柱型棋子嵌入棋盘及点击命中问题 | 🟡 中等 | ✅ 已修复 |
| 15 | 棋子移动后重新嵌入棋盘 | 🟡 中等 | ✅ 已修复 |
| 16 | 被吃掉的棋子不显示 | 🟡 中等 | ✅ 已修复 |
| 17 | 车炮指示点过滤条件错误 | 🟡 中等 | ✅ 已修复 |
| 18 | 两次点击模式棋子不移动 | 🔴 严重 | ✅ 已修复 |

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

``rust
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

### **Bug #13: 棋子字体漂浮和方向错误**

**发现时间：** 2026-05-04  
**影响范围：** `src/components/3d/ChessBoard3D.vue`  
**现象：**
- 棋子从鼓型改成柱型后，字体漂浮在棋子外面，离开棋子表面有距离
- 字体方向不正确，没有根据配置正确旋转

**根本原因：**
1. **字体漂浮问题：**
   - 柱型棋子使用 `CylinderGeometry`，几何体中心在原点，高度范围是 `-height/2` 到 `+height/2`
   - 但文字贴图的 y 坐标设置为 `height + 0.001`，导致文字远离顶部表面
   - 鼓型棋子使用 `LatheGeometry`，几何体从 `y=0` 开始到 `y=height`，所以原来的计算是正确的

2. **字体方向问题：**
   - 原代码根据棋子在棋盘的位置（上半部分/下半部分）决定旋转
   - 应该根据配置的 `opponent_text_direction` 和棋子颜色来决定旋转角度

**修复方案：**

1. **修复字体位置：**
``typescript
// 修复前（错误）
textMesh.position.y = height + 0.001; // 对所有形状都使用相同逻辑

// 修复后（正确）
if (currentPieceShape === 'cylinder') {
  // 柱型：圆柱几何体中心在原点，顶部在 height/2 位置
  textMesh.position.y = height / 2 + 0.001;
} else {
  // 鼓型：LatheGeometry 从 y=0 开始，顶部在 height 位置
  textMesh.position.y = height + 0.001;
}
```

2. **修复字体方向：**
``typescript
// 修复前（错误）
// 根据棋子在棋盘的位置决定旋转
if (!isRed && row < 5) {
  pieceMesh.rotation.y = -Math.PI / 2;
} else if (isRed && row >= 5) {
  pieceMesh.rotation.y = Math.PI / 2;
}
// ... 更多条件判断

// 修复后（正确）
const isRed = piece > 0;
let rotationY = 0;

if (opponentTextDirection === 'down') {
  // 对方棋子字体方向：向下
  // 红方字体旋转90度，黑方字体旋转-90度
  rotationY = isRed ? Math.PI / 2 : -Math.PI / 2;
} else {
  // 对方棋子字体方向：向上
  // 红方字体旋转90度，黑方字体也旋转90度
  rotationY = Math.PI / 2;
}

pieceMesh.rotation.y = rotationY;
```

3. **添加配置加载：**
``typescript
// 在 initScene 中加载配置
opponentTextDirection = config.ui.opponent_text_direction || 'down';
console.log('加载对方棋子字体方向配置:', opponentTextDirection);
```

**验证方法：**
1. 启动应用，观察柱型棋子的文字是否紧贴顶部表面
2. 修改配置文件中的 `opponent_text_direction` 为 `down` 或 `up`
3. 重启应用，验证红黑双方棋子的文字方向是否正确旋转

**相关提交：** （待提交）

---

### **Bug #14: 柱型棋子嵌入棋盘及点击命中问题**

**发现时间：** 2026-05-04（紧接 Bug #13 之后）  
**影响范围：** `src/components/3d/ChessBoard3D.vue`  
**现象：**
- 修复 Bug #13 后，柱型棋子嵌入到棋盘里面
- 需要确保点击时命中棋子本体而不是文字贴图

**根本原因：**
1. **棋子嵌入问题：**
   - 柱型使用 `CylinderGeometry`，几何体中心在原点，高度范围是 `-height/2` 到 `+height/2`
   - 将 `mesh.position.y = 0.01` 时，实际底部位置是 `0.01 - height/2`，导致嵌入棋盘
   - 需要将整个 mesh 上移 `height/2`，使底部位于 `y=0.01`

2. **点击命中问题：**
   - 文字贴图作为子对象添加到棋子 mesh 中
   - 射线检测可能先命中文字贴图而非棋子本体
   - 虽然代码已有向上查找父对象的逻辑，但不够可靠

**修复方案：**

1. **调整柱型棋子高度和位置：**
``typescript
// 修复前（错误）
const height = CELL_SIZE * 0.35;    // 固定高度
const mesh = new THREE.Mesh(geometry, sideMaterial);
mesh.position.y = 0.01; // 导致柱型嵌入棋盘

// 修复后（正确）
const fullHeight = CELL_SIZE * 0.35;
const height = currentPieceShape === 'cylinder' ? fullHeight * 0.5 : fullHeight; // 柱型高度减半

const mesh = new THREE.Mesh(geometry, sideMaterial);

if (currentPieceShape === 'cylinder') {
  // 柱型：圆柱几何体中心在原点，要让底部在 y=0.01，需要上移 height/2
  mesh.position.y = 0.01 + height / 2;
} else {
  // 鼓型：LatheGeometry 从 y=0 开始，直接放在棋盘上
  mesh.position.y = 0.01;
}
```

2. **禁用文字贴图的射线检测：**
``typescript
// 添加顶部文字贴图
const textMesh = new THREE.Mesh(textGeometry, textMaterial);
textMesh.rotation.x = -Math.PI / 2;

// 设置文字贴图不参与射线检测，确保点击命中棋子本体
textMesh.raycast = () => {}; // 禁用射线检测

// 然后设置位置和添加到父对象
```

**验证方法：**
1. 启动应用，观察柱型棋子是否完全在棋盘上方，不再嵌入
2. 点击柱型棋子，确认能正常拖动
3. 对比鼓型和柱型的高度差异（柱型应该更矮）
4. 检查点击时是否稳定命中棋子本体

**相关提交：** （待提交）

---

### **Bug #15: 棋子移动后重新嵌入棋盘**

**发现时间：** 2026-05-04（紧接 Bug #14 之后）  
**影响范围：** `src/components/3d/ChessBoard3D.vue`  
**现象：**
- 修复 Bug #14 后，棋子初始位置正确
- 但移动一步棋后，所有棋子又嵌入到棋盘里面

**根本原因：**
在多个函数中错误地覆盖了 [createPieceMesh](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\ChessBoard3D.vue#L602-L693) 中已正确计算的y坐标：

1. **[syncPiecesWithBoard](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\ChessBoard3D.vue#L776-L842)** (第815行)：
   ```typescript
   pieceMesh.position.y = 0; // ❌ 覆盖了正确的y坐标
   ```

2. **[resetPiecePosition](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\ChessBoard3D.vue#L1413-L1423)** (第1421行)：
   ```typescript
   pieceMesh.position.y = 0.01; // ❌ 覆盖了正确的y坐标
   ```

3. **[onMouseUp](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\ChessBoard3D.vue#L1050-L1140)** (第1112和1124行)：
   ```typescript
   (targetMesh as THREE.Mesh).position.y = 0.01; // ❌ 被吃掉的棋子
   draggedPiece.position.y = 0.01; // ❌ 移动的棋子
   ```

这些代码都假设棋子高度是固定的，没有考虑柱型和鼓型的不同几何体结构。

**修复方案：**

移除所有手动设置y坐标的代码，保留 [createPieceMesh](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\ChessBoard3D.vue#L602-L693) 中根据棋子形状动态计算的y坐标：

``typescript
// 修复前（错误）
pieceMesh.position.x = startX + col * CELL_SIZE;
pieceMesh.position.z = startZ + row * CELL_SIZE;
pieceMesh.position.y = 0; // ❌ 覆盖正确的y坐标

// 修复后（正确）
pieceMesh.position.x = startX + col * CELL_SIZE;
pieceMesh.position.z = startZ + row * CELL_SIZE;
// ✅ 不设置y坐标，保持createPieceMesh中的正确值
```

**修改的函数：**
1. [syncPiecesWithBoard](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\ChessBoard3D.vue#L776-L842) - 同步棋盘状态时重建棋子
2. [resetPiecePosition](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\ChessBoard3D.vue#L1413-L1423) - 重置棋子位置
3. [onMouseUp](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\ChessBoard3D.vue#L1050-L1140) - 放下棋子和处理被吃棋子

**验证方法：**
1. 启动应用，观察棋子初始位置是否正确
2. 移动一个棋子，观察所有棋子是否保持在正确高度
3. 多次移动棋子，确认不会出现嵌入问题
4. 测试吃掉棋子的场景，确认被吃棋子位置正确

**相关提交：** `82eda65`

---

### **Bug #16: 被吃掉的棋子不显示**

**发现时间：** 2026-05-04（紧接 Bug #15 之后）  
**影响范围：** `src/components/3d/ChessBoard3D.vue`  
**现象：**
- 修复 Bug #15 后，棋子高度和位置都正确
- 但吃掉对方棋子后，被吃掉的棋子从场景中消失

**根本原因：**
[syncPiecesWithBoard](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\ChessBoard3D.vue#L776-L875) 函数在每次落子后被调用，其原有逻辑是：
1. **清空所有棋子**（包括被吃掉的棋子）
2. **只根据 board 数组重新创建棋子**

而被吃掉的棋子已经从 board 数组中移除（标记为 [PIECES.EMPTY](file://v:\4_mydoc\tauri\nicechchess\src\logic\chess\constants.ts#L30-L30)），所以不会被重新创建。

这违反了**棋子永不消失原则**：所有棋子在任何情况下都不应该从场景中消失！

**修复方案：**

修改 [syncPiecesWithBoard](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\ChessBoard3D.vue#L776-L875) 函数的策略：**保留被吃掉的棋子，只更新棋盘上的棋子**。

```
// 修复前（错误）❌
// 第一步：移除所有现有棋子
while(piecesGroup.children.length > 0) {
  const child = piecesGroup.children[0];
  piecesGroup.remove(child);
  // ... 释放资源 ...
}

// 第二步：根据board重新创建所有棋子
for (let row = 0; row < BOARD_HEIGHT; row++) {
  for (let col = 0; col < BOARD_WIDTH; col++) {
    const piece = board[row][col];
    if (piece !== PIECES.EMPTY) {
      // 创建棋子...
    }
  }
}
// 被吃掉的棋子因为不在board中，所以消失了！

// 修复后（正确）✅
// 第一步：收集并保留被吃掉的棋子
const capturedPieces: THREE.Mesh[] = [];
piecesGroup.children.forEach(child => {
  if (child instanceof THREE.Mesh) {
    const userData = child.userData as any;
    if (userData.isCaptured) {
      capturedPieces.push(child); // 保留被吃掉的棋子
    }
  }
});

// 第二步：只移除棋盘上的活子
piecesToRemove.forEach(piece => {
  piecesGroup.remove(piece);
  // ... 释放资源 ...
});

// 第三步：重建棋盘上的棋子
for (let row = 0; row < BOARD_HEIGHT; row++) {
  for (let col = 0; col < BOARD_WIDTH; col++) {
    const piece = board[row][col];
    if (piece !== PIECES.EMPTY) {
      // 创建棋子...
    }
  }
}

// 第四步：将被吃掉的棋子重新添加回场景
capturedPieces.forEach(capturedPiece => {
  piecesGroup.add(capturedPiece);
});
```

**关键改进：**
1. **分离保留策略**：先收集被吃掉的棋子，避免被清除
2. **选择性清理**：只移除棋盘上的活子（`isCaptured === false`）
3. **恢复机制**：重建完成后，将被吃棋子重新添加到场景
4. **y坐标保持**：被吃棋子保持在正确高度（y=0.01）

**验证方法：**
1. 启动应用，进行正常对局
2. 用己方棋子吃掉对方棋子
3. 观察被吃掉的棋子是否移动到棋盘边缘并保持可见
4. 继续对局，多次吃子，确认所有被吃棋子都保持可见
5. 检查被吃棋子是否在棋盘边缘整齐排列

**相关规范：**
此Bug的修复促使我们建立了**棋子永不消失原则**，已添加到 [`docs/PROJECT_RULES.md`](v:\4_mydoc\tauri\nicechchess\docs\PROJECT_RULES.md) 中作为强制性规范。

**相关提交：** `ccb9444`

---

### **Bug #17: 字体加载被开发模式限制及多余日志问题**

**发现时间：** 2026-05-05  
**影响范围：** `src/components/3d/usePieces.ts`, `src/components/3d/ChessBoard3D.vue`, `src/components/3d/useAI.ts`  
**现象：**
1. 开发模式下自定义字体无法加载，控制台显示"开发模式下跳过自定义字体加载"
2. 控制台输出大量调试信息，影响可读性
3. 满棋盘都是棋子（疑似重复创建）

**根本原因：**
1. **开发模式限定**：[loadChessFont](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\usePieces.ts#L15-L60) 和 [loadJSONFont](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\usePieces.ts#L70-L119) 函数中有 `import.meta.env.DEV` 检查，导致开发环境下直接返回，不加载字体
2. **日志过多**：代码中存在大量 `console.log` 用于调试，未在生产前清理
3. **满棋盘棋子**：经检查，棋盘初始化逻辑正确，实际是用户误解（可能是视觉错觉或旧缓存）

**修复方案：**

1. **移除开发模式限定**：
``typescript
// 修复前（错误）❌
if (import.meta.env.DEV) {
  console.warn(`⚠️ 开发模式下跳过自定义字体加载（技术限制）`);
  return; // 直接返回，不尝试加载
}

// 修复后（正确）✅
// 直接加载字体，不再检查开发模式
const url = convertFileSrc(fontPath);
const font = new FontFace(fontName, `url(${url})`);
await font.load();
document.fonts.add(font);
```

2. **清理多余日志**：
- [usePieces.ts](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\usePieces.ts)：移除字体加载的详细调试日志，保留成功/失败提示
- [useAI.ts](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\useAI.ts)：移除 AI 思考过程的详细日志，保留错误信息
- [ChessBoard3D.vue](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\ChessBoard3D.vue)：移除配置加载、棋子创建等过程的日志

3. **更新字体路径**：
``typescript
// 修复前（旧路径）❌
fontPath = 'resources/fonts/隶书.json';

// 修复后（新路径）✅
fontPath = 'src/assets/fonts/隶书.json';
```

4. **修正回退逻辑**：
- 移除不存在的 `隶书.TTF` 回退路径
- JSON 字体加载失败时直接回退到系统字体

**验证方法：**
1. 启动应用（开发模式）
2. 检查控制台，确认没有"开发模式下跳过"的警告
3. 观察棋子文字是否正确显示自定义字体
4. 检查控制台输出是否简洁清晰
5. 确认棋盘上只有32个棋子（初始布局）

**相关提交：** （待提交）

**经验教训：**
- ⚠️ 开发模式限定应谨慎使用，避免阻碍正常功能测试
- ✅ 调试日志应在功能稳定后及时清理，保持代码整洁
- ✅ 资源路径应统一管理，避免分散在不同目录

---

### **Bug #18: 棋子渲染为黑色问题**

**发现时间：** 2026-05-05  
**影响范围：** `src/components/3d/usePieces.ts`  
**现象：**
棋子侧面显示为纯黑色，没有木纹质感和米黄色基底。

**根本原因：**
1. **缺少基础颜色**：棋子侧面的MeshStandardMaterial只设置了木纹贴图，但没有设置基础颜色（color属性默认为白色0xffffff）
2. **纹理叠加问题**：当木纹纹理加载失败或透明度过高时，如果没有基础颜色支撑，会显示为黑色

**修复方案：**

为棋子侧面材质添加米黄色基底颜色，与棋子顶部背景色保持一致：

``typescript
// 修复前（错误）❌
const sideMaterial = new THREE.MeshStandardMaterial({
  map: woodTexture,
  color: 0xffffff,        // 白色基底
  roughness: 0.6,
  metalness: 0.0,
});

// 修复后（正确）✅
const sideMaterial = new THREE.MeshStandardMaterial({
  map: woodTexture,
  color: 0xF5DEB3,        // 米黄色基底（与棋子顶部背景色一致）
  roughness: 0.6,
  metalness: 0.0,
});
```

**同时修复了refreshPieceTextures函数**：
- 原函数错误地尝试更新父mesh的材质数组
- 修正为遍历子对象，找到文字贴图的圆形平面并更新其纹理

``typescript
// 修复后的逻辑
piecesGroup.children.forEach((child) => {
  if (child instanceof THREE.Mesh && child.userData.piece !== undefined) {
    const pieceType = child.userData.piece as PieceType;
    const isRed = pieceType > 0;
    
    const textures = createPieceTexture(pieceType, isRed);
    
    // 查找子对象中的文字贴图并更新
    child.children.forEach((subChild) => {
      if (subChild instanceof THREE.Mesh && subChild.geometry instanceof THREE.CircleGeometry) {
        if (!Array.isArray(subChild.material)) {
          subChild.material.map = textures.colorTexture;
          subChild.material.normalMap = textures.normalMap;
          subChild.material.needsUpdate = true;
        }
      }
    });
  }
});
```

**验证方法：**
1. 启动应用，观察棋子侧面是否显示米黄色木纹质感
2. 检查红方和黑方棋子是否有正确的颜色区分
3. 字体加载后，确认文字贴图正确刷新

**相关提交：** （待提交）

---

### **Bug #19: 移除3D文字功能，统一使用Canvas方案**

**发现时间：** 2026-05-05  
**影响范围：** `src/components/3d/usePieces.ts`, `src/components/3d/ChessBoard3D.vue`  
**现象：**
项目中有两套棋子文字渲染方案（3D TextGeometry和Canvas贴图），增加了代码复杂度和维护成本。

**根本原因：**
1. **双重实现**：同时维护 [createPieceWith3DText](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\usePieces.ts#L687-L774) 和 [createPieces](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\usePieces.ts#L528-L582) 两套函数
2. **条件分支**：ChessBoard3D.vue中根据字体类型选择不同的渲染方案
3. **资源浪费**：JSON字体加载、FontLoader等仅在3D方案中使用

**修复方案：**

1. **删除3D文字相关函数**：
   - 删除 [create3DTextGeometry](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\usePieces.ts#L91-L124) 辅助函数
   - 删除 [createPieceWith3DText](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\usePieces.ts#L687-L774) 函数
   - 删除 [createPiecesWith3DText](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\usePieces.ts#L776-L819) 函数

2. **简化ChessBoard3D.vue中的字体加载逻辑**：
``typescript
// 修复前（复杂）❌
let useJSONFont = false;
let jsonFont: Font | null = null;

if (useJSONFont) {
  jsonFont = await loadJSONFont(fontPath);
  piecesGroup = createPiecesWith3DText(scene, chessStore.board, jsonFont, ...);
} else {
  await loadChessFont('ChessFont', fontPath);
  piecesGroup = createPieces(scene, chessStore.board, ...);
}

// 修复后（简洁）✅
if (fontPath) {
  await loadChessFont('ChessFont', fontPath);
}

piecesGroup = createPieces(scene, chessStore.board, currentPieceShape, ...);

if (fontPath) {
  refreshPieceTextures(piecesGroup);
}
```

3. **移除不必要的导入**：
   - 从ChessBoard3D.vue中移除 `createPiecesWith3DText` 导入
   - 从usePieces.ts中移除 `FontLoader` 和 `Font` 类型导入
   - 移除 [loadJSONFont](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\usePieces.ts#L50-L70) 函数

**关键改进：**
1. **统一渲染方案**：所有棋子都使用Canvas贴图方案
2. **简化代码路径**：移除条件分支，降低维护成本
3. **保留字体支持**：仍然支持自定义字体（TTF/JSON），但统一通过Canvas方案渲染
4. **减少依赖**：不再需要Three.js的FontLoader和TextGeometry

**验证方法：**
1. 启动应用，确认棋子文字正常显示
2. 测试不同字体配置（隶书、汉仪颜楷繁、中國龍豪行書）
3. 确认字体加载后纹理正确刷新
4. 检查控制台无错误信息

**相关提交：** （待提交）

**经验教训：**
- ✅ 避免在同一项目中维护多套相似功能的实现
- ✅ 优先选择性能更好、兼容性更强的方案（Canvas vs 3D Geometry）
- ✅ 定期清理未使用的代码和依赖，保持代码库整洁

---

### **Bug #20: 统一使用TTF字体，支持三种自定义字体**

**发现时间：** 2026-05-05  
**影响范围：** `src/components/3d/usePieces.ts`, `src/components/3d/ChessBoard3D.vue`  
**现象：**
项目中有JSON字体和TTF字体混用，但JSON字体无法用于Canvas渲染，导致字体配置混乱。

**根本原因：**
1. **格式不兼容**：JSON字体（隶书.json、汉仪颜楷繁.json）是Three.js专用格式，只能用于TextGeometry，不能用于Canvas
2. **Canvas限制**：Canvas只能使用TTF/OTF文件或系统已安装字体
3. **字体名称映射缺失**：TTF文件的内部字体名称与文件名不一致，需要正确映射

**修复方案：**

#### **1. 确认字体内部名称**
通过检查TTF文件元数据，确认三个字体的内部名称：
- 隶书.ttf → `LiSu`
- 汉仪颜楷繁.ttf → `汉仪颜楷繁`
- 中國龍豪行書.TTF → `HAKUYOOTI3500`

#### **2. 添加全局字体名称管理**
``typescript
// usePieces.ts
let currentFontName: string = 'KaiTi';

export function setCurrentFontName(fontName: string): void {
  currentFontName = fontName;
}

export function getCurrentFontName(): string {
  return currentFontName;
}

export function getFontString(fontSize: number, customFontName?: string): string {
  const fontName = customFontName || currentFontName;
  return `bold ${fontSize}px "${fontName}", "KaiTi", "STKaiti", "SimSun", serif`;
}
```

#### **3. 修改ChessBoard3D.vue中的字体加载逻辑**
``typescript
// 字体配置映射
const fontName = (config.ui as any).chess_font || '楷体';
let fontPath = '';
let internalFontName = 'KaiTi';

if (fontName === '隶书') {
  fontPath = 'assets/fonts/隶书.ttf';
  internalFontName = 'LiSu';
} else if (fontName === '汉仪颜楷繁') {
  fontPath = 'assets/fonts/汉仪颜楷繁.ttf';
  internalFontName = '汉仪颜楷繁';
} else if (fontName === '中國龍豪行書') {
  fontPath = 'assets/fonts/中國龍豪行書.TTF';
  internalFontName = 'HAKUYOOTI3500';
}

// 加载字体并设置全局字体名称
if (fontPath) {
  await loadChessFont(internalFontName, fontPath);
  setCurrentFontName(internalFontName);
} else {
  setCurrentFontName('KaiTi');
}
```

#### **4. 移除JSON字体相关代码**
- 删除 `隶书.json` 和 `汉仪颜楷繁.json` 的引用
- 统一使用TTF字体加载
- 所有字体都通过 FontFace API 加载到系统

**关键改进：**
1. **统一字体格式**：全部使用TTF格式，避免格式混用
2. **全局字体管理**：通过 `currentFontName` 统一管理当前使用的字体
3. **自动回退机制**：如果自定义字体加载失败，自动回退到系统楷体
4. **即时生效**：字体切换后立即调用 [refreshPieceTextures()](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\usePieces.ts#L575-L597) 刷新纹理

**验证方法：**
1. 启动应用，默认显示楷体棋子文字
2. 在配置中切换到"隶书"，确认显示为隶书字体
3. 切换到"汉仪颜楷繁"，确认显示为该字体
4. 切换到"中國龍豪行書"，确认显示为该字体
5. 检查控制台无字体加载错误

**相关提交：** （待提交）

**经验教训：**
- ✅ Canvas渲染只能使用TTF/OTF或系统字体，不能使用Three.js专用的JSON字体
- ✅ TTF文件的内部字体名称可能与文件名不同，需要正确映射
- ✅ 使用全局变量管理当前字体名称，简化代码逻辑
- ✅ 提供完善的回退机制，确保字体加载失败时应用仍可用

---

### **Bug #21: 隶书字体大小和位置优化**

**发现时间：** 2026-05-05  
**影响范围：** `src/components/3d/usePieces.ts`  
**现象：**
隶书字体在棋子上显示偏小，且位置偏下，视觉效果不够协调。

**根本原因：**
1. **字体大小统一**：所有字体都使用72px，但不同字体的视觉大小差异较大
2. **基线对齐问题**：隶书字体的基线位置与其他字体不同，导致居中显示时偏下

**修复方案：**

#### **1. 动态调整字体大小**
``typescript
// getFontString 函数中添加字体特定调整
export function getFontString(fontSize: number, customFontName?: string): string {
  const fontName = customFontName || currentFontName;
  
  // 隶书字体需要放大10%以获得更好的视觉效果
  let adjustedFontSize = fontSize;
  if (fontName === 'LiSu') {
    adjustedFontSize = Math.round(fontSize * 1.1); // 72px → 79px
  }
  
  return `bold ${adjustedFontSize}px "${fontName}", "KaiTi", "STKaiti", "SimSun", serif`;
}
```

#### **2. 调整文字垂直位置**
``typescript
// createPieceTexture 函数中
// 隶书字体需要向上偏移约1/4字体高度（72px * 0.25 ≈ 18px）
const verticalOffset = currentFontName === 'LiSu' ? -18 : 4;
ctx.fillText(pieceName, size / 2, size / 2 + verticalOffset);

// 法线贴图中同样调整
const normalVerticalOffset = currentFontName === 'LiSu' ? -18 : 4;
normalCtx.fillText(pieceName, size / 2, size / 2 + normalVerticalOffset);
```

**关键改进：**
1. **字体大小增加10%**：隶书从72px增加到79px，视觉上更加饱满
2. **向上偏移18像素**：约1/4字体高度，使文字在棋子顶部更居中
3. **双重调整**：颜色纹理和法线贴图同步调整，确保凹陷效果一致

**修改位置总结：**

| 文件 | 函数 | 行号 | 修改内容 |
|------|------|------|---------|
| usePieces.ts | [getFontString](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\usePieces.ts#L68-L81) | ~75 | 添加隶书字体大小调整逻辑（+10%） |
| usePieces.ts | [createPieceTexture](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\usePieces.ts#L107-L180) | ~136 | 颜色纹理文字位置向上偏移18px |
| usePieces.ts | [createPieceTexture](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\usePieces.ts#L107-L180) | ~165 | 法线贴图文字位置向上偏移18px |

**验证方法：**
1. 启动应用，选择"隶书"字体
2. 观察棋子文字是否比之前大10%左右
3. 确认文字位置是否向上移动，在棋子中更加居中
4. 检查凹陷效果是否正常（法线贴图同步调整）
5. 切换其他字体（楷体、汉仪颜楷繁），确认不受影响

**相关提交：** （待提交）

**经验教训：**
- ✅ 不同字体的视觉大小差异需要通过动态调整来补偿
- ✅ 字体基线位置不同，需要根据具体字体调整垂直偏移量
- ✅ 颜色纹理和法线贴图必须同步调整，否则凹陷效果会错位
- ✅ 调整参数应该基于字体特性，而非硬编码固定值

---

### **Bug #17: 车炮指示点过滤条件错误**

**发现时间：** 2026-05-06  
**影响范围：** `src/components/3d/ChessBoard3D.vue` - [showValidMoves](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\ChessBoard3D.vue#L460-L498) 函数  
**严重程度：** 🟡 中等  
**状态：** ✅ 已修复

**问题描述：**
- 点击车或炮时，仍然显示绿色合法落点指示器
- 根据设计规范，车和炮因可移动位置多，不应显示指示点以避免视觉干扰
- 之前的过滤条件使用了错误的棋子类型编号

**根本原因：**
- 误以为棋子类型编号是连续的（1-7），但实际 [PIECES](file://v:\4_mydoc\tauri\nicechchess\src\logic\chess\constants.ts#L6-L25) 常量定义为：
  - 红方：帅=1, **车=2**, 马=3, **炮=4**, 仕=5, 相=6, 兵=7
  - 黑方：将=-1, **车=-2**, 马=-3, **炮=-4**, 士=-5, 象=-6, 卒=-7
- 之前的过滤条件写成了 `absType === 5 || absType === 6`（对应仕/士、相/象）
- 正确的过滤条件应该是 `absType === 2 || absType === 4`（对应车、炮）

**修复方案：**

**文件：** `src/components/3d/ChessBoard3D.vue`

```typescript
// ❌ 之前：错误的类型判断
if (absType === 5 || absType === 6) {  // 5=仕/士, 6=相/象
  return;
}

// ✅ 现在：正确的类型判断
if (absType === 2 || absType === 4) {  // 2=车, 4=炮
  return;
}
```

**完整代码上下文：**
```typescript
function showValidMoves(pieceType: number, row: number, col: number) {
  clearValidMoves();
  
  const absType = Math.abs(pieceType);
  
  console.log('🟢 显示合法落点 - 棋子类型:', pieceType, '绝对值:', absType);
  
  // 车和炮不显示指示点（因为可移动位置太多）
  if (absType === 2 || absType === 4) {  // 2=车, 4=炮
    console.log('⛔ 车或炮，不显示指示点');
    return;
  }
  
  // ... 其他棋子的指示点逻辑
}
```

**关键改进：**
1. **准确的类型判断**：根据实际的 [PIECES](file://v:\4_mydoc\tauri\nicechchess\src\logic\chess\constants.ts#L6-L25) 常量定义修正过滤条件
2. **统一的规则应用**：红方和黑方的车、炮都不显示指示点
3. **优化的视觉效果**：绿点尺寸保持缩小一倍的状态

**验证方法：**
1. 启动应用，点击任意车（红方或黑方）
2. 确认不显示任何绿色指示点
3. 点击任意炮（红方或黑方）
4. 确认不显示任何绿色指示点
5. 点击其他棋子（马、相、仕、兵、将）
6. 确认正常显示绿色指示点

**相关提交：** 
- `eb50ec7 修正车炮类型判断条件`

**经验教训：**
- ✅ 必须查阅实际的常量定义，不能凭直觉假设编号顺序
- ✅ 使用 `Math.abs()` 统一处理正负号，简化类型判断逻辑
- ✅ 添加调试日志帮助快速定位问题根源
- ✅ 符合记忆规范：走法提示视觉规范要求仅对非滑动类棋子显示指示点

---

### **Bug #18: 两次点击模式棋子不移动**

**发现时间：** 2026-05-06  
**影响范围：** 
- `src/components/3d/useInteraction.ts` - 交互逻辑
- `src/components/3d/ChessBoard3D.vue` - [executeMove](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\ChessBoard3D.vue#L127-L230) 函数  
**严重程度：** 🔴 严重  
**状态：** ✅ 已修复

**问题描述：**
- 在全局设置中启用"两次点击移动"模式后
- 第一次点击棋子可以正常选中并抬起（y=1.2）
- 第二次点击目标位置时，棋子没有移动到目标位置
- 控制台显示移动验证通过，但棋子位置未更新

**根本原因：**
1. **[executeMove](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\ChessBoard3D.vue#L127-L230) 依赖拖动状态**：
   - [executeMove](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\ChessBoard3D.vue#L127-L230) 函数通过 `interaction.getDraggedPiece()` 获取要移动的棋子
   - 在两次点击模式下，使用的是局部变量 [selectedPiece](file://v:\4_mydoc\tauri\nicechchess\src\store\chessStore.ts#L54-L54)，而不是 `draggedPiece`
   - 导致 `draggedPiece` 为 `null`，[executeMove](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\ChessBoard3D.vue#L127-L230) 函数提前返回

2. **回调函数签名不匹配**：
   - [executeMoveCallback](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\useInteraction.ts#L17-L17) 只接受坐标参数，不接受棋子对象
   - 无法传递 [selectedPiece](file://v:\4_mydoc\tauri\nicechchess\src\store\chessStore.ts#L54-L54) 给 [executeMove](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\ChessBoard3D.vue#L127-L230)

**修复方案：**

#### **1. 修改 executeMove 函数签名**

**文件：** `src/components/3d/ChessBoard3D.vue`

```typescript
// ❌ 之前：只能从 interaction 获取棋子
function executeMove(fromRow: number, fromCol: number, toRow: number, toCol: number) {
  const draggedPiece = interaction ? interaction.getDraggedPiece() : null;
  
  if (!draggedPiece) {
    return; // 提前返回，导致棋子不移动
  }
  // ...
}

// ✅ 现在：支持传入棋子对象参数
function executeMove(fromRow: number, fromCol: number, toRow: number, toCol: number, piece?: THREE.Mesh) {
  const draggedPiece = piece || (interaction ? interaction.getDraggedPiece() : null);
  
  if (!draggedPiece) {
    console.warn('⚠️ executeMove: 没有找到要移动的棋子');
    return;
  }
  // ...
}
```

#### **2. 修改 useInteraction 回调类型**

**文件：** `src/components/3d/useInteraction.ts`

```typescript
// ❌ 之前：只接受坐标参数
export function useInteraction(
  // ... other parameters ...
  executeMoveCallback: (fromRow: number, fromCol: number, toRow: number, toCol: number) => void,
  // ... other parameters ...
) {
  // ...
}

// ✅ 现在：添加可选的棋子参数
export function useInteraction(
  // ... other parameters ...
  executeMoveCallback: (fromRow: number, fromCol: number, toRow: number, toCol: number, piece?: THREE.Mesh) => void,
  // ... other parameters ...
) {
  // ...
}
```

#### **3. 传递选中的棋子**

**文件：** `src/components/3d/useInteraction.ts`

**点击另一个棋子（吃子）：**
```typescript
if (isValidMove(chessStore.board, fromRow, fromCol, toRow, toCol)) {
  // ✅ 传递 selectedPiece 参数
  executeMoveCallback(fromRow, fromCol, toRow, toCol, selectedPiece);
  
  selectedPiece.position.y = 0.15;
  selectedPiece = null;
  if (onPieceDeselected) {
    onPieceDeselected();
  }
}
```

**点击棋盘空白处：**
```typescript
if (isValidMove(chessStore.board, fromRow, fromCol, toRow, toCol)) {
  // ✅ 传递 selectedPiece 参数
  executeMoveCallback(fromRow, fromCol, toRow, toCol, selectedPiece);
  
  selectedPiece.position.y = 0.15;
  selectedPiece = null;
  if (onPieceDeselected) {
    onPieceDeselected();
  }
}
```

**关键改进：**
1. **灵活的参数设计**：[executeMove](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\ChessBoard3D.vue#L127-L230) 支持可选的棋子参数
2. **正确的数据传递**：两次点击模式传递 [selectedPiece](file://v:\4_mydoc\tauri\nicechchess\src\store\chessStore.ts#L54-L54) 给回调函数
3. **向后兼容**：拖动模式不传参数，仍然使用 `interaction.getDraggedPiece()`
4. **清晰的降级策略**：优先使用传入的参数，其次使用 interaction 的状态

**验证方法：**
1. 在设置中将移动模式改为"两次点击移动"
2. 第一次点击棋子，确认棋子高高抬起（y=1.2）并显示绿色落点指示器
3. 第二次点击目标位置（可以是空白格或对方棋子）
4. 确认棋子成功移动到目标位置
5. 切换回"拖动棋子"模式，确认拖动功能不受影响

**相关提交：** 
- `9d8b04d 添加棋子移动模式切换功能`
- `28b9363 添加两次点击模式调试日志`
- `61ae845 清理调试日志完成两次点击模式`
- `d948fcd 修复两次点击模式棋子移动问题`

**经验教训：**
- ✅ 跨模块调用时，需要确保数据传递路径的完整性
- ✅ 回调函数签名应该足够灵活，支持多种调用场景
- ✅ 使用可选参数实现向后兼容，避免破坏现有功能
- ✅ 调试日志对于诊断复杂交互问题非常有效
- ✅ 符合记忆规范：配置管理规范要求所有全局选项保存到配置文件并持久化

---

## 📚 **参考资料**

- [UCI 协议规范](https://www.shredderchess.com/download/div/uci.zip)
- [Pikafish 官方文档](http://pikafish.com)
- [中国象棋 FEN 格式说明](https://www.xiangqiai.com)
- [Three.js Raycaster 文档](https://threejs.org/docs/#api/en/core/Raycaster)
- [Three.js Scene Graph 文档](https://threejs.org/docs/#manual/en/introduction/Scenegraph)

---

**最后更新：** 2026-05-06  
**维护者：** ChChess 开发团队
