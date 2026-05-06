import * as THREE from 'three';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { PieceType, Board } from '../../logic/chess/constants';
import { createWoodTexture } from './useBoard';
import { BOARD_WIDTH, BOARD_HEIGHT, CELL_SIZE } from './useBoard';
import { resolveResource } from '@tauri-apps/api/path';

// 全局字体名称（用于Canvas渲染）
let currentFontName: string = 'KaiTi';

/**
 * 设置当前使用的字体名称
 */
export function setCurrentFontName(fontName: string): void {
  currentFontName = fontName;
}

/**
 * 获取当前使用的字体名称
 */
export function getCurrentFontName(): string {
  return currentFontName;
}

async function getFontUrl(path: string): Promise<string> {
  // 这里的路径是相对于 tauri.conf.json 中 resources 配置的基准路径
  const resourcePath = await resolveResource(path);

  // 转换为 asset 协议
  const url = convertFileSrc(resourcePath);
  
  return url;
}

/**
 * 加载自定义字体到 Canvas 系统
 * @param fontName - 字体名称（在 CSS 中使用的名称）
 * @param fontPath - 字体文件路径（相对于项目根目录）
 */
export async function loadChessFont(fontName: string, fontPath: string): Promise<void> {
  try {
    // 转换 Tauri 资源路径为 WebView 可访问的 URL
    const url = await getFontUrl(fontPath);

    // 创建 FontFace 对象
    const font = new FontFace(fontName, `url(${url})`);
    
    // 加载字体
    await font.load();
    
    // 添加到文档字体系统
    document.fonts.add(font);
    
    // 等待所有字体就绪
    await document.fonts.ready;
  } catch (error) {
    console.error(`❌ 字体 "${fontName}" 加载失败，将使用系统字体`, error);
    console.error(`   原始路径: ${fontPath}`);
    // 不抛出错误，允许回退到系统字体
  }
}

/**
 * 获取字体配置字符串
  * @param fontSize - 基础字体大小（像素）
 * @param customFontName - 自定义字体名称（可选，如果不传则使用全局字体）
 * @returns 字体配置字符串
 */
export function getFontString(fontSize: number, customFontName?: string): string {
  // 使用传入的字体名称，或全局字体名称，最后回退到系统楷体
  const fontName = customFontName || currentFontName;
  
  // 隶书字体需要放大10%以获得更好的视觉效果
  let adjustedFontSize = fontSize;
  if (fontName === 'LiSu') {
    adjustedFontSize = Math.round(fontSize * 1.3); // 增加10%
  }
  
  return `${adjustedFontSize}px "${fontName}", "KaiTi", "STKaiti", "SimSun", serif`;
}

/**
 * 获取棋子的中文名称
 */
export function getPieceChineseName(piece: PieceType): string {
  const names: Record<number, string> = {
    1: '帥',   // 红帅（繁体）
    2: '俥',   // 红车（繁体）
    3: '馬',   // 红马（繁体）
    4: '炮',   // 红炮
    5: '仕',   // 红仕
    6: '相',   // 红相
    7: '兵',   // 红兵
    '-1': '將', // 黑将
    '-2': '車', // 黑车（繁体）
    '-3': '馬', // 黑马（繁体）
    '-4': '砲', // 黑炮（繁体）
    '-5': '士', // 黑士
    '-6': '象', // 黑象
    '-7': '卒', // 黑卒
  };
  
  return names[piece] || '';
}

/**
 * 创建棋子文字纹理（带凹陷效果）
 */
export function createPieceTexture(piece: PieceType, isRed: boolean): { colorTexture: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  const size = 128;
  canvas.width = size;
  canvas.height = size;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法获取 canvas 上下文');
  
  // ========== 1. 创建颜色纹理（基础颜色贴图）==========
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
  ctx.font = getFontString(72); // 使用自定义字体，自动回退到系统字体
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isRed ? '#CC0000' : '#000000';
  
  // 隶书字体需要向上偏移约1/4字体高度（72px * 0.25 ≈ 18px）
  const verticalOffset = currentFontName === 'LiSu' ? 4 : 4;
  ctx.fillText(pieceName, size / 2, size / 2 + verticalOffset);
  
  const colorTexture = new THREE.CanvasTexture(canvas);
  colorTexture.colorSpace = THREE.SRGBColorSpace; // 确保色彩正确
  colorTexture.needsUpdate = true;
  
  // ========== 2. 创建法线贴图（实现凹陷效果）==========
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const normalCtx = normalCanvas.getContext('2d');
  if (!normalCtx) throw new Error('无法获取法线贴图 canvas 上下文');
  
  // 清空画布
  normalCtx.clearRect(0, 0, size, size);
  
  // 创建黑白掩码：白色表示凹陷区域，黑色表示平坦区域
  // 先填充黑色背景（平坦区域）
  normalCtx.fillStyle = '#000000';
  normalCtx.fillRect(0, 0, size, size);
  
  // 绘制白色文字（凹陷区域）
  normalCtx.font = getFontString(72); // 使用自定义字体，自动回退到系统字体
  normalCtx.textAlign = 'center';
  normalCtx.textBaseline = 'middle';
  normalCtx.fillStyle = '#FFFFFF';
  
  // 隶书字体需要向上偏移约小半个字体高度
  const normalVerticalOffset = currentFontName === 'LiSu' ? 4 : 4;
  normalCtx.fillText(pieceName, size / 2, size / 2 + normalVerticalOffset);
  
  // 绘制白色圆形边框（凹陷区域）
  normalCtx.strokeStyle = '#FFFFFF';
  normalCtx.lineWidth = 4;
  normalCtx.beginPath();
  normalCtx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
  normalCtx.stroke();
  
  // 从黑白掩码生成法线贴图
  const normalMap = generateNormalMapFromMask(normalCanvas, size);
  
  return { colorTexture, normalMap };
}

/**
 * 从黑白掩码生成法线贴图
 * @param maskCanvas 黑白掩码 canvas（白色=凹陷，黑色=平坦）
 * @param size 贴图尺寸
 */
function generateNormalMapFromMask(maskCanvas: HTMLCanvasElement, size: number): THREE.CanvasTexture {
  const imageData = maskCanvas.getContext('2d')!.getImageData(0, 0, size, size);
  const data = imageData.data;
  
  // 创建法线贴图的 canvas
  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const normalCtx = normalCanvas.getContext('2d')!;
  const normalImageData = normalCtx.createImageData(size, size);
  const normalData = normalImageData.data;
  
  // Sobel 算子用于计算梯度
  const kernelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
  const kernelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let gx = 0;
      let gy = 0;
      
      // 应用 Sobel 算子
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const px = Math.min(Math.max(x + kx, 0), size - 1);
          const py = Math.min(Math.max(y + ky, 0), size - 1);
          const idx = (py * size + px) * 4;
          
          // 使用红色通道作为灰度值
          const val = data[idx] / 255;
          
          gx += val * kernelX[ky + 1][kx + 1];
          gy += val * kernelY[ky + 1][kx + 1];
        }
      }
      
      // 将梯度转换为法线向量
      // 注意：我们需要反转 Z 轴来产生凹陷效果
      const nx = -gx; // X 分量
      const ny = -gy; // Y 分量
      const nz = 1.0; // Z 分量（基础高度）
      
      // 归一化法线向量
      const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const normalizedNx = nx / length;
      const normalizedNy = ny / length;
      const normalizedNz = nz / length;
      
      // 转换到 [0, 255] 范围并存储
      const idx = (y * size + x) * 4;
      normalData[idx] = (normalizedNx * 0.5 + 0.5) * 255;     // R
      normalData[idx + 1] = (normalizedNy * 0.5 + 0.5) * 255; // G
      normalData[idx + 2] = (normalizedNz * 0.5 + 0.5) * 255; // B
      normalData[idx + 3] = 255;                               // A
    }
  }
  
  normalCtx.putImageData(normalImageData, 0, 0);
  
  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.needsUpdate = true;
  
  return normalMap;
}

/**
 * 创建单个棋子网格（带文字）- 支持柱型和鼓型
 */
export function createPieceMesh(
  piece: PieceType, 
  row: number, 
  col: number,
  pieceShape: 'cylinder' | 'standard',
  opponentTextDirection: 'down' | 'up',
  randomRotationRange: number = 0 // 随机旋转角度范围（度），0表示不随机
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
  
  // 创建带文字的纹理（包含颜色贴图和法线贴图）
  const { colorTexture, normalMap } = createPieceTexture(piece, isRed);
  
  // 创建木纹纹理用于侧面
  const woodTexture = createWoodTexture();
  
  // 侧面材质（木纹质感 + 米黄色基底）
  const sideMaterial = new THREE.MeshStandardMaterial({
    map: woodTexture,
    color: 0xF5DEB3,        // 米黄色基底（与棋子顶部背景色一致）
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
    map: colorTexture,
    normalMap: normalMap,           // 应用法线贴图实现凹陷效果
    normalScale: new THREE.Vector2(-4, -4), // 负值产生凹陷感，数值越大凹陷越深（已增强）
    transparent: true,
    side: THREE.DoubleSide,
    roughness: 0.5,                 // 适当的粗糙度增强立体感
    metalness: 0.0,
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
  
  // 应用随机旋转（在基础旋转之上添加随机偏移）
  let randomOffset = 0;
  if (randomRotationRange > 0) {
    // 生成 -range/2 到 +range/2 之间的随机角度
    randomOffset = (Math.random() - 0.5) * randomRotationRange * (Math.PI / 180);
    rotationY += randomOffset;
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
    isCaptured: false,
    randomRotationOffset: randomOffset // 保存随机旋转偏移量，用于后续同步时保持一致
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
  opponentTextDirection: 'down' | 'up',
  randomRotationRange: number = 0 // 随机旋转角度范围（度）
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
      if (piece !== null && piece !== 0) {
        const pieceMesh = createPieceMesh(piece, row, col, pieceShape, opponentTextDirection, randomRotationRange);
        
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
 * 同步棋子与棋盘状态（增量更新，保留现有棋子的随机旋转角度）
 */
export function syncPiecesWithBoard(
  piecesGroup: THREE.Group,
  scene: THREE.Scene,
  board: Board,
  pieceShape: 'cylinder' | 'standard',
  opponentTextDirection: 'down' | 'up',
  randomRotationRange: number = 0 // 随机旋转角度范围（度）
) {
  if (!piecesGroup || !scene) return;
  
  console.log('[syncPiecesWithBoard] Starting sync, current children count:', piecesGroup.children.length);
  
  const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
  const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;

  // 第一步：收集当前所有棋子的信息（包括随机旋转偏移量）
  const existingPieces = new Map<string, {
    mesh: THREE.Mesh;
    row: number;
    col: number;
    piece: number;
    randomOffset: number;
  }>();
  
  piecesGroup.children.forEach(child => {
    if (child instanceof THREE.Mesh) {
      const userData = (child as any).userData;
      if (userData && userData.row !== undefined && userData.col !== undefined) {
        // 使用行列和棋子类型作为唯一键来匹配位置上的棋子
        const key = `${userData.row}_${userData.col}_${userData.piece}`;
        existingPieces.set(key, {
          mesh: child,
          row: userData.row,
          col: userData.col,
          piece: userData.piece,
          randomOffset: userData.randomRotationOffset || 0
        });
      }
    }
  });
  
  console.log('[syncPiecesWithBoard] Collected existing pieces:', existingPieces.size);
  
  // 第二步：标记所有现有棋子为待删除
  const toRemove: THREE.Mesh[] = [];
  piecesGroup.children.forEach(child => {
    if (child instanceof THREE.Mesh) {
      toRemove.push(child);
    }
  });
  
  // 第三步：遍历当前board状态，复用或创建棋子
  const usedKeys = new Set<string>();
  
  for (let row = 0; row < BOARD_HEIGHT; row++) {
    for (let col = 0; col < BOARD_WIDTH; col++) {
      const piece = board[row][col];
      if (piece !== null && piece !== 0) {
        const key = `${row}_${col}_${piece}`;
        
        // 检查是否有相同位置的棋子可以复用
        const existing = existingPieces.get(key);
        
        if (existing) {
          console.log('[syncPiecesWithBoard] Reusing piece at', row, col, 'key:', key);
          // 复用现有棋子，保持其随机旋转角度
          existing.mesh.position.x = startX + col * CELL_SIZE;
          existing.mesh.position.z = startZ + row * CELL_SIZE;
          
          // ✅ 关键修复：更新userData以反映新位置
          (existing.mesh as any).userData.row = row;
          (existing.mesh as any).userData.col = col;
          
          // 从待删除列表中移除
          const index = toRemove.indexOf(existing.mesh);
          if (index > -1) {
            toRemove.splice(index, 1);
          }
          
          usedKeys.add(key);
        } else {
          console.log('[syncPiecesWithBoard] Creating new piece at', row, col, 'key:', key);
          // 创建新棋子
          const pieceMesh = createPieceMesh(piece, row, col, pieceShape, opponentTextDirection, randomRotationRange);
          pieceMesh.position.x = startX + col * CELL_SIZE;
          pieceMesh.position.z = startZ + row * CELL_SIZE;
          piecesGroup.add(pieceMesh);
        }
      }
    }
  }
  
  console.log('[syncPiecesWithBoard] To remove count:', toRemove.length);
  // 第四步：移除不再需要的棋子（被吃掉或移动走的）
  toRemove.forEach(mesh => {
    piecesGroup.remove(mesh);
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(mat => mat.dispose());
    } else {
      mesh.material.dispose();
    }
  });
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

/**
 * 重建所有棋子纹理（用于字体加载后刷新）
 * @param piecesGroup - Three.js Group，包含所有棋子 Mesh
 */
export function refreshPieceTextures(piecesGroup: THREE.Group): void {
  piecesGroup.children.forEach((child) => {
    if (child instanceof THREE.Mesh && child.userData.piece !== undefined) {
      const pieceType = child.userData.piece as PieceType;
      const isRed = pieceType > 0;
      
      // 重新创建纹理
      const textures = createPieceTexture(pieceType, isRed);
      
      // 查找子对象中的文字贴图并更新
      child.children.forEach((subChild) => {
        if (subChild instanceof THREE.Mesh && subChild.geometry instanceof THREE.CircleGeometry) {
          // 这是文字贴图的圆形平面
          if (!Array.isArray(subChild.material)) {
            subChild.material.map = textures.colorTexture;
            subChild.material.normalMap = textures.normalMap;
            subChild.material.needsUpdate = true;
          }
        }
      });
    }
  });
}

