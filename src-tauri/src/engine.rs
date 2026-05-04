use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::State;

/// 引擎状态结构体
pub struct EngineState {
    pub process: Mutex<Option<Child>>,
}

impl EngineState {
    pub fn new() -> Self {
        EngineState {
            process: Mutex::new(None),
        }
    }
}

/// 启动 Pikafish 引擎
#[tauri::command]
pub fn start_engine(engine_path: String, state: State<EngineState>) -> Result<String, String> {
    // 检查引擎是否已经在运行
    {
        let process_guard = state.process.lock().map_err(|e| format!("锁定失败: {}", e))?;
        if process_guard.is_some() {
            return Err("引擎已经在运行".to_string());
        }
    }
    
    println!("正在启动引擎: {}", engine_path);
    println!("当前工作目录: {:?}", std::env::current_dir());

    // 启动引擎进程
    match Command::new(&engine_path)