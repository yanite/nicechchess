/**
 * 游戏状态管理类（纯TypeScript，无Vue依赖）
 * 使用观察者模式通知状态变化，替代Vue的响应式系统
 */

import type { Board, MoveRecord, Player, GameStatus, GameConfig } from '../chess/types';
import { initBoard } from '../chess/constants';
import { isValidMove, isInCheck } from '../chess/rules';

export class GameState {
  private board: Board;
  private currentPlayer: Player;
  private moveHistory: MoveRecord[];
  private status: GameStatus;
  private config: GameConfig;
  private observers: Array<(state: GameState) => void> = [];
  
  constructor(config?: Partial<GameConfig>) {
    this.board = initBoard();
    this.currentPlayer = 'red';
    this.moveHistory = [];
    this.status = 'playing';
    this.config = {
      redUseAI: false,
      blackUseAI: true,
      redAILevel: 15,
      blackAILevel: 15,
      timePerMove: 30,
      ...config,
    };
  }
  
  /**
   * 移动棋子
   * @returns 是否成功
   */
  movePiece(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    // 验证移动
    if (!isValidMove(this.board, fromRow, fromCol, toRow, toCol)) {
      return false;
    }
    
    // 执行移动
    const piece = this.board[fromRow][fromCol];
    const captured = this.board[toRow][toCol];
    this.board[toRow][toCol] = piece;
    this.board[fromRow][fromCol] = 0;
    
    // 记录历史
    this.moveHistory.push({
      from: { row: fromRow, col: fromCol },
      to: { row: toRow, col: toCol },
      piece,
      captured: captured !== 0 ? captured : undefined,
      timestamp: Date.now(),
    });
    
    // 检查将军/绝杀
    const opponent = this.currentPlayer === 'red' ? 'black' : 'red';
    if (isInCheck(this.board, opponent)) {
      this.status = 'check';
      // TODO: 检查是否绝杀
    } else {
      this.status = 'playing';
    }
    
    // 切换玩家
    this.currentPlayer = opponent;
    
    // 通知观察者
    this.notifyObservers();
    
    return true;
  }
  
  /**
   * 悔棋
   */
  undo(): boolean {
    if (this.moveHistory.length === 0) return false;
    
    const lastMove = this.moveHistory.pop();
    if (!lastMove) return false;
    
    // 恢复棋盘
    this.board[lastMove.from.row][lastMove.from.col] = lastMove.piece;
    this.board[lastMove.to.row][lastMove.to.col] = lastMove.captured || 0;
    
    // 切换回上一个玩家
    this.currentPlayer = this.currentPlayer === 'red' ? 'black' : 'red';
    this.status = 'playing';
    
    this.notifyObservers();
    return true;
  }
  
  /**
   * 重置游戏
   */
  reset(): void {
    this.board = initBoard();
    this.currentPlayer = 'red';
    this.moveHistory = [];
    this.status = 'playing';
    this.notifyObservers();
  }
  
  /**
   * 订阅状态变化（替代Vue watch）
   * @param callback 状态变化时的回调函数
   * @returns 取消订阅的函数
   */
  subscribe(callback: (state: GameState) => void): () => void {
    this.observers.push(callback);
    return () => {
      const index = this.observers.indexOf(callback);
      if (index > -1) {
        this.observers.splice(index, 1);
      }
    };
  }
  
  /**
   * 通知所有观察者
   */
  private notifyObservers(): void {
    this.observers.forEach(cb => cb(this));
  }
  
  // Getter方法（提供只读访问）
  getBoard(): Board {
    return this.board.map(row => [...row]); // 返回副本
  }
  
  getCurrentPlayer(): Player {
    return this.currentPlayer;
  }
  
  getMoveHistory(): MoveRecord[] {
    return [...this.moveHistory]; // 返回副本
  }
  
  getStatus(): GameStatus {
    return this.status;
  }
  
  getConfig(): GameConfig {
    return { ...this.config }; // 返回副本
  }
  
  generateFEN(): string {
    // TODO: 实现FEN生成
    return '';
  }
  
  loadFromFEN(fen: string): void {
    // TODO: 实现FEN解析
    this.notifyObservers();
  }
}
