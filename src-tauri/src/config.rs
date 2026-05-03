use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// 应用程序配置结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// 窗口位置和大小
    pub window: WindowConfig,
    /// AI 引擎配置
    pub engine: EngineConfig,
    /// UI 配置
    pub ui: UIConfig,
}

/// 窗口配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowConfig {
    /// 窗口 X 坐标
    pub x: i32,
    /// 窗口 Y 坐标
    pub y: i32,
    /// 窗口宽度
    pub width: u32,
    /// 窗口高度
    pub height: u32,
}

/// 引擎配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineConfig {
    /// Pikafish 引擎路径（相对或绝对路径）
    pub pikafish_path: String,
}

/// UI 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UIConfig {
    /// 棋盘纹理路径
    pub board_texture: String,
}

impl AppConfig {
    /// 获取配置文件路径
    fn get_config_path() -> PathBuf {
        // 使用应用数据目录存储配置
        if let Some(config_dir) = dirs::config_dir() {
            config_dir.join("chchess").join("config.yaml")
        } else {
            // 降级方案：使用当前目录
            PathBuf::from("config.yaml")
        }
    }

    /// 加载配置
    pub fn load() -> Result<Self, String> {
        let config_path = Self::get_config_path();
        
        if !config_path.exists() {
            println!("配置文件不存在，创建默认配置");
            let default_config = Self::default();
            default_config.save()?;
            return Ok(default_config);
        }

        let content = fs::read_to_string(&config_path)
            .map_err(|e| format!("读取配置文件失败: {}", e))?;
        
        let config: AppConfig = serde_yaml::from_str(&content)
            .map_err(|e| format!("解析配置文件失败: {}", e))?;
        
        println!("配置加载成功: {:?}", config_path);
        Ok(config)
    }

    /// 保存配置
    pub fn save(&self) -> Result<(), String> {
        let config_path = Self::get_config_path();
        
        // 确保目录存在
        if let Some(parent) = config_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("创建配置目录失败: {}", e))?;
        }

        let content = serde_yaml::to_string(self)
            .map_err(|e| format!("序列化配置失败: {}", e))?;
        
        fs::write(&config_path, content)
            .map_err(|e| format!("写入配置文件失败: {}", e))?;
        
        println!("配置已保存: {:?}", config_path);
        Ok(())
    }

    /// 获取默认配置
    fn default() -> Self {
        Self {
            window: WindowConfig {
                x: 100,
                y: 100,
                width: 1280,
                height: 720,
            },
            engine: EngineConfig {
                pikafish_path: "public/pikafish/pikafish-vnni512.exe".to_string(),
            },
            ui: UIConfig {
                board_texture: "src/assets/textures/tx1/dark_wood_diff_1k.jpg".to_string(),
            },
        }
    }
}
