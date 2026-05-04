<template>
  <div v-if="visible" class="settings-dialog-overlay" @click.self="close">
    <div class="settings-dialog">
      <div class="dialog-header">
        <h2>游戏设置</h2>
        <button class="close-btn" @click="close">×</button>
      </div>
      
      <div class="dialog-content">
        <!-- 1. AI引擎路径 -->
        <div class="setting-item">
          <label>AI引擎路径：</label>
          <div class="path-input-group">
            <input 
              type="text" 
              v-model="settings.engine.pikafish_path" 
              readonly 
              placeholder="点击选择pikafish引擎路径"
            />
            <button @click="selectEnginePath">浏览...</button>
          </div>
        </div>

        <!-- 2. 棋盘纹理 -->
        <div class="setting-item">
          <label>棋盘纹理：</label>
          <select v-model="selectedTexture" @change="onTextureChange">
            <option v-for="texture in availableTextures" :key="texture.value" :value="texture.value">
              {{ texture.label }}
            </option>
          </select>
          <input 
            v-if="selectedTexture === 'custom'" 
            type="file" 
            accept="image/*" 
            @change="onCustomTextureUpload"
            style="margin-top: 8px;"
          />
        </div>

        <!-- 3. 对方棋子字体方向 -->
        <div class="setting-item">
          <label>对方棋子字体方向：</label>
          <div class="radio-group">
            <label>
              <input 
                type="radio" 
                value="down" 
                v-model="settings.ui.opponent_text_direction"
                @change="saveSettings"
              />
              向下（默认）
            </label>
            <label>
              <input 
                type="radio" 
                value="up" 
                v-model="settings.ui.opponent_text_direction"
                @change="saveSettings"
              />
              向上
            </label>
          </div>
        </div>

        <!-- 4. 棋子形状 -->
        <div class="setting-item">
          <label>棋子形状：</label>
          <div class="radio-group">
            <label>
              <input 
                type="radio" 
                value="cylinder" 
                v-model="settings.ui.piece_shape"
                @change="saveSettings"
              />
              圆柱形（默认）
            </label>
            <label>
              <input 
                type="radio" 
                value="standard" 
                v-model="settings.ui.piece_shape"
                @change="saveSettings"
              />
              标准型
            </label>
          </div>
        </div>
      </div>
      
      <div class="dialog-footer">
        <button @click="close">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { loadConfig, saveConfig } from '../services/configService';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';

interface Settings {
  engine: {
    pikafish_path: string;
  };
  ui: {
    board_texture: string;
    opponent_text_direction: 'down' | 'up';
    piece_shape: 'cylinder' | 'standard';
  };
}

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'settings-changed', settings: Settings): void;
}>();

const settings = ref<Settings>({
  engine: {
    pikafish_path: 'public/pikafish/pikafish-vnni512.exe',
  },
  ui: {
    board_texture: 'src/assets/textures/tx1/dark_wood_diff_1k.jpg',
    opponent_text_direction: 'down',
    piece_shape: 'cylinder',
  },
});

const selectedTexture = ref<string>('tx1');
const availableTextures = ref<Array<{ value: string; label: string }>>([
  { value: 'tx1', label: '纹理1 (tx1)' },
  { value: 'tx2', label: '纹理2 (tx2)' },
  { value: 'custom', label: '自定义纹理...' },
]);

// 加载配置
async function loadSettings() {
  try {
    const config = await loadConfig();
    settings.value.engine.pikafish_path = config.engine.pikafish_path;
    settings.value.ui.board_texture = config.ui.board_texture || 'src/assets/textures/tx1/dark_wood_diff_1k.jpg';
    settings.value.ui.opponent_text_direction = (config.ui as any).opponent_text_direction || 'down';
    settings.value.ui.piece_shape = (config.ui as any).piece_shape || 'cylinder';
    
    // 从路径中提取纹理名称
    const textureMatch = settings.value.ui.board_texture.match(/textures\/([^/]+)/);
    if (textureMatch) {
      selectedTexture.value = textureMatch[1];
    }
    
    // 扫描可用纹理
    await scanAvailableTextures();
    
    console.log('设置已加载:', settings.value);
  } catch (error) {
    console.error('加载配置失败:', error);
  }
}

// 扫描可用的纹理目录
async function scanAvailableTextures() {
  try {
    const textures: string[] = await invoke('scan_texture_directories');
    
    availableTextures.value = textures.map(t => ({
      value: t,
      label: `纹理 (${t})`
    }));
    
    // 添加自定义选项
    availableTextures.value.push({ value: 'custom', label: '自定义纹理...' });
    
    console.log('可用纹理:', availableTextures.value);
  } catch (error) {
    console.error('扫描纹理失败:', error);
    // 降级到默认列表
    availableTextures.value = [
      { value: 'tx1', label: '纹理1 (tx1)' },
      { value: 'custom', label: '自定义纹理...' },
    ];
  }
}

// 保存配置
async function saveSettings() {
  try {
    await saveConfig(settings.value);
    emit('settings-changed', settings.value);
    console.log('设置已保存:', settings.value);
  } catch (error) {
    console.error('保存配置失败:', error);
  }
}

// 选择引擎路径
async function selectEnginePath() {
  try {
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'Executable',
        extensions: ['exe']
      }]
    });
    
    if (selected) {
      settings.value.engine.pikafish_path = selected as string;
      await saveSettings();
    }
  } catch (error) {
    console.error('选择文件失败:', error);
  }
}

// 纹理切换
function onTextureChange() {
  if (selectedTexture.value !== 'custom') {
    // 构建纹理路径
    settings.value.ui.board_texture = `src/assets/textures/${selectedTexture.value}/dark_wood_diff_1k.jpg`;
    saveSettings();
  }
}

// 自定义纹理上传
function onCustomTextureUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  
  if (file) {
    // TODO: 处理自定义图片上传
    console.log('自定义纹理:', file.name);
    // 这里需要将文件复制到assets目录并更新路径
  }
}

// 关闭对话框
function close() {
  emit('update:visible', false);
}

// 组件挂载时加载配置
onMounted(() => {
  loadSettings();
});
</script>

<style scoped>
.settings-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.settings-dialog {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
}

.dialog-header h2 {
  margin: 0;
  color: #2c3e50;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: #95a5a6;
  line-height: 1;
  padding: 0;
  width: 30px;
  height: 30px;
}

.close-btn:hover {
  color: #e74c3c;
}

.dialog-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.setting-item {
  margin-bottom: 20px;
}

.setting-item label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: #34495e;
}

.path-input-group {
  display: flex;
  gap: 10px;
}

.path-input-group input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #bdc3c7;
  border-radius: 4px;
  font-size: 14px;
}

.path-input-group button {
  padding: 8px 16px;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.path-input-group button:hover {
  background-color: #2980b9;
}

select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #bdc3c7;
  border-radius: 4px;
  font-size: 14px;
  background-color: white;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.radio-group label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: normal;
  cursor: pointer;
}

.radio-group input[type="radio"] {
  width: auto;
  margin: 0;
}

.dialog-footer {
  padding: 15px 20px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  justify-content: flex-end;
}

.dialog-footer button {
  padding: 10px 24px;
  background-color: #95a5a6;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

.dialog-footer button:hover {
  background-color: #7f8c8d;
}
</style>
