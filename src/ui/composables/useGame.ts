/**
 * Vue组合式函数（薄封装层）
 * 仅负责将纯TS类的状态转换为响应式，不包含业务逻辑
 */

import { ref, onUnmounted } from 'vue';
import { GameState } from '../../core/game/gameState';
import type { Board, Player, GameStatus, MoveRecord } from '../../core/chess/types';

export function useGame() {
  const gameState = new GameState();
  
  // 响应式状态
  const board = ref<Board>(gameState.getBoard());
  const currentPlayer = ref<Player>(gameState.getCurrentPlayer());
  const status = ref<GameStatus>(gameState.getStatus());
  const moveHistory = ref<MoveRecord[]>(gameState.getMoveHistory());
  
  // 订阅状态变化（替代watch）
  const unsubscribe = gameState.subscribe((state) => {
    board.value = state.getBoard();
    currentPlayer.value = state.getCurrentPlayer();
    status.value = state.getStatus();
    moveHistory.value = state.getMoveHistory();
  });
  
  onUnmounted(() => {
    unsubscribe();
  });
  
  // 暴露方法（直接透传纯TS类的方法）
  return {
    // 响应式状态
    board,
    currentPlayer,
    status,
    moveHistory,
    
    // 方法
    movePiece: (fromRow: number, fromCol: number, toRow: number, toCol: number) => 
      gameState.movePiece(fromRow, fromCol, toRow, toCol),
    undo: () => gameState.undo(),
    reset: () => gameState.reset(),
    generateFEN: () => gameState.generateFEN(),
    loadFromFEN: (fen: string) => gameState.loadFromFEN(fen),
    
    // 原始实例（供高级用法）
    gameState,
  };
}
