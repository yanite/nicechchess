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
            />
          </div>
          
          <div class="form-group checkbox-group">
            <label class="checkbox-label">
              <input 
                type="checkbox" 
                v-model="blackPlayer.useAI"
              />
              使用AI
            </label>
            
            <div v-if="blackPlayer.useAI" class="ai-level-group">
              <label>AI等级：</label>
              <input 
                type="range" 
                v-model.number="blackPlayer.aiLevel" 
                min="0" 
                max="20" 
                step="1"
              />
              <span class="level-value">{{ blackPlayer.aiLevel }}</span>
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
            />
          </div>
          
          <div class="form-group checkbox-group">
            <label class="checkbox-label">
              <input 
                type="checkbox" 
                v-model="redPlayer.useAI"
              />
              使用AI
            </label>
            
            <div v-if="redPlayer.useAI" class="ai-level-group">
              <label>AI等级：</label>
              <input 
                type="range" 
                v-model.number="redPlayer.aiLevel" 
                min="0" 
                max="20" 
                step="1"
              />
              <span class="level-value">{{ redPlayer.aiLevel }}</span>
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
            <input 
              type="number" 
              v-model.number="timePerMove" 
              min="1" 
              max="300"
              placeholder="请输入秒数"
            />
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
function confirm() {
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
  
  emit('confirm', config);
  close();
}

/**
 * 监听对话框显示状态，重置表单
 */
watch(() => props.visible, (newVal) => {
  if (newVal) {
    // 对话框打开时重置为默认值
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
});
</script>

<style scoped>
.new-game-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(4px);
}

.new-game-dialog {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  overflow-y: auto;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 2px solid rgba(255, 255, 255, 0.2);
}

.dialog-header h2 {
  margin: 0;
  color: white;
  font-size: 24px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 32px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  line-height: 1;
  transition: transform 0.2s;
}

.close-btn:hover {
  transform: scale(1.2);
}

.dialog-content {
  padding: 24px;
}

.player-section {
  margin-bottom: 20px;
}

.player-section h3 {
  color: white;
  font-size: 18px;
  margin: 0 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 8px;
  font-size: 14px;
}

.form-group input[type="text"],
.form-group input[type="number"] {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  font-size: 14px;
  transition: all 0.3s;
}

.form-group input[type="text"]:focus,
.form-group input[type="number"]:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.15);
}

.form-group input[type="text"]::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.ai-level-group {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: 26px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

.ai-level-group label {
  margin: 0;
  white-space: nowrap;
}

.ai-level-group input[type="range"] {
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
  outline: none;
}

.ai-level-group input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  background: white;
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.level-value {
  color: white;
  font-weight: 600;
  font-size: 16px;
  min-width: 30px;
  text-align: center;
}

.divider {
  height: 1px;
  background: linear-gradient(to right, transparent, rgba(255, 255, 255, 0.3), transparent);
  margin: 24px 0;
}

.time-section h3 {
  color: white;
  font-size: 18px;
  margin: 0 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 2px solid rgba(255, 255, 255, 0.2);
}

.dialog-footer button {
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.cancel-btn {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.cancel-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.confirm-btn {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(245, 87, 108, 0.4);
}

.confirm-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(245, 87, 108, 0.5);
}

/* 滚动条样式 */
.new-game-dialog::-webkit-scrollbar {
  width: 8px;
}

.new-game-dialog::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.new-game-dialog::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
  border-radius: 4px;
}

.new-game-dialog::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.4);
}
</style>
