// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod engine;
mod config;

use engine::{EngineState, start_engine, stop_engine, get_best_move};
use config::AppConfig;
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 加载配置
#[tauri::command]
fn load_config() -> Result<AppConfig, String> {
    AppConfig::load()
}

/// 保存配置
#[tauri::command]
fn save_config(config: AppConfig) -> Result<(), String> {
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(EngineState::new())
        .setup(|app| {
            // 加载配置并恢复窗口状态
            if let Ok(config) = AppConfig::load() {
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
                }
            }
            
            // 监听窗口移动和调整大小事件
            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    match event {
                        tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                            // 延迟保存，避免频繁写入
                            let win = window_clone.clone();
                            std::thread::spawn(move || {
                                std::thread::sleep(std::time::Duration::from_millis(500));
                                if let Ok(position) = win.outer_position() {
                                    if let Ok(size) = win.outer_size() {
                                        if let Ok(mut config) = AppConfig::load() {
                                            config.window.x = position.x;
                                            config.window.y = position.y;
                                            config.window.width = size.width;
                                            config.window.height = size.height;
                                            let _ = config.save();
                                        }
                                    }
                                }
                            });
                        }
                        _ => {}
                    }
                });
            }
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            start_engine,
            stop_engine,
            get_best_move,
            load_config,
            save_config,
            save_window_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
