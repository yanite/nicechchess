// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod engine;

use engine::{EngineState, start_engine, stop_engine, get_best_move};
use std::path::PathBuf;
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn open_devtools(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    let window = app.get_webview_window("main")
        .ok_or("Failed to get main window")?;
    window.open_devtools();
    Ok(())
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
    
    // 尝试多个可能的路径（支持开发和便携版）
    let possible_paths = vec![
        PathBuf::from("../assets/textures"),            // 开发模式：从 src-tauri/ 向上
        PathBuf::from("assets/textures"),               // 便携版：exe 同级
        env::current_dir().unwrap_or_default().join("../assets/textures"), // 从当前工作目录向上
        env::current_dir().unwrap_or_default().join("assets/textures"), // 当前工作目录
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
    println!("[资源加载] 读取纹理资源于目录: {:?}", textures_path);
    
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
    println!("[资源加载] ✓ 找到 {} 个纹理目录", textures.len());
    Ok(textures)
}

/// 获取指定纹理目录下的所有贴图文件
#[tauri::command]
fn get_texture_files(texture_name: String) -> Result<Vec<String>, String> {
    use std::fs;
    use std::env;
    
    // 尝试多个可能的路径（支持开发和便携版）
    let possible_paths = vec![
        PathBuf::from(format!("../assets/textures/{}", texture_name)),
        PathBuf::from(format!("assets/textures/{}", texture_name)),
        env::current_dir().unwrap_or_default().join(format!("../assets/textures/{}", texture_name)),
        env::current_dir().unwrap_or_default().join(format!("assets/textures/{}", texture_name)),
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
    println!("[资源加载] 读取纹理文件于目录: {:?}", texture_path);
    
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
    println!("[资源加载] ✓ 找到 {} 个纹理文件", files.len());
    Ok(files)
}

/// 列出棋谱目录下的所有棋谱文件
#[tauri::command]
fn list_chess_scores() -> Result<Vec<String>, String> {
    use std::fs;
    use std::env;
    
    // 尝试多个可能的路径（支持开发和便携版）
    let possible_paths = vec![
        PathBuf::from("../assets/chess_score"),            // 开发模式：从 src-tauri/ 向上
        PathBuf::from("assets/chess_score"),               // 便携版：exe 同级
        env::current_dir().unwrap_or_default().join("../assets/chess_score"),
        env::current_dir().unwrap_or_default().join("assets/chess_score"),
    ];
    
    let mut chess_score_path = None;
    
    for path in possible_paths {
        if path.exists() && path.is_dir() {
            chess_score_path = Some(path);
            break;
        }
    }
    
    if chess_score_path.is_none() {
        eprintln!("未找到棋谱目录，返回空列表");
        return Ok(vec![]);
    }
    
    let chess_score_path = chess_score_path.unwrap();
    println!("[资源加载] 读取棋谱资源于目录: {:?}", chess_score_path);
    
    let mut scores = vec![];
    
    for entry in fs::read_dir(&chess_score_path).map_err(|e| format!("读取目录失败: {}", e))? {
        let entry = entry.map_err(|e| format!("读取条目失败: {}", e))?;
        let path = entry.path();
        
        if path.is_file() {
            if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                // 只返回 .txt 文件
                if file_name.ends_with(".txt") {
                    scores.push(file_name.to_string());
                }
            }
        }
    }
    
    scores.sort();
    println!("[资源加载] ✓ 找到 {} 个棋谱文件", scores.len());
    Ok(scores)
}

/// 读取指定棋谱文件的内容
#[tauri::command]
fn read_chess_score(filename: String) -> Result<String, String> {
    use std::fs;
    use std::env;
    
    // 尝试多个可能的路径（支持开发和便携版）
    let possible_paths = vec![
        PathBuf::from(format!("../assets/chess_score/{}", filename)),
        PathBuf::from(format!("assets/chess_score/{}", filename)),
        env::current_dir().unwrap_or_default().join(format!("../assets/chess_score/{}", filename)),
        env::current_dir().unwrap_or_default().join(format!("assets/chess_score/{}", filename)),
    ];
    
    let mut score_path = None;
    
    for path in possible_paths {
        if path.exists() && path.is_file() {
            score_path = Some(path);
            break;
        }
    }
    
    if score_path.is_none() {
        return Err(format!("未找到棋谱文件: {}", filename));
    }
    
    let score_path = score_path.unwrap();
    println!("[资源加载] 读取棋谱资源 \"{}\" 于目录: {:?}", filename, score_path);
    
    let content = fs::read_to_string(&score_path)
        .map_err(|e| format!("读取文件失败: {}", e))?;
    
    println!("[资源加载] ✓ 棋谱文件加载成功，长度: {} 字节", content.len());
    Ok(content)
}

/// 获取 assets 目录的绝对路径
/// 支持开发模式和便携版模式
#[tauri::command]
fn get_assets_dir() -> Result<String, String> {
    use std::env;
    
    // 获取当前可执行文件的目录
    let exe_dir = env::current_exe()
        .map_err(|e| format!("获取可执行文件路径失败: {}", e))?
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_default();
    
    println!("[资源加载] 可执行文件目录: {:?}", exe_dir);
    
    // 按优先级尝试查找 assets 目录
    let possible_paths = vec![
        exe_dir.join("assets"),                          // 便携版：exe 同级目录
        PathBuf::from("../assets"),                      // 开发模式：从 src-tauri/ 向上
        PathBuf::from("assets"),                         // 便携版：当前工作目录
        env::current_dir().unwrap_or_default().join("../assets"), // 开发模式：从 CWD 向上
        env::current_dir().unwrap_or_default().join("assets"),    // 当前工作目录（便携）
    ];
    
    for path in &possible_paths {
        println!("[资源加载] 检查路径: {:?}", path);
        if path.exists() && path.is_dir() {
            let abs_path = path.canonicalize()
                .map_err(|e| format!("获取绝对路径失败: {}", e))?;
            let result = abs_path.to_string_lossy().to_string();
            println!("[资源加载] ✓ 找到 assets 目录: {}", result);
            return Ok(result);
        }
    }
    
    let err_msg = format!(
        "未找到 assets 目录，已检查: {:?}", 
        possible_paths.iter().map(|p| p.to_string_lossy().to_string()).collect::<Vec<_>>()
    );
    println!("[资源加载] ✗ {}", err_msg);
    Err(err_msg)
}

/// 获取指定资源文件的绝对路径
/// 支持开发模式和便携版模式
#[tauri::command]
fn get_asset_path(relative_path: String) -> Result<String, String> {
    use std::env;
    
    // 去除开头的 assets/ 前缀，因为函数会自行添加
    let clean_path = relative_path
        .strip_prefix("assets/")
        .unwrap_or(&relative_path)
        .to_string();
    
    // 获取当前可执行文件的目录
    let exe_dir = env::current_exe()
        .map_err(|e| format!("获取可执行文件路径失败: {}", e))?
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_default();
    
    // 按优先级尝试查找资源文件
    let possible_paths = vec![
        exe_dir.join("assets").join(&clean_path),        // 便携版
        PathBuf::from("../assets").join(&clean_path),    // 开发模式：从 src-tauri/ 向上
        PathBuf::from("assets").join(&clean_path),       // 便携版：当前工作目录
        env::current_dir().unwrap_or_default().join("../assets").join(&clean_path),
        env::current_dir().unwrap_or_default().join("assets").join(&clean_path),
    ];
    
    for path in &possible_paths {
        if path.exists() {
            let abs_path = path.canonicalize()
                .map_err(|e| format!("获取绝对路径失败: {}", e))?;
            let result = abs_path.to_string_lossy().to_string();
            println!("[资源加载] 读取资源 \"{}\" 于目录 \"{}\"", relative_path, result);
            return Ok(result);
        }
    }
    
    let err_msg = format!("未找到资源文件: {}", relative_path);
    println!("[资源加载] ✗ {}", err_msg);
    Err(err_msg)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .build()
        )
        .manage(EngineState::new())
        .setup(|app: &mut tauri::App| {
            use tauri_plugin_window_state::{StateFlags, WindowExt};
            
            if let Some(window) = app.get_webview_window("main") {
                let _result = window.restore_state(StateFlags::all());
                let _ = window.show();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            open_devtools,
            start_engine,
            stop_engine,
            get_best_move,
            update_engine_config,
            scan_texture_directories,
            get_texture_files,
            list_chess_scores,
            read_chess_score,
            get_assets_dir,
            get_asset_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
