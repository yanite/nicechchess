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

        <!-- 5. AI线程数 -->
        <div class="setting-item">
          <label>AI线程数：</label>
          <input 
            type="number" 
            v-model.number="settings.engine.threads"
            min="1"
            max="64"
            @change="validateAndSaveThreads"
          />
          <span class="hint">建议值：CPU核心数的一半</span>
        </div>

        <!-- 6. AI哈希表大小 -->
        <div class="setting-item">
          <label>AI哈希表大小 (MB)：</label>
          <input 
            type="number" 
            v-model.number="settings.engine.hash"
            min="16"
            max="32768"
            step="256"
            @change="validateAndSaveHash"
          />
          <span class="hint">范围：16-32768 MB，默认 2048</span>
        </div>

        <!-- 7. AI计算模式 -->
        <div class="setting-item">
          <label>AI计算模式：</label>
          <div class="radio-group">
            <label>
              <input 
                type="radio" 
                value="depth" 
                v-model="settings.engine.calculation_mode"
                @change="saveSettings"
              />
              按深度计算
            </label>
            <label>
              <input 
                type="radio" 
                value="time" 
                v-model="settings.engine.calculation_mode"
                @change="saveSettings"
              />
              按时间计算
            </label>
          </div>
        </div>

        <!-- 8. 搜索深度 -->
        <div v-if="settings.engine.calculation_mode === 'depth'" class="setting-item">
          <label>搜索深度：</label>
          <input 
            type="number" 
            v-model.number="settings.engine.depth"
            min="1"
            max="100"
            @change="validateAndSaveDepth"
          />
          <span class="hint">范围：1-100，默认 20</span>
        </div>

        <!-- 9. 思考时间 -->
        <div v-if="settings.engine.calculation_mode === 'time'" class="setting-item">
          <label>每步思考时间 (毫秒)：</label>
          <input 
            type="number" 
            v-model.number="settings.engine.movetime"
            min="100"
            max="3000"
            step="100"
            @change="validateAndSaveMovetime"
          />
          <span class="hint">范围：100-3000 ms，默认 1000</span>
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
import { loadConfig, saveConfig, scanTextureDirectories } from '../services/configService';

interface Settings {
  engine: {
    pikafish_path: string;
    threads: number;        // CPU线程数
    hash: number;           // 哈希表大小(MB)
    calculation_mode: 'time' | 'depth';  // 计算模式：时间或深度
    movetime: number;       // 每步思考时间(毫秒)
    depth: number;          // 搜索深度
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
    threads: Math.max(1, Math.floor(navigator.hardwareConcurrency || 4) / 2),  // CPU核心数的一半
    hash: 2048,
    calculation_mode: 'depth',
    movetime: 1000,
    depth: 20,
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
    settings.value.engine.threads = (config.engine as any).threads ?? 2;
    settings.value.engine.hash = (config.engine as any).hash ?? 64;
    settings.value.engine.calculation_mode = (config.engine as any).calculation_mode || 'time';
    settings.value.engine.movetime = (config.engine as any).movetime ?? 1000;
    settings.value.engine.depth = (config.engine as any).depth ?? 10;
    
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
    const textures = await scanTextureDirectories();
    
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

// 验证并保存线程数
function validateAndSaveThreads() {
  if (settings.value.engine.threads < 1) {
    settings.value.engine.threads = 1;
  } else if (settings.value.engine.threads > 64) {
    settings.value.engine.threads = 64;
  }
  saveSettings();
}

// 验证并保存哈希表大小
function validateAndSaveHash() {
  if (settings.value.engine.hash < 16) {
    settings.value.engine.hash = 16;
  } else if (settings.value.engine.hash > 32768) {
    settings.value.engine.hash = 32768;
  }
  saveSettings();
}

// 验证并保存搜索深度
function validateAndSaveDepth() {
  if (settings.value.engine.depth < 1) {
    settings.value.engine.depth = 1;
  } else if (settings.value.engine.depth > 100) {
    settings.value.engine.depth = 100;
  }
  saveSettings();
}

// 验证并保存思考时间
function validateAndSaveMovetime() {
  if (settings.value.engine.movetime < 100) {
    settings.value.engine.movetime = 100;
  } else if (settings.value.engine.movetime > 3000) {
    settings.value.engine.movetime = 3000;
  }
  saveSettings();
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
