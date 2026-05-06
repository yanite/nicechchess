<script setup lang="ts">
import ChessBoard3D from './components/3d/ChessBoard3D.vue';
import SettingsDialog from './components/SettingsDialog.vue';
import NewGameDialog, { type NewGameConfig } from './components/NewGameDialog.vue';
import GameNotationDialog from './components/GameNotationDialog.vue';
import { useChessStore } from './store/chessStore';
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { toast } from './utils/toast';

const chessStore = useChessStore();

// ChessBoard3D 组件引用
const boardRef = ref<InstanceType<typeof ChessBoard3D> | null>(null);

const showSettings = ref(false);
const showNewGameDialog = ref(false);
const showNotationDialog = ref(false);

// 窗口状态管理
const WINDOW_STATE_KEY = 'chchess_window_state';

interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
}

// 窗口尺寸和位置约束
const MIN_WINDOW_SIZE = 400; // 最小窗口尺寸
const DEFAULT_WINDOW_WIDTH = 1280;
const DEFAULT_WINDOW_HEIGHT = 720;
const DEFAULT_WINDOW_X = 100;
const DEFAULT_WINDOW_Y = 100;

/**
 * 验证并修正窗口状态，确保不会出现非法值
 */
async function validateAndFixWindowState(state: WindowState): Promise<WindowState> {
  const appWindow = getCurrentWindow();
  
  // 获取屏幕尺寸
  let screenWidth = window.screen.width;
  let screenHeight = window.screen.height;
  
  // 尝试获取更准确的屏幕工作区（排除任务栏）
  try {
    const currentMonitor = await appWindow.currentMonitor();
    if (currentMonitor) {
      screenWidth = currentMonitor.size.width;
      screenHeight = currentMonitor.size.height;
    }
  } catch (error) {
    // 忽略错误，使用默认屏幕尺寸
  }
  
  let fixedState = { ...state };
  
  // 验证窗口大小
  if (fixedState.width < MIN_WINDOW_SIZE) {
    fixedState.width = DEFAULT_WINDOW_WIDTH;
  }
  
  if (fixedState.height < MIN_WINDOW_SIZE) {
    fixedState.height = DEFAULT_WINDOW_HEIGHT;
  }
  
  // 限制窗口最大尺寸为屏幕尺寸
  if (fixedState.width > screenWidth) {
    fixedState.width = screenWidth - 50;
  }
  
  if (fixedState.height > screenHeight) {
    fixedState.height = screenHeight - 50;
  }
  
  // 验证窗口位置
  if (fixedState.x < 0 || fixedState.x >= screenWidth) {
    fixedState.x = DEFAULT_WINDOW_X;
  }
  
  if (fixedState.y < 0 || fixedState.y >= screenHeight) {
    fixedState.y = DEFAULT_WINDOW_Y;
  }
  
  // 确保窗口不会完全超出屏幕右侧或底部
  if (fixedState.x + fixedState.width > screenWidth) {
    fixedState.x = Math.max(0, screenWidth - fixedState.width - 10);
  }
  
  if (fixedState.y + fixedState.height > screenHeight) {
    fixedState.y = Math.max(0, screenHeight - fixedState.height - 10);
  }
  
  return fixedState;
}

// 保存窗口状态到localStorage（带防抖）
let saveTimeout: number | null = null;
function saveWindowStateDebounced() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  
  saveTimeout = window.setTimeout(async () => {
    try {
      const appWindow = getCurrentWindow();
      const position = await appWindow.outerPosition();
      const size = await appWindow.outerSize();
      
      const state: WindowState = {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
      };
      
      localStorage.setItem(WINDOW_STATE_KEY, JSON.stringify(state));
    } catch (error) {
      // 忽略保存错误
    }
  }, 500); // 500ms 防抖
}

// 恢复窗口状态
async function restoreWindowState() {
  try {
    const saved = localStorage.getItem(WINDOW_STATE_KEY);
    if (!saved) {
      return;
    }
    
    let state: WindowState = JSON.parse(saved);
    
    // 验证并修正窗口状态
    state = await validateAndFixWindowState(state);
    
    const appWindow = getCurrentWindow();
    
    // 设置窗口位置（使用Tauri v2 PhysicalPosition）
    try {
      await appWindow.setPosition({ 
        type: 'Physical',
        x: Math.round(state.x), 
        y: Math.round(state.y) 
      });
    } catch (posError) {
      // 忽略设置位置错误
    }
    
    // 设置窗口大小（使用Tauri v2 PhysicalSize）
    try {
      await appWindow.setSize({ 
        type: 'Physical',
        width: Math.round(state.width), 
        height: Math.round(state.height) 
      });
    } catch (sizeError) {
      // 忽略设置大小错误
    }
  } catch (error) {
    // 忽略恢复状态错误
  }
}

// 组件挂载时恢复窗口状态并监听事件
onMounted(async () => {
  // 恢复窗口状态
  await restoreWindowState();
  
  // 监听窗口移动和调整大小事件
  const appWindow = getCurrentWindow();
  
  let unlistenMove: (() => void) | null = null;
  let unlistenResize: (() => void) | null = null;
  
  try {
    unlistenMove = await appWindow.onMoved(() => {
      saveWindowStateDebounced();
    });
    
    unlistenResize = await appWindow.onResized(() => {
      saveWindowStateDebounced();
    });
  } catch (error) {
    // 忽略注册监听器错误
  }
  
  // 监听页面刷新/关闭事件，停止引擎
  window.addEventListener('beforeunload', async () => {
    try {
      const { stopEngine } = await import('./services/engineService');
      await stopEngine();
    } catch (error) {
      // 忽略停止引擎错误
    }
  });
  
  // 在组件卸载时清理事件监听器
  onUnmounted(() => {
    if (unlistenMove) {
      unlistenMove();
    }
    if (unlistenResize) {
      unlistenResize();
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
 */
async function jumpToMove(moveIndex: number | undefined) {
  console.log('[App] ========== jumpToMove CALLED ==========', moveIndex);
  
  if (moveIndex === undefined) {
    console.log('[App] moveIndex is undefined, returning');
    return;
  }
  
  console.log('[App] jumpToMove called with index:', moveIndex, 'current:', chessStore.currentMoveIndex);
  
  // 调用 store 的方法跳转到指定着法
  chessStore.jumpToMove(moveIndex);
  
  console.log('[App] After jumpToMove, currentMoveIndex:', chessStore.currentMoveIndex);
  console.log('[App] Board at (7,4):', chessStore.board[7][4], 'Board at (7,7):', chessStore.board[7][7]);
  
  // 等待一小段时间确保 store 状态完全更新
  await new Promise(resolve => setTimeout(resolve, 100));
  
  console.log('[App] Before sync, Board at (7,4):', chessStore.board[7][4], 'Board at (7,7):', chessStore.board[7][7]);
  
  // 同步 3D 棋盘状态（带动画）
  if (boardRef.value && boardRef.value.animateSyncBoardState) {
    await boardRef.value.animateSyncBoardState();
  } else if (boardRef.value && boardRef.value.syncBoardState) {
    // 降级方案：如果没有动画版本，使用普通同步
    boardRef.value.syncBoardState();
  }
}

// 重置游戏
function resetGame() {
  chessStore.resetGame();
}

// 悔棋
async function undoMove() {
  const success = chessStore.undoMove();
  if (success && boardRef.value) {
    // 等待动画完成
    await boardRef.value.animateSyncBoardState();
    toast.info('已悔棋');
  } else if (!success) {
    toast.warning('无法悔棋：已回到初始状态');
  }
}

// 重做（下一步）
async function redoMove() {
  const success = chessStore.redoMove();
  if (success && boardRef.value) {
    // 等待动画完成
    await boardRef.value.animateSyncBoardState();
    toast.info('已重做');
  } else if (!success) {
    toast.warning('无法重做：已在最新状态');
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
        <h3>局势分析</h3>
        <div class="analysis-panel">
          <p>引擎分析功能开发中...</p>
          <!-- TODO: 添加实时胜率图表 -->
          <!-- TODO: 添加引擎评估分数 -->
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