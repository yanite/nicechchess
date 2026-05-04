import * as THREE from 'three';
import { PIECES, type PieceType, type Board } from '../../logic/chess/constants';
import { createWoodTexture } from './useBoard';
import { BOARD_WIDTH, BOARD_HEIGHT, CELL_SIZE } from './useBoard';

/**
 * 获取棋子的中文名称
 */
export function getPieceChineseName(piece: PieceType): string {
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
 * 创建棋子文字纹理
 */
export function createPieceTexture(piece: PieceType, isRed: boolean): THREE.CanvasTexture {
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
 * 创建单个棋子网格（带文字）- 支持柱型和鼓型
 */
export function createPieceMesh(
  piece: PieceType, 
  row: number, 
  col: number,
  pieceShape: 'cylinder' | 'standard',
  opponentTextDirection: 'down' | 'up'
): THREE.Mesh {
  const baseRadius = CELL_SIZE * 0.4; // 基础半径
  const fullHeight = CELL_SIZE * 0.35;    // 原始棋子高度
  const height = pieceShape === 'cylinder' ? fullHeight * 0.5 : fullHeight; // 柱型高度减半
  
  let geometry: THREE.BufferGeometry;
  
  if (pieceShape === 'cylinder') {
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
  if (pieceShape === 'cylinder') {
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
  if (pieceShape === 'cylinder') {
    // 柱型：圆柱几何体中心在原点，顶部在 height/2 位置（相对于mesh中心）
    // 文字贴图应该在顶部表面上方一点点
    textMesh.position.y = height / 2 + 0.001;
  } else {
    // 鼓型：使用 LatheGeometry，几何体从 y=0 开始到 y=height
    // 所以顶部在 height 位置
    textMesh.position.y = height + 0.001;
  }
  
  mesh.add(textMesh);
  
  // 设置文字朝向：控制文字顶部方向
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
  
  mesh.rotation.y = rotationY;
  
  // 生成唯一编号
  const pieceName = getPieceChineseName(piece);
  const colorPrefix = isRed ? '红' : '黑';
  const key = `${colorPrefix}${pieceName}`;
  
  (mesh as any).userData = { 
    row, 
    col, 
    piece,
    owner: isRed ? '红' : '黑',
    pieceName: pieceName,
    uniqueId: `${key}_initial`, // 简化版ID
    isCaptured: false
  };
  
  return mesh;
}

/**
 * 创建所有棋子（只在初始化时调用一次）
 */
export function createPieces(
  scene: THREE.Scene,
  board: Board,
  pieceShape: 'cylinder' | 'standard',
  opponentTextDirection: 'down' | 'up'
): THREE.Group {
  const piecesGroup = new THREE.Group();
  
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
        const pieceMesh = createPieceMesh(piece, row, col, pieceShape, opponentTextDirection);
        
        // 设置位置（x和z坐标）
        pieceMesh.position.x = startX + col * CELL_SIZE;
        pieceMesh.position.z = startZ + row * CELL_SIZE;
        
        // 生成唯一编号：颜色 + 棋子名称 + 序号
        const pieceName = getPieceChineseName(piece);
        const colorPrefix = piece > 0 ? '红' : '黑';
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
          owner: piece > 0 ? '红' : '黑',
          pieceName: pieceName,
          uniqueId: uniqueId,
          isCaptured: false
        };
        piecesGroup.add(pieceMesh);
      }
    }
  }
  
  scene.add(piecesGroup);
  
  return piecesGroup;
}

/**
 * 同步3D棋子位置与store的棋盘状态
 */
export function syncPiecesWithBoard(
  piecesGroup: THREE.Group,
  scene: THREE.Scene,
  board: Board,
  pieceShape: 'cylinder' | 'standard',
  opponentTextDirection: 'down' | 'up'
) {
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
  const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
  const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;
  
  // 记录每种棋子的计数，用于生成唯一编号
  const pieceCounter: Record<string, number> = {};
  
  for (let row = 0; row < BOARD_HEIGHT; row++) {
    for (let col = 0; col < BOARD_WIDTH; col++) {
      const piece = board[row][col];
      if (piece !== PIECES.EMPTY) {
        const pieceMesh = createPieceMesh(piece, row, col, pieceShape, opponentTextDirection);
        
        // 设置位置（x和z坐标）
        pieceMesh.position.x = startX + col * CELL_SIZE;
        pieceMesh.position.z = startZ + row * CELL_SIZE;
        
        // 生成唯一编号
        const pieceName = getPieceChineseName(piece);
        const colorPrefix = piece > 0 ? '红' : '黑';
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
          owner: piece > 0 ? '红' : '黑',
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
 * 重置棋子位置到原位
 */
export function resetPiecePosition(
  pieceMesh: THREE.Mesh,
  pieceShape: 'cylinder' | 'standard'
) {
  const { row, col } = (pieceMesh as any).userData;
  const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
  const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;
  
  pieceMesh.position.x = startX + col * CELL_SIZE;
  pieceMesh.position.z = startZ + row * CELL_SIZE;
  
  // 恢复正确的y坐标：根据棋子形状重新计算
  const fullHeight = CELL_SIZE * 0.35;
  const height = pieceShape === 'cylinder' ? fullHeight * 0.5 : fullHeight;
  
  if (pieceShape === 'cylinder') {
    // 柱型：圆柱几何体中心在原点，要让底部在 y=0.01，需要上移 height/2
    pieceMesh.position.y = 0.01 + height / 2;
  } else {
    // 鼓型：LatheGeometry 从 y=0 开始，直接放在棋盘上
    pieceMesh.position.y = 0.01;
  }
}

/**
 * 平滑移动棋子到目标位置（带动画效果）
 */
export function animatePieceMove(
  pieceMesh: THREE.Mesh, 
  targetX: number, 
  targetZ: number, 
  duration: number = 300
) {
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
