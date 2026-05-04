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
              class="custom-input"
            />
            <button @click="selectEnginePath" class="custom-button">浏览...</button>
          </div>
        </div>

        <!-- 2. 棋盘纹理 -->
        <div class="setting-item">
          <label>棋盘纹理：</label>
          <div class="custom-select-wrapper">
            <select v-model="selectedTexture" @change="onTextureChange" class="custom-select">
              <option v-for="texture in availableTextures" :key="texture.value" :value="texture.value">
                {{ texture.label }}
              </option>
            </select>
          </div>
          <input 
            v-if="selectedTexture === 'custom'" 
            type="file" 
            accept="image/*" 
            @change="onCustomTextureUpload"
            class="custom-file-input"
          />
        </div>

        <!-- 3. 对方棋子字体方向 -->
        <div class="setting-item">
          <label>对方棋子字体方向：</label>
          <div class="custom-radio-group">
            <div 
              class="custom-radio" 
              :class="{ active: settings.ui.opponent_text_direction === 'down' }"
              @click="setOpponentDirection('down')"
            >
              <span class="radio-indicator"></span>
              <span class="radio-label">向下（默认）</span>
            </div>
            <div 
              class="custom-radio" 
              :class="{ active: settings.ui.opponent_text_direction === 'up' }"
              @click="setOpponentDirection('up')"
            >
              <span class="radio-indicator"></span>
              <span class="radio-label">向上</span>
            </div>
          </div>
        </div>

        <!-- 4. 棋子形状 -->
        <div class="setting-item">
          <label>棋子形状：</label>
          <div class="custom-radio-group">
            <div 
              class="custom-radio" 
              :class="{ active: settings.ui.piece_shape === 'cylinder' }"
              @click="setPieceShape('cylinder')"
            >
              <span class="radio-indicator"></span>
              <span class="radio-label">圆柱形（默认）</span>
            </div>
            <div 
              class="custom-radio" 
              :class="{ active: settings.ui.piece_shape === 'standard' }"
              @click="setPieceShape('standard')"
            >
              <span class="radio-indicator"></span>
              <span class="radio-label">标准型</span>
            </div>
          </div>
        </div>

        <!-- 5. AI线程数 -->
        <div class="setting-item">
          <label>AI线程数：</label>
          <div class="number-input-wrapper">
            <button class="number-btn minus" @click="decrementThreads">-</button>
            <input 
              type="number" 
              v-model.number="settings.engine.threads"
              min="1"
              max="64"
              @change="validateAndSaveThreads"
              class="custom-number-input"
            />
            <button class="number-btn plus" @click="incrementThreads">+</button>
          </div>
          <span class="hint">建议值：CPU核心数的一半</span>
        </div>

        <!-- 6. AI哈希表大小 -->
        <div class="setting-item">
          <label>AI哈希表大小 (MB)：</label>
          <div class="number-input-wrapper">
            <button class="number-btn minus" @click="decrementHash">-</button>
            <input 
              type="number" 
              v-model.number="settings.engine.hash"
              min="16"
              max="32768"
              step="256"
              @change="validateAndSaveHash"
              class="custom-number-input"
            />
            <button class="number-btn plus" @click="incrementHash">+</button>
          </div>
          <span class="hint">范围：16-32768 MB，默认 2048</span>
        </div>

        <!-- 7. AI计算模式 -->
        <div class="setting-item">
          <label>AI计算模式：</label>
          <div class="custom-radio-group">
            <div 
              class="custom-radio" 
              :class="{ active: settings.engine.calculation_mode === 'depth' }"
              @click="setCalculationMode('depth')"
            >
              <span class="radio-indicator"></span>
              <span class="radio-label">按深度计算</span>
            </div>
            <div 
              class="custom-radio" 
              :class="{ active: settings.engine.calculation_mode === 'time' }"
              @click="setCalculationMode('time')"
            >
              <span class="radio-indicator"></span>
              <span class="radio-label">按时间计算</span>
            </div>
          </div>
        </div>

        <!-- 8. 搜索深度 -->
        <div v-if="settings.engine.calculation_mode === 'depth'" class="setting-item">
          <label>搜索深度：</label>
          <div class="number-input-wrapper">
            <button class="number-btn minus" @click="decrementDepth">-</button>
            <input 
              type="number" 
              v-model.number="settings.engine.depth"
              min="1"
              max="100"
              @change="validateAndSaveDepth"
              class="custom-number-input"
            />
            <button class="number-btn plus" @click="incrementDepth">+</button>
          </div>
          <span class="hint">范围：1-100，默认 20</span>
        </div>

        <!-- 9. 思考时间 -->
        <div v-if="settings.engine.calculation_mode === 'time'" class="setting-item">
          <label>每步思考时间 (毫秒)：</label>
          <div class="number-input-wrapper">
            <button class="number-btn minus" @click="decrementMovetime">-</button>
            <input 
              type="number" 
              v-model.number="settings.engine.movetime"
              min="100"
              max="3000"
              step="100"
              @change="validateAndSaveMovetime"
              class="custom-number-input"
            />
            <button class="number-btn plus" @click="incrementMovetime">+</button>
          </div>
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
    board_texture: 'src/assets/textures/tx1/wood_diff_1k.jpg',
    opponent_text_direction: 'down',
    piece_shape: 'cylinder',
  },
});

const selectedTexture = ref<string>('tx1');
// 可用纹理列表（初始为空，等待扫描）
const availableTextures = ref<Array<{ value: string; label: string }>>([]);

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
    
    settings.value.ui.board_texture = config.ui.board_texture || 'src/assets/textures/tx1/wood_diff_1k.jpg';
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
    console.log('开始扫描纹理目录...');
    const textures = await scanTextureDirectories();
    console.log('Rust 返回的纹理列表:', textures);
    
    if (textures.length === 0) {
      console.warn('未找到任何纹理目录，使用默认值');
      availableTextures.value = [
        { value: 'tx1', label: '纹理1 (tx1)' },
        { value: 'tx2', label: '纹理2 (tx2)' },
        { value: 'custom', label: '自定义纹理...' },
      ];
      return;
    }
    
    availableTextures.value = textures.map(t => ({
      value: t,
      label: `纹理 (${t})`
    }));
    
    // 添加自定义选项
    availableTextures.value.push({ value: 'custom', label: '自定义纹理...' });
    
    console.log('可用纹理列表:', availableTextures.value);
  } catch (error) {
    console.error('扫描纹理失败:', error);
    // 降级到默认列表
    availableTextures.value = [
      { value: 'tx1', label: '纹理1 (tx1)' },
      { value: 'tx2', label: '纹理2 (tx2)' },
      { value: 'custom', label: '自定义纹理...' },
    ];
  }
}

// 保存配置
async function saveSettings() {
  try {
    // 加载完整配置
    const fullConfig = await loadConfig();
    
    // 更新引擎和UI配置
    fullConfig.engine = {
      pikafish_path: settings.value.engine.pikafish_path,
      threads: settings.value.engine.threads,
      hash: settings.value.engine.hash,
      calculation_mode: settings.value.engine.calculation_mode,
      movetime: settings.value.engine.movetime,
      depth: settings.value.engine.depth
    };
    
    fullConfig.ui = {
      board_texture: settings.value.ui.board_texture,
      opponent_text_direction: settings.value.ui.opponent_text_direction,
      piece_shape: settings.value.ui.piece_shape
    };
    
    // 保存完整配置
    await saveConfig(fullConfig);
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

// 设置对方棋子方向
function setOpponentDirection(direction: 'down' | 'up') {
  settings.value.ui.opponent_text_direction = direction;
  saveSettings();
}

// 设置棋子形状
function setPieceShape(shape: 'cylinder' | 'standard') {
  settings.value.ui.piece_shape = shape;
  saveSettings();
}

// 设置计算模式
function setCalculationMode(mode: 'time' | 'depth') {
  settings.value.engine.calculation_mode = mode;
  saveSettings();
}

// 线程数增减
function incrementThreads() {
  if (settings.value.engine.threads < 64) {
    settings.value.engine.threads++;
    saveSettings();
  }
}

function decrementThreads() {
  if (settings.value.engine.threads > 1) {
    settings.value.engine.threads--;
    saveSettings();
  }
}

// Hash大小增减
function incrementHash() {
  if (settings.value.engine.hash < 32768) {
    settings.value.engine.hash += 256;
    saveSettings();
  }
}

function decrementHash() {
  if (settings.value.engine.hash > 16) {
    settings.value.engine.hash -= 256;
    saveSettings();
  }
}

// 深度增减
function incrementDepth() {
  if (settings.value.engine.depth < 100) {
    settings.value.engine.depth++;
    saveSettings();
  }
}

function decrementDepth() {
  if (settings.value.engine.depth > 1) {
    settings.value.engine.depth--;
    saveSettings();
  }
}

// 思考时间增减
function incrementMovetime() {
  if (settings.value.engine.movetime < 3000) {
    settings.value.engine.movetime += 100;
    saveSettings();
  }
}

function decrementMovetime() {
  if (settings.value.engine.movetime > 100) {
    settings.value.engine.movetime -= 100;
    saveSettings();
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
    settings.value.ui.board_texture = `src/assets/textures/${selectedTexture.value}/wood_diff_1k.jpg`;
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

/* 自定义输入框样式 */
.custom-input {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  transition: all 0.3s;
  background-color: #fafafa;
}

.custom-input:focus {
  outline: none;
  border-color: #3498db;
  background-color: white;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.custom-button {
  padding: 10px 20px;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s;
}

.custom-button:hover {
  background-color: #2980b9;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(52, 152, 219, 0.3);
}

/* 自定义下拉框样式 */
.custom-select-wrapper {
  position: relative;
}

.custom-select {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  background-color: white;
  cursor: pointer;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  transition: all 0.3s;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%233498db' d='M6 9L1 4h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 36px;
}

.custom-select:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.custom-select:hover {
  border-color: #3498db;
}

/* 自定义文件输入 */
.custom-file-input {
  margin-top: 8px;
  padding: 8px;
  border: 2px dashed #e0e0e0;
  border-radius: 6px;
  width: 100%;
  cursor: pointer;
  transition: all 0.3s;
}

.custom-file-input:hover {
  border-color: #3498db;
  background-color: #f8f9fa;
}

/* 自定义单选框组 */
.custom-radio-group {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.custom-radio {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
  background-color: white;
  user-select: none;
}

.custom-radio:hover {
  border-color: #3498db;
  background-color: #f8f9fa;
}

.custom-radio.active {
  border-color: #3498db;
  background-color: #ebf5fb;
}

.radio-indicator {
  width: 18px;
  height: 18px;
  border: 2px solid #bdc3c7;
  border-radius: 50%;
  position: relative;
  transition: all 0.3s;
}

.custom-radio.active .radio-indicator {
  border-color: #3498db;
  background-color: #3498db;
}

.custom-radio.active .radio-indicator::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  background-color: white;
  border-radius: 50%;
}

.radio-label {
  font-size: 14px;
  color: #2c3e50;
  font-weight: 500;
}

/* 数字输入框包装器 */
.number-input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.custom-number-input {
  width: 100px;
  padding: 10px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  text-align: center;
  transition: all 0.3s;
}

.custom-number-input:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

.number-btn {
  width: 36px;
  height: 36px;
  border: 2px solid #e0e0e0;
  background-color: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 18px;
  font-weight: bold;
  color: #3498db;
  transition: all 0.3s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.number-btn:hover {
  border-color: #3498db;
  background-color: #ebf5fb;
  transform: scale(1.05);
}

.number-btn:active {
  transform: scale(0.95);
}

.hint {
  display: block;
  margin-top: 6px;
  font-size: 12px;
  color: #7f8c8d;
  font-style: italic;
}
</style>
