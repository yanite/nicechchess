<script setup lang="ts">
import ChessBoard3D from './components/3d/ChessBoard3D.vue';
import SettingsDialog from './components/SettingsDialog.vue';
import { useChessStore } from './store/chessStore';
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { getCurrentWindow } from '@tauri-apps/api/window';

const chessStore = useChessStore();
const showSettings = ref(false);

// 窗口状态管理
const WINDOW_STATE_KEY = 'chchess_window_state';

interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
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
      console.log('窗口状态已保存:', state);
    } catch (error) {
      console.error('保存窗口状态失败:', error);
    }
  }, 500); // 500ms 防抖
}

// 恢复窗口状态
async function restoreWindowState() {
  try {
    const saved = localStorage.getItem(WINDOW_STATE_KEY);
    if (!saved) return;
    
    const state: WindowState = JSON.parse(saved);
    const appWindow = getCurrentWindow();
    
    // 设置窗口位置和大小
    await appWindow.setPosition({ x: state.x, y: state.y });
    await appWindow.setSize({ width: state.width, height: state.height });
    
    console.log('窗口状态已恢复:', state);
  } catch (error) {
    console.error('恢复窗口状态失败:', error);
  }
}

// 组件挂载时恢复窗口状态并监听事件
onMounted(async () => {
  console.log('App.vue onMounted - 开始初始化窗口监听');
  
  // 恢复窗口状态
  await restoreWindowState();
  
  // 监听窗口移动和调整大小事件
  const appWindow = getCurrentWindow();
  console.log('获取到appWindow对象:', appWindow);
  
  let unlistenMove: (() => void) | null = null;
  let unlistenResize: (() => void) | null = null;
  
  try {
    unlistenMove = await appWindow.onMoved((event) => {
      console.log('窗口移动事件触发:', event.payload);
      saveWindowStateDebounced();
    });
    console.log('窗口移动监听器已注册');
    
    unlistenResize = await appWindow.onResized((event) => {
      console.log('窗口调整大小事件触发:', event.payload);
      saveWindowStateDebounced();
    });
    console.log('窗口调整大小监听器已注册');
  } catch (error) {
    console.error('注册窗口监听器失败:', error);
  }
  
  // 在组件卸载时清理事件监听器
  onUnmounted(() => {
    if (unlistenMove) {
      unlistenMove();
      console.log('窗口移动监听器已清理');
    }
    if (unlistenResize) {
      unlistenResize();
      console.log('窗口调整大小监听器已清理');
    }
  });
});

// 计算当前行棋方显示文本
const currentPlayerText = computed(() => {
  return chessStore.currentPlayer === 'red' ? '红方' : '黑方';
});

// 计算着法历史显示（按回合分组）
const moveHistoryText = computed(() => {
  const rounds: Array<{ num: number; red?: string; black?: string }> = [];
  
  chessStore.moveHistory.forEach((move, index) => {
    const roundNum = Math.floor(index / 2) + 1;
    
    if (index % 2 === 0) {
      // 红方着法
      rounds.push({ num: roundNum, red: move.chineseNotation });
    } else {
      // 黑方着法，添加到上一个回合
      if (rounds.length > 0) {
        rounds[rounds.length - 1].black = move.chineseNotation;
      }
    }
  });
  
  return rounds.map(round => {
    if (round.black) {
      return `${round.num}. ${round.red} ${round.black}`;
    } else {
      return `${round.num}. ${round.red}`;
    }
  });
});

// 重置游戏
function resetGame() {
  chessStore.resetGame();
}

// 悔棋
function undoMove() {
  chessStore.undoMove();
}

// 打开设置对话框
function openSettings() {
  showSettings.value = true;
}

// 处理设置变更
function onSettingsChanged(settings: any) {
  console.log('设置已更改:', settings);
  // TODO: 通知ChessBoard3D组件更新配置
}
</script>

<template>
  <div class="app-container">
    <!-- 顶部菜单栏（可选） -->
    <header class="menu-bar">
      <div class="menu-items">
        <button @click="resetGame">新游戏</button>
        <button @click="undoMove" :disabled="!chessStore.canUndo">悔棋</button>
        <button @click="openSettings">选项</button>
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

    <!-- 主内容区 -->
    <main class="main-content">
      <!-- 左侧边栏：着法记录 -->
      <aside class="sidebar left-sidebar">
        <h3>着法记录</h3>
        <div class="move-list">
          <div v-for="(move, index) in moveHistoryText" :key="index" class="move-item">
            {{ move }}
          </div>
          <div v-if="chessStore.moveHistory.length === 0" class="empty-hint">
            暂无着法
          </div>
        </div>
      </aside>

      <!-- 中间：3D 棋盘 -->
      <div class="board-container">
        <ChessBoard3D />
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
}

.empty-hint {
  color: #95a5a6;
  font-style: italic;
  text-align: center;
  padding: 20px;
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