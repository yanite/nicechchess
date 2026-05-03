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

// 棋子名称映射
export const PIECE_NAMES: Record<number, string> = {
  [PIECES.EMPTY]: '',
  [PIECES.R_KING]: '帅',
  [PIECES.R_CAR]: '车',
  [PIECES.R_HORSE]: '马',
  [PIECES.R_CANNON]: '炮',
  [PIECES.R_BISHOP]: '仕',
  [PIECES.R_ELEPHANT]: '相',
  [PIECES.R_PAWN]: '兵',
  [PIECES.B_KING]: '将',
  [PIECES.B_CAR]: '车',
  [PIECES.B_HORSE]: '马',
  [PIECES.B_CANNON]: '炮',
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
 * @param row 行 (0-9)
 * @param col 列 (0-8)
 * @returns UCI 坐标字符串 (如 "a1", "i9")
 */
export function boardToUCI(row: number, col: number): string {
  const files = 'abcdefghi';
  const ranks = row.toString();
  return files[col] + ranks;
}

/**
 * 坐标转换：UCI 坐标转棋盘坐标
 * @param uci UCI 坐标字符串 (如 "a1", "i9")
 * @returns [row, col] 数组
 */
export function UCIToBoard(uci: string): [number, number] {
  const col = uci.charCodeAt(0) - 'a'.charCodeAt(0);
  const row = parseInt(uci[1]);
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
