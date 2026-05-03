// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod engine;

use engine::{EngineState, start_engine, stop_engine, get_best_move};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
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
            get_best_move
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
