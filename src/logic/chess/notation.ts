/**
 * 中国象棋标准棋谱工具模块
 * 
 * 功能：
 * 1. 中文数字与阿拉伯数字转换
 * 2. 着法解析（中文棋谱 → 棋盘坐标）
 * 3. 着法生成（棋盘坐标 → 中文棋谱）
 * 4. 完整棋谱导入导出
 * 5. 智能识别文本是否为棋谱
 * 6. ASCII棋盘图形解析
 */

import { 
  type Board, 
  type PieceType, 
  PIECES, 
  BOARD_ROWS, 
  BOARD_COLS,
  initBoard,
  getPieceColor
} from './constants';
import { isValidMove } from './rules';

// ==================== ASCII棋盘解析 ====================

const BLACK_PIECE_MAP: Record<string, PieceType> = {
  '将': PIECES.B_KING,
  '車': PIECES.B_CAR, '车': PIECES.B_CAR,
  '馬': PIECES.B_HORSE, '马': PIECES.B_HORSE,
  '砲': PIECES.B_CANNON, '炮': PIECES.B_CANNON,
  '士': PIECES.B_BISHOP,
  '象': PIECES.B_ELEPHANT,
  '卒': PIECES.B_PAWN,
};

const RED_PIECE_MAP: Record<string, PieceType> = {
  '帅': PIECES.R_KING,
  '俥': PIECES.R_CAR, '车': PIECES.R_CAR,
  '傌': PIECES.R_HORSE, '马': PIECES.R_HORSE,
  '炮': PIECES.R_CANNON,
  '仕': PIECES.R_BISHOP, '士': PIECES.R_BISHOP,
  '相': PIECES.R_ELEPHANT, '象': PIECES.R_ELEPHANT,
  '兵': PIECES.R_PAWN,
};

export function parseASCIIBoard(text: string): Board | null {
  console.log('[parseASCIIBoard] 开始解析ASCII棋盘');
  
  const lines = text.split(/\r?\n/);
  
  let blackSideLine = -1;
  let redSideLine = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^黑\s*方$/.test(trimmed) || trimmed === '黑方') {
      blackSideLine = i;
    }
    if (/^红\s*方$/.test(trimmed) || trimmed === '红方') {
      redSideLine = i;
    }
  }
  
  if (blackSideLine === -1) {
    console.error('[parseASCIIBoard] 错误：未找到"黑方"标记行');
    return null;
  }
  if (redSideLine === -1) {
    console.error('[parseASCIIBoard] 错误：未找到"红方"标记行');
    return null;
  }
  if (blackSideLine >= redSideLine) {
    console.error('[parseASCIIBoard] 错误："黑方"标记应在"红方"标记上方');
    return null;
  }
  
  console.log(`[parseASCIIBoard] 找到标记：黑方行=${blackSideLine}, 红方行=${redSideLine}`);
  
  let boardStartLine = -1;
  let boardEndLine = -1;
  
  for (let i = blackSideLine + 1; i < redSideLine; i++) {
    const line = lines[i];
    if (line.includes('┌') || line.includes('┐') || line.includes('└') || line.includes('┘')) {
      if (boardStartLine === -1) boardStartLine = i;
      boardEndLine = i;
    }
  }
  
  if (boardStartLine === -1) {
    console.error('[parseASCIIBoard] 错误：未找到棋盘边框字符（┌┐└┘）');
    return null;
  }
  
  console.log(`[parseASCIIBoard] 棋盘区域：${boardStartLine} - ${boardEndLine}`);
  
  const board: Board = Array.from({ length: BOARD_ROWS }, () =>
    Array(BOARD_COLS).fill(PIECES.EMPTY)
  );
  
  const allPieces: Array<{ row: number; col: number; piece: PieceType; char: string }> = [];
  
  let currentRow = 0;
  
  for (let lineIdx = boardStartLine; lineIdx <= boardEndLine && currentRow < BOARD_ROWS; lineIdx++) {
    const line = lines[lineIdx];
    
    const isBoardLine = line.includes('┬') || line.includes('┼') || 
                        line.includes('├') || line.includes('┤') || line.includes('┴') ||
                        line.includes('└') || line.includes('┌') || line.includes('┐') || 
                        line.includes('┘') || line.includes('[') || line.includes('(');
    
    if (!isBoardLine) {
      continue;
    }
    
    let col = 0;
    let i = 0;
    
    while (i < line.length && col <= BOARD_COLS) {
      const char = line[i];
      
      if (char === '┬' || char === '┼' || char === '├' || char === '┤' || char === '│' || char === '┴') {
        col++;
        i++;
      } else if (char === '┌' || char === '┐' || char === '└' || char === '┘') {
        col++;
        i++;
      } else if (char === '※') {
        col++;
        i++;
      } else if (char === '[') {
        const endIndex = line.indexOf(']', i);
        if (endIndex === -1) {
          console.error(`[parseASCIIBoard] 错误：行${lineIdx}位置${i}，方括号未闭合`);
          return null;
        }
        const pieceChar = line.substring(i + 1, endIndex);
        const piece = BLACK_PIECE_MAP[pieceChar];
        if (piece === undefined) {
          console.error(`[parseASCIIBoard] 错误：方括号内未知黑棋"${pieceChar}"`);
          return null;
        }
        if (col >= 0 && col < BOARD_COLS) {
          allPieces.push({ row: currentRow, col, piece, char: pieceChar });
          console.log(`[parseASCIIBoard] 黑棋 [${pieceChar}] -> row=${currentRow}, col=${col}`);
        }
        col++;
        i = endIndex + 1;
      } else if (char === '(') {
        const endIndex = line.indexOf(')', i);
        if (endIndex === -1) {
          console.error(`[parseASCIIBoard] 错误：行${lineIdx}位置${i}，圆括号未闭合`);
          return null;
        }
        const pieceChar = line.substring(i + 1, endIndex);
        const piece = RED_PIECE_MAP[pieceChar];
        if (piece === undefined) {
          console.error(`[parseASCIIBoard] 错误：圆括号内未知红棋"${pieceChar}"`);
          return null;
        }
        if (col >= 0 && col < BOARD_COLS) {
          allPieces.push({ row: currentRow, col, piece, char: pieceChar });
          console.log(`[parseASCIIBoard] 红棋 (${pieceChar}) -> row=${currentRow}, col=${col}`);
        }
        col++;
        i = endIndex + 1;
      } else {
        i++;
      }
    }
    
    currentRow++;
  }
  
  if (currentRow !== BOARD_ROWS) {
    console.error(`[parseASCIIBoard] 错误：解析行数不正确，期望${BOARD_ROWS}行，实际${currentRow}行`);
    return null;
  }
  
  const blackKing = allPieces.find(p => p.piece === PIECES.B_KING);
  
  if (blackKing) {
    const validKingCols = [3, 4, 5];
    if (!validKingCols.includes(blackKing.col)) {
      const blackBishop = allPieces.find(p => p.piece === PIECES.B_BISHOP);
      const blackElephant = allPieces.find(p => p.piece === PIECES.B_ELEPHANT);
      
      let colOffset = 0;
      
      if (blackBishop) {
        const validBishopCols = [3, 5];
        if (!validBishopCols.includes(blackBishop.col)) {
          colOffset = 4 - blackKing.col;
        }
      } else if (blackElephant) {
        const validElephantCols = [2, 6];
        if (!validElephantCols.includes(blackElephant.col)) {
          colOffset = 4 - blackKing.col;
        }
      } else {
        colOffset = 4 - blackKing.col;
      }
      
      if (colOffset !== 0) {
        console.log(`[parseASCIIBoard] 黑将位置: col=${blackKing.col}, 偏移量=${colOffset}`);
        console.log(`[parseASCIIBoard] 应用列偏移修正: ${colOffset}`);
        allPieces.forEach(p => {
          p.col += colOffset;
          if (p.col < 0) p.col = 0;
          if (p.col >= BOARD_COLS) p.col = BOARD_COLS - 1;
        });
      }
    } else {
      console.log(`[parseASCIIBoard] 黑将位置正确: col=${blackKing.col}`);
    }
  }
  
  for (const p of allPieces) {
    if (p.row >= 0 && p.row < BOARD_ROWS && p.col >= 0 && p.col < BOARD_COLS) {
      board[p.row][p.col] = p.piece;
    }
  }
  
  console.log('[parseASCIIBoard] 解析成功');
  return board;
}

// ==================== 基础转换函数 ====================

/**
 * 中文数字转阿拉伯数字
 */
export function chineseToNumber(char: string): number {
  const map: Record<string, number> = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9
  };
  return map[char] || 0;
}

/**
 * 阿拉伯数字转中文数字
 */
export function numberToChinese(num: number): string {
  const map: Record<number, string> = {
    1: '一', 2: '二', 3: '三', 4: '四', 5: '五',
    6: '六', 7: '七', 8: '八', 9: '九'
  };
  return map[num] || '';
}

/**
 * 全角数字转半角数字
 * @param char 全角数字字符（如 ８）
 * @returns 半角数字字符（如 8）
 */
function fullwidthToHalfwidth(char: string): string {
  const code = char.charCodeAt(0);
  // 全角数字范围：０(65296) - ９(65305)
  if (code >= 65296 && code <= 65305) {
    return String.fromCharCode(code - 65248); // 转换为半角
  }
  return char;
}

/**
 * 红方列号转中文数字（从右到左：col 8→0 对应 一→九）
 */
export function redColToChinese(col: number): string {
  // col 8 → "一", col 7 → "二", ..., col 0 → "九"
  return numberToChinese(9 - col);
}

/**
 * 黑方列号转阿拉伯数字字符串（从左到右：col 0→8 对应 1→9）
 */
export function blackColToNumber(col: number): string {
  // col 0 → "1", col 1 → "2", ..., col 8 → "9"
  return String(col + 1);
}

/**
 * 中文列名转内部列号（红方）
 */
export function chineseToRedCol(chinese: string): number {
  const num = chineseToNumber(chinese);
  return 9 - num; // "一"→8, "二"→7, ..., "九"→0
}

/**
 * 阿拉伯数字列名转内部列号（黑方）
 */
export function numberToBlackCol(numStr: string): number {
  // 先转换全角数字为半角
  const halfwidthNum = fullwidthToHalfwidth(numStr);
  const num = parseInt(halfwidthNum);
  return num - 1; // "1"→0, "2"→1, ..., "9"→8
}

// ==================== 棋子名称映射 ====================

/**
 * 棋子中文名到 PIECES 枚举的映射（仅用于识别棋子类型，不区分颜色）
 * 注意：某些棋子名称（如"马"、"炮"）红黑双方通用，需要根据列号格式判断颜色
 */
const PIECE_NAME_TO_TYPE: Record<string, PieceType> = {
  // 帅/将类
  '帥': PIECES.R_KING,
  '帅': PIECES.R_KING,  // 简体
  '將': PIECES.B_KING,
  '将': PIECES.B_KING,  // 简体
  
  // 车类
  '俥': PIECES.R_CAR,
  '車': PIECES.B_CAR,
  '车': PIECES.B_CAR,   // 简体（默认黑方）
  
  // 马类（红黑都用"马"，根据列号判断颜色）
  '傌': PIECES.R_HORSE,
  '馬': PIECES.B_HORSE,
  '马': PIECES.R_HORSE, // 简体默认红方，实际使用时根据列号调整
  
  // 炮类（红黑都用"炮/砲"，根据列号判断颜色）
  '炮': PIECES.R_CANNON,
  '砲': PIECES.B_CANNON,
  
  // 仕/士类
  '仕': PIECES.R_BISHOP,
  '士': PIECES.B_BISHOP,
  
  // 相/象类
  '相': PIECES.R_ELEPHANT,
  '象': PIECES.B_ELEPHANT,
  
  // 兵/卒类
  '兵': PIECES.R_PAWN,
  '卒': PIECES.B_PAWN,
};

/**
 * 获取棋子中文名称
 */
export function getPieceNameFromType(piece: PieceType): string {
  for (const [name, type] of Object.entries(PIECE_NAME_TO_TYPE)) {
    if (type === piece) return name;
  }
  return '';
}

/**
 * 根据颜色调整棋子类型（处理简繁体混用情况）
 * @param pieceType 原始棋子类型
 * @param pieceName 棋子名称
 * @param color 行棋方颜色
 * @returns 调整后的棋子类型
 */
function adjustPieceTypeByColor(
  pieceType: PieceType, 
  pieceName: string, 
  color: 'red' | 'black'
): PieceType {
  // 如果已经是正确的颜色，直接返回
  const currentColor = getPieceColor(pieceType);
  if (currentColor === color) return pieceType;
  
  // 处理简繁体混用的棋子
  switch (pieceName) {
    case '马':
    case '傌':
    case '馬':
      return color === 'red' ? PIECES.R_HORSE : PIECES.B_HORSE;
    
    case '炮':
    case '砲':
      return color === 'red' ? PIECES.R_CANNON : PIECES.B_CANNON;
    
    case '车':
    case '俥':
    case '車':
      return color === 'red' ? PIECES.R_CAR : PIECES.B_CAR;
    
    default:
      // 其他棋子保持原样
      return pieceType;
  }
}

/**
 * 检测是否为特殊记谱法（前车、后车、前马、后马等）
 * @param notation 着法字符串
 * @returns 是否为特殊记谱法
 */
function isSpecialNotation(notation: string): boolean {
  return notation.startsWith('前') || notation.startsWith('后') || notation.startsWith('中');
}

/**
 * 解析特殊记谱法（前车进三、后马退五等）
 * @param notation 着法字符串
 * @param board 当前棋盘状态
 * @param color 行棋方颜色
 * @returns 解析结果，失败返回 null
 */
function parseSpecialNotation(
  notation: string,
  board: Board,
  color: 'red' | 'black'
): ParsedMove | null {
  // 支持两种格式：
  // 1. 5字符：前车进三（prefix + piece + colPlaceholder + direction + target）
  // 2. 4字符：前车进３（prefix + piece + direction + target）
  
  let prefix: string;
  let pieceName: string;
  let direction: '进' | '退' | '平';
  let targetStr: string;
  
  if (notation.length === 5) {
    // 5字符格式：前车进三
    prefix = notation[0];
    pieceName = notation[1];
    // notation[2] is column placeholder, ignored
    direction = notation[3] as '进' | '退' | '平';
    targetStr = notation[4];
  } else if (notation.length === 4) {
    // 4字符格式：前车进３
    prefix = notation[0];
    pieceName = notation[1];
    direction = notation[2] as '进' | '退' | '平';
    targetStr = notation[3];
  } else {
    return null;
  }
  
  // 映射棋子名称到类型
  let basePieceType = PIECE_NAME_TO_TYPE[pieceName];
  if (!basePieceType) {
    return null;
  }
  
  // 根据颜色调整棋子类型
  basePieceType = adjustPieceTypeByColor(basePieceType, pieceName, color);
  
  // 收集该颜色的所有同类棋子
  const candidates: Array<{row: number, col: number}> = [];
  for (let row = 0; row < BOARD_ROWS; row++) {
    for (let col = 0; col < BOARD_COLS; col++) {
      if (board[row][col] === basePieceType) {
        candidates.push({row, col});
      }
    }
  }
  
  if (candidates.length === 0) {
    return null;
  }
  
  // 根据前缀筛选棋子
  let selectedCandidate: {row: number, col: number} | null = null;
  
  if (prefix === '前') {
    // 前方：红方row大的是前，黑方row小的是前
    if (color === 'red') {
      selectedCandidate = candidates.reduce((prev, curr) => curr.row > prev.row ? curr : prev);
    } else {
      selectedCandidate = candidates.reduce((prev, curr) => curr.row < prev.row ? curr : prev);
    }
  } else if (prefix === '后') {
    // 后方：红方row小的是后，黑方row大的是后
    if (color === 'red') {
      selectedCandidate = candidates.reduce((prev, curr) => curr.row < prev.row ? curr : prev);
    } else {
      selectedCandidate = candidates.reduce((prev, curr) => curr.row > prev.row ? curr : prev);
    }
  } else if (prefix === '中') {
    // 中间：选择最接近中间的棋子（col=4）
    selectedCandidate = candidates.reduce((prev, curr) => 
      Math.abs(curr.col - 4) < Math.abs(prev.col - 4) ? curr : prev
    );
  }
  
  if (!selectedCandidate) return null;
  
  // 解析目标值
  let targetValue: number;
  if (direction === '平') {
    if (color === 'red') {
      targetValue = chineseToRedCol(targetStr);
    } else {
      const halfwidthTarget = fullwidthToHalfwidth(targetStr);
      targetValue = numberToBlackCol(halfwidthTarget);
    }
  } else {
    if (color === 'red') {
      targetValue = chineseToNumber(targetStr);
    } else {
      const halfwidthTarget = fullwidthToHalfwidth(targetStr);
      targetValue = parseInt(halfwidthTarget);
    }
  }
  
  return {
    pieceType: basePieceType,
    fromCol: selectedCandidate.col,
    direction,
    targetValue
  };
}

// ==================== 着法解析 ====================

/**
 * 解析后的着法信息
 */
export interface ParsedMove {
  pieceType: PieceType;      // 棋子类型
  fromCol: number;           // 起始列
  direction: '进' | '退' | '平'; // 方向
  targetValue: number;       // 目标值（列号或步数）
}

/**
 * 解析单个着法字符串
 * @param notation 着法字符串（如"炮二平五"或"炮8平5"）
 * @param board 当前棋盘状态
 * @param color 行棋方颜色（可选，如果不传则自动根据列号格式判断）
 * @returns 解析结果，失败返回 null
 */
export function parseSingleMove(
  notation: string, 
  board: Board, 
  color?: 'red' | 'black'
): ParsedMove | null {
  // 检测并处理特殊记谱法（前车、后车等）
  if (isSpecialNotation(notation)) {
    if (!color) {
      // 如果没有指定颜色，根据列号格式判断
      const isChineseNumber = /[一二三四五六七八九]/.test(notation[2]);
      color = isChineseNumber ? 'red' : 'black';
    }
    return parseSpecialNotation(notation, board, color);
  }
  
  if (notation.length < 4) return null;
  
  // 提取各部分
  const pieceName = notation[0];
  const fromColStr = notation[1];
  const direction = notation[2] as '进' | '退' | '平';
  const targetStr = notation[3];
  
  // 验证棋子名称
  let pieceType = PIECE_NAME_TO_TYPE[pieceName];
  if (!pieceType) return null;
  
  // 如果没有指定颜色，根据列号格式自动判断
  let actualColor: 'red' | 'black';
  if (color) {
    actualColor = color;
  } else {
    // 根据起始列号格式判断：中文数字=红方，阿拉伯数字=黑方
    const isChineseNumber = /[一二三四五六七八九]/.test(fromColStr);
    actualColor = isChineseNumber ? 'red' : 'black';
  }
  
  // 根据实际颜色调整棋子类型（处理简繁体混用情况）
  pieceType = adjustPieceTypeByColor(pieceType, pieceName, actualColor);
  
  // 解析起始列
  let fromCol: number;
  if (actualColor === 'red') {
    fromCol = chineseToRedCol(fromColStr);
  } else {
    fromCol = numberToBlackCol(fromColStr);
  }
  
  if (fromCol < 0 || fromCol >= BOARD_COLS) return null;
  
  // 解析目标值
  let targetValue: number;
  if (direction === '平') {
    // 平：目标是列号
    if (actualColor === 'red') {
      targetValue = chineseToRedCol(targetStr);
    } else {
      targetValue = numberToBlackCol(targetStr);
    }
  } else {
    // 进/退：需要区分棋子类型
    // 马、仕、相：targetValue 是目标列号
    // 车、炮、兵、将：targetValue 是步数
    
    const isColumnBasedPiece = 
      pieceType === PIECES.R_HORSE || pieceType === PIECES.B_HORSE ||
      pieceType === PIECES.R_BISHOP || pieceType === PIECES.B_BISHOP ||
      pieceType === PIECES.R_ELEPHANT || pieceType === PIECES.B_ELEPHANT;
    
    if (isColumnBasedPiece) {
      // 马、仕、相：进/退后面的是目标列号
      if (actualColor === 'red') {
        targetValue = chineseToRedCol(targetStr);
      } else {
        targetValue = numberToBlackCol(targetStr);
      }
    } else {
      // 车、炮、兵、将：进/退后面的是步数
      if (actualColor === 'red') {
        targetValue = chineseToNumber(targetStr);
      } else {
        // 黑方：先转换全角数字为半角
        const halfwidthTarget = fullwidthToHalfwidth(targetStr);
        targetValue = parseInt(halfwidthTarget);
      }
    }
  }
  
  if (targetValue < 0 || targetValue > 9) return null;
  
  return {
    pieceType,
    fromCol,
    direction,
    targetValue
  };
}

/**
 * 根据解析的着法信息，在棋盘上找到具体棋子并计算目标位置
 * @param parsed 解析后的着法信息
 * @param board 当前棋盘状态
 * @param color 行棋方颜色
 * @returns [fromRow, fromCol, toRow, toCol] 或 null
 */
export function resolveMovePosition(
  parsed: ParsedMove,
  board: Board,
  color: 'red' | 'black'
): [number, number, number, number] | null {
  const { pieceType, fromCol, direction, targetValue } = parsed;
  
  // 收集该列所有候选棋子
  const candidates: number[] = [];
  
  if (color === 'red') {
    // 红方：从下往上找（row 9→0）
    for (let row = 9; row >= 0; row--) {
      if (board[row][fromCol] === pieceType) {
        candidates.push(row);
      }
    }
  } else {
    // 黑方：从上往下找（row 0→9）
    for (let row = 0; row <= 9; row++) {
      if (board[row][fromCol] === pieceType) {
        candidates.push(row);
      }
    }
  }
  
  if (candidates.length === 0) {
    console.warn(`在列 ${fromCol} 未找到棋子类型 ${pieceType}`);
    return null;
  }
  
  // 计算目标位置（对每个候选）
  for (const fromRow of candidates) {
    let toRow: number;
    let toCol: number;
    
    if (direction === '平') {
      // 横向移动：行不变，列变
      toRow = fromRow;
      toCol = targetValue;
    } else {
      // 进/退：需要区分棋子类型
      const isColumnBasedPiece = 
        pieceType === PIECES.R_HORSE || pieceType === PIECES.B_HORSE ||
        pieceType === PIECES.R_BISHOP || pieceType === PIECES.B_BISHOP ||
        pieceType === PIECES.R_ELEPHANT || pieceType === PIECES.B_ELEPHANT;
      
      if (isColumnBasedPiece) {
        // 马、仕、相：targetValue 是目标列号
        toCol = targetValue;
        
        // 根据方向和目标列号推断目标行号
        if (pieceType === PIECES.R_HORSE || pieceType === PIECES.B_HORSE) {
          // 马走日：从 fromCol 到 toCol
          const colDiff = Math.abs(toCol - fromCol);
          
          if (colDiff === 1) {
            // 横向移动1格，纵向必须移动2格
            const rowDiff = 2;
            toRow = direction === '进' ? 
              (color === 'red' ? fromRow - rowDiff : fromRow + rowDiff) :
              (color === 'red' ? fromRow + rowDiff : fromRow - rowDiff);
          } else if (colDiff === 2) {
            // 横向移动2格，纵向必须移动1格
            const rowDiff = 1;
            toRow = direction === '进' ? 
              (color === 'red' ? fromRow - rowDiff : fromRow + rowDiff) :
              (color === 'red' ? fromRow + rowDiff : fromRow - rowDiff);
          } else {
            // 不符合马的移动规则
            continue;
          }
        } else if (pieceType === PIECES.R_BISHOP || pieceType === PIECES.B_BISHOP) {
          // 仕/士：斜走1格
          const colDiff = Math.abs(toCol - fromCol);
          if (colDiff === 1) {
            const rowDiff = 1;
            toRow = direction === '进' ? 
              (color === 'red' ? fromRow - rowDiff : fromRow + rowDiff) :
              (color === 'red' ? fromRow + rowDiff : fromRow - rowDiff);
          } else {
            continue;
          }
        } else if (pieceType === PIECES.R_ELEPHANT || pieceType === PIECES.B_ELEPHANT) {
          // 相/象：飞田（斜走2格）
          const colDiff = Math.abs(toCol - fromCol);
          if (colDiff === 2) {
            const rowDiff = 2;
            toRow = direction === '进' ? 
              (color === 'red' ? fromRow - rowDiff : fromRow + rowDiff) :
              (color === 'red' ? fromRow + rowDiff : fromRow - rowDiff);
          } else {
            continue;
          }
        } else {
          // 其他情况
          continue;
        }
      } else {
        // 车、炮、兵、将：targetValue 是步数
        toCol = fromCol;
        
        if (color === 'red') {
          // 红方：进=row减小，退=row增加
          if (direction === '进') {
            toRow = fromRow - targetValue;
          } else {
            toRow = fromRow + targetValue;
          }
        } else {
          // 黑方：进=row增加，退=row减小
          if (direction === '进') {
            toRow = fromRow + targetValue;
          } else {
            toRow = fromRow - targetValue;
          }
        }
      }
    }
    
    // 验证目标位置是否在棋盘内
    if (toRow < 0 || toRow >= BOARD_ROWS || toCol < 0 || toCol >= BOARD_COLS) {
      continue;  // 尝试下一个候选
    }
    
    // 验证移动是否合法（包括基础规则、吃子规则、叫将规则、高级规则）
    if (!isValidMove(board, fromRow, fromCol, toRow, toCol)) {
      continue;  // 尝试下一个候选
    }
    
    // 返回第一个合法的移动
    return [fromRow, fromCol, toRow, toCol];
  }
  
  console.warn(`所有候选棋子都无法合法移动到目标位置`);
  return null;
}

// ==================== 完整棋谱解析 ====================

/**
 * 棋谱数据结构
 */
export interface GameNotation {
  metadata: string[];        // 元数据行
  fen?: string;              // 初始局面 FEN（残局用）
  asciiBoard?: Board;        // ASCII棋盘解析结果
  moves: Array<{             // 着法列表
    round: number;
    red?: string;            // 红方着法原文
    black?: string;          // 黑方着法原文
  }>;
}

/**
 * 检测并解析完整棋谱文本
 * @param text 棋谱文本
 * @returns 解析结果，如果不是棋谱返回 null
 */
export function parseGameNotation(text: string): GameNotation | null {
  const lines = text.split(/\r?\n/);
  let metadataLines: string[] = [];
  let moveTextLines: string[] = [];
  let fenLine: string | undefined;
  let hasASCIIBoard = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (/^(FEN|初始局面)\s*[:：]\s*(.+)/i.test(trimmed)) {
      const match = trimmed.match(/^(?:FEN|初始局面)\s*[:：]\s*(.+)/i);
      if (match) {
        fenLine = match[1].trim();
      }
      metadataLines.push(line);
      continue;
    }
    
    if (/^\s*黑方\s*$/.test(line) || /^\s*红方\s*$/.test(line) || /[\[（][^\]）]+[\]）]/.test(line)) {
      hasASCIIBoard = true;
    }
    
    if (containsStandardMoves(trimmed)) {
      moveTextLines.push(line);
    } else {
      metadataLines.push(line);
    }
  }
  
  if (moveTextLines.length === 0 && !hasASCIIBoard) {
    return null;
  }
  
  const moves = parseMovesFromLines(moveTextLines);
  
  if (moves.length === 0 && !hasASCIIBoard) {
    return null;
  }
  
  let asciiBoard: Board | undefined;
  if (hasASCIIBoard) {
    console.log('[parseGameNotation] 检测到ASCII棋盘，尝试解析');
    const parsedBoard = parseASCIIBoard(text);
    if (parsedBoard) {
      asciiBoard = parsedBoard;
    } else {
      console.log('[parseGameNotation] ASCII棋盘解析失败');
      if (moves.length === 0) {
        return null;
      }
    }
  }
  
  return {
    metadata: metadataLines,
    fen: fenLine,
    asciiBoard,
    moves
  };
}

/**
 * 检测文本行是否包含标准着法
 */
function containsStandardMoves(line: string): boolean {
  // 匹配模式：棋子名 + 列号 + 方向词（允许后面有特殊标记如 * m 等）
  // 支持简繁体混用
  const movePattern = /[帥帅俥車车傌馬马炮砲仕士相象兵卒][一二三四五六七八九1-9１２３４５６７８９][进退平]/;
  return movePattern.test(line);
}

/**
 * 清理着法字符串，移除特殊标记符号
 * @param notation 原始着法字符串
 * @returns 清理后的着法字符串
 */
function cleanNotation(notation: string): string {
  // 移除常见的标记符号：* m ! ? !! ?? +- = 等
  return notation.replace(/[*m!?\s+\-=]+$/g, '').trim();
}

/**
 * 从多行文本中解析着法序列
 */
function parseMovesFromLines(lines: string[]): Array<{ round: number; red?: string; black?: string }> {
  const moves: Array<{ round: number; red?: string; black?: string }> = [];
  
  const allText = lines.join('\n');
  
  const halfwidthNum = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  const normalizedText = halfwidthNum(allText);
  
  // 红方着法：棋子名 + 中文数字列号 + 进退平 + 目标（可选）
  // 支持：车二平五、兵九进一、前车进三、前炮平四
  // 列号在"前/后"记谱法中可能省略
  const redMovePattern = '[前后]?[帥帅俥車车傌馬马炮砲仕士相象兵卒將](?:[一二三四五六七八九])?[进退平][一二三四五六七八九]?';
  // 黑方着法：棋子名 + 阿拉伯数字列号 + 进退平 + 目标（可选）
  // 支持：马8进7、车9平8、前炮平4、前车进3
  // 列号在"前/后"记谱法中可能省略
  const blackMovePattern = '[前后]?[帥帅俥車车傌馬马炮砲仕士相象兵卒將将](?:[1-9])?[进退平][1-9]?';
  
  // 匹配完整回合：数字. 红方着法 黑方着法
  const roundRegex = new RegExp(`(\\d+)\\.\\s*(${redMovePattern})\\s+(${blackMovePattern})`, 'g');
  
  let match;
  let lastRound = 0;
  while ((match = roundRegex.exec(normalizedText)) !== null) {
    const round = parseInt(match[1]);
    const redMove = cleanNotation(match[2].trim());
    const blackMove = cleanNotation(match[3].trim());
    
    // 检测回合号是否连续
    if (round !== lastRound + 1) {
      console.error(`[parseMovesFromLines] ❌ 回合号不连续: 期望 ${lastRound + 1}，实际 ${round}，可能缺少回合 ${lastRound + 1}`);
    }
    lastRound = round;
    
    console.log('[parseMovesFromLines] matched:', match[0], 'round:', round, 'red:', redMove, 'black:', blackMove);
    
    moves.push({
      round,
      red: redMove || undefined,
      black: blackMove || undefined
    });
  }
  
  // 匹配只有红方的回合
  const singleRedRegex = new RegExp(`(\\d+)\\.\\s*(${redMovePattern})(?!\\s+${blackMovePattern})`, 'g');
  while ((match = singleRedRegex.exec(normalizedText)) !== null) {
    const round = parseInt(match[1]);
    const redMove = cleanNotation(match[2].trim());
    
    // 检查是否已经存在该回合
    if (!moves.find(m => m.round === round)) {
      console.log('[parseMovesFromLines] single red matched:', match[0], 'round:', round, 'red:', redMove);
      moves.push({
        round,
        red: redMove || undefined,
        black: undefined
      });
    }
  }
  
  return moves.sort((a, b) => a.round - b.round);
}

// ==================== 棋谱导出 ====================

/**
 * 从着法记录生成标准棋谱文本
 * @param moves 着法记录数组
 * @returns 标准棋谱文本
 */
export function exportGameNotation(moves: Array<{
  round: number;
  red?: string;
  black?: string;
}>): string {
  if (moves.length === 0) return '';
  
  const lines: string[] = [];
  let currentLine = '';
  let moveCount = 0;
  
  for (const move of moves) {
    const roundText = `${move.round}.`;
    
    if (move.red) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }
      currentLine = `${roundText}${move.red.padEnd(12, ' ')}`;
      moveCount++;
    }
    
    if (move.black) {
      currentLine += move.black.padEnd(12, ' ');
      moveCount++;
      
      // 每4个着法换行
      if (moveCount % 4 === 0) {
        lines.push(currentLine);
        currentLine = '';
      }
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines.join('\n');
}

// ==================== 智能识别 ====================

/**
 * 检测结果
 */
export interface DetectedNotation {
  isNotation: boolean;       // 是否为棋谱
  confidence: number;        // 置信度 0-1
  metadata: string[];        // 元数据
  notationText: string;      // 纯着法部分
  parsed?: GameNotation;     // 解析后的结构
}

/**
 * 智能检测并解析文本是否为棋谱
 * @param text 待检测文本
 * @returns 检测结果
 */
export function detectAndParseNotation(text: string): DetectedNotation {
  const lines = text.split(/\r?\n/);
  let moveLines: string[] = [];
  let metadataLines: string[] = [];
  let totalMoves = 0;
  let hasASCIIBoard = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (/^\s*黑方\s*$/.test(line) || /^\s*红方\s*$/.test(line) || /[\[（][^\]）]+[\]）]/.test(line)) {
      hasASCIIBoard = true;
    }
    
    if (containsStandardMoves(trimmed)) {
      moveLines.push(line);
      const matches = trimmed.match(/[帥俥馬砲仕相兵將車士象卒][一二三四五六七八九1-9１２３４５６７８９][进退平][^]*/g);
      if (matches) {
        totalMoves += matches.length;
      }
    } else {
      metadataLines.push(line);
    }
  }
  
  const isNotation = totalMoves > 0 || hasASCIIBoard;
  const confidence = hasASCIIBoard ? 1.0 : Math.min(totalMoves / 4, 1.0);
  
  const notationText = moveLines.join('\n');
  const parsed = isNotation ? (parseGameNotation(text) || undefined) : undefined;
  
  return {
    isNotation,
    confidence,
    metadata: metadataLines.filter(l => l.trim()),
    notationText,
    parsed
  };
}

// ==================== 测试用例 ====================

/**
 * 运行测试（开发时使用）
 */
export function runTests(): void {
  console.log('=== 棋谱模块测试 ===\n');
  
  // 测试1：数字转换
  console.log('测试1：数字转换');
  console.log('  一 →', chineseToNumber('一'), '(期望: 1)');
  console.log('  5 →', numberToChinese(5), '(期望: 五)');
  console.log('  红方col 8 →', redColToChinese(8), '(期望: 一)');
  console.log('  黑方col 0 →', blackColToNumber(0), '(期望: 1)');
  
  // 测试2：着法解析
  console.log('\n测试2：着法解析');
  const testBoard = initBoard();
  const parsed = parseSingleMove('炮二平五', testBoard, 'red');
  console.log('  "炮二平五" →', parsed);
  
  // 测试3：完整棋谱解析
  console.log('\n测试3：完整棋谱解析');
  const sampleNotation = `棋谱主人: chouzhouyu
棋谱价值: 1
浏览次数: 6
来源网站: www.dpxq.com
 
1.相三进五      卒３进１      2.炮八平七      马２进１  
  3.马八进九      车１平２      4.兵三进一      炮８平５`;
  
  const result = parseGameNotation(sampleNotation);
  console.log('  元数据行数:', result?.metadata.length);
  console.log('  着法回合数:', result?.moves.length);
  console.log('  第1回合:', result?.moves[0]);
  
  // 测试4：智能识别
  console.log('\n测试4：智能识别');
  const detected = detectAndParseNotation(sampleNotation);
  console.log('  是否为棋谱:', detected.isNotation);
  console.log('  置信度:', detected.confidence);
  console.log('  元数据:', detected.metadata);
  
  // 测试5：带标记符号的棋谱（新增）
  console.log('\n测试5：带标记符号的棋谱');
  const notationWithMarks = `标题: 第1节 红屏风马型 第163局 黑挺7卒式
赛事: 布局定式与战理
轮次: 飞相局 第1章 飞相对左中炮
 
  1.相三进五      炮８平５* 
  2.马二进三      马８进７  
  3.车一平二      车９平８  
  4.马八进七*     卒７进１*m
  5.兵七进一 m    炮２平３* 
  6.马七进八      马７进６  
  7.仕六进五*m    车８进６  
  8.车九进一      马６进５*m`;
  
  const resultWithMarks = parseGameNotation(notationWithMarks);
  console.log('  元数据行数:', resultWithMarks?.metadata.length);
  console.log('  着法回合数:', resultWithMarks?.moves.length);
  console.log('  第1回合:', resultWithMarks?.moves[0]);
  console.log('  第4回合:', resultWithMarks?.moves[3]);
  console.log('  第5回合:', resultWithMarks?.moves[4]);
  
  // 测试清理函数
  console.log('\n测试6：清理函数');
  console.log('  "炮８平５*" →', cleanNotation('炮８平５*'));
  console.log('  "卒７进１*m" →', cleanNotation('卒７进１*m'));
  console.log('  "兵七进一 m" →', cleanNotation('兵七进一 m'));
  console.log('  "仕六进五*m" →', cleanNotation('仕六进五*m'));
  
  // 测试7：全角数字支持（新增）
  console.log('\n测试7：全角数字支持');
  console.log('  全角 ８ → 半角', fullwidthToHalfwidth('８'), '(期望: 8)');
  console.log('  全角 ５ → 半角', fullwidthToHalfwidth('５'), '(期望: 5)');
  console.log('  黑方col "８" →', numberToBlackCol('８'), '(期望: 7)');
  console.log('  黑方col "５" →', numberToBlackCol('５'), '(期望: 4)');
  
  // 测试解析带全角数字的着法
  const testBoard2 = initBoard();
  const parsedFullwidth = parseSingleMove('炮８平５', testBoard2, 'black');
  console.log('  "炮８平５" (全角) →', parsedFullwidth);
  console.log('    起始列:', parsedFullwidth?.fromCol, '(期望: 7)');
  console.log('    目标列:', parsedFullwidth?.targetValue, '(期望: 4)');
  
  // 测试8：简体字支持（新增）
  console.log('\n测试8：简体字支持');
  const testBoard3 = initBoard();
  
  // 红方简体字
  const parsedRedSimp = parseSingleMove('马二进三', testBoard3);
  console.log('  "马二进三" (简体红方) →', parsedRedSimp);
  console.log('    棋子类型:', parsedRedSimp?.pieceType, '(期望: 3=R_HORSE)');
  
  // 黑方简体字
  const parsedBlackSimp = parseSingleMove('马８进７', testBoard3);
  console.log('  "马８进７" (简体黑方) →', parsedBlackSimp);
  console.log('    棋子类型:', parsedBlackSimp?.pieceType, '(期望: -3=B_HORSE)');
  
  // 混合简繁体
  const parsedMixed = parseSingleMove('车一平二', testBoard3);
  console.log('  "车一平二" (简体车) →', parsedMixed);
  console.log('    棋子类型:', parsedMixed?.pieceType, '(期望: 2=R_CAR)');
  
  const parsedMixed2 = parseSingleMove('车９平８', testBoard3);
  console.log('  "车９平８" (简体车+全角) →', parsedMixed2);
  console.log('    棋子类型:', parsedMixed2?.pieceType, '(期望: -2=B_CAR)');
  
  console.log('\n=== 测试完成 ===');
}
