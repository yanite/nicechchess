/**
 * 游戏状态适配器（过渡层）
 * 桥接旧的 Pinia store 和新的 GameState
 * 用于渐进式迁移
 */

import { useChessStore } from '../../store/chessStore';
import type { GameStatus } from '../../core/chess/types';

export function useGameAdapter() {
  const chessStore = useChessStore();
  
  // 转换函数：将 store 的数据格式转换为新类型
  function convertStatus(): GameStatus {
    if (chessStore.gameStatus === 'finished') {
      return chessStore.winner ? 'checkmate' : 'stalemate';
    }
    return 'playing';
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
  
  function jumpToMove(targetIndex: number): void {
    chessStore.jumpToMove(targetIndex);
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
    jumpToMove,
    
    // 原始store（供高级用法）
    chessStore,
  };
}
