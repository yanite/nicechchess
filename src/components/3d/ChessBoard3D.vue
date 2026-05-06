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
import { loadConfig } from '../../services/configService';
import { isValidMove } from '../../logic/chess/rules';

// 导入模块化功能
import { useScene } from './useScene';
import { createBoard, BOARD_WIDTH, BOARD_HEIGHT, CELL_SIZE } from './useBoard';
import { createPieces, syncPiecesWithBoard, resetPiecePosition as resetPiecePositionFunc, loadChessFont, refreshPieceTextures, setCurrentFontName } from './usePieces';
import { useInteraction } from './useInteraction';
import { useAI } from './useAI';
import { useGameState } from './useGameState';
import { useGameAdapter } from '../../ui/composables/useGameAdapter'; // 新增：使用适配器

const container = ref<HTMLDivElement | null>(null);
const gameAdapter = useGameAdapter(); // 新增：使用适配器替代直接引用store
const chessStore = gameAdapter.chessStore; // 保留引用供高级用法

// 棋子形状配置
let currentPieceShape: 'cylinder' | 'standard' = 'cylinder';
let opponentTextDirection: 'down' | 'up' = 'down';
let pieceTextRandomRotation: number = 0;
let currentMoveMode: 'drag' | 'click' = 'drag'; // 当前移动模式

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

// 合法落点指示点
let validMoveIndicators: THREE.Mesh[] = [];

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
  return gameAdapter.currentPlayer === 'red' ? '红方' : '黑方';
});

/**
 * 动画移动棋子（用于跳转着法时）
 */
function animatePieceMove(piece: THREE.Mesh, fromRow: number, fromCol: number, toRow: number, toCol: number, duration: number = 500): Promise<void> {
  return new Promise((resolve) => {
    const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
    const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;
    
    // 起始位置
    const startPos = {
      x: startX + fromCol * CELL_SIZE,
      z: startZ + fromRow * CELL_SIZE,
      y: piece.position.y
    };
    
    // 目标位置
    const targetPos = {
      x: startX + toCol * CELL_SIZE,
      z: startZ + toRow * CELL_SIZE,
      y: 0.01 // 棋盘平面高度
    };
    
    // 动画参数
    const startTime = Date.now();
    
    function animate() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 使用缓动函数（easeInOutQuad）
      const eased = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      
      // 更新位置
      piece.position.x = startPos.x + (targetPos.x - startPos.x) * eased;
      piece.position.z = startPos.z + (targetPos.z - startPos.z) * eased;
      piece.position.y = startPos.y + (targetPos.y - startPos.y) * eased;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // 动画完成，恢复正确的y坐标
        resetPiecePositionFunc(piece, currentPieceShape);
        resolve();
      }
    }
    
    animate();
  });
}

/**
 * 执行棋子移动（带动画）
 */
function executeMove(fromRow: number, fromCol: number, toRow: number, toCol: number, piece?: THREE.Mesh) {
  const board = gameAdapter.board;
  
  // 获取当前拖动的棋子或传入的棋子
  const draggedPiece = piece || (interaction ? interaction.getDraggedPiece() : null);
  
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
  
  // 恢复正确的y坐标（根据棋子形状）
  resetPiecePositionFunc(draggedPiece, currentPieceShape);
  
  // 4. 更新棋盘数据
  gameAdapter.movePiece(fromRow, fromCol, toRow, toCol);
  
  // 5. 清除合法落点指示器
  clearValidMoves();
  
  // 6. 检查是否形成将军或绝杀
  checkCheckAndCheckmate(toRow, toCol);
  
  // 7. 如果当前玩家是 AI 且不在研究模式，触发 AI 行棋（支持双 AI）
  if (!gameAdapter.getIsStudyMode() && gameAdapter.isCurrentPlayerAI()) {
    setTimeout(() => {
      if (aiModule) aiModule.triggerAIMove();
    }, 1000);
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
    currentPieceShape = config.ui.piece_shape || 'cylinder';
    opponentTextDirection = config.ui.opponent_text_direction || 'down';
    pieceTextRandomRotation = (config.ui as any).piece_text_random_rotation ?? 0;
    currentMoveMode = (config.ui as any).move_mode || 'drag';
  } catch (error) {
    // 使用默认纹理
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

  // 加载自定义字体（如果存在）
  // 根据配置选择字体
  const config = await loadConfig();
  const fontName = (config.ui as any).chess_font || '楷体';
  
  let fontPath = '';
  let internalFontName = 'KaiTi'; // Canvas使用的内部字体名称
  
  if (fontName === '隶书') {
    fontPath = 'assets/fonts/隶书.ttf';
    internalFontName = 'LiSu';
  } else if (fontName === '中國龍豪行書') {
    fontPath = 'assets/fonts/中國龍豪行書.TTF';
    internalFontName = 'HAKUYOOTI3500';
  } else {
    // 系统楷体，不加载自定义字体
    fontPath = '';
    internalFontName = 'KaiTi';
  }
  
  if (fontPath) {
    // 加载 TTF 字体（Canvas 方案）
    await loadChessFont(internalFontName, fontPath);
    
    // 设置全局字体名称，供Canvas渲染使用
    setCurrentFontName(internalFontName);
  } else {
    // 使用系统楷体
    setCurrentFontName('KaiTi');
  }

  // 添加灯光
  // setupLights 已在 initScene 中调用

  // 创建棋盘
  boardGroup = createBoard(scene, boardTexturePath, container.value, lineMaterials);

  // 创建棋子
  piecesGroup = createPieces(scene, gameAdapter.board, currentPieceShape, opponentTextDirection, pieceTextRandomRotation);
  
  // 如果使用了自定义字体，需要刷新纹理以确保字体生效
  if (fontPath) {
    refreshPieceTextures(piecesGroup);
  }

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
    () => isConfigReady.value, // ✅ 传递配置就绪状态
    showValidMoves, // ✅ 棋子选中回调，显示合法落点
    clearValidMoves, // ✅ 棋子取消选中回调，清除合法落点
    currentMoveMode // ✅ 传递移动模式
  );

  // 设置鼠标事件监听
  interaction.setupEventListeners();
}

/**
 * 重新加载棋盘纹理
 */
async function reloadBoardTexture(texturePath: string) {
  if (!scene || !boardGroup) return;
  
  const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
  const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;
  
  // 移除旧的棋盘
  scene.remove(boardGroup);
  
  // 创建新的棋盘
  boardGroup = createBoard(scene, texturePath, container.value, lineMaterials);
}

/**
 * 更新棋子形状配置并重建所有棋子
 */
function updatePieceShape(shape: 'cylinder' | 'standard') {
  currentPieceShape = shape;
  
  // 重建所有棋子
  syncPiecesWithBoard(piecesGroup, scene, chessStore.board, currentPieceShape, opponentTextDirection, pieceTextRandomRotation);
}

/**
 * 同步棋盘状态（立即更新）
 */
function syncBoardState() {
  syncPiecesWithBoard(piecesGroup, scene, gameAdapter.board, currentPieceShape, opponentTextDirection, pieceTextRandomRotation);
}

/**
 * 同步棋盘状态（带动画）
 */
async function animateSyncBoardState() {
  // 获取当前着法索引和历史记录（统一从 adapter 获取）
  const store = gameAdapter.chessStore;
  const moveIndex = store.currentMoveIndex;
  const moveHistory = store.moveHistory;
  
  if (moveIndex >= 0 && moveIndex < moveHistory.length) {
    const moveRecord = moveHistory[moveIndex];
    
    const [fromRow, fromCol] = moveRecord.from;
    const [toRow, toCol] = moveRecord.to;
    const pieceType = moveRecord.piece;
    
    // 在3D场景中查找要移动的棋子（通过起始位置精确匹配）
    let pieceMesh: THREE.Mesh | undefined;
    for (const child of piecesGroup.children) {
      if (child instanceof THREE.Mesh) {
        const userData = (child as any).userData;
        if (userData.row === fromRow && 
            userData.col === fromCol && 
            userData.piece === pieceType &&
            !userData.isCaptured) {
          pieceMesh = child;
          break;
        }
      }
    }
    
    if (!pieceMesh) {
      // 降级方案：直接同步
      syncPiecesWithBoard(piecesGroup, scene, gameAdapter.board, currentPieceShape, opponentTextDirection, pieceTextRandomRotation);
      return;
    }
    
    const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
    const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;
    
    // 保存目标位置的引用（因为 syncPiecesWithBoard 会重建场景）
    const targetX = startX + toCol * CELL_SIZE;
    const targetZ = startZ + toRow * CELL_SIZE;
    const sourceX = startX + fromCol * CELL_SIZE;
    const sourceZ = startZ + fromRow * CELL_SIZE;
    
    // 先设置棋子到起始位置
    pieceMesh.position.x = sourceX;
    pieceMesh.position.z = sourceZ;
    
    // 执行动画
    const duration = 400;
    await animatePieceMove(pieceMesh, fromRow, fromCol, toRow, toCol, duration);
    
    // 动画完成后，立即更新棋子的 userData 以反映新位置，确保 syncPiecesWithBoard 能正确匹配
    (pieceMesh as any).userData.row = toRow;
    (pieceMesh as any).userData.col = toCol;
    
    // 同步所有棋子位置（处理被吃掉的棋子等）
    syncPiecesWithBoard(piecesGroup, scene, gameAdapter.board, currentPieceShape, opponentTextDirection, pieceTextRandomRotation);
  } else {
    // 没有着法记录，直接同步
    syncPiecesWithBoard(piecesGroup, scene, gameAdapter.board, currentPieceShape, opponentTextDirection, pieceTextRandomRotation);
  }
}

/**
 * 显示合法落点指示器
 */
function showValidMoves(pieceType: number, fromRow: number, fromCol: number) {
  // 清除旧的指示点
  clearValidMoves();
  
  // 车、炮不需要指示点（车=2, 炮=4，正负都表示车/炮）
  const absType = Math.abs(pieceType);
  if (absType === 2 || absType === 4) {
    return;
  }
  
  // 遍历所有可能的位置，找出合法落点
  for (let toRow = 0; toRow < BOARD_HEIGHT; toRow++) {
    for (let toCol = 0; toCol < BOARD_WIDTH; toCol++) {
      // 跳过当前位置
      if (toRow === fromRow && toCol === fromCol) continue;
      
      // 验证移动是否合法
      if (isValidMove(gameAdapter.board, fromRow, fromCol, toRow, toCol)) {
        // 创建绿色指示点
        const indicator = createValidMoveIndicator(toRow, toCol);
        scene.add(indicator);
        validMoveIndicators.push(indicator);
      }
    }
  }
}

/**
 * 创建单个合法落点指示器（绿色圆点）
 */
function createValidMoveIndicator(row: number, col: number): THREE.Mesh {
  const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
  const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;
  
  // 创建圆形几何体（半径缩小一倍，从 0.15 改为 0.075）
  const geometry = new THREE.CircleGeometry(CELL_SIZE * 0.075, 16);
  const material = new THREE.MeshBasicMaterial({ 
    color: 0x00ff00,  // 绿色
    transparent: true,
    opacity: 0.7,
    depthWrite: false
  });
  
  const indicator = new THREE.Mesh(geometry, material);
  
  // 设置位置（略高于棋盘）
  indicator.position.x = startX + col * CELL_SIZE;
  indicator.position.z = startZ + row * CELL_SIZE;
  indicator.position.y = 0.02; // 略高于棋盘
  
  // 旋转使其平躺在棋盘上
  indicator.rotation.x = -Math.PI / 2;
  
  return indicator;
}

/**
 * 清除所有合法落点指示器
 */
function clearValidMoves() {
  validMoveIndicators.forEach(indicator => {
    scene.remove(indicator);
    indicator.geometry.dispose();
    (indicator.material as THREE.Material).dispose();
  });
  validMoveIndicators = [];
}

/**
 * 获取棋子名称
 */
function getPieceName(pieceType: number): string {
  if (pieceType > 0) {
    // 红方
    const redPieces: Record<number, string> = {
      1: '帅', 2: '仕', 3: '相', 4: '马', 5: '车', 6: '炮', 7: '兵'
    };
    return redPieces[pieceType] || '';
  } else {
    // 黑方（负数）
    const absType = Math.abs(pieceType);
    const blackPieces: Record<number, string> = {
      1: '将', 2: '士', 3: '象', 4: '马', 5: '车', 6: '炮', 7: '卒'
    };
    return blackPieces[absType] || '';
  }
}

// 监听棋盘状态变化，同步3D视图
// 注意：不再监听 chessStore.board 的变化
// 棋子移动由 executeMove 和 executeAIMove 直接处理位置更新
// 配置变化（如棋子形状、随机旋转角度）将在下次开局时生效

// 监听配置变化（通过轮询检测localStorage）
let lastConfig = '';
const checkConfigChange = setInterval(() => {
  const currentConfig = localStorage.getItem('chchess_config') || '';
  if (currentConfig !== lastConfig && lastConfig !== '') {
    lastConfig = currentConfig;
    try {
      const config = JSON.parse(currentConfig);
      
      // 检查棋子形状变化（下次开局生效）
      if (config.ui && config.ui.piece_shape && config.ui.piece_shape !== currentPieceShape) {
        // 不立即重建，等待下次开局时应用
      }
      
      // 检查棋子文字随机旋转角度变化（下次开局生效）
      if (config.ui && config.ui.piece_text_random_rotation !== undefined && config.ui.piece_text_random_rotation !== pieceTextRandomRotation) {
        // 不立即重建，等待下次开局时应用
      }
      
      // 检查移动模式变化
      if (config.ui && config.ui.move_mode && config.ui.move_mode !== currentMoveMode) {
        currentMoveMode = config.ui.move_mode;
      }
      
      // 检查棋盘纹理变化
      if (config.ui && config.ui.board_texture) {
        reloadBoardTexture(config.ui.board_texture);
      }
    } catch (error) {
      // 忽略解析错误
    }
  } else if (lastConfig === '') {
    lastConfig = currentConfig;
  }
}, 1000); // 每秒检查一次

// 监听localStorage变化（配置变更）
const handleStorageChange = (e: StorageEvent) => {
  if (e.key === 'chchess_config') {
    try {
      const config = JSON.parse(e.newValue || '{}');
      
      // 检查棋子形状变化
      if (config.ui && config.ui.piece_shape && config.ui.piece_shape !== currentPieceShape) {
        updatePieceShape(config.ui.piece_shape);
      }
      
      // 检查棋子文字随机旋转角度变化
      if (config.ui && config.ui.piece_text_random_rotation !== undefined && config.ui.piece_text_random_rotation !== pieceTextRandomRotation) {
        pieceTextRandomRotation = config.ui.piece_text_random_rotation;
        // 重建所有棋子以应用新的旋转角度
        syncPiecesWithBoard(piecesGroup, scene, gameAdapter.board, currentPieceShape, opponentTextDirection, pieceTextRandomRotation);
      }
      
      // 检查移动模式变化
      if (config.ui && config.ui.move_mode && config.ui.move_mode !== currentMoveMode) {
        currentMoveMode = config.ui.move_mode;
      }
      
      // 检查棋盘纹理变化
      if (config.ui && config.ui.board_texture) {
        reloadBoardTexture(config.ui.board_texture);
      }
    } catch (error) {
      // 忽略解析错误
    }
  }
};

window.addEventListener('storage', handleStorageChange);

// 监听currentPlayer变化，自动触发AI行棋
watch(
  () => gameAdapter.currentPlayer,
  (newPlayer, oldPlayer) => {
    // 如果新玩家是AI且不在研究模式，延迟触发AI行棋
    if (!gameAdapter.getIsStudyMode() && gameAdapter.isCurrentPlayerAI()) {
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
    // ✅ 设置配置就绪标志，允许用户操作
    isConfigReady.value = true;
    
    // 更新全局棋子形状配置
    currentPieceShape = config.ui.piece_shape;

    const enginePath = config.engine.pikafish_path;
    
    // 注意：startEngine 需要从 services 导入
    import('../../services/engineService').then(({ startEngine }) => {
      return startEngine(enginePath);
    }).then(() => {
      // 确保 aiModule 已初始化后再调用
      if (aiModule) {
        aiModule.setEngineStarted(true);
      }
    }).catch(error => {
      // 启动 AI 引擎失败
    });
  }).catch(error => {
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
    
    // 左右方向键导航（悔棋/重做）
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const success = gameAdapter.undo();
      if (success) {
        // 延迟一小段时间确保 store 状态已更新，再同步 3D 场景
        setTimeout(() => {
          animateSyncBoardState();
        }, 50);
      }
      return;
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      const success = gameAdapter.redo();
      if (success) {
        // 延迟一小段时间确保 store 状态已更新，再同步 3D 场景
        setTimeout(() => {
          animateSyncBoardState();
        }, 50);
      }
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
  updatePieceShape,
  syncBoardState,
  animateSyncBoardState,  // 新增：带动画的同步
  triggerAIMove: () => aiModule?.triggerAIMove()
});

onBeforeUnmount(() => {
  // 清理配置检查定时器
  if (checkConfigChange) {
    clearInterval(checkConfigChange);
  }
  
  window.removeEventListener('resize', sceneManager.onWindowResize);
  
  // 清理提示定时器
  gameState.cleanup();
  
  // ✅ 清除合法落点指示器
  clearValidMoves();
  
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
