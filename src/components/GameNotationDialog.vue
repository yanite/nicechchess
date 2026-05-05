<template>
  <div v-if="visible" class="notation-dialog-overlay" @click.self="close">
    <div class="notation-dialog">
      <div class="dialog-header">
        <h2>棋谱管理</h2>
        <button class="close-btn" @click="close">×</button>
      </div>
      
      <div class="dialog-content">
        <!-- 元数据显示区 -->
        <div v-if="metadata.length > 0" class="metadata-section">
          <h3>棋谱信息</h3>
          <div class="metadata-list">
            <div v-for="(line, index) in metadata" :key="index" class="metadata-item">
              {{ line }}
            </div>
          </div>
        </div>

        <!-- 棋谱编辑区 -->
        <div class="notation-editor-section">
          <h3>着法记录</h3>
          <textarea 
            v-model="notationText" 
            class="notation-textarea"
            placeholder="在此粘贴或输入棋谱...&#10;例如：&#10;1.炮二平五 马8进7&#10;2.马二进三 车9平8"
            @input="onTextChange"
          ></textarea>
          
          <!-- 识别状态提示 -->
          <div v-if="detectionResult" class="detection-status">
            <span :class="['status-indicator', detectionResult.isNotation ? 'success' : 'warning']">
              {{ detectionResult.isNotation ? '✓ 已识别为棋谱' : '⚠ 未检测到标准棋谱格式' }}
            </span>
            <span v-if="detectionResult.confidence > 0" class="confidence">
              置信度: {{ (detectionResult.confidence * 100).toFixed(0) }}%
            </span>
          </div>
        </div>

        <!-- 操作按钮区 -->
        <div class="action-buttons">
          <button @click="exportNotation" class="btn btn-primary" :disabled="!hasMoves">
            📤 导出当前对局
          </button>
          <button @click="importNotation" class="btn btn-success" :disabled="!canImport">
            📥 导入并开局
          </button>
          <button @click="copyToClipboard" class="btn btn-secondary" :disabled="!notationText">
            📋 复制到剪贴板
          </button>
          <button @click="clearNotation" class="btn btn-danger" :disabled="!notationText">
            🗑️ 清空
          </button>
        </div>

        <!-- 提示信息 -->
        <div class="tips-section">
          <h4>💡 使用说明</h4>
          <ul>
            <li><strong>导出：</strong>将当前对局导出为标准棋谱格式</li>
            <li><strong>导入：</strong>从文本导入棋谱并开始新对局（自动识别元数据）</li>
            <li><strong>支持格式：</strong>如 "1.炮二平五 马8进7" 或 "相三进五 卒３进１"</li>
            <li><strong>自动识别：</strong>粘贴包含棋谱的文本时，会自动分离元数据和着法</li>
          </ul>
        </div>
      </div>

      <div class="dialog-footer">
        <button @click="close" class="btn btn-close">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useChessStore } from '../store/chessStore';
import { detectAndParseNotation } from '../logic/chess/notation';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'close'): void;
  (e: 'imported'): void;  // 导入完成事件
}>();

const chessStore = useChessStore();

// 响应式数据
const notationText = ref('');
const metadata = ref<string[]>([]);
const detectionResult = ref<{
  isNotation: boolean;
  confidence: number;
  metadata: string[];
} | null>(null);

// 计算属性
const hasMoves = computed(() => {
  return chessStore.moveHistory.length > 0;
});

const canImport = computed(() => {
  return notationText.value.trim().length > 0 && detectionResult.value?.isNotation;
});

// 监听对话框打开
watch(() => props.visible, (newVal) => {
  if (newVal) {
    // 打开对话框时，如果有历史记录，自动导出
    if (chessStore.moveHistory.length > 0) {
      exportNotation();
    } else {
      notationText.value = '';
      metadata.value = [];
      detectionResult.value = null;
    }
  }
});

// 文本变化时自动检测
function onTextChange() {
  if (!notationText.value.trim()) {
    detectionResult.value = null;
    metadata.value = [];
    return;
  }
  
  // 智能检测棋谱
  const result = detectAndParseNotation(notationText.value);
  detectionResult.value = {
    isNotation: result.isNotation,
    confidence: result.confidence,
    metadata: result.metadata
  };
  
  // 更新元数据显示
  metadata.value = result.metadata;
}

// 导出当前对局
function exportNotation() {
  const exported = chessStore.exportNotation();
  if (exported) {
    notationText.value = exported;
    metadata.value = [];
    detectionResult.value = {
      isNotation: true,
      confidence: 1.0,
      metadata: []
    };
  } else {
    alert('当前没有对局记录可导出');
  }
}

// 导入棋谱
function importNotation() {
  if (!notationText.value.trim()) {
    alert('请输入或粘贴棋谱内容');
    return;
  }
  
  const success = chessStore.importNotation(notationText.value);
  
  if (success) {
    alert('棋谱导入成功！');
    close();
    emit('imported');
  } else {
    alert('棋谱导入失败，请检查格式是否正确');
  }
}

// 复制到剪贴板
async function copyToClipboard() {
  if (!notationText.value) return;
  
  try {
    await navigator.clipboard.writeText(notationText.value);
    alert('已复制到剪贴板');
  } catch (error) {
    console.error('复制失败:', error);
    alert('复制失败，请手动选择文本复制');
  }
}

// 清空文本
function clearNotation() {
  notationText.value = '';
  metadata.value = [];
  detectionResult.value = null;
}

// 关闭对话框
function close() {
  emit('update:visible', false);
  emit('close');
}
</script>

<style scoped>
/* 遮罩层 */
.notation-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

/* 对话框主体 */
.notation-dialog {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 700px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
}

/* 头部 */
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 2px solid #3498db;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 8px 8px 0 0;
}

.dialog-header h2 {
  margin: 0;
  font-size: 20px;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 28px;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
}

.close-btn:hover {
  transform: scale(1.2);
}

/* 内容区 */
.dialog-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* 元数据区域 */
.metadata-section {
  margin-bottom: 20px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 4px solid #3498db;
}

.metadata-section h3 {
  margin: 0 0 10px 0;
  font-size: 16px;
  color: #2c3e50;
}

.metadata-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.metadata-item {
  font-size: 14px;
  color: #555;
  padding: 3px 0;
}

/* 编辑器区域 */
.notation-editor-section {
  margin-bottom: 20px;
}

.notation-editor-section h3 {
  margin: 0 0 10px 0;
  font-size: 16px;
  color: #2c3e50;
}

.notation-textarea {
  width: 100%;
  min-height: 200px;
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  transition: border-color 0.3s;
}

.notation-textarea:focus {
  outline: none;
  border-color: #3498db;
}

/* 检测状态 */
.detection-status {
  margin-top: 10px;
  padding: 8px 12px;
  background: #f0f0f0;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.status-indicator {
  font-weight: bold;
}

.status-indicator.success {
  color: #27ae60;
}

.status-indicator.warning {
  color: #f39c12;
}

.confidence {
  color: #7f8c8d;
  font-size: 12px;
}

/* 按钮区域 */
.action-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}

.btn {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
  font-weight: 500;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #3498db;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2980b9;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(52, 152, 219, 0.3);
}

.btn-success {
  background: #27ae60;
  color: white;
}

.btn-success:hover:not(:disabled) {
  background: #229954;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(39, 174, 96, 0.3);
}

.btn-secondary {
  background: #95a5a6;
  color: white;
}

.btn-secondary:hover:not(:disabled) {
  background: #7f8c8d;
  transform: translateY(-2px);
}

.btn-danger {
  background: #e74c3c;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c0392b;
  transform: translateY(-2px);
}

.btn-close {
  background: #34495e;
  color: white;
  padding: 10px 30px;
}

.btn-close:hover {
  background: #2c3e50;
}

/* 提示区域 */
.tips-section {
  padding: 15px;
  background: #fff3cd;
  border-radius: 6px;
  border-left: 4px solid #ffc107;
}

.tips-section h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #856404;
}

.tips-section ul {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: #856404;
}

.tips-section li {
  margin-bottom: 5px;
}

/* 底部 */
.dialog-footer {
  padding: 15px 20px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
  background: #f8f9fa;
  border-radius: 0 0 8px 8px;
}
</style>
