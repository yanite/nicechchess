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
pub fn start_engine(state: State<EngineState>) -> Result<String, String> {
    // 检查引擎是否已经在运行
    {
        let process_guard = state.process.lock().map_err(|e| format!("锁定失败: {}", e))?;
        if process_guard.is_some() {
            return Err("引擎已经在运行".to_string());
        }
    }

    // Pikafish 引擎路径（相对于项目根目录）
    let engine_path = "public/pikafish/pikafish-vnni512.exe";
    
    println!("正在启动引擎: {}", engine_path);
    println!("当前工作目录: {:?}", std::env::current_dir());

    // 启动引擎进程
    match Command::new(engine_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => {
            println!("引擎启动成功");
            *state.process.lock().map_err(|e| format!("锁定失败: {}", e))? = Some(child);
            
            // 发送 UCI 命令初始化引擎
            send_uci_command(&state)?;
            
            Ok("引擎启动成功".to_string())
        }
        Err(e) => {
            let error_msg = format!("启动引擎失败: {}", e);
            println!("{}", error_msg);
            Err(error_msg)
        }
    }
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
) -> Result<String, String> {
    let mut process_guard = state.process.lock().map_err(|e| format!("锁定失败: {}", e))?;
    if let Some(ref mut child) = *process_guard {
        // 设置局面
        set_position(child, &fen)?;
        
        // 开始思考
        go_think(child, depth)?;
        
        // 读取最佳着法
        let best_move = read_best_move(child)?;
        
        Ok(best_move)
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
            
            // 重新获取 stdin
            child.stdin = Some(stdin);
            
            // 读取响应直到 uciok
            if let Some(stdout) = &mut child.stdout {
                use std::io::BufRead;
                let reader = std::io::BufReader::new(stdout);
                for line in reader.lines() {
                    match line {
                        Ok(l) => {
                            println!("引擎响应: {}", l);
                            if l.trim() == "uciok" {
                                break;
                            }
                        }
                        Err(e) => {
                            return Err(format!("读取引擎响应失败: {}", e));
                        }
                    }
                }
            }
            
            // 发送 isready 命令
            if let Some(mut stdin) = child.stdin.take() {
                use std::io::Write;
                stdin.write_all(b"isready\n").map_err(|e| format!("发送 isready 命令失败: {}", e))?;
                stdin.flush().map_err(|e| format!("刷新缓冲区失败: {}", e))?;
                child.stdin = Some(stdin);
                
                // 读取响应直到 readyok
                if let Some(stdout) = &mut child.stdout {
                    use std::io::BufRead;
                    let reader = std::io::BufReader::new(stdout);
                    for line in reader.lines() {
                        match line {
                            Ok(l) => {
                                println!("引擎响应: {}", l);
                                if l.trim() == "readyok" {
                                    break;
                                }
                            }
                            Err(e) => {
                                return Err(format!("读取引擎响应失败: {}", e));
                            }
                        }
                    }
                }
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
fn go_think(child: &mut Child, depth: u32) -> Result<(), String> {
    if let Some(mut stdin) = child.stdin.take() {
        use std::io::Write;
        let command = format!("go depth {}\n", depth);
        stdin.write_all(command.as_bytes()).map_err(|e| format!("发送 go 命令失败: {}", e))?;
        stdin.flush().map_err(|e| format!("刷新缓冲区失败: {}", e))?;
        child.stdin = Some(stdin);
    }
    Ok(())
}

/// 读取最佳着法
fn read_best_move(child: &mut Child) -> Result<String, String> {
    println!("开始读取引擎最佳着法...");
    if let Some(stdout) = &mut child.stdout {
        use std::io::BufRead;
        let reader = std::io::BufReader::new(stdout);
        let mut line_count = 0;
        for line in reader.lines() {
            match line {
                Ok(l) => {
                    line_count += 1;
                    println!("引擎思考 [第{}行]: {}", line_count, l);
                    // 查找 bestmove 行
                    if l.starts_with("bestmove") {
                        let parts: Vec<&str> = l.split_whitespace().collect();
                        if parts.len() >= 2 {
                            println!("找到最佳着法: {}", parts[1]);
                            return Ok(parts[1].to_string());
                        } else {
                            println!("bestmove 行格式错误: {}", l);
                        }
                    }
                    // 防止无限循环，最多读取 1000 行
                    if line_count > 1000 {
                        return Err(format!("读取超过 1000 行仍未找到 bestmove"));
                    }
                }
                Err(e) => {
                    return Err(format!("读取引擎响应失败: {}", e));
                }
            }
        }
    }
    Err("未找到最佳着法".to_string())
}
