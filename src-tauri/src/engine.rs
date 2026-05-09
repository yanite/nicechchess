use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::io::{BufRead, BufReader};
use std::thread;
use std::path::PathBuf;
use tauri::{State, AppHandle, Emitter};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const ENGINE_OUTPUT_EVENT: &str = "engine-output";

/// 解析引擎路径，支持相对路径和绝对路径
fn resolve_engine_path(relative_path: &str) -> Result<PathBuf, String> {
    use std::env;
    
    let clean_path = relative_path
        .trim_start_matches("assets/")
        .trim_start_matches("public/");
    
    let exe_dir = env::current_exe()
        .map_err(|e| format!("获取可执行文件路径失败: {}", e))?
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_default();
    
    let possible_paths = vec![
        exe_dir.join("assets").join(clean_path),
        exe_dir.join(clean_path),
        PathBuf::from("../assets").join(clean_path),
        PathBuf::from("assets").join(clean_path),
        env::current_dir().unwrap_or_default().join("../assets").join(clean_path),
        env::current_dir().unwrap_or_default().join("assets").join(clean_path),
        PathBuf::from(relative_path),
    ];
    
    for path in &possible_paths {
        if path.exists() && path.is_file() {
            let abs_path = path.canonicalize()
                .map_err(|e| format!("获取绝对路径失败: {}", e))?;
            return Ok(abs_path);
        }
    }
    
    Err(format!("未找到引擎文件: {}\n已检查路径: {:?}", relative_path, possible_paths))
}

/// 引擎状态结构体
pub struct EngineState {
    pub process: Mutex<Option<Child>>,
    pub best_move: Arc<Mutex<Option<String>>>,
}

impl EngineState {
    pub fn new() -> Self {
        EngineState {
            process: Mutex::new(None),
            best_move: Arc::new(Mutex::new(None)),
        }
    }
 
    pub fn is_running(&self) -> bool {
        if let Ok(process_guard) = self.process.lock() {
            process_guard.is_some()
        } else {
            false
        }
    }
    
    pub fn set_best_move(&self, m: String) {
        if let Ok(mut guard) = self.best_move.lock() {
            *guard = Some(m);
        }
    }
    
    pub fn take_best_move(&self) -> Option<String> {
        if let Ok(mut guard) = self.best_move.lock() {
            guard.take()
        } else {
            None
        }
    }
}

/// 启动 Pikafish 引擎
#[tauri::command]
pub fn start_engine(
    engine_path: String, 
    state: State<EngineState>,
    app_handle: AppHandle
) -> Result<String, String> {
    // 如果引擎已经在运行，复用它
    if state.is_running() {
        println!("引擎已经在运行，复用现有实例");
        return Ok("引擎复用成功".to_string());
    }
    
    // 解析引擎路径
    let resolved_path = resolve_engine_path(&engine_path)?;
    println!("解析后的引擎路径: {:?}", resolved_path);
    
    // 启动引擎进程
    let mut command = Command::new(&resolved_path);
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    
    #[cfg(windows)]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }
    
    let mut child = command.spawn().map_err(|e| {
        let error_msg = format!("启动引擎失败: {}", e);
        println!("{}", error_msg);
        error_msg
    })?;
    
    println!("引擎启动成功");
    
    // 获取 stdout 用于读取引擎输出
    let stdout = child.stdout.take().ok_or("无法获取引擎 stdout")?;
    let reader = BufReader::new(stdout);
    
    // 克隆 Arc 用于后台线程
    let best_move_clone = state.best_move.clone();
    
    // 在后台线程中读取引擎输出并发送到前端
    let app_handle_clone = app_handle.clone();
    thread::spawn(move || {
        use std::io::{BufRead, BufReader};
        for line in reader.lines() {
            match line {
                Ok(l) => {
                    let _ = app_handle_clone.emit(ENGINE_OUTPUT_EVENT, &l);
                    
                    if l.starts_with("bestmove") {
                        let parts: Vec<&str> = l.split_whitespace().collect();
                        if parts.len() >= 2 {
                            if let Ok(mut guard) = best_move_clone.lock() {
                                *guard = Some(parts[1].to_string());
                            }
                        }
                    }
                }
                Err(_) => break,
            }
        }
    });
    
    // 保存进程
    {
        let mut process_guard = state.process.lock().map_err(|e| format!("锁定失败: {}", e))?;
        *process_guard = Some(child);
    }
    
    // 发送 UCI 命令初始化引擎
    send_uci_command(&state)?;
    
    Ok("引擎启动成功".to_string())
}

/// 停止引擎
#[tauri::command]
pub fn stop_engine(state: State<EngineState>) -> Result<String, String> {
    let mut process_guard = state.process.lock().map_err(|e| format!("锁定失败: {}", e))?;
    if let Some(mut child) = process_guard.take() {
        // 发送 quit 命令
        if let Some(mut stdin) = child.stdin.take() {
            use std::io::Write;
            let _ = stdin.write_all(b"quit\n");
        }
        
        // 等待进程结束
        let _ = child.wait();
        println!("引擎已停止");
        Ok("引擎已停止".to_string())
    } else {
        Err("引擎未启动".to_string())
    }
}

/// 获取 AI 最佳着法
#[tauri::command]
pub fn get_best_move(
    state: State<EngineState>,
    fen: String,
    depth: u32,
    skill_level: Option<u32>,
    threads: Option<u32>,
    hash: Option<u32>,
    calculation_mode: Option<String>,  // "time" or "depth"
    movetime: Option<u32>,
) -> Result<String, String> {
    let mut process_guard = state.process.lock().map_err(|e| format!("锁定失败: {}", e))?;
    if let Some(ref mut child) = *process_guard {
        // 清空之前的最佳着法
        if let Ok(mut guard) = state.best_move.lock() {
            *guard = None;
        }
        
        // 设置线程数（如果提供）
        if let Some(t) = threads {
            set_option(child, "Threads", t)?;
        }
        
        // 设置哈希表大小（如果提供）
        if let Some(h) = hash {
            set_option(child, "Hash", h)?;
        }
        
        // 设置 AI 等级（如果提供）
        if let Some(level) = skill_level {
            set_skill_level(child, level)?;
        }
        
        // 设置局面
        set_position(child, &fen)?;
        
        // 开始思考（根据模式选择）
        let mode = calculation_mode.unwrap_or_else(|| "depth".to_string());
        if mode == "time" {
            let time = movetime.unwrap_or(1000);
            go_think_time(child, time)?;
        } else {
            go_think_depth(child, depth)?;
        }
        
        // 等待最佳着法（轮询，最多 60 秒）
        for _ in 0..600 {
            thread::sleep(std::time::Duration::from_millis(100));
            if let Some(m) = state.take_best_move() {
                return Ok(m);
            }
        }
        
        Err("计算超时".to_string())
    } else {
        Err("引擎未启动".to_string())
    }
}

/// 发送 UCI 命令初始化引擎
fn send_uci_command(state: &State<EngineState>) -> Result<(), String> {
    let mut process_guard = state.process.lock().map_err(|e| format!("锁定失败: {}", e))?;
    if let Some(ref mut child) = *process_guard {
        if let Some(mut stdin) = child.stdin.take() {
            use std::io::Write;
            
            // 发送 uci 命令
            stdin.write_all(b"uci\n").map_err(|e| format!("发送 UCI 命令失败: {}", e))?;
            stdin.flush().map_err(|e| format!("刷新缓冲区失败: {}", e))?;
            child.stdin = Some(stdin);
            
            // 发送 isready 命令
            if let Some(mut stdin) = child.stdin.take() {
                use std::io::Write;
                stdin.write_all(b"isready\n").map_err(|e| format!("发送 isready 命令失败: {}", e))?;
                stdin.flush().map_err(|e| format!("刷新缓冲区失败: {}", e))?;
                child.stdin = Some(stdin);
            }
        }
    }
    Ok(())
}

/// 设置局面
fn set_position(child: &mut Child, fen: &str) -> Result<(), String> {
    println!("发送 position 命令，FEN: {}", fen);
    if let Some(mut stdin) = child.stdin.take() {
        use std::io::Write;
        let command = format!("position fen {}\n", fen);
        stdin.write_all(command.as_bytes()).map_err(|e| format!("发送 position 命令失败: {}", e))?;
        stdin.flush().map_err(|e| format!("刷新缓冲区失败: {}", e))?;
        child.stdin = Some(stdin);
    }
    Ok(())
}

/// 开始思考
fn go_think_depth(child: &mut Child, depth: u32) -> Result<(), String> {
    if let Some(mut stdin) = child.stdin.take() {
        use std::io::Write;
        let command = format!("go depth {}\n", depth);
        stdin.write_all(command.as_bytes()).map_err(|e| format!("发送 go 命令失败: {}", e))?;
        stdin.flush().map_err(|e| format!("刷新缓冲区失败: {}", e))?;
        child.stdin = Some(stdin);
    }
    Ok(())
}

/// 开始思考（时间模式）
fn go_think_time(child: &mut Child, time: u32) -> Result<(), String> {
    if let Some(mut stdin) = child.stdin.take() {
        use std::io::Write;
        let command = format!("go movetime {}\n", time);
        stdin.write_all(command.as_bytes()).map_err(|e| format!("发送 go 命令失败: {}", e))?;
        stdin.flush().map_err(|e| format!("刷新缓冲区失败: {}", e))?;
        child.stdin = Some(stdin);
    }
    Ok(())
}

/// 设置 AI 等级
fn set_skill_level(child: &mut Child, level: u32) -> Result<(), String> {
    println!("设置 AI 等级: {}", level);
    if let Some(mut stdin) = child.stdin.take() {
        use std::io::Write;
        let command = format!("setoption name Skill Level value {}\n", level);
        stdin.write_all(command.as_bytes()).map_err(|e| format!("发送 setoption 命令失败: {}", e))?;
        stdin.flush().map_err(|e| format!("刷新缓冲区失败: {}", e))?;
        child.stdin = Some(stdin);
    }
    Ok(())
}

/// 通用 setoption 设置函数
fn set_option(child: &mut Child, name: &str, value: u32) -> Result<(), String> {
    println!("设置选项: {} = {}", name, value);
    if let Some(mut stdin) = child.stdin.take() {
        use std::io::Write;
        let command = format!("setoption name {} value {}\n", name, value);
        stdin.write_all(command.as_bytes()).map_err(|e| format!("发送 setoption 命令失败: {}", e))?;
        stdin.flush().map_err(|e| format!("刷新缓冲区失败: {}", e))?;
        child.stdin = Some(stdin);
    }
    Ok(())
}
