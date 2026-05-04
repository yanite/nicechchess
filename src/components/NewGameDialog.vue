<template>
  <div v-if="visible" class="new-game-dialog-overlay" @click.self="close">
    <div class="new-game-dialog">
      <div class="dialog-header">
        <h2>新开局设置</h2>
        <button class="close-btn" @click="close">×</button>
      </div>
      
      <div class="dialog-content">
        <!-- 黑棋玩家配置 -->
        <div class="player-section">
          <h3>黑棋玩家</h3>
          <div class="form-group">
            <label>玩家名称：</label>
            <input 
              type="text" 
              v-model="blackPlayer.name" 
              placeholder="请输入玩家名称"
              maxlength="20"
              class="custom-input"
            />
          </div>
          
          <div class="form-group checkbox-group">
            <div 
              class="custom-checkbox" 
              :class="{ checked: blackPlayer.useAI }"
              @click="toggleBlackAI"
            >
              <span class="checkbox-indicator"></span>
              <span class="checkbox-label">使用AI</span>
            </div>
            
            <div v-if="blackPlayer.useAI" class="ai-level-group">
              <label>AI等级：</label>
              <div class="slider-wrapper">
                <input 
                  type="range" 
                  v-model.number="blackPlayer.aiLevel" 
                  min="0" 
                  max="20" 
                  step="1"
                  class="custom-slider"
                />
                <span class="level-value">{{ blackPlayer.aiLevel }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 分隔线 -->
        <div class="divider"></div>

        <!-- 红棋玩家配置 -->
        <div class="player-section">
          <h3>红棋玩家</h3>
          <div class="form-group">
            <label>玩家名称：</label>
            <input 
              type="text" 
              v-model="redPlayer.name" 
              placeholder="请输入玩家名称"
              maxlength="20"
              class="custom-input"
            />
          </div>
          
          <div class="form-group checkbox-group">
            <div 
              class="custom-checkbox" 
              :class="{ checked: redPlayer.useAI }"
              @click="toggleRedAI"
            >
              <span class="checkbox-indicator"></span>
              <span class="checkbox-label">使用AI</span>
            </div>
            
            <div v-if="redPlayer.useAI" class="ai-level-group">
              <label>AI等级：</label>
              <div class="slider-wrapper">
                <input 
                  type="range" 
                  v-model.number="redPlayer.aiLevel" 
                  min="0" 
                  max="20" 
                  step="1"
                  class="custom-slider"
                />
                <span class="level-value">{{ redPlayer.aiLevel }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 分隔线 -->
        <div class="divider"></div>

        <!-- 时间设置 -->
        <div class="time-section">
          <h3>时间设置</h3>
          <div class="form-group">
            <label>每步棋用时（秒）：</label>
            <div class="number-input-wrapper">
              <button class="number-btn minus" @click="decrementTime">-</button>
              <input 
                type="number" 
                v-model.number="timePerMove" 
                min="1" 
                max="300"
                placeholder="请输入秒数"
                class="custom-number-input"
              />
              <button class="number-btn plus" @click="incrementTime">+</button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="dialog-footer">
        <button class="cancel-btn" @click="close">取消</button>
        <button class="confirm-btn" @click="confirm">开始游戏</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { loadConfig, saveConfig } from '../services/configService';

// 玩家配置接口
interface PlayerConfig {
  name: string;
  useAI: boolean;
  aiLevel: number;
}

// Props
const props = defineProps<{
  visible: boolean;
}>();

// Emits
const emit = defineEmits<{
  close: [];
  confirm: [config: NewGameConfig];
}>();

// 新游戏配置接口
export interface NewGameConfig {
  blackPlayer: PlayerConfig;
  redPlayer: PlayerConfig;
  timePerMove: number;
}

// 黑棋玩家配置（默认：AI启用，等级15）
const blackPlayer = ref<PlayerConfig>({
  name: 'Play1',
  useAI: true,
  aiLevel: 15
});

// 红棋玩家配置（默认：AI禁用）
const redPlayer = ref<PlayerConfig>({
  name: 'Play2',
  useAI: false,
  aiLevel: 15
});

// 每步棋用时（默认：30秒）
const timePerMove = ref<number>(30);

/**
 * 关闭对话框
 */
function close() {
  emit('close');
}

/**
 * 确认并开始游戏
 */
async function confirm() {
  // 验证输入
  if (!blackPlayer.value.name.trim()) {
    alert('请输入黑棋玩家名称');
    return;
  }
  
  if (!redPlayer.value.name.trim()) {
    alert('请输入红棋玩家名称');
    return;
  }
  
  if (timePerMove.value < 1 || timePerMove.value > 300) {
    alert('每步棋用时必须在1-300秒之间');
    return;
  }
  
  const config: NewGameConfig = {
    blackPlayer: { ...blackPlayer.value },
    redPlayer: { ...redPlayer.value },
    timePerMove: timePerMove.value
  };
  
  // 保存当前设置为下次使用的默认值
  try {
    const currentConfig = await loadConfig();
    currentConfig.new_game_defaults = {
      black_use_ai: blackPlayer.value.useAI,
      red_use_ai: redPlayer.value.useAI,
      black_ai_level: blackPlayer.value.aiLevel,
      red_ai_level: redPlayer.value.aiLevel,
      time_per_move: timePerMove.value
    };
    await saveConfig(currentConfig);
    console.log('已保存新游戏默认配置到config.yaml');
  } catch (error) {
    console.error('保存配置失败:', error);
  }
  
  emit('confirm', config);
  close();
}

/**
 * 监听对话框显示状态，从config.yaml加载默认值
 */
watch(() => props.visible, async (newVal) => {
  if (newVal) {
    try {
      // 从config.yaml加载配置
      const config = await loadConfig();
      
      // 使用保存的默认值
      blackPlayer.value = {
        name: 'Play1',
        useAI: config.new_game_defaults.black_use_ai,
        aiLevel: config.new_game_defaults.black_ai_level
      };
      
      redPlayer.value = {
        name: 'Play2',
        useAI: config.new_game_defaults.red_use_ai,
        aiLevel: config.new_game_defaults.red_ai_level
      };
      
      timePerMove.value = config.new_game_defaults.time_per_move;
      
      console.log('已从config.yaml加载新游戏默认配置');
    } catch (error) {
      console.error('加载配置失败，使用硬编码默认值:', error);
      // 降级到硬编码默认值
      blackPlayer.value = {
        name: 'Play1',
        useAI: true,
        aiLevel: 15
      };
      
      redPlayer.value = {
        name: 'Play2',
        useAI: false,
        aiLevel: 15
      };
      
      timePerMove.value = 30;
    }
  }
});

/**
 * 切换黑方AI
 */
function toggleBlackAI() {
  blackPlayer.value.useAI = !blackPlayer.value.useAI;
}

/**
 * 切换红方AI
 */
function toggleRedAI() {
  redPlayer.value.useAI = !redPlayer.value.useAI;
}

/**
 * 增加时间
 */
function incrementTime() {
  if (timePerMove.value < 300) {
    timePerMove.value++;
  }
}

/**
 * 减少时间
 */
function decrementTime() {
  if (timePerMove.value > 1) {
    timePerMove.value--;
  }
}

</script>

<style scoped>
.new-game-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.new-game-dialog {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
}

.dialog-header h2 {
  margin: 0;
  color: #333;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: #666;
  font-size: 28px;
  cursor: pointer;
  padding: 0;
  width: 28px;
  height: 28px;
  line-height: 1;
}

.close-btn:hover {
  color: #333;
}

.dialog-content {
  padding: 20px;
}

.player-section {
  margin-bottom: 16px;
}

.player-section h3 {
  color: #333;
  font-size: 16px;
  margin: 0 0 12px 0;
  padding-bottom: 6px;
  border-bottom: 1px solid #e0e0e0;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  color: #555;
  margin-bottom: 6px;
  font-size: 14px;
}

.form-group input[type="text"],
.form-group input[type="number"] {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  background: white;
  color: #333;
  font-size: 14px;
}

.form-group input[type="text"]:focus,
.form-group input[type="number"]:focus {
  outline: none;
  border-color: #4a90e2;
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: #555;
  font-size: 14px;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.ai-level-group {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: 22px;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 4px;
}

.ai-level-group label {
  margin: 0;
  white-space: nowrap;
}

.ai-level-group input[type="range"] {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #d0d0d0;
  border-radius: 2px;
  outline: none;
}

.ai-level-group input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: #4a90e2;
  border-radius: 50%;
  cursor: pointer;
}

.level-value {
  color: #333;
  font-weight: 600;
  font-size: 14px;
  min-width: 28px;
  text-align: center;
}

.divider {
  height: 1px;
  background: #e0e0e0;
  margin: 16px 0;
}

.time-section h3 {
  color: #333;
  font-size: 16px;
  margin: 0 0 12px 0;
  padding-bottom: 6px;
  border-bottom: 1px solid #e0e0e0;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #e0e0e0;
}

.dialog-footer button {
  padding: 8px 20px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  background: white;
  color: #333;
}

.dialog-footer button:hover {
  background: #f5f5f5;
}

.confirm-btn {
  background: #4a90e2;
  color: white;
  border-color: #4a90e2;
}

.confirm-btn:hover {
  background: #357abd;
}

/* 滚动条样式 */
.new-game-dialog::-webkit-scrollbar {
  width: 6px;
}

.new-game-dialog::-webkit-scrollbar-track {
  background: #f0f0f0;
}

.new-game-dialog::-webkit-scrollbar-thumb {
  background: #c0c0c0;
  border-radius: 3px;
}

.new-game-dialog::-webkit-scrollbar-thumb:hover {
  background: #a0a0a0;
}

/* 自定义输入框样式 */
.custom-input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  background: white;
  color: #333;
  font-size: 14px;
}

.custom-input:focus {
  outline: none;
  border-color: #4a90e2;
}

/* 自定义复选框样式 */
.custom-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: #555;
  font-size: 14px;
}

.custom-checkbox .checkbox-indicator {
  width: 16px;
  height: 16px;
  background: white;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  position: relative;
}

.custom-checkbox .checkbox-indicator::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 4px;
  width: 6px;
  height: 12px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
  opacity: 0;
}

.custom-checkbox.checked .checkbox-indicator {
  background: #4a90e2;
  border-color: #4a90e2;
}

.custom-checkbox.checked .checkbox-indicator::after {
  opacity: 1;
}

/* 滑块包装器 */
.slider-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: 22px;
  padding: 8px;
  background: #f5f5f5;
  border-radius: 4px;
}

/* 自定义滑块样式 */
.custom-slider {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #d0d0d0;
  border-radius: 2px;
  outline: none;
}

.custom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: #4a90e2;
  border-radius: 50%;
  cursor: pointer;
}

/* 自定义数字输入框样式 */
.number-input-wrapper {
  display: flex;
  align-items: center;
}

.number-input-wrapper .number-btn {
  width: 32px;
  height: 32px;
  background: #f0f0f0;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.number-input-wrapper .number-btn:hover {
  background: #e0e0e0;
}

.number-input-wrapper .number-btn.minus {
  margin-right: 4px;
}

.number-input-wrapper .number-btn.plus {
  margin-left: 4px;
}

.number-input-wrapper .custom-number-input {
  width: 60px;
  padding: 8px 10px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  background: white;
  color: #333;
  font-size: 14px;
  text-align: center;
}

.number-input-wrapper .custom-number-input:focus {
  outline: none;
  border-color: #4a90e2;
}
</style>