<template>
  <div ref="container" class="chess-board-3d"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
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
 */
function createBoard() {
  // 清空之前的 LineMaterial 引用
  lineMaterials = [];
  
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
 * 规则验证函数（目前假设所有移动都合法）
 * @param fromRow 起始行
 * @param fromCol 起始列
 * @param toRow 目标行
 * @param toCol 目标列
 * @returns 是否合法
 */
function validateMove(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
  // TODO: 实现完整的规则验证
  // 目前假设所有移动都合法
  
  // 基本检查：不能移动到同一个位置
  if (fromRow === toRow && fromCol === toCol) {
    return false;
  }
  
  // 基本检查：目标位置必须在棋盘内
  if (toRow < 0 || toRow >= BOARD_HEIGHT || toCol < 0 || toCol >= BOARD_WIDTH) {
    return false;
  }
  
  // 暂时返回 true，后续会实现具体规则
  return true;
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
        
        pieceMesh.userData = { row, col, piece };
        piecesGroup.add(pieceMesh);
      }
    }
  }
  
  scene.add(piecesGroup);
}

/**
 * 更新棋子位置和状态（不清除棋子，只更新位置）
 */
function updatePieces() {
  const board = chessStore.board;
  const selectedPiece = chessStore.selectedPiece;
  // 棋盘线的起始位置（与 drawBoardLines 保持一致）
  const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
  const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;

  // 记录每个棋子类型在棋盘上的出现次数，用于处理同类型棋子
  const pieceCountOnBoard: Record<number, number> = {};
  
  // 统计棋盘上每种棋子的数量
  for (let row = 0; row < BOARD_HEIGHT; row++) {
    for (let col = 0; col < BOARD_WIDTH; col++) {
      const piece = board[row][col];
      if (piece !== PIECES.EMPTY) {
        pieceCountOnBoard[piece] = (pieceCountOnBoard[piece] || 0) + 1;
      }
    }
  }

  // 遍历所有现有棋子，更新它们的位置和状态
  piecesGroup.children.forEach(child => {
    if (child instanceof THREE.Mesh) {
      const { piece } = child.userData;
      
      // 查找该棋子当前在棋盘上的位置
      let newRow = -1;
      let newCol = -1;
      let found = false;
      
      // 如果是正在拖动的棋子，使用 userData 中的旧位置作为参考
      // 但实际上应该从棋盘数据中查找它的新位置
      
      for (let row = 0; row < BOARD_HEIGHT && !found; row++) {
        for (let col = 0; col < BOARD_WIDTH && !found; col++) {
          if (board[row][col] === piece) {
            // 检查这个位置是否已经被其他同类型棋子占据
            let isOccupied = false;
            piecesGroup.children.forEach(other => {
              if (other !== child && other instanceof THREE.Mesh) {
                const otherData = other.userData;
                if (otherData.row === row && otherData.col === col) {
                  isOccupied = true;
                }
              }
            });
            
            if (!isOccupied) {
              newRow = row;
              newCol = col;
              found = true;
            }
          }
        }
      }
      
      if (found && newRow >= 0 && newCol >= 0) {
        // 更新棋子位置
        child.position.x = startX + newCol * CELL_SIZE;
        child.position.z = startZ + newRow * CELL_SIZE;
        
        // 如果该棋子被选中，抬起一定距离
        if (selectedPiece && selectedPiece[0] === newRow && selectedPiece[1] === newCol) {
          child.position.y = 0.5; // 抬起 0.5 单位
        } else {
          child.position.y = 0; // 正常位置
        }
        
        // 更新 userData
        child.userData.row = newRow;
        child.userData.col = newCol;
      } else {
        // 棋子被吃掉，移到棋盘左边一个棋子外的位置
        // 计算棋盘左边界
        const leftBoundary = startX - CELL_SIZE * 1.5; // 左边再偏移1.5个棋子距离
        // 根据棋子类型分配不同的垂直位置，避免重叠
        const pieceIndex = Object.keys(pieceCountOnBoard).indexOf(String(piece));
        const offsetZ = (pieceIndex % 5) * CELL_SIZE * 1.5; // 每5个棋子一排
        
        child.position.x = leftBoundary;
        child.position.z = startZ + offsetZ;
        child.position.y = 0; // 放在棋盘平面上
        
        // 更新 userData 标记为已移除
        child.userData.row = -1;
        child.userData.col = -1;
      }
    }
  });
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
    
    // 检查是否是当前行棋方的棋子
    const { row, col, piece } = selectedObject.userData;
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
    const fromRow = draggedPiece.userData.row;
    const fromCol = draggedPiece.userData.col;
    
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
  // 更新棋盘数据（updatePieces 会通过 watch 自动调用，更新所有棋子位置）
  chessStore.movePiece(fromRow, fromCol, toRow, toCol);
}

/**
 * 重置棋子位置到原位
 */
function resetPiecePosition(pieceMesh: THREE.Mesh) {
  const { row, col } = pieceMesh.userData;
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
