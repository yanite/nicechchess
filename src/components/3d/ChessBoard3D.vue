<template>
  <div ref="container" class="chess-board-3d"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useChessStore } from '../../store/chessStore';
import { PIECES, type PieceType } from '../../logic/chess/constants';

const container = ref<HTMLDivElement | null>(null);
const chessStore = useChessStore();

// Three.js 相关变量
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let boardGroup: THREE.Group;
let piecesGroup: THREE.Group;
let raycaster: THREE.Raycaster;
let mouse: THREE.Vector2;

// 棋盘尺寸配置
const BOARD_WIDTH = 9;
const BOARD_HEIGHT = 10;
const CELL_SIZE = 1;
const BOARD_MARGIN_X = 0.5; // 左右边界
const BOARD_MARGIN_Z = 1.0; // 上下边界（一个棋子尺寸）

/**
 * 初始化 Three.js 场景
 */
function initScene() {
  if (!container.value) return;

  // 创建场景
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  // 创建相机 - 初始位置正对棋盘（俯视）
  const aspect = container.value.clientWidth / container.value.clientHeight;
  camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
  camera.position.set(0, 15, 0); // 正上方俯视
  camera.lookAt(0, 0, 0);

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.value.clientWidth, container.value.clientHeight);
  renderer.shadowMap.enabled = true;
  container.value.appendChild(renderer.domElement);

  // 添加轨道控制器 - 默认禁用，需要按住 Ctrl 才能旋转
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enabled = false; // 默认禁用旋转

  // 添加灯光
  setupLights();

  // 创建棋盘和棋子
  createBoard();
  createPieces();

  // 初始化射线检测
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // 添加点击事件监听
  renderer.domElement.addEventListener('click', onMouseClick);

  // 开始渲染循环
  animate();
}

/**
 * 设置灯光
 */
function setupLights() {
  // 环境光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  // 方向光（主光源）
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 20, 10);
  directionalLight.castShadow = true;
  directionalLight.shadow.camera.near = 0.1;
  directionalLight.shadow.camera.far = 50;
  directionalLight.shadow.camera.left = -10;
  directionalLight.shadow.camera.right = 10;
  directionalLight.shadow.camera.top = 10;
  directionalLight.shadow.camera.bottom = -10;
  scene.add(directionalLight);
}

/**
 * 创建棋盘
 */
function createBoard() {
  boardGroup = new THREE.Group();

  // 棋盘底座尺寸计算
  // 棋盘有 9 列（8个间隔），10 行（9个间隔）
  // 左右边界使用 BOARD_MARGIN_X，上下边界使用 BOARD_MARGIN_Z
  const boardWidth = (BOARD_WIDTH - 1) * CELL_SIZE + BOARD_MARGIN_X * 2;
  const boardHeight = (BOARD_HEIGHT - 1) * CELL_SIZE + BOARD_MARGIN_Z * 2;
  const boardGeometry = new THREE.BoxGeometry(boardWidth, 0.2, boardHeight);
  const boardMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xDEB887,
    roughness: 0.7 
  });
  const boardMesh = new THREE.Mesh(boardGeometry, boardMaterial);
  boardMesh.position.y = -0.1;
  boardMesh.receiveShadow = true;
  boardGroup.add(boardMesh);

  // 绘制棋盘线
  drawBoardLines();

  scene.add(boardGroup);
}

/**
 * 绘制棋盘线
 */
function drawBoardLines() {
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
  
  // 棋盘线的起始位置
  // 9 条竖线，8 个间隔
  // 10 条横线，9 个间隔
  const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
  const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;

  // 绘制横线（10条，从 0 到 9）
  for (let i = 0; i < BOARD_HEIGHT; i++) {
    const points = [];
    points.push(new THREE.Vector3(startX, 0.01, startZ + i * CELL_SIZE));
    points.push(new THREE.Vector3(startX + (BOARD_WIDTH - 1) * CELL_SIZE, 0.01, startZ + i * CELL_SIZE));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, lineMaterial);
    boardGroup.add(line);
  }

  // 绘制竖线（9条，从 0 到 8）
  for (let i = 0; i < BOARD_WIDTH; i++) {
    const points = [];
    
    // 上半部分（从第 0 行到第 4 行）
    points.push(new THREE.Vector3(startX + i * CELL_SIZE, 0.01, startZ));
    points.push(new THREE.Vector3(startX + i * CELL_SIZE, 0.01, startZ + 4 * CELL_SIZE));
    let geometry = new THREE.BufferGeometry().setFromPoints(points);
    let line = new THREE.Line(geometry, lineMaterial);
    boardGroup.add(line);
    
    // 下半部分（从第 5 行到第 9 行）
    points.length = 0;
    points.push(new THREE.Vector3(startX + i * CELL_SIZE, 0.01, startZ + 5 * CELL_SIZE));
    points.push(new THREE.Vector3(startX + i * CELL_SIZE, 0.01, startZ + (BOARD_HEIGHT - 1) * CELL_SIZE));
    geometry = new THREE.BufferGeometry().setFromPoints(points);
    line = new THREE.Line(geometry, lineMaterial);
    boardGroup.add(line);
  }

  // 绘制九宫格斜线
  const palaceLines = [
    // 上方九宫格（第 0-2 行，第 3-5 列）
    [[3, 0], [5, 2]],
    [[5, 0], [3, 2]],
    // 下方九宫格（第 7-9 行，第 3-5 列）
    [[3, 7], [5, 9]],
    [[5, 7], [3, 9]],
  ];

  palaceLines.forEach(([start, end]) => {
    const points = [];
    points.push(new THREE.Vector3(
      startX + start[0] * CELL_SIZE,
      0.01,
      startZ + start[1] * CELL_SIZE
    ));
    points.push(new THREE.Vector3(
      startX + end[0] * CELL_SIZE,
      0.01,
      startZ + end[1] * CELL_SIZE
    ));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, lineMaterial);
    boardGroup.add(line);
  });

  // 绘制楚河汉界文字（在第 4 行和第 5 行之间）
  const riverY = startZ + 4.5 * CELL_SIZE;
  
  // 创建文字纹理
  const createTextTexture = (text: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    // 透明背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, 128, 128);
    
    // 绘制文字
    ctx.font = 'bold 80px "KaiTi", "STKaiti", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000000';
    ctx.fillText(text, 64, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  };
  
  // 在棋盘上分散放置"楚河汉界"四个字
  const riverTexts = ['楚', '河', '汉', '界'];
  const textSpacing = (BOARD_WIDTH - 1) * CELL_SIZE / 5; // 平均分布
  
  riverTexts.forEach((char, index) => {
    const texture = createTextTexture(char);
    if (!texture) return;
    
    // 创建平面几何体显示文字
    const textGeometry = new THREE.PlaneGeometry(CELL_SIZE * 0.8, CELL_SIZE * 0.8);
    const textMaterial = new THREE.MeshBasicMaterial({ 
      map: texture, 
      transparent: true,
      side: THREE.DoubleSide
    });
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    
    // 计算位置：均匀分布在楚河汉界区域
    const xPos = startX + (index + 1) * textSpacing;
    textMesh.position.set(xPos, 0.02, riverY);
    textMesh.rotation.x = -Math.PI / 2; // 水平放置
    
    boardGroup.add(textMesh);
  });

  // 绘制兵、卒、炮位置的位标（十字准星标记）
  drawPieceMarkers(startX, startZ);
}

/**
 * 绘制兵、卒、炮位置的位标
 */
function drawPieceMarkers(startX: number, startZ: number) {
  const markerMaterial = new THREE.LineBasicMaterial({ color: 0x000000 });
  const markerSize = 0.15; // 位标拐线长度

  // 定义需要绘制位标的位置（col, row）
  const markerPositions = [
    // 红方兵位 (1,3), (3,3), (5,3), (7,3), (9,3) → 对应索引 (0,6), (2,6), (4,6), (6,6), (8,6)
    [0, 6], [2, 6], [4, 6], [6, 6], [8, 6],
    // 红方炮位 (2,2), (8,2) → 对应索引 (1,7), (7,7)
    [1, 7], [7, 7],
    // 黑方卒位 (9,6), (7,6), (5,6), (3,6), (1,6) → 对应索引 (8,3), (6,3), (4,3), (2,3), (0,3)
    [8, 3], [6, 3], [4, 3], [2, 3], [0, 3],
    // 黑方炮位 (8,7), (2,7) → 对应索引 (7,2), (1,2)
    [7, 2], [1, 2],
  ];

  markerPositions.forEach(([col, row]) => {
    const x = startX + col * CELL_SIZE;
    const z = startZ + row * CELL_SIZE;

    // 左上角拐线
    const leftTopPoints = [
      new THREE.Vector3(x - markerSize, 0.01, z - markerSize / 2),
      new THREE.Vector3(x - markerSize / 2, 0.01, z - markerSize / 2),
      new THREE.Vector3(x - markerSize / 2, 0.01, z - markerSize),
    ];
    const leftTopGeometry = new THREE.BufferGeometry().setFromPoints(leftTopPoints);
    const leftTopLine = new THREE.Line(leftTopGeometry, markerMaterial);
    boardGroup.add(leftTopLine);

    // 右上角拐线
    const rightTopPoints = [
      new THREE.Vector3(x + markerSize / 2, 0.01, z - markerSize),
      new THREE.Vector3(x + markerSize / 2, 0.01, z - markerSize / 2),
      new THREE.Vector3(x + markerSize, 0.01, z - markerSize / 2),
    ];
    const rightTopGeometry = new THREE.BufferGeometry().setFromPoints(rightTopPoints);
    const rightTopLine = new THREE.Line(rightTopGeometry, markerMaterial);
    boardGroup.add(rightTopLine);

    // 左下角拐线
    const leftBottomPoints = [
      new THREE.Vector3(x - markerSize, 0.01, z + markerSize / 2),
      new THREE.Vector3(x - markerSize / 2, 0.01, z + markerSize / 2),
      new THREE.Vector3(x - markerSize / 2, 0.01, z + markerSize),
    ];
    const leftBottomGeometry = new THREE.BufferGeometry().setFromPoints(leftBottomPoints);
    const leftBottomLine = new THREE.Line(leftBottomGeometry, markerMaterial);
    boardGroup.add(leftBottomLine);

    // 右下角拐线
    const rightBottomPoints = [
      new THREE.Vector3(x + markerSize / 2, 0.01, z + markerSize),
      new THREE.Vector3(x + markerSize / 2, 0.01, z + markerSize / 2),
      new THREE.Vector3(x + markerSize, 0.01, z + markerSize / 2),
    ];
    const rightBottomGeometry = new THREE.BufferGeometry().setFromPoints(rightBottomPoints);
    const rightBottomLine = new THREE.Line(rightBottomGeometry, markerMaterial);
    boardGroup.add(rightBottomLine);
  });
}

/**
 * 创建棋子
 */
function createPieces() {
  piecesGroup = new THREE.Group();
  updatePieces();
  scene.add(piecesGroup);
}

/**
 * 更新棋子位置
 */
function updatePieces() {
  // 清除现有棋子
  while (piecesGroup.children.length > 0) {
    piecesGroup.remove(piecesGroup.children[0]);
  }

  const board = chessStore.board;
  // 棋盘线的起始位置（与 drawBoardLines 保持一致）
  const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
  const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;

  // 遍历棋盘，创建棋子
  for (let row = 0; row < BOARD_HEIGHT; row++) {
    for (let col = 0; col < BOARD_WIDTH; col++) {
      const piece = board[row][col];
      if (piece !== PIECES.EMPTY) {
        const pieceMesh = createPieceMesh(piece, row, col);
        // 棋子应该放在棋盘线的交叉点上
        pieceMesh.position.x = startX + col * CELL_SIZE;
        pieceMesh.position.z = startZ + row * CELL_SIZE;
        
        // 设置棋子文字朝向：都朝向楚河汉界（棋盘中心）
        // 黑方在上方（row 0-4），文字需要旋转 -90 度
        // 红方在下方（row 5-9），文字需要旋转 90 度
        const isRed = piece > 0;
        if (!isRed && row < 5) {
          // 黑方棋子在上半部分，旋转 -90 度
          pieceMesh.rotation.y = -Math.PI / 2;
        } else if (isRed && row >= 5) {
          // 红方棋子在下半部分，旋转 90 度
          pieceMesh.rotation.y = Math.PI / 2;
        } else if (!isRed && row >= 5) {
          // 黑方棋子在下半部分（特殊情况），旋转 90 度
          pieceMesh.rotation.y = Math.PI / 2;
        } else {
          // 红方棋子在上半部分（特殊情况），旋转 -90 度
          pieceMesh.rotation.y = -Math.PI / 2;
        }
        
        pieceMesh.userData = { row, col, piece };
        piecesGroup.add(pieceMesh);
      }
    }
  }
}

/**
 * 创建单个棋子网格（带文字）
 */
function createPieceMesh(piece: PieceType, row: number, col: number): THREE.Mesh {
  const radius = CELL_SIZE * 0.4;
  const height = CELL_SIZE * 0.25;
  
  // 圆柱体几何
  const geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
  
  // 根据棋子颜色设置材质
  const isRed = piece > 0;
  
  // 创建带文字的纹理
  const texture = createPieceTexture(piece, isRed);
  
  // 顶部材质（带文字）
  const topMaterial = new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff,
    roughness: 0.5,
    metalness: 0.1,
  });
  
  // 侧面材质
  const sideMaterial = new THREE.MeshStandardMaterial({
    color: isRed ? 0xFF6B6B : 0x333333,
    roughness: 0.6,
    metalness: 0.2,
  });
  
  // 底部材质
  const bottomMaterial = new THREE.MeshStandardMaterial({
    color: isRed ? 0xCC0000 : 0x1a1a1a,
    roughness: 0.7,
    metalness: 0.1,
  });
  
  // 为圆柱体的不同面应用不同材质
  // CylinderGeometry 的材质索引顺序: [侧面, 顶面, 底面]
  const materials = [
    sideMaterial,   // 侧面
    topMaterial,    // 顶部
    bottomMaterial, // 底部
  ];
  
  const mesh = new THREE.Mesh(geometry, materials);
  mesh.position.y = height / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  
  return mesh;
}

/**
 * 创建棋子文字纹理
 */
function createPieceTexture(piece: PieceType, isRed: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const size = 128;
  canvas.width = size;
  canvas.height = size;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法获取 canvas 上下文');
  
  // 背景色（米黄色）
  ctx.fillStyle = '#F5DEB3';
  ctx.fillRect(0, 0, size, size);
  
  // 绘制圆形边框
  ctx.strokeStyle = isRed ? '#CC0000' : '#000000';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
  ctx.stroke();
  
  // 绘制文字
  const pieceName = getPieceChineseName(piece);
  ctx.font = 'bold 72px "KaiTi", "STKaiti", "SimSun", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isRed ? '#CC0000' : '#000000';
  ctx.fillText(pieceName, size / 2, size / 2 + 4);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  
  return texture;
}

/**
 * 获取棋子的中文名称
 */
function getPieceChineseName(piece: PieceType): string {
  const names: Record<number, string> = {
    1: '帥',   // 红帅（繁体）
    2: '俥',   // 红车（繁体）
    3: '傌',   // 红马（繁体）
    4: '炮',   // 红炮
    5: '仕',   // 红仕
    6: '相',   // 红相
    7: '兵',   // 红兵
    '-1': '将', // 黑将
    '-2': '车', // 黑车
    '-3': '马', // 黑马
    '-4': '炮', // 黑炮
    '-5': '士', // 黑士
    '-6': '象', // 黑象
    '-7': '卒', // 黑卒
  };
  
  return names[piece] || '';
}

/**
 * 鼠标点击处理
 */
function onMouseClick(event: MouseEvent) {
  if (!container.value) return;

  // 计算鼠标位置
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // 射线检测
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(piecesGroup.children);

  if (intersects.length > 0) {
    const selectedObject = intersects[0].object;
    const { row, col, piece } = selectedObject.userData;
    
    // 如果已经选中了棋子，则尝试移动
    if (chessStore.selectedPiece) {
      const [fromRow, fromCol] = chessStore.selectedPiece;
      
      // TODO: 添加规则校验
      const success = chessStore.movePiece(fromRow, fromCol, row, col);
      
      if (success) {
        updatePieces();
      }
    } else {
      // 否则选择该棋子
      chessStore.selectPiece(row, col);
      
      // 高亮选中的棋子
      highlightPiece(selectedObject);
    }
  } else {
    // 点击空白处，取消选择
    chessStore.selectPiece(-1, -1);
  }
}

/**
 * 高亮选中的棋子
 */
function highlightPiece(mesh: THREE.Object3D) {
  // 重置所有棋子颜色
  piecesGroup.children.forEach(child => {
    if (child instanceof THREE.Mesh) {
      const material = child.material as THREE.MeshStandardMaterial;
      const isRed = child.userData.piece > 0;
      material.color.setHex(isRed ? 0xFF0000 : 0x000000);
      material.emissive.setHex(0x000000);
    }
  });
  
  // 高亮当前选中的棋子
  if (mesh instanceof THREE.Mesh) {
    const material = mesh.material as THREE.MeshStandardMaterial;
    material.emissive.setHex(0x444444);
  }
}

/**
 * 动画循环
 */
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

/**
 * 处理窗口大小变化
 */
function onWindowResize() {
  if (!container.value) return;
  
  const width = container.value.clientWidth;
  const height = container.value.clientHeight;
  
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

// 生命周期钩子
onMounted(() => {
  initScene();
  window.addEventListener('resize', onWindowResize);
  
  // 添加键盘事件监听，按住 Ctrl 键时启用摄像头旋转
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.ctrlKey && controls) {
      controls.enabled = true;
    }
  };
  
  const handleKeyUp = (event: KeyboardEvent) => {
    if (!event.ctrlKey && controls) {
      controls.enabled = false;
    }
  };
  
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  
  // 保存清理函数
  (window as any).__chessControlsCleanup = () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  };
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize);
  
  // 清理键盘事件监听
  if ((window as any).__chessControlsCleanup) {
    (window as any).__chessControlsCleanup();
    delete (window as any).__chessControlsCleanup;
  }
  
  if (renderer) {
    renderer.dispose();
  }
});

// 监听棋盘状态变化
watch(() => chessStore.board, () => {
  updatePieces();
}, { deep: true });
</script>

<style scoped>
.chess-board-3d {
  width: 100%;
  height: 100%;
  position: relative;
}
</style>
