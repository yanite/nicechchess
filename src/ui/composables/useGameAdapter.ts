/**
 * 游戏状态适配器（过渡层）
 * 桥接旧的 Pinia store 和新的 GameState
 * 用于渐进式迁移
 */

import { useChessStore } from '../../store/chessStore';
import type { Board, Player, GameStatus, MoveRecord } from '../../core/chess/types';
import { getPieceColor } from '../../core/chess/constants';

export function useGameAdapter() {
  const chessStore = useChessStore();
  
  // 转换函数：将 store 的数据格式转换为新类型
  function convertBoard(): Board {
    return chessStore.board.map(row => [...row]);
  }
  
  function convertCurrentPlayer(): Player {
    return chessStore.currentPlayer;
  }
  
  function convertStatus(): GameStatus {
    if (chessStore.gameStatus === 'finished') {
      return chessStore.winner ? 'checkmate' : 'stalemate';
    }
    return 'playing';
  }
  
  function convertMoveHistory(): MoveRecord[] {
    return chessStore.moveHistory.map(record => ({
      from: { row: record.from[0], col: record.from[1] },
      to: { row: record.to[0], col: record.to[1] },
      piece: record.piece,
      captured: record.captured,
      timestamp: record.timestamp,
      notation: record.chineseNotation,
    }));
  }
  
  // 方法适配
  function movePiece(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    return chessStore.movePiece(fromRow, fromCol, toRow, toCol);
  }
  
  function undo(): boolean {
    chessStore.undoMove();
    return true;
  }
  
  function redo(): boolean {
    chessStore.redoMove();
    return true;
  }
  
  function reset(): void {
    chessStore.resetGame();
  }
  
  function isCurrentPlayerAI(): boolean {
    return chessStore.isCurrentPlayerAI();
  }
  
  function getIsStudyMode(): boolean {
    return chessStore.isStudyMode;
  }
  
  return {
    // 响应式数据（直接从store获取）
    board: chessStore.board,
    currentPlayer: chessStore.currentPlayer,
    status: convertStatus(),
    moveHistory: chessStore.moveHistory,
    
    // 方法
    movePiece,
    undo,
    redo,
    reset,
    isCurrentPlayerAI,
    getIsStudyMode,
    
    // 原始store（供高级用法）
    chessStore,
  };
}
