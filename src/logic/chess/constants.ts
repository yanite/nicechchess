/**
 * 中国象棋棋盘常量定义
 */

// 棋子类型枚举
export const PIECES = {
  EMPTY: 0,
  // 红方为正数
  R_KING: 1,      // 红帅
  R_CAR: 2,       // 红车
  R_HORSE: 3,     // 红马
  R_CANNON: 4,    // 红炮
  R_BISHOP: 5,    // 红仕
  R_ELEPHANT: 6,  // 红相
  R_PAWN: 7,      // 红兵
  // 黑方为负数
  B_KING: -1,     // 黑将
  B_CAR: -2,      // 黑车
  B_HORSE: -3,    // 黑马
  B_CANNON: -4,   // 黑炮
  B_BISHOP: -5,   // 黑士
  B_ELEPHANT: -6, // 黑象
  B_PAWN: -7,     // 黑卒
} as const;

// 棋子名称映射（使用中国象棋传统写法）
export const PIECE_NAMES: Record<number, string> = {
  [PIECES.EMPTY]: '',
  [PIECES.R_KING]: '帅',
  [PIECES.R_CAR]: '俥',      // 红车用"俥"
  [PIECES.R_HORSE]: '傌',    // 红马用"傌"
  [PIECES.R_CANNON]: '炮',
  [PIECES.R_BISHOP]: '仕',
  [PIECES.R_ELEPHANT]: '相',
  [PIECES.R_PAWN]: '兵',
  [PIECES.B_KING]: '将',
  [PIECES.B_CAR]: '車',      // 黑车用"車"
  [PIECES.B_HORSE]: '馬',    // 黑马用"馬"
  [PIECES.B_CANNON]: '砲',   // 黑炮用"砲"
  [PIECES.B_BISHOP]: '士',
  [PIECES.B_ELEPHANT]: '象',
  [PIECES.B_PAWN]: '卒',
};

// 棋盘尺寸
export const BOARD_ROWS = 10;
export const BOARD_COLS = 9;

// 棋盘类型
export type PieceType = typeof PIECES[keyof typeof PIECES];
export type Board = PieceType[][];

/**
 * 初始化棋盘
 * @returns 初始状态的棋盘数组
 */
export function initBoard(): Board {
  const board: Board = Array.from({ length: BOARD_ROWS }, () =>
    Array(BOARD_COLS).fill(PIECES.EMPTY)
  );

  // 初始化黑方棋子（顶部）
  board[0] = [
    PIECES.B_CAR, PIECES.B_HORSE, PIECES.B_ELEPHANT, PIECES.B_BISHOP,
    PIECES.B_KING, PIECES.B_BISHOP, PIECES.B_ELEPHANT, PIECES.B_HORSE, PIECES.B_CAR
  ];
  board[2][1] = PIECES.B_CANNON;
  board[2][7] = PIECES.B_CANNON;
  board[3][0] = PIECES.B_PAWN;
  board[3][2] = PIECES.B_PAWN;
  board[3][4] = PIECES.B_PAWN;
  board[3][6] = PIECES.B_PAWN;
  board[3][8] = PIECES.B_PAWN;

  // 初始化红方棋子（底部）
  board[9] = [
    PIECES.R_CAR, PIECES.R_HORSE, PIECES.R_ELEPHANT, PIECES.R_BISHOP,
    PIECES.R_KING, PIECES.R_BISHOP, PIECES.R_ELEPHANT, PIECES.R_HORSE, PIECES.R_CAR
  ];
  board[7][1] = PIECES.R_CANNON;
  board[7][7] = PIECES.R_CANNON;
  board[6][0] = PIECES.R_PAWN;
  board[6][2] = PIECES.R_PAWN;
  board[6][4] = PIECES.R_PAWN;
  board[6][6] = PIECES.R_PAWN;
  board[6][8] = PIECES.R_PAWN;

  return board;
}

/**
 * 坐标转换：棋盘坐标转 UCI 坐标
 * @param row 行 (0-9)，0=黑方底线，9=红方底线
 * @param col 列 (0-8)，0=a列，8=i列
 * @returns UCI 坐标字符串 (如 "a0", "i9")
 * 
 * 注意：UCI 协议中 row=0 是红方底线，row=9 是黑方底线
 * 而内部坐标系 row=0 是黑方，row=9 是红方，需要反转
 */
export function boardToUCI(row: number, col: number): string {
  const files = 'abcdefghi';
  const uciRow = 9 - row;  // 反转行号：内部row=9(红方) → UCI row=0
  return files[col] + uciRow.toString();
}

/**
 * 坐标转换：UCI 坐标转棋盘坐标
 * @param uci UCI 坐标字符串 (如 "a0", "i9")
 * @returns [row, col] 数组
 * 
 * 注意：UCI 协议中 row=0 是红方底线，row=9 是黑方底线
 * 而内部坐标系 row=0 是黑方，row=9 是红方，需要反转
 */
export function UCIToBoard(uci: string): [number, number] {
  const col = uci.charCodeAt(0) - 'a'.charCodeAt(0);
  const uciRow = parseInt(uci[1]);
  const row = 9 - uciRow;  // 反转行号：UCI row=0 → 内部row=9(红方)
  return [row, col];
}

/**
 * 获取棋子颜色
 * @param piece 棋子值
 * @returns 'red' | 'black' | 'empty'
 */
export function getPieceColor(piece: PieceType): 'red' | 'black' | 'empty' {
  if (piece === PIECES.EMPTY) return 'empty';
  return piece > 0 ? 'red' : 'black';
}

/**
 * 将内部着法转换为 UCI 格式
 * @param fromRow 起始行
 * @param fromCol 起始列
 * @param toRow 目标行
 * @param toCol 目标列
 * @returns UCI 格式着法字符串 (如 "e2e4")
 */
export function moveToUCI(fromRow: number, fromCol: number, toRow: number, toCol: number): string {
  const from = boardToUCI(fromRow, fromCol);
  const to = boardToUCI(toRow, toCol);
  return from + to;
}

/**
 * 将 UCI 格式着法转换为内部坐标
 * @param uciMove UCI 格式着法字符串 (如 "e2e4")
 * @returns [fromRow, fromCol, toRow, toCol] 数组
 */
export function UCIToMove(uciMove: string): [number, number, number, number] {
  if (uciMove.length < 4) {
    throw new Error(`Invalid UCI move: ${uciMove}`);
  }
  
  const fromSquare = uciMove.substring(0, 2);
  const toSquare = uciMove.substring(2, 4);
  
  const [fromRow, fromCol] = UCIToBoard(fromSquare);
  const [toRow, toCol] = UCIToBoard(toSquare);
  
  return [fromRow, fromCol, toRow, toCol];
}

/**
 * 将列号转换为显示文本（红方用中文数字，黑方用阿拉伯数字）
 * @param col 列号 (0-8)
 * @param color 棋子颜色
 * @returns 数字字符串
 */
function colToDisplayText(col: number, color: 'red' | 'black'): string {
  if (color === 'red') {
    const chineseNumbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
    return chineseNumbers[col];
  } else {
    // 黑方使用阿拉伯数字：col 0→"1", col 1→"2", ..., col 8→"9"
    return String(col + 1);
  }
}

/**
 * 生成中文着法记录
 * @param board 当前棋盘状态
 * @param fromRow 起始行
 * @param fromCol 起始列
 * @param toRow 目标行
 * @param toCol 目标列
 * @param piece 移动的棋子
 * @returns 中文着法字符串，如 "俥一进二"（红方）或 "车1进1"（黑方）
 */
export function generateChineseNotation(
  _board: Board,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  piece: PieceType
): string {
  const color = getPieceColor(piece);
  
  // 安全检查：确保不是空棋子
  if (color === 'empty') {
    console.error('尝试为空白棋子生成着法记录');
    return '';
  }
  
  // TypeScript 类型收窄：此时 color 一定是 'red' | 'black'
  const validColor = color as 'red' | 'black';
  
  const pieceName = PIECE_NAMES[piece] || '?';
  
  // 确定方向：进、退、平
  let direction: string;
  let distance: string;
  
  if (validColor === 'red') {
    // 红方：向上为进（row减小），向下为退（row增加）
    const rowDiff = fromRow - toRow;
    
    if (rowDiff > 0) {
      direction = '进';
      // 红方步数使用中文数字
      const chineseNumbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
      distance = chineseNumbers[rowDiff - 1];
    } else if (rowDiff < 0) {
      direction = '退';
      // 红方步数使用中文数字
      const chineseNumbers = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
      distance = chineseNumbers[-rowDiff - 1];
    } else {
      direction = '平';
      distance = colToDisplayText(toCol, 'red');
    }
  } else {
    // 黑方：向下为进（row增加），向上为退（row减小）
    const rowDiff = toRow - fromRow;
    
    if (rowDiff > 0) {
      direction = '进';
      // 黑方步数使用阿拉伯数字
      distance = String(rowDiff);
    } else if (rowDiff < 0) {
      direction = '退';
      // 黑方步数使用阿拉伯数字
      distance = String(-rowDiff);
    } else {
      direction = '平';
      distance = colToDisplayText(toCol, 'black');
    }
  }
  
  // 格式：棋子名 + 起始列 + 方向 + 距离/目标列（不添加颜色前缀）
  const fromColText = colToDisplayText(fromCol, validColor);
  
  return `${pieceName}${fromColText}${direction}${distance}`;
}
