/**
 * 中国象棋常量定义
 * 纯TypeScript，无框架依赖
 */

import type { PieceType, Board } from './types';

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
  [PIECES.R_CAR]: '俥',
  [PIECES.R_HORSE]: '傌',
  [PIECES.R_CANNON]: '炮',
  [PIECES.R_BISHOP]: '仕',
  [PIECES.R_ELEPHANT]: '相',
  [PIECES.R_PAWN]: '兵',
  [PIECES.B_KING]: '将',
  [PIECES.B_CAR]: '車',
  [PIECES.B_HORSE]: '馬',
  [PIECES.B_CANNON]: '砲',
  [PIECES.B_BISHOP]: '士',
  [PIECES.B_ELEPHANT]: '象',
  [PIECES.B_PAWN]: '卒',
};

// 棋盘尺寸
export const BOARD_ROWS = 10;
export const BOARD_COLS = 9;

/**
 * 初始化棋盘（纯函数）
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
 * 获取棋子颜色（纯函数）
 * @param piece 棋子值
 * @returns 'red' | 'black' | null
 */
export function getPieceColor(piece: PieceType): 'red' | 'black' | null {
  if (piece === PIECES.EMPTY) return null;
  return piece > 0 ? 'red' : 'black';
}

/**
 * 坐标转换：棋盘坐标转 UCI 坐标（纯函数）
 * @param row 行 (0-9)，0=黑方底线，9=红方底线
 * @param col 列 (0-8)，0=a列，8=i列
 * @returns UCI 坐标字符串 (如 "a0", "i9")
 */
export function boardToUCI(row: number, col: number): string {
  const files = 'abcdefghi';
  const uciRow = 9 - row;  // 反转行号
  return files[col] + uciRow.toString();
}

/**
 * 坐标转换：UCI 坐标转棋盘坐标（纯函数）
 * @param uci UCI 坐标字符串 (如 "a0", "i9")
 * @returns {row, col} 对象
 */
export function UCIToBoard(uci: string): { row: number; col: number } {
  const files = 'abcdefghi';
  const col = files.indexOf(uci[0]);
  const uciRow = parseInt(uci[1]);
  const row = 9 - uciRow;  // 反转行号
  return { row, col };
}

/**
 * 将内部着法转换为 UCI 格式（纯函数）
 */
export function moveToUCI(fromRow: number, fromCol: number, toRow: number, toCol: number): string {
  const from = boardToUCI(fromRow, fromCol);
  const to = boardToUCI(toRow, toCol);
  return from + to;
}

/**
 * 将 UCI 格式着法转换为内部坐标（纯函数）
 */
export function UCIToMove(uciMove: string): { fromRow: number; fromCol: number; toRow: number; toCol: number } {
  if (uciMove.length < 4) {
    throw new Error(`Invalid UCI move: ${uciMove}`);
  }
  
  const fromSquare = uciMove.substring(0, 2);
  const toSquare = uciMove.substring(2, 4);
  
  const from = UCIToBoard(fromSquare);
  const to = UCIToBoard(toSquare);
  
  return {
    fromRow: from.row,
    fromCol: from.col,
    toRow: to.row,
    toCol: to.col,
  };
}
