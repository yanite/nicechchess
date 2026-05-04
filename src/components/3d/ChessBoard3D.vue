<template>
  <div ref="container" class="chess-board-3d">
    <!-- 将军/绝杀提示图片 -->
    <div v-if="showCheckAlert" class="check-alert">
      <img :src="alertImage" alt="提示" class="alert-image" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { useChessStore } from '../../store/chessStore';
import { PIECES, type PieceType, type Board, UCIToMove } from '../../logic/chess/constants';
import { isValidMove, isInCheck } from '../../logic/chess/rules';
import checkImage from '../../assets/将军.png';
import checkmateImage from '../../assets/绝杀.png';
import { startEngine, getBestMove } from '../../services/engineService';
import { loadConfig } from '../../services/configService';

const container = ref<HTMLDivElement | null>(null);
const chessStore = useChessStore();

// 将军/绝杀提示相关状态
const showCheckAlert = ref(false);
const alertImage = ref('');
let alertTimer: number | null = null;

// AI 引擎相关状态
const isAIThinking = ref(false); // AI 是否正在思考
let engineStarted = false; // 引擎是否已启动

// Three.js 相关变量
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let boardGroup: THREE.Group;
let piecesGroup: THREE.Group;
let raycaster: THREE.Raycaster;
let mouse: THREE.Vector2;
let lineMaterials: LineMaterial[] = []; // 存储所有 LineMaterial，用于更新分辨率

// 默认相机位置和视角（用于Ctrl+H重置）
const DEFAULT_CAMERA_POSITION = new THREE.Vector3(0, 15, 0);
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 0, 0);

// 拖动相关变量
let draggedPiece: THREE.Mesh | null = null; // 当前拖动的棋子
let isDragging = false; // 是否正在拖动
let dragOffset = new THREE.Vector3(); // 拖动偏移量

// 棋子形状配置
let currentPieceShape: 'cylinder' | 'standard' = 'cylinder';

// 对方棋子字体方向配置
let opponentTextDirection: 'down' | 'up' = 'down';

// 棋盘尺寸配置
const BOARD_WIDTH = 9;
const BOARD_HEIGHT = 10;
const CELL_SIZE = 1;
const BOARD_MARGIN_X = 0.5; // 左右边界
const BOARD_MARGIN_Z = 1.0; // 上下边界（一个棋子尺寸）

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

  // 添加轨道控制器 - 始终启用，通过修饰键控制不同操作
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enabled = true; // 始终启用
  
  // 配置鼠标按钮：默认禁用所有操作，由键盘修饰键动态控制
  controls.mouseButtons = {
    LEFT: null,        // 左键默认不执行任何操作
    MIDDLE: null,      // 中键禁用
    RIGHT: null        // 右键禁用
  };

  // 添加灯光
  setupLights();

  // 创建棋盘和棋子
  createBoard(boardTexturePath);
  createPieces();

  // 初始化射线检测
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  // 添加鼠标事件监听
  renderer.domElement.addEventListener('mousedown', onMouseDown);
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('mouseup', onMouseUp);

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
 * 创建粗线（使用 Line2）
 * @param points - 线的顶点数组
 * @param color - 线的颜色
 * @param lineWidth - 线的宽度（像素）
 */
function createThickLine(points: THREE.Vector3[], color: number, lineWidth: number): Line2 {
  // 将点转化为扁平数组 [x1, y1, z1, x2, y2, z2, ...]
  const positions: number[] = [];
  points.forEach(p => positions.push(p.x, p.y, p.z));

  // 创建 LineGeometry
  const geometry = new LineGeometry();
  geometry.setPositions(positions);

  // 创建 LineMaterial
  const material = new LineMaterial({
    color: color,
    linewidth: lineWidth,
    resolution: new THREE.Vector2(
      container.value?.clientWidth || window.innerWidth,
      container.value?.clientHeight || window.innerHeight
    ),
    dashed: false
  });

  // 存储材质引用，用于窗口大小改变时更新分辨率
  lineMaterials.push(material);

  // 创建 Line2
  const line = new Line2(geometry, material);
  line.computeLineDistances(); // 必须调用，否则线条不可见
  
  return line;
}

/**
 * 创建棋盘
 * @param texturePath - 棋盘纹理路径
 */
function createBoard(texturePath: string) {
  // 清空之前的 LineMaterial 引用
  lineMaterials = [];
  
  boardGroup = new THREE.Group();

  // 棋盘底座尺寸计算
  // 棋盘有 9 列（8个间隔），10 行（9个间隔）
  // 左右边界使用 BOARD_MARGIN_X，上下边界使用 BOARD_MARGIN_Z
  const boardWidth = (BOARD_WIDTH - 1) * CELL_SIZE + BOARD_MARGIN_X * 2;
  const boardHeight = (BOARD_HEIGHT - 1) * CELL_SIZE + BOARD_MARGIN_Z * 2;
  const boardGeometry = new THREE.BoxGeometry(boardWidth, 0.2, boardHeight);
  
  // 加载纹理
  const textureLoader = new THREE.TextureLoader();
  let boardMaterial: THREE.MeshStandardMaterial;
  
  // 尝试加载纹理，如果失败则使用默认颜色
  try {
    console.log('尝试加载棋盘纹理:', texturePath);
    const texture = textureLoader.load(
      texturePath,
      (loadedTexture) => {
        console.log('棋盘纹理加载成功:', texturePath);
        loadedTexture.wrapS = THREE.RepeatWrapping;
        loadedTexture.wrapT = THREE.RepeatWrapping;
        loadedTexture.repeat.set(1, 1);
      },
      undefined,
      (error) => {
        console.warn('棋盘纹理加载失败，使用默认木纹颜色:', error);
        console.warn('纹理路径:', texturePath);
        // 降级到默认木纹颜色
        boardMaterial = new THREE.MeshStandardMaterial({ 
          color: 0xDEB887,  // 实木色
          roughness: 0.7 
        });
      }
    );
    
    // 如果纹理加载成功，使用纹理材质
    boardMaterial = new THREE.MeshStandardMaterial({ 
      map: texture,
      roughness: 0.7 
    });
  } catch (error) {
    console.error('纹理加载异常，使用默认颜色:', error);
    boardMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xDEB887,  // 实木色
      roughness: 0.7 
    });
  }
  
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
  const markerSize = 0.15; // 位标拐线长度
  const markerLineWidth = 2; // 位标线宽（像素）

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

    // 左上角拐线（排除最左边的列 col=0）
    if (col > 0) {
      const leftTopPoints = [
        new THREE.Vector3(x - markerSize, 0.01, z - markerSize / 2),
        new THREE.Vector3(x - markerSize / 2, 0.01, z - markerSize / 2),
        new THREE.Vector3(x - markerSize / 2, 0.01, z - markerSize),
      ];
      const leftTopLine = createThickLine(leftTopPoints, 0x000000, markerLineWidth);
      boardGroup.add(leftTopLine);
    }

    // 右上角拐线（排除最右边的列 col=8）
    if (col < BOARD_WIDTH - 1) {
      const rightTopPoints = [
        new THREE.Vector3(x + markerSize / 2, 0.01, z - markerSize),
        new THREE.Vector3(x + markerSize / 2, 0.01, z - markerSize / 2),
        new THREE.Vector3(x + markerSize, 0.01, z - markerSize / 2),
      ];
      const rightTopLine = createThickLine(rightTopPoints, 0x000000, markerLineWidth);
      boardGroup.add(rightTopLine);
    }

    // 左下角拐线（排除最左边的列 col=0）
    if (col > 0) {
      const leftBottomPoints = [
        new THREE.Vector3(x - markerSize, 0.01, z + markerSize / 2),
        new THREE.Vector3(x - markerSize / 2, 0.01, z + markerSize / 2),
        new THREE.Vector3(x - markerSize / 2, 0.01, z + markerSize),
      ];
      const leftBottomLine = createThickLine(leftBottomPoints, 0x000000, markerLineWidth);
      boardGroup.add(leftBottomLine);
    }

    // 右下角拐线（排除最右边的列 col=8）
    if (col < BOARD_WIDTH - 1) {
      const rightBottomPoints = [
        new THREE.Vector3(x + markerSize / 2, 0.01, z + markerSize),
        new THREE.Vector3(x + markerSize / 2, 0.01, z + markerSize / 2),
        new THREE.Vector3(x + markerSize, 0.01, z + markerSize / 2),
      ];
      const rightBottomLine = createThickLine(rightBottomPoints, 0x000000, markerLineWidth);
      boardGroup.add(rightBottomLine);
    }
  });
}

/**
 * 规则验证函数（调用 rules.ts 中的完整验证逻辑）
 * @param fromRow 起始行
 * @param fromCol 起始列
 * @param toRow 目标行
 * @param toCol 目标列
 * @returns 是否合法
 */
function validateMove(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
  return isValidMove(chessStore.board, fromRow, fromCol, toRow, toCol);
}

/**
 * 创建所有棋子（只在初始化时调用一次）
 */
function createPieces() {
  piecesGroup = new THREE.Group();
  
  const board = chessStore.board;
  // 棋盘线的起始位置（与 drawBoardLines 保持一致）
  const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
  const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;

  // 记录每种棋子的计数，用于生成唯一编号
  const pieceCounter: Record<string, number> = {};

  // 遍历棋盘，创建棋子
  for (let row = 0; row < BOARD_HEIGHT; row++) {
    for (let col = 0; col < BOARD_WIDTH; col++) {
      const piece = board[row][col];
      if (piece !== PIECES.EMPTY) {
        const pieceMesh = createPieceMesh(piece, row, col);
        
        // 设置位置（x和z坐标）
        pieceMesh.position.x = startX + col * CELL_SIZE;
        pieceMesh.position.z = startZ + row * CELL_SIZE;
        // 注意：不要设置 y 坐标，createPieceMesh 已经根据棋子形状正确设置了y坐标
        
        // 设置文字朝向：控制文字顶部方向
        const isRed = piece > 0;
        let rotationY = 0;
        
        if (isRed) {
          // 红方：文字顶部朝上（朝向棋盘上方/楚河汉界），不旋转
          rotationY = 0;
        } else {
          // 黑方：根据配置决定文字顶部方向
          if (opponentTextDirection === 'down') {
            // 向下：文字顶部朝下（朝向棋盘下方/楚河汉界），旋转180度
            rotationY = Math.PI;
          } else {
            // 向上：文字顶部朝上（远离楚河汉界），不旋转
            rotationY = 0;
          }
        }
        
        pieceMesh.rotation.y = rotationY;
        
        // 生成唯一编号：颜色 + 棋子名称 + 序号
        const pieceName = getPieceChineseName(piece);
        const colorPrefix = isRed ? '红' : '黑';
        const key = `${colorPrefix}${pieceName}`;
        
        // 增加计数器
        if (!pieceCounter[key]) {
          pieceCounter[key] = 0;
        }
        pieceCounter[key]++;
        
        const uniqueId = `${key}${pieceCounter[key]}`; // 例如：黑卒1、红兵1
        
        (pieceMesh as any).userData = { 
          row, 
          col, 
          piece,
          owner: isRed ? '红' : '黑',  // 归属方
          pieceName: pieceName,  // 棋子文字
          uniqueId: uniqueId,  // 唯一编号
          isCaptured: false  // 初始为活子
        };
        piecesGroup.add(pieceMesh);
      }
    }
  }
  
  scene.add(piecesGroup);
}

/**
 * 创建木纹纹理
 */
function createWoodTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  const size = 256;
  canvas.width = size;
  canvas.height = size;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法获取 canvas 上下文');
  
  // 基础木色背景
  ctx.fillStyle = '#D2B48C'; // 棕褐色
  ctx.fillRect(0, 0, size, size);
  
  // 绘制木纹线条
  ctx.strokeStyle = 'rgba(139, 69, 19, 0.3)'; // 深棕色半透明
  ctx.lineWidth = 2;
  
  for (let i = 0; i < size; i += 8) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    
    // 添加波浪效果模拟木纹
    for (let x = 0; x < size; x += 20) {
      const yOffset = Math.sin(x * 0.05) * 3;
      ctx.lineTo(x, i + yOffset);
    }
    
    ctx.stroke();
  }
  
  // 添加一些深色纹理线
  ctx.strokeStyle = 'rgba(101, 67, 33, 0.2)';
  ctx.lineWidth = 1;
  
  for (let i = 0; i < size; i += 15) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    
    for (let x = 0; x < size; x += 15) {
      const yOffset = Math.cos(x * 0.08) * 2;
      ctx.lineTo(x, i + yOffset);
    }
    
    ctx.stroke();
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1); // 水平重复2次
  texture.needsUpdate = true;
  
  return texture;
}

/**
 * 创建单个棋子网格（带文字）- 支持柱型和鼓型
 */
function createPieceMesh(piece: PieceType, _row: number, _col: number): THREE.Mesh {
  const baseRadius = CELL_SIZE * 0.4; // 基础半径
  const fullHeight = CELL_SIZE * 0.35;    // 原始棋子高度
  const height = currentPieceShape === 'cylinder' ? fullHeight * 0.5 : fullHeight; // 柱型高度减半
  
  let geometry: THREE.BufferGeometry;
  
  if (currentPieceShape === 'cylinder') {
    // 柱型：使用 CylinderGeometry
    geometry = new THREE.CylinderGeometry(baseRadius, baseRadius, height, 32);
  } else {
    // 鼓型：使用 LatheGeometry
    const bulgeAmount = CELL_SIZE * 0.08; // 鼓出程度
    const points: THREE.Vector2[] = [];
    const segments = 16; // 垂直采样点
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments; // 0 到 1
      const y = t * height; // y 轴从 0 到 height
      
      // 使用正弦函数实现"中间鼓、上下缩"的圆弧
      const radius = baseRadius + Math.sin(t * Math.PI) * bulgeAmount;
      
      points.push(new THREE.Vector2(radius, y));
    }
    
    // 封闭底部和顶部，让它看起来是实心的
    const allPoints = [
      new THREE.Vector2(0, 0),         // 底部中心点
      ...points,
      new THREE.Vector2(0, height)     // 顶部中心点
    ];
    
    geometry = new THREE.LatheGeometry(allPoints, 64); // 64 是径向分段
  }
  
  // 根据棋子颜色设置材质
  const isRed = piece > 0;
  
  // 创建带文字的纹理
  const texture = createPieceTexture(piece, isRed);
  
  // 创建木纹纹理用于侧面
  const woodTexture = createWoodTexture();
  
  // 侧面材质（木纹质感）
  const sideMaterial = new THREE.MeshStandardMaterial({
    map: woodTexture,
    color: 0xffffff,        // 白色基底，让木纹自然显示
    roughness: 0.6,         // 木质粗糙度
    metalness: 0.0,         // 无金属感
  });
  
  const mesh = new THREE.Mesh(geometry, sideMaterial);
  
  // 根据棋子形状设置y坐标位置
  if (currentPieceShape === 'cylinder') {
    // 柱型：圆柱几何体中心在原点，高度从 -height/2 到 +height/2
    // 要让底部在 y=0.01，需要将mesh整体上移 height/2
    mesh.position.y = 0.01 + height / 2;
  } else {
    // 鼓型：LatheGeometry 从 y=0 开始到 y=height
    // 直接放在棋盘上即可
    mesh.position.y = 0.01;
  }
  
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  
  // 添加顶部文字贴图（作为单独的平面）
  const textGeometry = new THREE.CircleGeometry(baseRadius * 0.9, 32);
  const textMaterial = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const textMesh = new THREE.Mesh(textGeometry, textMaterial);
  textMesh.rotation.x = -Math.PI / 2; // 水平放置
  
  // 设置文字贴图不参与射线检测，确保点击命中棋子本体
  textMesh.raycast = () => {}; // 禁用射线检测
  
  // 修复文字贴图位置：根据棋子形状调整
  if (currentPieceShape === 'cylinder') {
    // 柱型：圆柱几何体中心在原点，顶部在 height/2 位置（相对于mesh中心）
    // 文字贴图应该在顶部表面上方一点点
    textMesh.position.y = height / 2 + 0.001;
  } else {
    // 鼓型：使用 LatheGeometry，几何体从 y=0 开始到 y=height
    // 所以顶部在 height 位置
    textMesh.position.y = height + 0.001;
  }
  
  mesh.add(textMesh);
  
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
 * 根据棋子类型和位置生成稳定的唯一ID
 */
function generateStablePieceId(piece: PieceType, row: number, col: number): string {
  const isRed = piece > 0;
  const colorPrefix = isRed ? '红' : '黑';
  const pieceName = getPieceChineseName(piece);
  // 使用位置作为ID的一部分，确保唯一性
  return `${colorPrefix}${pieceName}_${row}_${col}`;
}

/**
 * 同步3D棋子位置与store的棋盘状态
 * 策略：清空现有棋子组，根据当前board状态重新创建所有棋子
 */
function syncPiecesWithBoard() {
  if (!piecesGroup || !scene) return;
  
  console.log('开始同步3D棋子');
  
  // 第一步：移除所有现有棋子
  while(piecesGroup.children.length > 0) {
    const child = piecesGroup.children[0];
    piecesGroup.remove(child);
    
    // 释放资源
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach(mat => mat.dispose());
      } else {
        child.material.dispose();
      }
    }
  }
  
  // 第二步：根据当前board状态重新创建所有棋子
  const board = chessStore.board;
  const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
  const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;
  
  // 记录每种棋子的计数，用于生成唯一编号
  const pieceCounter: Record<string, number> = {};
  
  for (let row = 0; row < BOARD_HEIGHT; row++) {
    for (let col = 0; col < BOARD_WIDTH; col++) {
      const piece = board[row][col];
      if (piece !== PIECES.EMPTY) {
        const pieceMesh = createPieceMesh(piece, row, col);
        
        // 设置位置（x和z坐标）
        pieceMesh.position.x = startX + col * CELL_SIZE;
        pieceMesh.position.z = startZ + row * CELL_SIZE;
        // 注意：不要设置 y 坐标，createPieceMesh 已经根据棋子形状正确设置了y坐标
        
        // 设置文字朝向：控制文字顶部方向
        const isRed = piece > 0;
        let rotationY = 0;
        
        if (isRed) {
          // 红方：文字顶部朝上（朝向棋盘上方/楚河汉界），不旋转
          rotationY = 0;
        } else {
          // 黑方：根据配置决定文字顶部方向
          if (opponentTextDirection === 'down') {
            // 向下：文字顶部朝下（朝向棋盘下方/楚河汉界），旋转180度
            rotationY = Math.PI;
          } else {
            // 向上：文字顶部朝上（远离楚河汉界），不旋转
            rotationY = 0;
          }
        }
        
        pieceMesh.rotation.y = rotationY;
        
        // 生成唯一编号
        const pieceName = getPieceChineseName(piece);
        const colorPrefix = isRed ? '红' : '黑';
        const key = `${colorPrefix}${pieceName}`;
        
        if (!pieceCounter[key]) {
          pieceCounter[key] = 0;
        }
        pieceCounter[key]++;
        
        const uniqueId = `${key}${pieceCounter[key]}`;
        
        (pieceMesh as any).userData = { 
          row, 
          col, 
          piece,
          owner: isRed ? '红' : '黑',
          pieceName: pieceName,
          uniqueId: uniqueId,
          isCaptured: false
        };
        
        piecesGroup.add(pieceMesh);
      }
    }
  }
  
  console.log(`3D棋子同步完成，共创建 ${piecesGroup.children.length} 个棋子`);
}

/**
 * 平滑移动棋子到目标位置（带动画效果）
 */
function animatePieceMove(pieceMesh: THREE.Mesh, targetX: number, targetZ: number, duration: number = 300) {
  const startX = pieceMesh.position.x;
  const startZ = pieceMesh.position.z;
  const startTime = Date.now();
  
  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // 使用缓动函数（ease-out）
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    
    pieceMesh.position.x = startX + (targetX - startX) * easedProgress;
    pieceMesh.position.z = startZ + (targetZ - startZ) * easedProgress;
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }
  
  animate();
}

/**
 * 鼠标按下事件 - 开始拖动棋子或相机控制
 */
function onMouseDown(event: MouseEvent) {
  if (!container.value) return;

  // 如果按下了修饰键（Alt/Ctrl/Shift），不处理棋子移动，交给OrbitControls处理
  if (event.altKey || event.ctrlKey || event.shiftKey) {
    return; // 让OrbitControls处理相机操作
  }

  // 计算鼠标位置
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // 射线检测
  raycaster.setFromCamera(mouse, camera);
  
  // 只响应左键
  if (event.button === 0) {
    // 递归检测所有子对象（包括文字贴图）
    const pieceIntersects = raycaster.intersectObjects(piecesGroup.children, true);

    if (pieceIntersects.length > 0) {
      let selectedObject = pieceIntersects[0].object as THREE.Mesh;
      
      // 如果点击的是文字贴图（子对象），找到父对象（棋子主体）
      while (selectedObject.parent && selectedObject.parent !== piecesGroup) {
        selectedObject = selectedObject.parent as THREE.Mesh;
      }
      
      // 检查是否是死子（被吃掉的棋子不能再移动）
      if ((selectedObject as any).userData.isCaptured) {
        return; // 死子不能拖动
      }
      
      // 检查是否是当前行棋方的棋子
      const { row, col, piece } = (selectedObject as any).userData;
      const pieceColor = piece > 0 ? 'red' : 'black';
      
      if (pieceColor === chessStore.currentPlayer) {
        // 开始拖动
        draggedPiece = selectedObject;
        isDragging = true;
        
        // 计算拖动偏移量（保持棋子与鼠标的相对位置）
        const planeY = 0.5; // 拖动平面高度
        const intersectPoint = new THREE.Vector3();
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
        raycaster.ray.intersectPlane(plane, intersectPoint);
        
        dragOffset.copy(selectedObject.position).sub(intersectPoint);
        
        // 抬起棋子
        selectedObject.position.y = 0.8;
        
        // 临时禁用控制器，避免冲突
        controls.enabled = false;
        return;
      }
    }
  }
}

/**
 * 鼠标移动事件 - 拖动棋子跟随鼠标
 */
function onMouseMove(event: MouseEvent) {
  if (!isDragging || !draggedPiece || !container.value) return;

  // 计算鼠标位置
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // 射线检测
  raycaster.setFromCamera(mouse, camera);
  
  // 在水平面上投射
  const planeY = 0.5;
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
  const intersectPoint = new THREE.Vector3();
  
  if (raycaster.ray.intersectPlane(plane, intersectPoint)) {
    // 更新棋子位置（保持偏移量）
    draggedPiece.position.x = intersectPoint.x + dragOffset.x;
    draggedPiece.position.z = intersectPoint.z + dragOffset.z;
  }
}

/**
 * 鼠标释放事件 - 放置棋子
 */
function onMouseUp(event: MouseEvent) {
  if (!isDragging || !draggedPiece || !container.value) {
    isDragging = false;
    draggedPiece = null;
    return;
  }

  // 计算鼠标位置
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // 射线检测棋盘平面
  raycaster.setFromCamera(mouse, camera);
  const planeY = 0;
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
  const intersectPoint = new THREE.Vector3();
  
  if (raycaster.ray.intersectPlane(plane, intersectPoint)) {
    // 计算目标格子坐标
    const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
    const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;
    
    const toCol = Math.round((intersectPoint.x - startX) / CELL_SIZE);
    const toRow = Math.round((intersectPoint.z - startZ) / CELL_SIZE);
    
    // 获取起始位置
    const fromRow = (draggedPiece as any).userData.row;
    const fromCol = (draggedPiece as any).userData.col;
    
    // 验证移动是否合法
    if (validateMove(fromRow, fromCol, toRow, toCol)) {
      // 执行移动
      executeMove(fromRow, fromCol, toRow, toCol);
    } else {
      // 移动不合法，回到原位
      resetPiecePosition(draggedPiece);
    }
  } else {
    // 没有命中棋盘，回到原位
    resetPiecePosition(draggedPiece);
  }
  
  // 重置拖动状态
  isDragging = false;
  draggedPiece = null;
  
  // 恢复控制器状态（根据当前修饰键状态）
  if (controls) {
    controls.enabled = true;
  }
}

/**
 * 执行移动
 */
function executeMove(fromRow: number, fromCol: number, toRow: number, toCol: number) {
  const board = chessStore.board;
  
  // 1. 生成检验函数（目前为空函数，总是返回 true）
  const validateMoveResult = validateMove(fromRow, fromCol, toRow, toCol);
  
  if (!validateMoveResult) {
    // 如果验证失败，将移动棋子放回原处
    if (draggedPiece) {
      resetPiecePosition(draggedPiece);
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
  if (targetPiece !== PIECES.EMPTY) {
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
      // 由于我们不再手动设置y坐标，棋子会保持createPieceMesh中设置的原始高度
      // 但为了确保可见，可以稍微降低一点高度让它看起来是"倒下"的状态
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
  // 不要设置y坐标，保持createPieceMesh中设置的正确高度
  
  // 4. 更新棋盘数据
  chessStore.movePiece(fromRow, fromCol, toRow, toCol);
  
  // 5. 检查是否形成将军或绝杀
  checkCheckAndCheckmate(toRow, toCol);
  
  // 6. 如果当前玩家是 AI，触发 AI 行棋（支持双 AI）
  console.log('移动完成，当前玩家:', chessStore.currentPlayer);
  if (chessStore.isCurrentPlayerAI()) {
    console.log('检测到当前玩家是AI，准备触发 AI...');
    setTimeout(() => {
      triggerAIMove();
    }, 1000);
  } else {
    console.log('当前是人类玩家，等待操作');
  }
}

/**
 * 检查并显示将军/绝杀提示
 */
function checkCheckAndCheckmate(movedToRow: number, movedToCol: number) {
  const board = chessStore.board;
  const nextPlayer = chessStore.currentPlayer; // 移动后切换到对方
  
  // 检查对方是否被将军
  const isOpponentInCheck = isInCheck(board, nextPlayer);
  
  if (isOpponentInCheck) {
    // 检查对方是否有解将的着法（即是否绝杀）
    const hasEscape = hasAnyLegalMove(board, nextPlayer);
    
    if (!hasEscape) {
      // 绝杀
      displayCheckmateAlert();
    } else {
      // 将军
      displayCheckAlert();
    }
  }
}

/**
 * 检查指定颜色是否有任何合法的移动
 */
function hasAnyLegalMove(board: Board, color: 'red' | 'black'): boolean {
  for (let fromRow = 0; fromRow < 10; fromRow++) {
    for (let fromCol = 0; fromCol < 9; fromCol++) {
      const piece = board[fromRow][fromCol];
      
      // 跳过空位和对方的棋子
      if (piece === PIECES.EMPTY) continue;
      const pieceColor = piece > 0 ? 'red' : 'black';
      if (pieceColor !== color) continue;
      
      // 尝试所有可能的目标位置
      for (let toRow = 0; toRow < 10; toRow++) {
        for (let toCol = 0; toCol < 9; toCol++) {
          if (fromRow === toRow && fromCol === toCol) continue;
          
          // 验证这个移动是否合法
          if (isValidMove(board, fromRow, fromCol, toRow, toCol)) {
            return true; // 找到一个合法移动
          }
        }
      }
    }
  }
  return false;
}

/**
 * 触发 AI 行棋
 */
async function triggerAIMove() {
  // 如果 AI 正在思考，不重复触发
  if (isAIThinking.value) {
    console.log('AI 正在思考中，跳过本次触发');
    return;
  }
  
  console.log('=== 开始触发 AI 行棋 ===');
  console.log('当前玩家:', chessStore.currentPlayer);
  console.log('引擎已启动:', engineStarted);
  
  // 启动引擎（如果尚未启动）
  if (!engineStarted) {
    try {
      await startEngine();
      engineStarted = true;
      console.log('AI 引擎已启动');
    } catch (error) {
      console.error('启动 AI 引擎失败:', error);
      return;
    }
  }
  
  isAIThinking.value = true;
  console.log('AI 开始思考...');
  
  try {
    // 获取当前局面的 FEN
    const fen = chessStore.fen;
    console.log('当前 FEN:', fen);
    
    // 打印棋盘状态用于调试
    console.log('当前棋盘 (board[9]=红方, board[0]=黑方):');
    for (let r = 9; r >= 0; r--) {
      const rowPieces = chessStore.board[r].map(p => {
        if (p === PIECES.EMPTY) return '.';
        return p > 0 ? 'R' : 'B';
      }).join(' ');
      console.log(`  board[${r}]: ${rowPieces}`);
    }
    
    // 请求 AI 最佳着法
    console.log('调用 getBestMove...');
    
    // 获取当前玩家的 AI 等级
    const skillLevel = chessStore.getCurrentPlayerAILevel();
    console.log('当前玩家 AI 等级:', skillLevel);
    
    // 获取引擎配置
    const config = chessStore.engineConfig;
    console.log('引擎配置:', config);
    
    const bestMoveUCI = await getBestMove(
      fen, 
      config.depth,           // 深度
      skillLevel,             // AI等级
      config.threads,         // 线程数
      config.hash,            // Hash大小
      config.calculationMode, // 计算模式
      config.movetime         // 思考时间
    );
    
    console.log('AI 选择着法:', bestMoveUCI);
    console.log('着法长度:', bestMoveUCI.length);
    
    // 转换 UCI 着法为内部坐标
    console.log('开始转换坐标...');
    const [fromRow, fromCol, toRow, toCol] = UCIToMove(bestMoveUCI);
    console.log(`UCI: ${bestMoveUCI} → 内部坐标: (${fromRow},${fromCol}) → (${toRow},${toCol})`);
    console.log(`起始位置棋子: ${chessStore.board[fromRow][fromCol]} (${chessStore.board[fromRow][fromCol] > 0 ? '红方' : '黑方'})`);
    console.log(`目标位置棋子: ${chessStore.board[toRow][toCol]}`);
    
    // 执行 AI 移动
    console.log('执行 AI 移动...');
    executeAIMove(fromRow, fromCol, toRow, toCol);
    console.log('AI 移动完成');
    
  } catch (error) {
    console.error('AI 行棋失败:', error);
    console.error('错误堆栈:', error instanceof Error ? error.stack : 'N/A');
  } finally {
    isAIThinking.value = false;
    console.log('=== AI 行棋流程结束 ===');
  }
}

/**
 * 执行 AI 移动（更新 3D 场景）
 */
function executeAIMove(fromRow: number, fromCol: number, toRow: number, toCol: number) {
  console.log(`AI 移动: (${fromRow},${fromCol}) → (${toRow},${toCol})`);
  
  // 验证 AI 着法是否符合规则
  const board = chessStore.board;
  if (!isValidMove(board, fromRow, fromCol, toRow, toCol)) {
    console.error(`AI 着法不合法: (${fromRow},${fromCol}) → (${toRow},${toCol})`);
    console.error('当前棋盘状态:', board);
    return;
  }
  console.log('AI 着法验证通过');
  
  // 找到 AI 要移动的棋子
  let aiPiece: THREE.Mesh | null = null;
  piecesGroup.children.forEach(child => {
    if (child instanceof THREE.Mesh) {
      const userData = child.userData as any;
      if (userData.row === fromRow && userData.col === fromCol && !userData.isCaptured) {
        aiPiece = child;
      }
    }
  });
  
  if (!aiPiece) {
    console.error('未找到 AI 棋子');
    return;
  }
  
  // 处理吃子
  const targetPiece = chessStore.board[toRow][toCol];
  if (targetPiece !== PIECES.EMPTY) {
    // 找到被吃的棋子并移到边缘
    let targetMesh: THREE.Mesh | null = null;
    piecesGroup.children.forEach(child => {
      if (child instanceof THREE.Mesh) {
        const userData = child.userData as any;
        if (userData.row === toRow && userData.col === toCol && !userData.isCaptured) {
          targetMesh = child;
        }
      }
    });
    
    if (targetMesh) {
      const targetUserData = (targetMesh as THREE.Mesh).userData as any;
      targetUserData.isCaptured = true;
      targetUserData.row = -1;
      targetUserData.col = -1;
      
      const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
      const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;
      const isRed = targetPiece > 0;
      
      let capturedCount = 0;
      piecesGroup.children.forEach(other => {
        if (other instanceof THREE.Mesh) {
          const otherUserData = other.userData as any;
          if (otherUserData.isCaptured) {
            const otherIsRed = otherUserData.piece > 0;
            if (otherIsRed === isRed) {
              capturedCount++;
            }
          }
        }
      });
      
      if (isRed) {
        const leftBoundary = startX - CELL_SIZE * 1.5;
        const offsetZ = capturedCount * CELL_SIZE * 0.75;
        (targetMesh as THREE.Mesh).position.x = leftBoundary;
        (targetMesh as THREE.Mesh).position.z = startZ + offsetZ;
      } else {
        const rightBoundary = startX + (BOARD_WIDTH - 1) * CELL_SIZE + CELL_SIZE * 1.5;
        const offsetZ = capturedCount * CELL_SIZE * 0.75;
        (targetMesh as THREE.Mesh).position.x = rightBoundary;
        (targetMesh as THREE.Mesh).position.z = startZ + offsetZ;
      }
      
      // 被吃掉的棋子也需要保持正确的高度
      // 由于我们不再手动设置y坐标，棋子会保持createPieceMesh中设置的原始高度
      // 但为了确保可见，可以稍微降低一点高度让它看起来是"倒下"的状态
      (targetMesh as THREE.Mesh).position.y = 0.01; // 保持在棋盘平面上
    }
  }
  
  // 移动 AI 棋子（使用平滑动画）
  const aiUserData = (aiPiece as THREE.Mesh).userData as any;
  aiUserData.row = toRow;
  aiUserData.col = toCol;
  
  const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
  const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;
  const targetX = startX + toCol * CELL_SIZE;
  const targetZ = startZ + toRow * CELL_SIZE;
  
  // 使用平滑动画移动棋子（500ms）
  animatePieceMove(aiPiece as THREE.Mesh, targetX, targetZ, 500);
  
  // 延迟更新棋盘数据，等待动画完成
  setTimeout(() => {
    chessStore.movePiece(fromRow, fromCol, toRow, toCol);
    // 检查将军/绝杀
    checkCheckAndCheckmate(toRow, toCol);
    
    // 检查下一位玩家是否是 AI（支持双 AI 对战）
    setTimeout(() => {
      if (chessStore.isCurrentPlayerAI()) {
        console.log('检测到下一位玩家也是AI，触发连续AI对战');
        triggerAIMove();
      }
    }, 600);
  }, 500);
}

/**
 * 显示将军提示
 */
function displayCheckAlert() {
  // 清除之前的定时器
  if (alertTimer !== null) {
    clearTimeout(alertTimer);
  }
  
  alertImage.value = checkImage;
  showCheckAlert.value = true;
  
  // 3秒后隐藏
  alertTimer = window.setTimeout(() => {
    showCheckAlert.value = false;
    alertTimer = null;
  }, 3000);
}

/**
 * 显示绝杀提示
 */
function displayCheckmateAlert() {
  // 清除之前的定时器
  if (alertTimer !== null) {
    clearTimeout(alertTimer);
  }
  
  alertImage.value = checkmateImage;
  showCheckAlert.value = true;
  
  // 3秒后隐藏
  alertTimer = window.setTimeout(() => {
    showCheckAlert.value = false;
    alertTimer = null;
  }, 3000);
}

/**
 * 重置棋子位置到原位
 */
function resetPiecePosition(pieceMesh: THREE.Mesh) {
  const { row, col, piece } = (pieceMesh as any).userData;
  const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
  const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;
  
  pieceMesh.position.x = startX + col * CELL_SIZE;
  pieceMesh.position.z = startZ + row * CELL_SIZE;
  
  // 恢复正确的y坐标：根据棋子形状重新计算
  const fullHeight = CELL_SIZE * 0.35;
  const height = currentPieceShape === 'cylinder' ? fullHeight * 0.5 : fullHeight;
  
  if (currentPieceShape === 'cylinder') {
    // 柱型：圆柱几何体中心在原点，要让底部在 y=0.01，需要上移 height/2
    pieceMesh.position.y = 0.01 + height / 2;
  } else {
    // 鼓型：LatheGeometry 从 y=0 开始，直接放在棋盘上
    pieceMesh.position.y = 0.01;
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
  
  // 更新所有 LineMaterial 的分辨率
  lineMaterials.forEach(material => {
    material.resolution.set(width, height);
  });
}

/**
 * 重置相机视角到默认位置（棋盘面向视口）
 */
function resetCameraView() {
  console.log('重置相机视角到默认位置');
  
  // 平滑过渡到默认位置
  const startPosition = camera.position.clone();
  const targetPosition = DEFAULT_CAMERA_POSITION.clone();
  
  // 简单的动画效果（10帧完成）
  let frame = 0;
  const totalFrames = 10;
  
  function animateReset() {
    frame++;
    const t = frame / totalFrames;
    
    // 线性插值
    camera.position.lerpVectors(startPosition, targetPosition, t);
    camera.lookAt(DEFAULT_CAMERA_TARGET);
    
    if (frame < totalFrames) {
      requestAnimationFrame(animateReset);
    } else {
      // 确保最终位置准确
      camera.position.copy(targetPosition);
      camera.lookAt(DEFAULT_CAMERA_TARGET);
      console.log('相机视角已重置');
    }
  }
  
  animateReset();
}

/**
 * 隐藏将军/绝杀提示
 */
function hideCheckAlert() {
  if (showCheckAlert.value) {
    // 清除定时器
    if (alertTimer !== null) {
      clearTimeout(alertTimer);
      alertTimer = null;
    }
    // 隐藏提示
    showCheckAlert.value = false;
  }
}

// 监听棋盘状态变化，同步3D视图
watch(
  () => chessStore.board,
  () => {
    // console.log('检测到棋盘状态变化，同步3D视图');
    syncPiecesWithBoard();
  },
  { deep: true }
);

// 监听配置变化（通过轮询检测localStorage）
let lastConfig = '';
const checkConfigChange = setInterval(() => {
  const currentConfig = localStorage.getItem('chchess_config') || '';
  if (currentConfig !== lastConfig && lastConfig !== '') {
    lastConfig = currentConfig;
    console.log('检测到配置变化，重新加载棋子形状');
    try {
      const config = JSON.parse(currentConfig);
      if (config.ui && config.ui.piece_shape && config.ui.piece_shape !== currentPieceShape) {
        updatePieceShape(config.ui.piece_shape);
      }
    } catch (error) {
      console.error('解析配置失败:', error);
    }
  } else if (lastConfig === '') {
    lastConfig = currentConfig;
  }
}, 1000); // 每秒检查一次

// 清理定时器
const originalBeforeUnmount = onBeforeUnmount;
onBeforeUnmount(() => {
  originalBeforeUnmount();
  clearInterval(checkConfigChange);
});

// 监听localStorage变化（配置变更）
const handleStorageChange = (e: StorageEvent) => {
  if (e.key === 'chchess_config') {
    console.log('检测到配置变化，重新加载棋子形状');
    try {
      const config = JSON.parse(e.newValue || '{}');
      if (config.ui && config.ui.piece_shape) {
        updatePieceShape(config.ui.piece_shape);
      }
    } catch (error) {
      console.error('解析配置失败:', error);
    }
  }
};

window.addEventListener('storage', handleStorageChange);

// 监听currentMoveIndex变化（用于悔棋/重做后更新UI）
watch(
  () => chessStore.currentMoveIndex,
  (newIndex, oldIndex) => {
    console.log(`着法索引变化: ${oldIndex} -> ${newIndex}`);
    // 触发UI更新（Vue会自动处理）
  }
);

// 生命周期钩子
onMounted(() => {
  initScene();
  window.addEventListener('resize', onWindowResize);
  
  // 加载配置并启动 AI 引擎
  loadConfig().then(config => {
    // 更新全局棋子形状配置
    currentPieceShape = config.ui.piece_shape;
    console.log('棋子形状配置加载:', currentPieceShape);

    const enginePath = config.engine.pikafish_path;
    console.log('准备启动AI引擎，路径:', enginePath);
    
    return startEngine(enginePath);
  }).then(() => {
    engineStarted = true;
    console.log('AI 引擎已就绪');
  }).catch(error => {
    console.error('启动 AI 引擎失败:', error);
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
      resetCameraView();
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

/**
 * 更新棋子形状配置并重建所有棋子
 */
function updatePieceShape(shape: 'cylinder' | 'standard') {
  console.log('更新棋子形状:', shape);
  currentPieceShape = shape;
  
  // 重建所有棋子
  syncPiecesWithBoard();
}

// 暴露方法给父组件
defineExpose({
  updatePieceShape
});

onBeforeUnmount(() => {
  // 清理配置检查定时器
  if (checkConfigChange) {
    clearInterval(checkConfigChange);
  }
  
  window.removeEventListener('resize', onWindowResize);
  
  // 清理提示定时器
  if (alertTimer !== null) {
    clearTimeout(alertTimer);
    alertTimer = null;
  }
  
  // 清理鼠标事件监听
  if (renderer && renderer.domElement) {
    renderer.domElement.removeEventListener('mousedown', onMouseDown);
    renderer.domElement.removeEventListener('mousemove', onMouseMove);
    renderer.domElement.removeEventListener('mouseup', onMouseUp);
  }
  
  // 清理键盘事件监听
  if ((window as any).__chessControlsCleanup) {
    (window as any).__chessControlsCleanup();
    delete (window as any).__chessControlsCleanup;
  }
  
  if (renderer) {
    renderer.dispose();
  }
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

@keyframes pulse {
  from {
    transform: translate(-50%, -50%) scale(1);
  }
  to {
    transform: translate(-50%, -50%) scale(1.1);
  }
}
</style>