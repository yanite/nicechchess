import { invoke } from '@tauri-apps/api/core';

export interface WindowConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EngineConfig {
  pikafish_path: string;
}

export interface UIConfig {
  board_texture: string;
}

export interface AppConfig {
  window: WindowConfig;
  engine: EngineConfig;
  ui: UIConfig;
}

/**
 * 加载配置
 */
export async function loadConfig(): Promise<AppConfig> {
  return await invoke<AppConfig>('load_config');
}

/**
 * 保存配置
 */
export async function saveConfig(config: AppConfig): Promise<void> {
  return await invoke('save_config', { config });
}

/**
 * 保存窗口状态
 */
export async function saveWindowState(): Promise<void> {
  return await invoke('save_window_state');
}
