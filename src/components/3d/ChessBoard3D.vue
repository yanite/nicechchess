<template>
  <div ref="container" class="chess-board-3d" @click="hideCheckAlert">
    <!-- 将军/绝杀提示图片 -->
    <div v-if="showCheckAlert" class="check-alert">
      <img :src="alertImage" alt="提示" class="alert-image" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
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

// 拖动相关变量
let draggedPiece: THREE.Mesh | null = null; // 当前拖动的棋子
let isDragging = false; // 是否正在拖动
let dragOffset = new THREE.Vector3(); // 拖动偏移量

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
    console.log('加载棋盘纹理配置:', boardTexturePath);
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

  // 添加轨道控制器 - 默认禁用，需要按住 Ctrl 才能旋转
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enabled = false; // 默认禁用旋转

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
        // 棋子应该放在棋盘线的交叉点上
        pieceMesh.position.x = startX + col * CELL_SIZE;
        pieceMesh.position.z = startZ + row * CELL_SIZE;
        pieceMesh.position.y = 0; // 正常位置
        
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
 * 创建单个棋子网格（带文字）
 */
function createPieceMesh(piece: PieceType, _row: number, _col: number): THREE.Mesh {
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
 * 鼠标按下事件 - 开始拖动棋子
 */
function onMouseDown(event: MouseEvent) {
  if (!container.value) return;

  // 计算鼠标位置
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // 射线检测
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(piecesGroup.children);

  if (intersects.length > 0) {
    const selectedObject = intersects[0].object as THREE.Mesh;
    
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
      (targetMesh as any).userData.isCaptured = true;
      (targetMesh as any).userData.row = -1;
      (targetMesh as any).userData.col = -1;
      
      // 移到棋盘边缘
      const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
      const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;
      const isRed = targetPiece > 0;
      
      // 统计该颜色已被吃的棋子数量
      let capturedCount = 0;
      piecesGroup.children.forEach(other => {
        if (other instanceof THREE.Mesh) {
          const otherData = (other as any).userData;
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
      
      (targetMesh as THREE.Mesh).position.y = 0;
    }
  }
  
  // 3. 更新拖动棋子的位置和状态
  (draggedPiece as any).userData.row = toRow;
  (draggedPiece as any).userData.col = toCol;
  
  const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
  const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;
  draggedPiece.position.x = startX + toCol * CELL_SIZE;
  draggedPiece.position.z = startZ + toRow * CELL_SIZE;
  draggedPiece.position.y = 0;
  
  // 4. 更新棋盘数据
  chessStore.movePiece(fromRow, fromCol, toRow, toCol);
  
  // 5. 检查是否形成将军或绝杀
  checkCheckAndCheckmate(toRow, toCol);
  
  // 6. 如果轮到黑方（AI），触发 AI 行棋
  console.log('移动完成，当前玩家:', chessStore.currentPlayer);
  if (chessStore.currentPlayer === 'black') {
    console.log('检测到轮到黑方，准备触发 AI...');
    triggerAIMove();
  } else {
    console.log('当前是红方，不触发 AI');
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
    
    // 请求 AI 最佳着法（搜索深度 15）
    console.log('调用 getBestMove...');
    const bestMoveUCI = await getBestMove(fen, 15);
    
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
      
      (targetMesh as THREE.Mesh).position.y = 0;
    }
  }
  
  // 移动 AI 棋子
  const aiUserData = (aiPiece as THREE.Mesh).userData as any;
  aiUserData.row = toRow;
  aiUserData.col = toCol;
  
  const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
  const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;
  (aiPiece as THREE.Mesh).position.x = startX + toCol * CELL_SIZE;
  (aiPiece as THREE.Mesh).position.z = startZ + toRow * CELL_SIZE;
  (aiPiece as THREE.Mesh).position.y = 0;
  
  // 更新棋盘数据
  chessStore.movePiece(fromRow, fromCol, toRow, toCol);
  
  // 检查将军/绝杀
  checkCheckAndCheckmate(toRow, toCol);
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
  const { row, col } = (pieceMesh as any).userData;
  const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
  const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;
  
  pieceMesh.position.x = startX + col * CELL_SIZE;
  pieceMesh.position.z = startZ + row * CELL_SIZE;
  pieceMesh.position.y = 0;
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

// 生命周期钩子
onMounted(() => {
  initScene();
  window.addEventListener('resize', onWindowResize);
  
  // 启动 AI 引擎
  startEngine().then(() => {
    engineStarted = true;
    console.log('AI 引擎已就绪');
  }).catch(error => {
    console.error('启动 AI 引擎失败:', error);
  });
  
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