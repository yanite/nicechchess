// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod engine;
mod config;

use engine::{EngineState, start_engine, stop_engine, get_best_move};
use config::AppConfig;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(EngineState::new())
        .invoke_handler(tauri::generate_handler![
            greet,
            start_engine,
            stop_engine,
            get_best_move,
            load_config,
            save_config
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
