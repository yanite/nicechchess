// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod engine;

use engine::{EngineState, start_engine, stop_engine, get_best_move};
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
    use std::env;
    
    // 尝试多个可能的路径
    let possible_paths = vec![
        PathBuf::from("src/assets/textures"),           // 开发模式
        PathBuf::from("../src/assets/textures"),        // 从 target 目录向上
        env::current_dir().unwrap_or_default().join("src/assets/textures"), // 当前工作目录
    ];
    
    let mut textures_path = None;
    
    for path in possible_paths {
        if path.exists() && path.is_dir() {
            textures_path = Some(path);
            break;
        }
    }
    
    if textures_path.is_none() {
        eprintln!("未找到纹理目录，返回默认值");
        return Ok(vec!["tx1".to_string(), "tx2".to_string()]);
    }
    
    let textures_path = textures_path.unwrap();
    println!("找到纹理目录: {:?}", textures_path);
    
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
    println!("扫描到的纹理: {:?}", textures);
    Ok(textures)
}

/// 获取指定纹理目录下的所有贴图文件
#[tauri::command]
fn get_texture_files(texture_name: String) -> Result<Vec<String>, String> {
    use std::fs;
    use std::env;
    
    // 尝试多个可能的路径
    let possible_paths = vec![
        PathBuf::from(format!("src/assets/textures/{}", texture_name)),
        PathBuf::from(format!("../src/assets/textures/{}", texture_name)),
        env::current_dir().unwrap_or_default().join(format!("src/assets/textures/{}", texture_name)),
    ];
    
    let mut texture_path = None;
    
    for path in possible_paths {
        if path.exists() && path.is_dir() {
            texture_path = Some(path);
            break;
        }
    }
    
    if texture_path.is_none() {
        return Err(format!("未找到纹理目录: {}", texture_name));
    }
    
    let texture_path = texture_path.unwrap();
    println!("扫描纹理目录: {:?}", texture_path);
    
    let mut files = vec![];
    
    for entry in fs::read_dir(&texture_path).map_err(|e| format!("读取目录失败: {}", e))? {
        let entry = entry.map_err(|e| format!("读取条目失败: {}", e))?;
        let path = entry.path();
        
        if path.is_file() {
            if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                // 只返回图片文件
                if file_name.ends_with(".jpg") || file_name.ends_with(".jpeg") || 
                   file_name.ends_with(".png") || file_name.ends_with(".exr") {
                    files.push(file_name.to_string());
                }
            }
        }
    }
    
    files.sort();
    println!("找到的贴图文件: {:?}", files);
    Ok(files)
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
            scan_texture_directories,
            get_texture_files
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
