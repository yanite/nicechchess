<template>
  <div ref="container" class="chess-board-3d">
    <!-- 将军/绝杀提示图片 -->
    <div v-if="showCheckAlert" class="check-alert">
      <img :src="alertImage" alt="提示" class="alert-image" />
    </div>
    
    <!-- AI行棋提示 -->
    <div v-if="aiModule && aiModule.isAIThinking.value" class="ai-hint">
      <div class="hint-text">{{ currentAIPlayer }} AI 正在行棋中，请勿操作</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue';
import * as THREE from 'three';
import { useChessStore } from '../../store/chessStore';
import { loadConfig } from '../../services/configService';

// 导入模块化功能
import { useScene } from './useScene';
import { createBoard, BOARD_WIDTH, BOARD_HEIGHT, CELL_SIZE } from './useBoard';
import { createPieces, syncPiecesWithBoard, resetPiecePosition as resetPiecePositionFunc } from './usePieces';
import { useInteraction } from './useInteraction';
import { useAI } from './useAI';
import { useGameState } from './useGameState';

const container = ref<HTMLDivElement | null>(null);
const chessStore = useChessStore();

// 棋子形状配置
let currentPieceShape: 'cylinder' | 'standard' = 'cylinder';
let opponentTextDirection: 'down' | 'up' = 'down';

// Three.js 相关变量
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: any;
let boardGroup: THREE.Group;
let piecesGroup: THREE.Group;
let raycaster: THREE.Raycaster;
let mouse: THREE.Vector2;
let lineMaterials: any[] = [];

// 使用场景管理模块
const sceneManager = useScene(container);

// 使用游戏状态管理模块
const gameState = useGameState(chessStore);
const { showCheckAlert, alertImage, checkCheckAndCheckmate } = gameState;

// AI 模块和交互模块将在 initScene 后创建
let aiModule: ReturnType<typeof useAI>;
let interaction: ReturnType<typeof useInteraction>;

// ✅ 配置就绪标志
const isConfigReady = ref(false);

// 计算当前行棋的 AI 玩家
const currentAIPlayer = computed(() => {
  if (!aiModule || !aiModule.isAIThinking.value) return '';
  return chessStore.currentPlayer === 'red' ? '红方' : '黑方';
});

// 执行移动的回调函数
function executeMove(fromRow: number, fromCol: number, toRow: number, toCol: number) {
  const board = chessStore.board;
  
  // 获取当前拖动的棋子
  const draggedPiece = interaction ? interaction.getDraggedPiece() : null;
  
  // 1. 生成检验函数（目前为空函数，总是返回 true）
  const validateMoveResult = true; // 简化验证
  
  if (!validateMoveResult) {
    // 如果验证失败，将移动棋子放回原处
    if (draggedPiece) {
      resetPiecePositionFunc(draggedPiece, currentPieceShape);
    }
    return;
  }
  
  // 确保 draggedPiece 存在
  if (!draggedPiece) {
    console.error('draggedPiece 不存在');
    return;
  }
  
  // 2. 如果目标位置有棋子，将目标棋子设置为死子并移到棋盘边上
  const targetPiece = board[toRow][toCol];
  if (targetPiece !== 0) {
    // 找到目标位置的棋子（通过位置精确匹配）
    let targetMesh: THREE.Mesh | null = null;
    piecesGroup.children.forEach(child => {
      if (child instanceof THREE.Mesh) {
        const { row, col, isCaptured } = (child as any).userData;
        // 找到目标位置且未被吃掉的棋子
        if (row === toRow && col === toCol && !isCaptured) {
          targetMesh = child;
        }
      }
    });
    
    if (targetMesh) {
      // 标记为死子
      (targetMesh as THREE.Mesh).userData.isCaptured = true;
      (targetMesh as THREE.Mesh).userData.row = -1;
      (targetMesh as THREE.Mesh).userData.col = -1;
      
      const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
      const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;
      const isRed = targetPiece > 0;
      
      // 统计该颜色已被吃的棋子数量
      let capturedCount = 0;
      piecesGroup.children.forEach(other => {
        if (other instanceof THREE.Mesh) {
          const otherData = other.userData as any;
          if (otherData.isCaptured) {
            const otherIsRed = otherData.piece > 0;
            if (otherIsRed === isRed) {
              capturedCount++;
            }
          }
        }
      });
      
      if (isRed) {
        // 红方被吃的棋子放在棋盘左边
        const leftBoundary = startX - CELL_SIZE * 1.5;
        const offsetZ = capturedCount * CELL_SIZE * 0.75;
        (targetMesh as THREE.Mesh).position.x = leftBoundary;
        (targetMesh as THREE.Mesh).position.z = startZ + offsetZ;
      } else {
        // 黑方被吃的棋子放在棋盘右边
        const rightBoundary = startX + (BOARD_WIDTH - 1) * CELL_SIZE + CELL_SIZE * 1.5;
        const offsetZ = capturedCount * CELL_SIZE * 0.75;
        (targetMesh as THREE.Mesh).position.x = rightBoundary;
        (targetMesh as THREE.Mesh).position.z = startZ + offsetZ;
      }
      
      // 被吃掉的棋子也需要保持正确的高度
      (targetMesh as THREE.Mesh).position.y = 0.01; // 保持在棋盘平面上
    }
  }
  
  // 3. 更新拖动棋子的位置和状态
  (draggedPiece as any).userData.row = toRow;
  (draggedPiece as any).userData.col = toCol;
  
  const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
  const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;
  draggedPiece.position.x = startX + toCol * CELL_SIZE;
  draggedPiece.position.z = startZ + toRow * CELL_SIZE;
  
  // 4. 更新棋盘数据
  chessStore.movePiece(fromRow, fromCol, toRow, toCol);
  
  // 5. 检查是否形成将军或绝杀
  checkCheckAndCheckmate(toRow, toCol);
  
  // 6. 如果当前玩家是 AI，触发 AI 行棋（支持双 AI）
  console.log('移动完成，当前玩家:', chessStore.currentPlayer);
  if (chessStore.isCurrentPlayerAI()) {
    console.log('检测到当前玩家是AI，准备触发 AI...');
    setTimeout(() => {
      if (aiModule) aiModule.triggerAIMove();
    }, 1000);
  } else {
    console.log('当前是人类玩家，等待操作');
  }
}

/**
 * 初始化 Three.js 场景
 */
async function initScene() {
  if (!container.value) return;

  // 加载配置
  let boardTexturePath = 'src/assets/textures/tx1.jpg';
  try {
    const config = await loadConfig();
    boardTexturePath = config.ui.board_texture;
    currentPieceShape = config.ui.piece_shape || 'cylinder'; // 加载棋子形状
    opponentTextDirection = config.ui.opponent_text_direction || 'down'; // 加载对方棋子字体方向
    console.log('加载棋盘纹理配置:', boardTexturePath);
    console.log('加载棋子形状配置:', currentPieceShape);
    console.log('加载对方棋子字体方向配置:', opponentTextDirection);
  } catch (error) {
    console.warn('加载配置失败，使用默认纹理:', error);
  }

  // 初始化场景
  const sceneData = await sceneManager.initScene();
  if (!sceneData) return;
  
  scene = sceneData.scene;
  camera = sceneData.camera;
  renderer = sceneData.renderer;
  controls = sceneData.controls;
  raycaster = sceneData.raycaster;
  mouse = sceneData.mouse;
  lineMaterials = sceneData.lineMaterials;

  // 添加灯光
  // setupLights 已在 initScene 中调用

  // 创建棋盘和棋子
  boardGroup = createBoard(scene, boardTexturePath, container.value, lineMaterials);
  piecesGroup = createPieces(scene, chessStore.board, currentPieceShape, opponentTextDirection);

  // 初始化 AI 模块和交互模块（在场景初始化之后）
  aiModule = useAI(
    chessStore,
    piecesGroup,
    executeMove,
    checkCheckAndCheckmate
  );

  interaction = useInteraction(
    chessStore,
    piecesGroup,
    camera,
    raycaster,
    mouse,
    controls,
    renderer,
    container.value,
    currentPieceShape,
    executeMove,
    (piece) => resetPiecePositionFunc(piece, currentPieceShape),
    () => aiModule ? aiModule.isAIThinking.value : false, // 传递 AI 思考状态
    () => isConfigReady.value // ✅ 传递配置就绪状态
  );

  // 设置鼠标事件监听
  interaction.setupEventListeners();
}

/**
 * 重新加载棋盘纹理
 */
function reloadBoardTexture(newTexturePath: string) {
  console.log('重新加载棋盘纹理:', newTexturePath);
  
  if (!boardGroup || !scene) {
    console.warn('棋盘组或场景未初始化');
    return;
  }
  
  // 移除旧的棋盘
  scene.remove(boardGroup);
  
  // 创建新的棋盘
  boardGroup = createBoard(scene, newTexturePath, container.value, lineMaterials);
  
  console.log('棋盘纹理已更新');
}

/**
 * 更新棋子形状配置并重建所有棋子
 */
function updatePieceShape(shape: 'cylinder' | 'standard') {
  console.log('更新棋子形状:', shape);
  currentPieceShape = shape;
  
  // 重建所有棋子
  syncPiecesWithBoard(piecesGroup, scene, chessStore.board, currentPieceShape, opponentTextDirection);
}

// 监听棋盘状态变化，同步3D视图
watch(
  () => chessStore.board,
  () => {
    syncPiecesWithBoard(piecesGroup, scene, chessStore.board, currentPieceShape, opponentTextDirection);
  },
  { deep: true }
);

// 监听配置变化（通过轮询检测localStorage）
let lastConfig = '';
const checkConfigChange = setInterval(() => {
  const currentConfig = localStorage.getItem('chchess_config') || '';
  if (currentConfig !== lastConfig && lastConfig !== '') {
    lastConfig = currentConfig;
    console.log('检测到配置变化');
    try {
      const config = JSON.parse(currentConfig);
      
      // 检查棋子形状变化
      if (config.ui && config.ui.piece_shape && config.ui.piece_shape !== currentPieceShape) {
        console.log('重新加载棋子形状');
        updatePieceShape(config.ui.piece_shape);
      }
      
      // 检查棋盘纹理变化
      if (config.ui && config.ui.board_texture) {
        console.log('检测到棋盘纹理变化:', config.ui.board_texture);
        reloadBoardTexture(config.ui.board_texture);
      }
    } catch (error) {
      console.error('解析配置失败:', error);
    }
  } else if (lastConfig === '') {
    lastConfig = currentConfig;
  }
}, 1000); // 每秒检查一次

// 监听localStorage变化（配置变更）
const handleStorageChange = (e: StorageEvent) => {
  if (e.key === 'chchess_config') {
    console.log('检测到配置变化');
    try {
      const config = JSON.parse(e.newValue || '{}');
      
      // 检查棋子形状变化
      if (config.ui && config.ui.piece_shape && config.ui.piece_shape !== currentPieceShape) {
        console.log('重新加载棋子形状');
        updatePieceShape(config.ui.piece_shape);
      }
      
      // 检查棋盘纹理变化
      if (config.ui && config.ui.board_texture) {
        console.log('检测到棋盘纹理变化:', config.ui.board_texture);
        reloadBoardTexture(config.ui.board_texture);
      }
    } catch (error) {
      console.error('解析配置失败:', error);
    }
  }
};

window.addEventListener('storage', handleStorageChange);

// 监听currentPlayer变化，自动触发AI行棋
watch(
  () => chessStore.currentPlayer,
  (newPlayer, oldPlayer) => {
    console.log(`当前玩家变化: ${oldPlayer} -> ${newPlayer}`);
    
    // 如果新玩家是AI，延迟触发AI行棋
    if (chessStore.isCurrentPlayerAI()) {
      console.log(`检测到${newPlayer === 'red' ? '红方' : '黑方'}使用AI，准备触发...`);
      setTimeout(() => {
        aiModule.triggerAIMove();
      }, 1000);
    }
  }
);

// 生命周期钩子
onMounted(() => {
  initScene();
  window.addEventListener('resize', sceneManager.onWindowResize);
  
  // 加载配置并启动 AI 引擎
  loadConfig().then(config => {
    console.log('✅ 配置加载完成，启用交互');
    
    // ✅ 设置配置就绪标志，允许用户操作
    isConfigReady.value = true;
    
    // 更新全局棋子形状配置
    currentPieceShape = config.ui.piece_shape;
    console.log('棋子形状配置加载:', currentPieceShape);

    const enginePath = config.engine.pikafish_path;
    console.log('准备启动AI引擎，路径:', enginePath);
    
    // 注意：startEngine 需要从 services 导入
    import('../../services/engineService').then(({ startEngine }) => {
      return startEngine(enginePath);
    }).then(() => {
      aiModule.setEngineStarted(true);
      console.log('AI 引擎已就绪');
    }).catch(error => {
      console.error('启动 AI 引擎失败:', error);
    });
  }).catch(error => {
    console.error('❌ 加载配置失败:', error);
    // 即使配置加载失败，也启用交互（使用默认配置）
    isConfigReady.value = true;
  });
  
  // 添加键盘事件监听，根据修饰键动态控制相机操作
  const updateControlsMode = (keyboardEvent: KeyboardEvent) => {
    if (!controls) return;
    
    // 根据修饰键设置不同的鼠标操作模式
    if (keyboardEvent.altKey) {
      // Alt + 左键：旋转
      controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      controls.enabled = true;
    } else if (keyboardEvent.ctrlKey) {
      // Ctrl + 左键：缩放
      controls.mouseButtons.LEFT = THREE.MOUSE.DOLLY;
      controls.enabled = true;
    } else if (keyboardEvent.shiftKey) {
      // Shift + 左键：平移
      controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
      controls.enabled = true;
    } else {
      // 无修饰键：禁用相机控制，允许拖动棋子
      controls.mouseButtons.LEFT = null;
      controls.enabled = false;
    }
  };
  
  const handleKeyDown = (event: KeyboardEvent) => {
    // 检查是否是 Ctrl+H 组合键（重置相机视角）
    if (event.ctrlKey && event.key.toLowerCase() === 'h') {
      event.preventDefault(); // 阻止默认行为
      sceneManager.resetCameraView();
      return;
    }
    
    // 更新控制器模式
    updateControlsMode(event);
  };
  
  const handleKeyUp = (event: KeyboardEvent) => {
    // 更新控制器模式
    updateControlsMode(event);
  };
  
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  
  // 保存清理函数
  (window as any).__chessControlsCleanup = () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  };
});

// 暴露方法给父组件
defineExpose({
  updatePieceShape
});

onBeforeUnmount(() => {
  // 清理配置检查定时器
  if (checkConfigChange) {
    clearInterval(checkConfigChange);
  }
  
  window.removeEventListener('resize', sceneManager.onWindowResize);
  
  // 清理提示定时器
  gameState.cleanup();
  
  // 清理鼠标事件监听
  interaction.cleanup();
  
  // 清理键盘事件监听
  if ((window as any).__chessControlsCleanup) {
    (window as any).__chessControlsCleanup();
    delete (window as any).__chessControlsCleanup;
  }
  
  // 清理场景资源
  sceneManager.dispose();
});

</script>

<style scoped>
.chess-board-3d {
  width: 100%;
  height: 100%;
  position: relative;
}

.check-alert {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
  animation: pulse 0.5s ease-in-out infinite alternate;
  pointer-events: none; /* 让点击事件穿透提示层 */
}

.alert-image {
  width: 200px;
  height: auto;
  filter: drop-shadow(0 0 20px rgba(255, 0, 0, 0.8));
}

.ai-hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px 20px;
  border-radius: 5px;
  font-size: 16px;
  font-weight: bold;
  pointer-events: none; /* 让点击事件穿透提示层 */
}

@keyframes pulse {
  from {
    transform: translate(-50%, -50%) scale(1);
  }
  to {
    transform: translate(-50%, -50%) scale(1.1);
  }
}
</style>
