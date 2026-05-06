/**
 * 中国象棋核心类型定义
 * 纯TypeScript，无框架依赖
 */

// 棋子类型（红方正数，黑方负数）
export type PieceType = number;

// 棋盘类型（10行 x 9列）
export type Board = PieceType[][];

// 坐标接口
export interface Position {
  row: number;
  col: number;
}

// 移动记录
export interface MoveRecord {
  from: Position;
  to: Position;
  piece: PieceType;
  captured?: PieceType;
  timestamp: number;
  notation?: string; // 中文着法表示
}

// 游戏状态枚举
export type GameStatus = 'playing' | 'check' | 'checkmate' | 'stalemate';

// 玩家类型
export type Player = 'red' | 'black';

// 游戏配置
export interface GameConfig {
  redUseAI: boolean;
  blackUseAI: boolean;
  redAILevel: number;
  blackAILevel: number;
  timePerMove: number; // 每步用时（秒）
}

// UCI着法格式
export interface UCIMove {
  from: string; // 如 "e2"
  to: string;   // 如 "e4"
  promotion?: string; // 升变（象棋中不需要，但UCI协议保留）
}
