# 窗口状态记住和引擎优化

**日期**: 2026-05-09

---

## 1. 窗口状态记住功能

### 背景
之前使用手动代码保存窗口大小和位置，代码冗长且容易出错。

### 解决方案
使用 Tauri 官方插件 `tauri-plugin-window-state`。

### 实现步骤

#### 1.1 安装插件

**package.json**:
```json
"@tauri-apps/plugin-window-state": "^2"
```

**Cargo.toml**:
```toml
tauri-plugin-window-state = "2"
```

#### 1.2 注册插件

**lib.rs**:
```rust
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .setup(|app: &mut tauri::App| {
            use tauri_plugin_window_state::{StateFlags, WindowExt};
            
            if let Some(window) = app.get_webview_window("main") {
                let _result = window.restore_state(StateFlags::all());
                let _ = window.show();
            }
            Ok(())
        })
        // ...
}
```

#### 1.3 移除旧代码
- 删除了 App.vue 中约 150 行手动窗口状态管理代码
- 删除了 `getCurrentWindow` 和 `onUnmounted` 导入

#### 1.4 权限配置
**default.json**:
```json
"window-state:allow-restore-state",
"window-state:allow-save-window-state"
```

---

## 2. 引擎黑窗口隐藏

### 问题
启动 Pikafish 引擎时弹出黑色控制台窗口。

### 解决方案
使用 Windows API 的 `CREATE_NO_WINDOW` 标志。

### 实现代码

**engine.rs**:
```rust
#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

// 启动引擎时
let mut command = Command::new(&engine_path);
command
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

#[cfg(windows)]
{
    command.creation_flags(CREATE_NO_WINDOW);
}
```

---

## 3. 引擎输出转发到前端

### 需求
将 Pikafish 引擎的所有 UCI 输出（`info depth ...`、`bestmove ...`）显示在浏览器控制台。

### 实现方案

#### 3.1 Rust 后端

**engine.rs**:
```rust
use std::sync::{Arc, Mutex};
use std::io::{BufRead, BufReader};
use std::thread;
use tauri::{State, AppHandle, Emitter};

const ENGINE_OUTPUT_EVENT: &str = "engine-output";

pub struct EngineState {
    pub process: Mutex<Option<Child>>,
    pub best_move: Arc<Mutex<Option<String>>>,
}

// 启动引擎后，在后台线程读取输出
let reader = BufReader::new(stdout);
let app_handle_clone = app_handle.clone();
let best_move_clone = state.best_move.clone();

thread::spawn(move || {
    for line in reader.lines() {
        match line {
            Ok(l) => {
                // 发送到前端
                let _ = app_handle_clone.emit(ENGINE_OUTPUT_EVENT, &l);
                
                // 检测 bestmove
                if l.starts_with("bestmove") {
                    // 保存最佳着法
                }
            }
            Err(_) => break,
        }
    }
});
```

#### 3.2 前端监听

**engineService.ts**:
```typescript
import { listen } from '@tauri-apps/api/event';

let unlistenEngineOutput: UnlistenFn | null = null;

export async function startEngineOutputListener(): Promise<void> {
  unlistenEngineOutput = await listen<string>('engine-output', (event) => {
    console.log(`[引擎] ${event.payload}`);
  });
}

export function stopEngineOutputListener(): void {
  if (unlistenEngineOutput) {
    unlistenEngineOutput();
    unlistenEngineOutput = null;
  }
}
```

#### 3.3 调用监听器

**useAI.ts**:
```typescript
import { startEngineOutputListener } from '../../services/engineService';

async function triggerAIMove() {
  if (!engineStarted) {
    await startEngineOutputListener();  // 启动监听器
    await startEngine(enginePath);
    engineStarted = true;
  }
  // ...
}
```

---

## 4. 引擎路径解析

### 问题
前端传递的相对路径 `assets/pikafish/pikafish-vnni512.exe` 在 Rust 端无法找到。

### 解决方案
在 Rust 端实现多路径搜索。

**engine.rs**:
```rust
fn resolve_engine_path(relative_path: &str) -> Result<PathBuf, String> {
    use std::env;
    
    let clean_path = relative_path
        .trim_start_matches("assets/")
        .trim_start_matches("public/");
    
    let exe_dir = env::current_exe()?
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_default();
    
    let possible_paths = vec![
        exe_dir.join("assets").join(clean_path),
        exe_dir.join(clean_path),
        PathBuf::from("../assets").join(clean_path),
        PathBuf::from("assets").join(clean_path),
        env::current_dir()?.join("../assets").join(clean_path),
        env::current_dir()?.join("assets").join(clean_path),
        PathBuf::from(relative_path),
    ];
    
    for path in &possible_paths {
        if path.exists() && path.is_file() {
            return Ok(path.canonicalize()?);
        }
    }
    
    Err(format!("未找到引擎文件: {}", relative_path))
}
```

---

## 5. 引擎复用机制

### 问题
重复调用 `startEngine` 时报错"引擎已经在运行"。

### 解决方案
改为复用已运行的引擎实例。

```rust
if state.is_running() {
    println!("引擎已经在运行，复用现有实例");
    return Ok("引擎复用成功".to_string());
}
```

---

## 相关文件

- `src-tauri/src/engine.rs` - 引擎管理核心代码
- `src-tauri/src/lib.rs` - Tauri 插件注册
- `src-tauri/Cargo.toml` - Rust 依赖
- `package.json` - 前端依赖
- `src/services/engineService.ts` - 前端引擎服务
- `src/components/3d/useAI.ts` - AI 逻辑
- `src/App.vue` - 主应用组件（移除旧窗口代码）

---

## 注意事项

1. **CREATE_NO_WINDOW** 只在 Windows 平台生效
2. **引擎输出监听** 应该在应用启动时设置一次，而不是每次启动引擎时
3. **路径解析** 支持开发模式和便携版模式
