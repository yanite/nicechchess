// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod engine;
mod config;

use engine::{EngineState, start_engine, stop_engine, get_best_move};
use config::AppConfig;
use tauri::Manager;
use std::sync::{Arc, Mutex};
use std::path::PathBuf;
use tauri::State;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 加载配置
#[tauri::command]
fn load_config(shared_config: State<Arc<Mutex<AppConfig>>>) -> Result<AppConfig, String> {
    let config = shared_config.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(config.clone())
}

/// 保存配置
#[tauri::command]
fn save_config(new_config: AppConfig, shared_config: State<Arc<Mutex<AppConfig>>>) -> Result<(), String> {
    let mut config = shared_config.lock().map_err(|e| format!("Lock error: {}", e))?;
    *config = new_config.clone();
    config.save()
}

/// 保存窗口状态到配置
#[tauri::command]
fn save_window_state(app_handle: tauri::AppHandle) -> Result<(), String> {
    let window = app_handle.get_webview_window("main").ok_or("未找到主窗口")?;
    
    let position = window.outer_position().map_err(|e| format!("获取窗口位置失败: {}", e))?;
    let size = window.outer_size().map_err(|e| format!("获取窗口大小失败: {}", e))?;
    
    let mut config = AppConfig::load()?;
    config.window.x = position.x;
    config.window.y = position.y;
    config.window.width = size.width;
    config.window.height = size.height;
    
    config.save()?;
    Ok(())
}

/// 扫描纹理目录
#[tauri::command]
fn scan_texture_directories() -> Result<Vec<String>, String> {
    use std::fs;
    
    let textures_path = PathBuf::from("src/assets/textures");
    
    if !textures_path.exists() {
        return Ok(vec![]);
    }
    
    let mut textures = vec![];
    
    for entry in fs::read_dir(&textures_path).map_err(|e| format!("读取目录失败: {}", e))? {
        let entry = entry.map_err(|e| format!("读取条目失败: {}", e))?;
        let path = entry.path();
        
        if path.is_dir() {
            if let Some(dir_name) = path.file_name().and_then(|n| n.to_str()) {
                textures.push(dir_name.to_string());
            }
        }
    }
    
    textures.sort();
    Ok(textures)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(EngineState::new())
        .setup(|app| {
            // 加载配置并恢复窗口状态（只执行一次）
            let config = AppConfig::load().unwrap_or_else(|_| AppConfig {
                window: config::WindowConfig {
                    x: 100,
                    y: 100,
                    width: 1280,
                    height: 720,
                },
                engine: config::EngineConfig {
                    pikafish_path: "public/pikafish/pikafish-vnni512.exe".to_string(),
                },
                ui: config::UIConfig {
                    board_texture: "src/assets/textures/tx1/dark_wood_diff_1k.jpg".to_string(),
                    opponent_text_direction: "down".to_string(),
                    piece_shape: "cylinder".to_string(),
                },
            });
            
            // 将配置存储在 Arc<Mutex<>> 中，供后续使用
            let shared_config = Arc::new(Mutex::new(config.clone()));
            
            if let Some(window) = app.get_webview_window("main") {
                // 设置窗口位置和大小
                let _ = window.set_position(tauri::PhysicalPosition::new(
                    config.window.x,
                    config.window.y
                ));
                let _ = window.set_size(tauri::PhysicalSize::new(
                    config.window.width,
                    config.window.height
                ));
                
                println!("窗口状态已恢复: x={}, y={}, w={}, h={}", 
                    config.window.x, config.window.y, 
                    config.window.width, config.window.height);
                
                // 监听窗口移动和调整大小事件
                let window_clone = window.clone();
                let config_clone = shared_config.clone();
                window.on_window_event(move |event| {
                    match event {
                        tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                            use std::sync::atomic::{AtomicBool, Ordering};
                            static SAVE_PENDING: AtomicBool = AtomicBool::new(false);
                            
                            // 如果已有保存任务在等待，则跳过
                            if SAVE_PENDING.swap(true, Ordering::SeqCst) {
                                return;
                            }
                            
                            // 延迟保存，避免频繁写入（增加到2秒）
                            let win = window_clone.clone();
                            let cfg = config_clone.clone();
                            std::thread::spawn(move || {
                                std::thread::sleep(std::time::Duration::from_millis(2000));
                                
                                if let Ok(position) = win.outer_position() {
                                    if let Ok(size) = win.outer_size() {
                                        // 更新内存中的配置
                                        if let Ok(mut config) = cfg.lock() {
                                            config.window.x = position.x;
                                            config.window.y = position.y;
                                            config.window.width = size.width;
                                            config.window.height = size.height;
                                            
                                            // 保存到文件
                                            if let Err(e) = config.save() {
                                                eprintln!("保存配置失败: {}", e);
                                            } else {
                                                println!("窗口状态已保存: x={}, y={}, w={}, h={}", 
                                                    position.x, position.y, size.width, size.height);
                                            }
                                        }
                                    }
                                }
                                
                                // 重置标志，允许下次保存
                                SAVE_PENDING.store(false, Ordering::SeqCst);
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
        .invoke_handler(tauri::generate_handler![
            greet,
            start_engine,
            stop_engine,
            get_best_move,
            load_config,
            save_config,
            save_window_state,
            scan_texture_directories
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
