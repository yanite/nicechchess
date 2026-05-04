import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';

// 棋盘尺寸配置
export const BOARD_WIDTH = 9;
export const BOARD_HEIGHT = 10;
export const CELL_SIZE = 1;
export const BOARD_MARGIN_X = 0.5; // 左右边界
export const BOARD_MARGIN_Z = 1.0; // 上下边界（一个棋子尺寸）

/**
 * 创建粗线（使用 Line2）
 */
export function createThickLine(
  points: THREE.Vector3[], 
  color: number, 
  lineWidth: number,
  container: HTMLDivElement | null,
  lineMaterials: any[]
): Line2 {
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
      container?.clientWidth || window.innerWidth,
      container?.clientHeight || window.innerHeight
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
 * 创建木纹纹理
 */
export function createWoodTexture(): THREE.CanvasTexture {
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
 * 根据纹理路径判断是否使用白线
 */
function shouldUseWhiteLines(texturePath: string): boolean {
  // tx1 纹理使用白线，其他使用黑线
  return texturePath.includes('tx1');
}

/**
 * 创建棋盘
 */
export function createBoard(
  scene: THREE.Scene,
  texturePath: string,
  container: HTMLDivElement | null,
  lineMaterials: any[]
): THREE.Group {
  // 清空之前的 LineMaterial 引用
  lineMaterials.length = 0;
  
  const boardGroup = new THREE.Group();

  // ✅ 棋盘底座尺寸计算
  const boardWidth = (BOARD_WIDTH - 1) * CELL_SIZE + BOARD_MARGIN_X * 2;
  const boardHeight = (BOARD_HEIGHT - 1) * CELL_SIZE + BOARD_MARGIN_Z * 2;
  const boardGeometry = new THREE.BoxGeometry(boardWidth, 0.2, boardHeight);
  
  // ✅ 棋盘线的起始位置（用于数字标记）
  const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
  const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;
  
  // 初始化加载器
  const textureLoader = new THREE.TextureLoader();
  const exrLoader = new EXRLoader();
  
  // 创建基础材质
  let boardMaterial: THREE.MeshStandardMaterial;
  
  // 尝试加载纹理，如果失败则使用默认颜色
  try {
    console.log('尝试加载棋盘纹理:', texturePath);
    
    // 从路径中提取基础名称（不含扩展名和目录）
    const basePath = texturePath.replace(/\.(jpg|jpeg|png)$/i, '');
    
    // 构建 EXR 文件路径
    const normalMapPath = basePath + '_nor_gl_1k.exr';
    const roughnessMapPath = basePath + '_rough_1k.exr';
    
    // 加载基础颜色贴图（JPG/PNG）
    const diffuseTexture = textureLoader.load(
      texturePath,
      (loadedTexture) => {
        console.log('棋盘颜色贴图加载成功:', texturePath);
        loadedTexture.wrapS = THREE.RepeatWrapping;
        loadedTexture.wrapT = THREE.RepeatWrapping;
        loadedTexture.repeat.set(1, 1);
        // 设置色彩空间为 sRGB
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
      },
      undefined,
      (error) => {
        console.warn('棋盘颜色贴图加载失败，使用默认木纹颜色:', error);
        // 降级到默认木纹颜色
        boardMaterial = new THREE.MeshStandardMaterial({ 
          color: 0xDEB887,  // 实木色
          roughness: 0.7 
        });
      }
    );
    
    // 创建材质（先只设置基础贴图）
    boardMaterial = new THREE.MeshStandardMaterial({ 
      map: diffuseTexture,
      roughness: 1.0,
      metalness: 0.0,
    });
    
    // 异步加载法线贴图（EXR格式）
    exrLoader.load(
      normalMapPath,
      (normalTexture) => {
        console.log('法线贴图加载成功:', normalMapPath);
        boardMaterial.normalMap = normalTexture;
        boardMaterial.normalScale = new THREE.Vector2(1, 1);
        boardMaterial.needsUpdate = true;
      },
      undefined,
      (error) => {
        console.warn('法线贴图加载失败，跳过:', normalMapPath, error);
      }
    );
    
    // 异步加载粗糙度贴图（EXR格式）
    exrLoader.load(
      roughnessMapPath,
      (roughnessTexture) => {
        console.log('粗糙度贴图加载成功:', roughnessMapPath);
        boardMaterial.roughnessMap = roughnessTexture;
        boardMaterial.needsUpdate = true;
      },
      undefined,
      (error) => {
        console.warn('粗糙度贴图加载失败，跳过:', roughnessMapPath, error);
      }
    );
    
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

  // ✅ 根据纹理类型决定线条颜色
  const useWhiteLines = shouldUseWhiteLines(texturePath);
  const lineColor = useWhiteLines ? 0xFFFFFF : 0x000000;
  
  console.log(`棋盘线条颜色: ${useWhiteLines ? '白色' : '黑色'} (纹理: ${texturePath})`);

  // 绘制棋盘线
  drawBoardLines(boardGroup, container, lineMaterials, lineColor);
  
  // ✅ 绘制外围包围框
  drawBorderFrame(boardGroup, container, lineMaterials, lineColor);
  
  // ✅ 绘制数字标记
  drawNumberLabels(boardGroup, startX, startZ, useWhiteLines);

  scene.add(boardGroup);
  
  return boardGroup;
}

/**
 * 绘制棋盘线
 */
function drawBoardLines(
  boardGroup: THREE.Group,
  container: HTMLDivElement | null,
  lineMaterials: any[],
  lineColor: number = 0x000000 // ✅ 新增：线条颜色参数，默认黑色
) {
  const lineMaterial = new THREE.LineBasicMaterial({ color: lineColor });
  
  // 棋盘线的起始位置
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
    // ✅ 最左边和最右边的竖线是连续的，中间的需要断开
    if (i === 0 || i === BOARD_WIDTH - 1) {
      // 连续竖线：从第 0 行到第 9 行
      const points = [];
      points.push(new THREE.Vector3(startX + i * CELL_SIZE, 0.01, startZ));
      points.push(new THREE.Vector3(startX + i * CELL_SIZE, 0.01, startZ + (BOARD_HEIGHT - 1) * CELL_SIZE));
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, lineMaterial);
      boardGroup.add(line);
    } else {
      // 中间竖线：分成上下两部分
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
  
  // ✅ 创建文字纹理（接受颜色参数）
  const createTextTexture = (text: string, textColor: string) => {
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
    ctx.fillStyle = textColor; // ✅ 使用传入的颜色
    ctx.fillText(text, 64, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  };
  
  // ✅ 确定文字颜色（与棋盘线条颜色一致）
  const riverTextColor = lineColor === 0xFFFFFF ? '#FFFFFF' : '#000000';
  
  // 在棋盘上分散放置"楚河汉界"四个字
  const riverTexts = ['楚', '河', '汉', '界'];
  const textSpacing = (BOARD_WIDTH - 1) * CELL_SIZE / 5; // 平均分布
  
  riverTexts.forEach((char, index) => {
    const texture = createTextTexture(char, riverTextColor); // ✅ 传递颜色参数
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
  drawPieceMarkers(boardGroup, startX, startZ, container, lineMaterials, lineColor);
}

/**
 * 绘制兵、卒、炮位置的位标
 */
function drawPieceMarkers(
  boardGroup: THREE.Group,
  startX: number,
  startZ: number,
  container: HTMLDivElement | null,
  lineMaterials: any[],
  markerColor: number = 0x000000 // ✅ 新增：标记颜色参数
) {
  const markerSize = 0.15; // 位标拐线长度
  const markerLineWidth = 2.25; // 位标线宽（像素）

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
      const leftTopLine = createThickLine(leftTopPoints, markerColor, markerLineWidth, container, lineMaterials);
      boardGroup.add(leftTopLine);
    }

    // 右上角拐线（排除最右边的列 col=8）
    if (col < BOARD_WIDTH - 1) {
      const rightTopPoints = [
        new THREE.Vector3(x + markerSize / 2, 0.01, z - markerSize),
        new THREE.Vector3(x + markerSize / 2, 0.01, z - markerSize / 2),
        new THREE.Vector3(x + markerSize, 0.01, z - markerSize / 2),
      ];
      const rightTopLine = createThickLine(rightTopPoints, markerColor, markerLineWidth, container, lineMaterials);
      boardGroup.add(rightTopLine);
    }

    // 左下角拐线（排除最左边的列 col=0）
    if (col > 0) {
      const leftBottomPoints = [
        new THREE.Vector3(x - markerSize, 0.01, z + markerSize / 2),
        new THREE.Vector3(x - markerSize / 2, 0.01, z + markerSize / 2),
        new THREE.Vector3(x - markerSize / 2, 0.01, z + markerSize),
      ];
      const leftBottomLine = createThickLine(leftBottomPoints, markerColor, markerLineWidth, container, lineMaterials);
      boardGroup.add(leftBottomLine);
    }

    // 右下角拐线（排除最右边的列 col=8）
    if (col < BOARD_WIDTH - 1) {
      const rightBottomPoints = [
        new THREE.Vector3(x + markerSize / 2, 0.01, z + markerSize),
        new THREE.Vector3(x + markerSize / 2, 0.01, z + markerSize / 2),
        new THREE.Vector3(x + markerSize, 0.01, z + markerSize / 2),
      ];
      const rightBottomLine = createThickLine(rightBottomPoints, markerColor, markerLineWidth, container, lineMaterials);
      boardGroup.add(rightBottomLine);
    }
  });
}

/**
 * ✅ 绘制外围包围框
 */
function drawBorderFrame(
  boardGroup: THREE.Group,
  container: HTMLDivElement | null,
  lineMaterials: any[],
  borderColor: number = 0x000000
) {
  const borderWidth = 3; // 包围框线宽（像素）
  const borderOffset = 0.12; // ✅ 包围框距离棋盘边缘的距离（再次缩小一半）
  
  // 计算包围框的四个角点
  const halfWidth = ((BOARD_WIDTH - 1) * CELL_SIZE) / 2 + borderOffset;
  const halfHeight = ((BOARD_HEIGHT - 1) * CELL_SIZE) / 2 + borderOffset;
  
  // 包围框的四个顶点
  const topLeft = new THREE.Vector3(-halfWidth, 0.01, -halfHeight);
  const topRight = new THREE.Vector3(halfWidth, 0.01, -halfHeight);
  const bottomLeft = new THREE.Vector3(-halfWidth, 0.01, halfHeight);
  const bottomRight = new THREE.Vector3(halfWidth, 0.01, halfHeight);
  
  // 绘制四条边
  const edges = [
    [topLeft, topRight],      // 上边
    [bottomLeft, bottomRight], // 下边
    [topLeft, bottomLeft],    // 左边
    [topRight, bottomRight],  // 右边
  ];
  
  edges.forEach(([start, end]) => {
    const points = [start, end];
    const borderLine = createThickLine(points, borderColor, borderWidth, container, lineMaterials);
    boardGroup.add(borderLine);
  });
  
  console.log('✅ 已绘制外围包围框');
}

/**
 * ✅ 绘制数字标记（红方中文数字，黑方阿拉伯数字）
 */
function drawNumberLabels(
  boardGroup: THREE.Group,
  startX: number,
  startZ: number,
  useWhiteLines: boolean
) {
  const labelOffset = 0.7; // 数字距离棋盘边缘的距离
  const labelY = 0.02; // 略高于棋盘表面
  
  // 中文数字（红方，从右到左：一到九）
  const chineseNumbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
  // 阿拉伯数字（黑方，从左到右：1到9）
  const arabicNumbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  
  // 创建文字纹理的辅助函数
  const createLabelTextTexture = (text: string, color: string) => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    // 透明背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, 64, 64);
    
    // 绘制文字
    ctx.font = 'bold 48px "KaiTi", "STKaiti", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, 32, 32);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  };
  
  // ✅ 确定文字颜色（与棋盘线条颜色一致，确保视觉统一）
  const labelColor = useWhiteLines ? '#FFFFFF' : '#000000';
  
  // 绘制红方数字（在棋盘下方，row=9 的外侧）
  const redLabelZ = startZ + (BOARD_HEIGHT - 1) * CELL_SIZE + labelOffset;
  for (let col = 0; col < BOARD_WIDTH; col++) {
    const xPos = startX + col * CELL_SIZE;
    const texture = createLabelTextTexture(chineseNumbers[col], labelColor);
    if (!texture) continue;
    
    const labelGeometry = new THREE.PlaneGeometry(CELL_SIZE * 0.6, CELL_SIZE * 0.6);
    const labelMaterial = new THREE.MeshBasicMaterial({ 
      map: texture, 
      transparent: true,
      side: THREE.DoubleSide
    });
    const labelMesh = new THREE.Mesh(labelGeometry, labelMaterial);
    labelMesh.position.set(xPos, labelY, redLabelZ);
    labelMesh.rotation.x = -Math.PI / 2; // 水平放置
    
    boardGroup.add(labelMesh);
  }
  
  // 绘制黑方数字（在棋盘上方，row=0 的外侧）
  const blackLabelZ = startZ - labelOffset;
  for (let col = 0; col < BOARD_WIDTH; col++) {
    const xPos = startX + col * CELL_SIZE;
    const texture = createLabelTextTexture(arabicNumbers[col], labelColor);
    if (!texture) continue;
    
    const labelGeometry = new THREE.PlaneGeometry(CELL_SIZE * 0.6, CELL_SIZE * 0.6);
    const labelMaterial = new THREE.MeshBasicMaterial({ 
      map: texture, 
      transparent: true,
      side: THREE.DoubleSide
    });
    const labelMesh = new THREE.Mesh(labelGeometry, labelMaterial);
    labelMesh.position.set(xPos, labelY, blackLabelZ);
    labelMesh.rotation.x = -Math.PI / 2; // 水平放置
    
    boardGroup.add(labelMesh);
  }
  
  console.log(`✅ 已绘制数字标记（${useWhiteLines ? '白线白字' : '黑线黑字'}）`);
}
