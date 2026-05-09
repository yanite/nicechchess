import { invoke } from '@tauri-apps/api/core';

export interface WindowConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EngineConfig {
  pikafish_path: string;
  threads: number;        // CPU线程数
  hash: number;           // 哈希表大小(MB)
  calculation_mode: 'time' | 'depth';  // 计算模式
  movetime: number;       // 每步思考时间(毫秒)
  depth: number;          // 搜索深度
}

export interface UIConfig {
  board_texture: string;
  opponent_text_direction: 'down' | 'up';
  piece_shape: 'cylinder' | 'standard';
  piece_text_random_rotation: number; // 棋子文字随机旋转角度范围（0-360度，0表示不随机）
  chess_font: '隶书' | '中國龍豪行書' | '系统楷体'; // 棋子字体选择
  move_mode: 'drag' | 'click'; // 移动模式：拖动或两次点击
}

// 新建游戏默认配置
export interface NewGameDefaultConfig {
  black_use_ai: boolean;
  red_use_ai: boolean;
  black_ai_level: number;
  red_ai_level: number;
  time_per_move: number;  // 每步用时(秒)
}

export interface AppConfig {
  window: WindowConfig;
  engine: EngineConfig;
  ui: UIConfig;
  new_game_defaults: NewGameDefaultConfig;
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
    pikafish_path: 'assets/pikafish/pikafish-vnni512.exe',
    threads: Math.max(1, Math.floor((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4) / 2),
    hash: 2048,
    calculation_mode: 'depth',
    movetime: 1000,
    depth: 20,
  },
  ui: {
    board_texture: 'assets/textures/tx1/wood_diff_1k.jpg',
    opponent_text_direction: 'down',
    piece_shape: 'cylinder',
    piece_text_random_rotation: 0, // 默认不随机旋转
    chess_font: '隶书', // 默认使用系统自带的隶书字体
    move_mode: 'drag', // 默认拖动模式
  },
  new_game_defaults: {
    black_use_ai: true,
    red_use_ai: false,
    black_ai_level: 15,
    red_ai_level: 15,
    time_per_move: 30,
  },
};

const CONFIG_KEY = 'chchess_config';

/**
 * 迁移旧路径配置到新的 assets/ 前缀格式
 */
function migrateConfigPaths(config: AppConfig): AppConfig {
  const migrated = { ...config };
  let changed = false;
  
  // 迁移引擎路径
  if (config.engine.pikafish_path.startsWith('public/pikafish/')) {
    migrated.engine = { ...config.engine };
    migrated.engine.pikafish_path = config.engine.pikafish_path.replace('public/pikafish/', 'assets/pikafish/');
    changed = true;
  }
  
  // 迁移纹理路径 - 处理多种旧格式
  if (config.ui.board_texture.startsWith('src/assets/')) {
    migrated.ui = { ...config.ui };
    migrated.ui.board_texture = config.ui.board_texture.replace('src/assets/', 'assets/');
    changed = true;
  } else if (config.ui.board_texture.startsWith('textures/')) {
    migrated.ui = { ...config.ui };
    migrated.ui.board_texture = 'assets/' + config.ui.board_texture;
    changed = true;
  }
  
  if (changed) {
    console.log('[配置迁移] 旧路径已迁移到 assets/ 格式');
  }
  
  return migrated;
}

/**
 * 加载配置（从localStorage）
 */
export async function loadConfig(): Promise<AppConfig> {
  try {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) {
      const config = JSON.parse(saved);
      const mergedConfig = { ...DEFAULT_CONFIG, ...config };
      // 迁移旧路径格式
      const migratedConfig = migrateConfigPaths(mergedConfig);
      if (JSON.stringify(migratedConfig) !== JSON.stringify(mergedConfig)) {
        // 路径已迁移，保存更新后的配置
        localStorage.setItem(CONFIG_KEY, JSON.stringify(migratedConfig));
        console.log('[配置迁移] 已将旧路径迁移到 assets/ 格式');
      }
      return migratedConfig;
    }
  } catch (error) {
    console.error('加载配置失败:', error);
  }
  
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

/**
 * 获取指定纹理目录下的所有贴图文件
 */
export async function getTextureFiles(textureName: string): Promise<string[]> {
  try {
    return await invoke('get_texture_files', { textureName });
  } catch (error) {
    console.error(`获取纹理文件失败 (${textureName}):`, error);
    return [];
  }
}
