import { type Board, type PieceType, PIECES } from './constants';

/**
 * 规则校验接口
 * TODO: 实现完整的象棋规则校验
 */

/**
 * 验证移动是否合法
 * @param board 当前棋盘状态
 * @param fromRow 起始行
 * @param fromCol 起始列
 * @param toRow 目标行
 * @param toCol 目标列
 * @returns 是否合法
 */
export function isValidMove(
  board: Board,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): boolean {
  // TODO: 实现规则校验逻辑
  // 1. 检查是否是当前行棋方的棋子
  // 2. 检查目标位置是否有己方棋子
  // 3. 根据棋子类型检查移动规则
  // 4. 检查是否会导致自己被将军
  // 5. 特殊规则：蹩马腿、塞象眼等
  
  console.warn('规则校验尚未实现，暂时允许所有移动');
  return true;
}

/**
 * 检查指定颜色是否被将军
 * @param board 棋盘状态
 * @param color 'red' | 'black'
 * @returns 是否被将军
 */
export function isInCheck(board: Board, color: 'red' | 'black'): boolean {
  // TODO: 实现将军检测
  return false;
}

/**
 * 检查游戏是否结束
 * @param board 棋盘状态
 * @returns 'playing' | 'red_win' | 'black_win' | 'stalemate'
 */
export function checkGameEnd(board: Board): 'playing' | 'red_win' | 'black_win' | 'stalemate' {
  // TODO: 实现游戏结束检测（将死、困毙等）
  return 'playing';
}

/**
 * 获取指定棋子的所有合法移动
 * @param board 棋盘状态
 * @param row 棋子行
 * @param col 棋子列
 * @returns 合法移动的目标位置数组 [[row, col], ...]
 */
export function getValidMoves(
  board: Board,
  row: number,
  col: number
): Array<[number, number]> {
  // TODO: 实现获取所有合法移动
  const moves: Array<[number, number]> = [];
  
  // 遍历所有可能的位置
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      if (isValidMove(board, row, col, r, c)) {
        moves.push([r, c]);
      }
    }
  }
  
  return moves;
}
