<script setup lang="ts">
import ChessBoard3D from './components/3d/ChessBoard3D.vue';
import SettingsDialog from './components/SettingsDialog.vue';
import NewGameDialog, { type NewGameConfig } from './components/NewGameDialog.vue';
import GameNotationDialog from './components/GameNotationDialog.vue';
import { useChessStore } from './store/chessStore';
import { computed, ref, onMounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { toast } from './utils/toast';

const chessStore = useChessStore();

// ChessBoard3D 组件引用
const boardRef = ref<InstanceType<typeof ChessBoard3D> | null>(null);

const showSettings = ref(false);
const showNewGameDialog = ref(false);
const showNotationDialog = ref(false);

// 组件挂载时初始化
onMounted(async () => {
  // 监听全局键盘事件用于打开开发工具
  document.addEventListener('keydown', async (event) => {
    if ((event.ctrlKey && event.shiftKey && event.key === 'I') || event.key === 'F12') {
      event.preventDefault();
      try {
        await invoke('open_devtools');
        console.log('DevTools opened via keyboard shortcut');
      } catch (error) {
        console.error('Failed to open DevTools:', error);
      }
    }
  });
  
  // 监听页面刷新/关闭事件，停止引擎
  window.addEventListener('beforeunload', async () => {
    try {
      const { stopEngine } = await import('./services/engineService');
      await stopEngine();
    } catch (error) {
      // 忽略停止引擎错误
    }
  });
});

// 计算当前行棋方显示文本
const currentPlayerText = computed(() => {
  return chessStore.currentPlayer === 'red' ? '红方' : '黑方';
});

// 计算着法历史显示（按回合分组）
const moveHistoryText = computed(() => {
  const rounds: Array<{ 
    num: number; 
    red?: string; 
    black?: string;
    redIndex?: number;
    blackIndex?: number;
  }> = [];
  
  chessStore.moveHistory.forEach((move, index) => {
    const roundNum = Math.floor(index / 2) + 1;
    
    // store 已经正确处理了数字格式：红方用中文数字，黑方用阿拉伯数字
    const displayNotation = move.chineseNotation;
    
    if (index % 2 === 0) {
      // 红方着法
      rounds.push({ num: roundNum, red: displayNotation, redIndex: index });
    } else {
      // 黑方着法
      if (rounds.length > 0) {
        rounds[rounds.length - 1].black = displayNotation;
        rounds[rounds.length - 1].blackIndex = index;
      }
    }
  });
  
  return rounds.map(round => {
    let isRedUndone = false;
    let isBlackUndone = false;
    
    // 判断着法是否已被撤销（索引大于currentMoveIndex）
    if (round.redIndex !== undefined && round.redIndex > chessStore.currentMoveIndex) {
      isRedUndone = true;
    }
    if (round.blackIndex !== undefined && round.blackIndex > chessStore.currentMoveIndex) {
      isBlackUndone = true;
    }
    
    return {
      num: round.num,
      red: round.red,
      black: round.black,
      redIndex: round.redIndex,
      blackIndex: round.blackIndex,
      isRedUndone,
      isBlackUndone,
      hasBoth: !!round.black
    };
  });
});

/**
 * 点击着法时，跳转到该着法位置
 * 使用带动画的跳转，animateJumpToMove 内部会处理状态更新和动画
 */
async function jumpToMove(moveIndex: number | undefined) {
  console.log('[App] jumpToMove called with index:', moveIndex, 'current:', chessStore.currentMoveIndex);
  
  if (moveIndex === undefined) {
    return;
  }
  
  // 如果有3D棋盘引用并且支持带动画跳转，使用动画跳转
  // animateJumpToMove 内部会处理所有状态更新，不需要在这里调用 store
  if (boardRef.value && boardRef.value.animateJumpToMove) {
    await boardRef.value.animateJumpToMove(moveIndex);
  } else {
    // 降级方案：直接跳转并同步
    chessStore.jumpToMove(moveIndex);
    
    // 等待一小段时间确保 store 状态完全更新
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 同步 3D 棋盘状态
    if (boardRef.value && boardRef.value.syncBoardState) {
      boardRef.value.syncBoardState();
    }
  }
}

// 重置游戏
// function resetGame() {
//   chessStore.resetGame();
// }

// 悔棋
async function undoMove() {
  if (boardRef.value && boardRef.value.animateSyncBoardState) {
    // 直接调用动画函数，内部会处理状态更新
    await boardRef.value.animateSyncBoardState('undo');
    toast.info('已悔棋');
  } else {
    const success = chessStore.undoMove();
    if (!success) {
      toast.warning('无法悔棋：已回到初始状态');
    }
  }
}

// 重做（下一步）
async function redoMove() {
  if (boardRef.value && boardRef.value.animateSyncBoardState) {
    // 直接调用动画函数，内部会处理状态更新
    await boardRef.value.animateSyncBoardState('redo');
    toast.info('已重做');
  } else {
    const success = chessStore.redoMove();
    if (!success) {
      toast.warning('无法重做：已在最新状态');
    }
  }
}

// 打开设置对话框
function openSettings() {
  showSettings.value = true;
}

// 处理设置变更
function onSettingsChanged(settings: any) {
  // 更新引擎配置到 store
  chessStore.setEngineConfig({
    threads: settings.engine.threads,
    hash: settings.engine.hash,
    calculationMode: settings.engine.calculation_mode,
    movetime: settings.engine.movetime,
    depth: settings.engine.depth
  });
  
  // 手动触发 ChessBoard3D 的配置更新
  // 通过 dispatchEvent 模拟 storage 事件，确保 ChessBoard3D 能检测到变化
  const configData = localStorage.getItem('chchess_config');
  if (configData) {
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'chchess_config',
      newValue: configData,
      oldValue: null
    }));
  }
}

// 打开新游戏对话框
function openNewGameDialog() {
  showNewGameDialog.value = true;
}

// 打开棋谱对话框
function openNotationDialog() {
  showNotationDialog.value = true;
}

// 处理棋谱导入完成
async function handleNotationImported() {
  // 停止AI引擎
  try {
    const { stopEngine } = await import('./services/engineService');
    await stopEngine();
  } catch (error) {
    // 忽略停止引擎错误
  }
  
  // 同步 3D 棋盘状态（导入棋谱后需要重建棋子）
  if (boardRef.value && boardRef.value.syncBoardState) {
    // 等待一小段时间确保 store 状态完全更新
    await new Promise(resolve => setTimeout(resolve, 100));
    boardRef.value.syncBoardState();
  }
}

// 触发AI走一步
function triggerAIMove() {
  if (boardRef.value && boardRef.value.triggerAIMove) {
    boardRef.value.triggerAIMove();
  }
}

// 退出研究模式
function exitStudyMode() {
  chessStore.isStudyMode = false;
}

// 处理新游戏确认
function handleNewGame(config: NewGameConfig) {
  // 设置玩家配置
  chessStore.setPlayers(config.blackPlayer, config.redPlayer);
  
  // 重置棋盘状态（红方先手）
  chessStore.resetGame();
  
  // 如果红方是AI，延迟触发AI行棋（红方先手）
  if (config.redPlayer.useAI) {
    setTimeout(() => {
      // ChessBoard3D组件会自动检测并触发AI
    }, 1000);
  }
  
  // 显示 Toast 提示
  const blackInfo = `${config.blackPlayer.name}${config.blackPlayer.useAI ? ` (AI Lv.${config.blackPlayer.aiLevel})` : ''}`;
  const redInfo = `${config.redPlayer.name}${config.redPlayer.useAI ? ` (AI Lv.${config.redPlayer.aiLevel})` : ''}`;
  toast.success(`新游戏开始！\n黑方：${blackInfo}\n红方：${redInfo}`);
}

</script>

<template>
  <div class="app-container">
    <!-- 顶部菜单栏（可选） -->
    <header class="menu-bar">
      <div class="menu-items">
        <button @click="openNewGameDialog">新游戏</button>
        <button @click="undoMove" :disabled="!chessStore.canUndo">悔棋</button>
        <button @click="redoMove" :disabled="!chessStore.canRedo">重做</button>
        <button @click="triggerAIMove">AI走一步</button>
        <button @click="openNotationDialog">棋谱</button>
        <button @click="openSettings">选项</button>
        <!-- 研究模式指示和退出按钮 -->
        <span v-if="chessStore.isStudyMode" class="study-mode-indicator">
          🔍 研究模式
          <button @click="exitStudyMode" class="exit-study-btn">退出</button>
        </span>
        <span class="game-info">
          当前: {{ currentPlayerText }} | 
          FEN: {{ chessStore.fen.substring(0, 30) }}...
        </span>
      </div>
    </header>

    <!-- 设置对话框 -->
    <SettingsDialog 
      :visible="showSettings" 
      @update:visible="showSettings = $event"
      @settings-changed="onSettingsChanged"
    />

    <!-- 新开局对话框 -->
    <NewGameDialog 
      :visible="showNewGameDialog"
      @close="showNewGameDialog = false"
      @confirm="handleNewGame"
    />

    <!-- 棋谱管理对话框 -->
    <GameNotationDialog 
      :visible="showNotationDialog"
      @update:visible="showNotationDialog = $event"
      @close="showNotationDialog = false"
      @imported="handleNotationImported"
    />

    <!-- 主内容区 -->
    <main class="main-content">
      <!-- 左侧边栏：着法记录 -->
      <aside class="sidebar left-sidebar">
        <h3>着法记录</h3>
        <div class="move-list">
          <div v-for="(move, index) in moveHistoryText" :key="index" class="move-item">
            <span class="round-number">{{ move.num }}.</span>
            
            <!-- 红方着法 -->
            <span 
              v-if="move.red" 
              class="red-move"
              :class="{ 
                'current': move.redIndex === chessStore.currentMoveIndex,
                'undone': move.isRedUndone 
              }"
              @click="jumpToMove(move.redIndex)"
            >
              {{ move.red }}
            </span>
            
            <!-- 黑方着法 -->
            <span 
              v-if="move.black" 
              class="black-move"
              :class="{ 
                'current': move.blackIndex === chessStore.currentMoveIndex,
                'undone': move.isBlackUndone 
              }"
              @click="jumpToMove(move.blackIndex)"
            >
              {{ move.black }}
            </span>
          </div>
          <div v-if="chessStore.moveHistory.length === 0" class="empty-hint">
            暂无着法
          </div>
        </div>
      </aside>

      <!-- 中间：3D 棋盘 -->
      <div class="board-container">
        <ChessBoard3D ref="boardRef" />
      </div>

      <!-- 右侧边栏：分析信息（预留） -->
      <aside class="sidebar right-sidebar">
        <h3>棋谱信息</h3>
        <div class="analysis-panel">
          <div v-if="chessStore.notationInfo.title || chessStore.notationInfo.event" class="notation-info">
            <p v-if="chessStore.notationInfo.title"><strong>标题:</strong> {{ chessStore.notationInfo.title }}</p>
            <p v-if="chessStore.notationInfo.event"><strong>赛事:</strong> {{ chessStore.notationInfo.event }}</p>
            <p v-if="chessStore.notationInfo.result"><strong>结果:</strong> {{ chessStore.notationInfo.result }}</p>
            <p v-if="chessStore.notationInfo.source"><strong>来源:</strong> {{ chessStore.notationInfo.source }}</p>
            <p><strong>着法数:</strong> {{ chessStore.moveHistory.length }}</p>
          </div>
          <p v-else class="no-info">暂无棋谱信息</p>
        </div>
      </aside>
    </main>

    <!-- 底部状态栏 -->
    <footer class="status-bar">
      <div class="status-items">
        <span>红方时间: {{ formatTime(chessStore.redTime) }}</span>
        <span>黑方时间: {{ formatTime(chessStore.blackTime) }}</span>
        <span>总着法: {{ chessStore.moveHistory.length }}</span>
        <span>状态: {{ chessStore.gameStatus === 'playing' ? '对弈中' : '已结束' }}</span>
      </div>
    </footer>
  </div>
</template>

<script lang="ts">
export default {
  methods: {
    formatTime(seconds: number): string {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  }
}
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

/* 顶部菜单栏 */
.menu-bar {
  background-color: #2c3e50;
  color: white;
  padding: 10px 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.menu-items {
  display: flex;
  align-items: center;
  gap: 15px;
}

.menu-items button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background-color: #3498db;
  color: white;
  cursor: pointer;
  transition: background-color 0.3s;
}

.menu-items button:hover:not(:disabled) {
  background-color: #2980b9;
}

.menu-items button:disabled {
  background-color: #95a5a6;
  cursor: not-allowed;
}

.game-info {
  margin-left: auto;
  font-size: 14px;
}

/* 主内容区 */
.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 侧边栏 */
.sidebar {
  width: 250px;
  background-color: #ecf0f1;
  padding: 15px;
  overflow-y: auto;
  box-shadow: inset -2px 0 4px rgba(0, 0, 0, 0.05);
}

.left-sidebar {
  border-right: 1px solid #bdc3c7;
}

.right-sidebar {
  border-left: 1px solid #bdc3c7;
}

.sidebar h3 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #2c3e50;
  font-size: 16px;
  border-bottom: 2px solid #3498db;
  padding-bottom: 8px;
}

/* 着法列表 */
.move-list {
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}

.move-item {
  padding: 5px 8px;
  margin-bottom: 4px;
  background-color: white;
  border-radius: 3px;
  font-size: 13px;
  font-family: monospace;
  display: flex;
  gap: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.move-item:hover {
  background-color: #ecf0f1;
}

.round-number {
  color: #7f8c8d;
  min-width: 25px;
}

.red-move {
  color: #c0392b; /* 红方着法颜色 */
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 2px;
  transition: background-color 0.2s, font-weight 0.2s;
}

.red-move:hover {
  background-color: rgba(192, 57, 43, 0.1);
}

/* 当前着法加粗 */
.red-move.current {
  font-weight: bold;
  background-color: rgba(192, 57, 43, 0.15);
}

.black-move {
  color: #2c3e50; /* 黑方着法颜色 */
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 2px;
  transition: background-color 0.2s, font-weight 0.2s;
}

.black-move:hover {
  background-color: rgba(44, 62, 80, 0.1);
}

/* 当前着法加粗 */
.black-move.current {
  font-weight: bold;
  background-color: rgba(44, 62, 80, 0.15);
}

/* 已撤销的着法 */
.undone {
  opacity: 0.4;
  text-decoration: line-through;
  cursor: default !important;
}

/* 异常着法（黄色斜体）- 用于标记有问题的着法 */
.abnormal {
  color: #f39c12 !important;
  font-style: italic;
  background-color: rgba(243, 156, 18, 0.1);
}

/* 研究模式指示器 */
.study-mode-indicator {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  background-color: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  color: #856404;
  font-weight: bold;
  font-size: 13px;
  margin-left: 10px;
}

.exit-study-btn {
  padding: 2px 8px;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.2s;
}

.exit-study-btn:hover {
  background-color: #c82333;
}

/* 棋盘容器 */
.board-container {
  flex: 1;
  position: relative;
  background-color: #f5f5f5;
}

/* 分析面板 */
.analysis-panel {
  padding: 10px;
  background-color: white;
  border-radius: 4px;
  min-height: 200px;
}

.analysis-panel p {
  margin: 8px 0;
  color: #333;
  font-size: 14px;
}

.notation-info p {
  text-align: left;
  padding: 4px 0;
  border-bottom: 1px solid #eee;
}

.notation-info p:last-child {
  border-bottom: none;
}

.no-info {
  color: #7f8c8d;
  text-align: center;
}

/* 底部状态栏 */
.status-bar {
  background-color: #34495e;
  color: white;
  padding: 10px 20px;
  box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.1);
}

.status-items {
  display: flex;
  justify-content: space-around;
  font-size: 14px;
}

.status-items span {
  padding: 5px 10px;
}
</style>

<style>
/* 全局样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Microsoft YaHei', Arial, sans-serif;
  overflow: hidden;
}
</style>