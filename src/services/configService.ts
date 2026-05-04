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
  opponent_text_direction: 'down' | 'up';
  piece_shape: 'cylinder' | 'standard';
}

export interface AppConfig {
  window: WindowConfig;
  engine: EngineConfig;
  ui: UIConfig;
}

// 默认配置
const DEFAULT_CONFIG: AppConfig = {
  window: {
    x: 100,
    y: 100,
    width: 1280,
    height: 720,
  },
  engine: {
    pikafish_path: 'public/pikafish/pikafish-vnni512.exe',
  },
  ui: {
    board_texture: 'src/assets/textures/tx1/dark_wood_diff_1k.jpg',
    opponent_text_direction: 'down',
    piece_shape: 'cylinder',
  },
};

const CONFIG_KEY = 'chchess_config';

/**
 * 加载配置（从localStorage）
 */
export async function loadConfig(): Promise<AppConfig> {
  try {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) {
      const config = JSON.parse(saved);
      console.log('配置加载成功（本地存储）');
      return { ...DEFAULT_CONFIG, ...config };
    }
  } catch (error) {
    console.error('加载配置失败:', error);
  }
  
  // 返回默认配置
  return { ...DEFAULT_CONFIG };
}

/**
 * 保存配置（到localStorage并通知Rust端）
 */
export async function saveConfig(config: AppConfig): Promise<void> {
  try {
    // 保存到localStorage
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    console.log('配置已保存（本地存储）');
    
    // 通知Rust端配置变更（只传递需要的部分）
    await notifyRustConfigChange(config);
  } catch (error) {
    console.error('保存配置失败:', error);
    throw error;
  }
}

/**
 * 通知Rust端配置变更
 */
async function notifyRustConfigChange(config: AppConfig): Promise<void> {
  try {
    // 只通知引擎路径变更，其他UI配置由前端处理
    await invoke('update_engine_config', { 
      pikafishPath: config.engine.pikafish_path 
    });
  } catch (error) {
    console.error('通知Rust配置变更失败:', error);
  }
}

/**
 * 保存窗口状态
 */
export async function saveWindowState(windowState: WindowConfig): Promise<void> {
  try {
    const config = await loadConfig();
    config.window = windowState;
    await saveConfig(config);
  } catch (error) {
    console.error('保存窗口状态失败:', error);
  }
}

/**
 * 扫描可用的纹理目录
 */
export async function scanTextureDirectories(): Promise<string[]> {
  try {
    return await invoke('scan_texture_directories');
  } catch (error) {
    console.error('扫描纹理目录失败:', error);
    return ['tx1']; // 降级返回默认值
  }
}
