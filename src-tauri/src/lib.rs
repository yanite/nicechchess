// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod engine;

use engine::{EngineState, start_engine, stop_engine, get_best_move};
use tauri::Manager;
use std::path::PathBuf;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 更新引擎配置（接收前端传来的配置）
#[tauri::command]
fn update_engine_config(pikafish_path: String) -> Result<(), String> {
    println!("收到引擎路径配置: {}", pikafish_path);
    // TODO: 这里可以执行引擎初始化等操作
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
        .setup(|_app| {
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            start_engine,
            stop_engine,
            get_best_move,
            update_engine_config,
            scan_texture_directories
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
