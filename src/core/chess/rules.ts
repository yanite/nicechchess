/**
 * 中国象棋规则验证（纯函数）
 * 无框架依赖，易于测试
 */

import type { Board, PieceType } from './types';
import { PIECES, BOARD_ROWS, BOARD_COLS, getPieceColor } from './constants';

/**
 * 检查位置是否在棋盘范围内（纯函数）
 */
function isInBoard(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS;
}

/**
 * 检查位置是否在九宫格内（纯函数）
 */
function isInPalace(row: number, col: number, color: 'red' | 'black'): boolean {
  if (col < 3 || col > 5) return false;
  if (color === 'red') {
    return row >= 7 && row <= 9;
  } else {
    return row >= 0 && row <= 2;
  }
}

/**
 * 检查两点之间是否有阻挡（纯函数）
 */
function hasObstacle(
  board: Board,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): boolean {
  if (fromRow === toRow) {
    const minCol = Math.min(fromCol, toCol);
    const maxCol = Math.max(fromCol, toCol);
    for (let c = minCol + 1; c < maxCol; c++) {
      if (board[fromRow][c] !== PIECES.EMPTY) {
        return true;
      }
    }
  } else if (fromCol === toCol) {
    const minRow = Math.min(fromRow, toRow);
    const maxRow = Math.max(fromRow, toRow);
    for (let r = minRow + 1; r < maxRow; r++) {
      if (board[r][fromCol] !== PIECES.EMPTY) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 计算两点之间的棋子数量（纯函数）
 */
function countPiecesBetween(
  board: Board,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): number {
  let count = 0;
  if (fromRow === toRow) {
    const minCol = Math.min(fromCol, toCol);
    const maxCol = Math.max(fromCol, toCol);
    for (let c = minCol + 1; c < maxCol; c++) {
      if (board[fromRow][c] !== PIECES.EMPTY) {
        count++;
      }
    }
  } else if (fromCol === toCol) {
    const minRow = Math.min(fromRow, toRow);
    const maxRow = Math.max(fromRow, toRow);
    for (let r = minRow + 1; r < maxRow; r++) {
      if (board[r][fromCol] !== PIECES.EMPTY) {
        count++;
      }
    }
  }
  return count;
}

/**
 * 检查马是否被蹩腿（纯函数）
 */
function isHorseBlocked(
  board: Board,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): boolean {
  const dRow = toRow - fromRow;
  const dCol = toCol - fromCol;

  if (Math.abs(dRow) === 2 && Math.abs(dCol) === 1) {
    const checkRow = fromRow + (dRow > 0 ? 1 : -1);
    return board[checkRow][fromCol] !== PIECES.EMPTY;
  } else if (Math.abs(dRow) === 1 && Math.abs(dCol) === 2) {
    const checkCol = fromCol + (dCol > 0 ? 1 : -1);
    return board[fromRow][checkCol] !== PIECES.EMPTY;
  }
  return false;
}

/**
 * 检查相/象是否被塞象眼（纯函数）
 */
function isElephantBlocked(
  board: Board,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): boolean {
  const eyeRow = (fromRow + toRow) / 2;
  const eyeCol = (fromCol + toCol) / 2;
  if (!Number.isInteger(eyeRow) || !Number.isInteger(eyeCol)) return true; 
  return board[eyeRow][eyeCol] !== PIECES.EMPTY;
}

/**
 * 基础移动规则验证（纯函数）
 */
function validateBasicMove(
  board: Board,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  piece: PieceType
): boolean {
  const color = getPieceColor(piece);
  if (!color) return false;

  const dRow = toRow - fromRow;
  const dCol = toCol - fromCol;
  const absRow = Math.abs(dRow);
  const absCol = Math.abs(dCol);

  switch (Math.abs(piece)) {
    case Math.abs(PIECES.R_KING): // 帅/将
      if (!isInPalace(toRow, toCol, color)) return false;
      return (absRow === 1 && absCol === 0) || (absRow === 0 && absCol === 1);

    case Math.abs(PIECES.R_CAR): // 车
      if (fromRow !== toRow && fromCol !== toCol) return false;
      return !hasObstacle(board, fromRow, fromCol, toRow, toCol);

    case Math.abs(PIECES.R_HORSE): // 马
      if (!((absRow === 2 && absCol === 1) || (absRow === 1 && absCol === 2))) return false;
      return !isHorseBlocked(board, fromRow, fromCol, toRow, toCol);

    case Math.abs(PIECES.R_CANNON): // 炮
      if (fromRow !== toRow && fromCol !== toCol) return false;
      const pieceCount = countPiecesBetween(board, fromRow, fromCol, toRow, toCol);
      const targetPiece = board[toRow][toCol];
      
      if (targetPiece === PIECES.EMPTY) {
        return pieceCount === 0;
      } else {
        return pieceCount === 1;
      }

    case Math.abs(PIECES.R_BISHOP): // 仕/士
      if (!isInPalace(toRow, toCol, color)) return false;
      return absRow === 1 && absCol === 1;

    case Math.abs(PIECES.R_ELEPHANT): // 相/象
      if (absRow !== 2 || absCol !== 2) return false;
      if (color === 'red' && toRow < 5) return false;
      if (color === 'black' && toRow > 4) return false;
      return !isElephantBlocked(board, fromRow, fromCol, toRow, toCol);

    case Math.abs(PIECES.R_PAWN): // 兵/卒
      if (color === 'red') {
        if (fromRow > 4) {
          return dRow === -1 && dCol === 0;
        } else {
          return (dRow === -1 && dCol === 0) || (dRow === 0 && absCol === 1);
        }
      } else {
        if (fromRow < 5) {
          return dRow === 1 && dCol === 0;
        } else {
          return (dRow === 1 && dCol === 0) || (dRow === 0 && absCol === 1);
        }
      }

    default:
      return false;
  }
}

/**
 * 检查两将是否面对面（纯函数）
 */
export function areKingsFacing(board: Board): boolean {
  let redKingRow = -1, redKingCol = -1;
  let blackKingRow = -1, blackKingCol = -1;

  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      if (board[r][c] === PIECES.R_KING) {
        redKingRow = r;
        redKingCol = c;
      } else if (board[r][c] === PIECES.B_KING) {
        blackKingRow = r;
        blackKingCol = c;
      }
    }
  }

  if (redKingRow === -1 || blackKingRow === -1) return false;
  if (redKingCol !== blackKingCol) return false;

  const minRow = Math.min(redKingRow, blackKingRow);
  const maxRow = Math.max(redKingRow, blackKingRow);
  
  for (let r = minRow + 1; r < maxRow; r++) {
    if (board[r][redKingCol] !== PIECES.EMPTY) {
      return false;
    }
  }

  return true;
}

/**
 * 检查指定颜色是否被将军（纯函数）
 */
export function isInCheck(board: Board, color: 'red' | 'black'): boolean {
  let kingRow = -1, kingCol = -1;
  const kingPiece = color === 'red' ? PIECES.R_KING : PIECES.B_KING;

  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      if (board[r][c] === kingPiece) {
        kingRow = r;
        kingCol = c;
        break;
      }
    }
    if (kingRow !== -1) break;
  }

  if (kingRow === -1) return false;

  const opponentColor = color === 'red' ? 'black' : 'red';
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const piece = board[r][c];
      if (piece !== PIECES.EMPTY && getPieceColor(piece) === opponentColor) {
        if (validateBasicMove(board, r, c, kingRow, kingCol, piece)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * 验证移动是否合法（完整验证，纯函数）
 * @returns true表示合法，false表示非法
 */
export function isValidMove(
  board: Board,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): boolean {
  // 基本检查
  if (fromRow === toRow && fromCol === toCol) return false;

  const piece = board[fromRow][fromCol];
  if (piece === PIECES.EMPTY) return false;

  if (!isInBoard(toRow, toCol)) return false;

  const moverColor = getPieceColor(piece);
  if (!moverColor) return false;

  const targetPiece = board[toRow][toCol];
  const targetColor = getPieceColor(targetPiece);

  // 不能吃自己的棋子
  if (targetColor === moverColor) return false;

  // 第一层：基础移动规则
  if (!validateBasicMove(board, fromRow, fromCol, toRow, toCol, piece)) {
    return false;
  }

  // 模拟移动后的棋盘状态
  const tempBoard = board.map(row => [...row]);
  tempBoard[toRow][toCol] = piece;
  tempBoard[fromRow][fromCol] = PIECES.EMPTY;

  // 检查是否会导致自己被将军（不能送将）
  if (isInCheck(tempBoard, moverColor)) {
    return false;
  }

  // 检查是否对将
  if (areKingsFacing(tempBoard)) {
    return false;
  }

  return true;
}

/**
 * 检查游戏是否结束（纯函数）
 * @returns 'playing' | 'red_win' | 'black_win' | 'stalemate'
 */
export function checkGameEnd(board: Board): 'playing' | 'red_win' | 'black_win' | 'stalemate' {
  let redKingExists = false;
  let blackKingExists = false;

  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      if (board[r][c] === PIECES.R_KING) redKingExists = true;
      if (board[r][c] === PIECES.B_KING) blackKingExists = true;
    }
  }

  if (!redKingExists) return 'black_win';
  if (!blackKingExists) return 'red_win';

  return 'playing';
}

/**
 * 获取指定棋子的所有合法移动（纯函数）
 * @returns 合法移动的目标位置数组
 */
export function getValidMoves(
  board: Board,
  row: number,
  col: number
): Array<{ row: number; col: number }> {
  const moves: Array<{ row: number; col: number }> = [];
  
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      if (isValidMove(board, row, col, r, c)) {
        moves.push({ row: r, col: c });
      }
    }
  }
  
  return moves;
}
