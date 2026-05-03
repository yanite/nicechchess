import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { 
  initBoard, 
  PIECES, 
  type Board, 
  type PieceType,
  boardToUCI,
  getPieceColor,
  BOARD_ROWS,
  BOARD_COLS,
  generateChineseNotation
} from '../logic/chess/constants';

// 着法记录接口
export interface MoveRecord {
  from: [number, number];  // 起始位置 [row, col]
  to: [number, number];    // 目标位置 [row, col]
  piece: PieceType;        // 移动的棋子
  captured?: PieceType;    // 被吃掉的棋子（如果有）
  uci: string;             // UCI 格式着法
  chineseNotation: string; // 中文着法，如 "红俥进二"
  timestamp: number;       // 时间戳
}

// 棋局状态接口
export interface GameState {
  board: Board;
  currentPlayer: 'red' | 'black';  // 当前行棋方
  moveHistory: MoveRecord[];       // 着法历史
  selectedPiece: [number, number] | null;  // 当前选中的棋子
  gameStatus: 'playing' | 'paused' | 'finished';  // 游戏状态
  winner: 'red' | 'black' | null;  // 获胜方
  redTime: number;  // 红方剩余时间（秒）
  blackTime: number;  // 黑方剩余时间（秒）
}

export const useChessStore = defineStore('chess', () => {
  // 状态
  const board = ref<Board>(initBoard());
  const currentPlayer = ref<'red' | 'black'>('red');
  const moveHistory = ref<MoveRecord[]>([]);
  const selectedPiece = ref<[number, number] | null>(null);
  const gameStatus = ref<'playing' | 'paused' | 'finished'>('playing');
  const winner = ref<'red' | 'black' | null>(null);
  const redTime = ref(600);  // 默认每方 10 分钟
  const blackTime = ref(600);

  // 计算属性：获取 FEN 串
  const fen = computed(() => {
    return generateFEN();
  });

  // 计算属性：是否可以悔棋
  const canUndo = computed(() => {
    return moveHistory.value.length > 0;
  });

  /**
   * 选择棋子
   */
  function selectPiece(row: number, col: number) {
    // 如果传入无效坐标，取消选择
    if (row < 0 || row >= BOARD_ROWS || col < 0 || col >= BOARD_COLS) {
      selectedPiece.value = null;
      return;
    }
    
    const piece = board.value[row][col];
    
    // 只能选择当前行棋方的棋子
    if (piece === PIECES.EMPTY) {
      selectedPiece.value = null;
      return;
    }
    
    const pieceColor = getPieceColor(piece);
    if (pieceColor !== currentPlayer.value) {
      selectedPiece.value = null;
      return;
    }
    
    selectedPiece.value = [row, col];
  }

  /**
   * 移动棋子（基础版本，暂不进行规则校验）
   */
  function movePiece(fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
    // TODO: 添加规则校验
    const piece = board.value[fromRow][fromCol];
    const captured = board.value[toRow][toCol];
    
    // 执行移动
    board.value[toRow][toCol] = piece;
    board.value[fromRow][fromCol] = PIECES.EMPTY;
    
    // 记录着法
    const uci = `${boardToUCI(fromRow, fromCol)}${boardToUCI(toRow, toCol)}`;
    const chineseNotation = generateChineseNotation(board.value, fromRow, fromCol, toRow, toCol, piece);
    const moveRecord: MoveRecord = {
      from: [fromRow, fromCol],
      to: [toRow, toCol],
      piece,
      captured: captured !== PIECES.EMPTY ? captured : undefined,
      uci,
      chineseNotation,
      timestamp: Date.now(),
    };
    moveHistory.value.push(moveRecord);
    
    // 切换行棋方
    currentPlayer.value = currentPlayer.value === 'red' ? 'black' : 'red';
    
    // 清除选中状态
    selectedPiece.value = null;
    
    return true;
  }

  /**
   * 悔棋
   */
  function undoMove(): boolean {
    if (moveHistory.value.length === 0) {
      return false;
    }
    
    const lastMove = moveHistory.value.pop();
    if (!lastMove) return false;
    
    // 恢复棋盘状态
    const { from, to, piece, captured } = lastMove;
    board.value[from[0]][from[1]] = piece;
    board.value[to[0]][to[1]] = captured || PIECES.EMPTY;
    
    // 切换回上一个行棋方
    currentPlayer.value = currentPlayer.value === 'red' ? 'black' : 'red';
    
    return true;
  }

  /**
   * 重置游戏
   */
  function resetGame() {
    board.value = initBoard();
    currentPlayer.value = 'red';
    moveHistory.value = [];
    selectedPiece.value = null;
    gameStatus.value = 'playing';
    winner.value = null;
    redTime.value = 600;
    blackTime.value = 600;
  }

  /**
   * 生成 FEN 串
   */
  function generateFEN(): string {
    let fen = '';
    
    for (let row = 9; row >= 0; row--) {
      let emptyCount = 0;
      
      for (let col = 0; col < 9; col++) {
        const piece = board.value[row][col];
        
        if (piece === PIECES.EMPTY) {
          emptyCount++;
        } else {
          if (emptyCount > 0) {
            fen += emptyCount;
            emptyCount = 0;
          }
          
          // 根据棋子类型添加字符
          const pieceChar = getPieceChar(piece);
          fen += pieceChar;
        }
      }
      
      if (emptyCount > 0) {
        fen += emptyCount;
      }
      
      if (row > 0) {
        fen += '/';
      }
    }
    
    // 添加当前行棋方
    // 测试：Pikafish 可能使用国际象棋标准的 w/b 而非 r/b
    fen += ` ${currentPlayer.value === 'red' ? 'w' : 'b'}`;
    
    // TODO: 添加其他 FEN 字段（易位、吃过路兵等）
    fen += ' - - 0 1';
    
    return fen;
  }

  /**
   * 获取棋子字符（用于 FEN）
   */
  function getPieceChar(piece: PieceType): string {
    const pieceChars: Record<number, string> = {
      // 红方棋子（大写）
      [PIECES.R_KING]: 'K',      // 帅/将
      [PIECES.R_CAR]: 'R',       // 车
      [PIECES.R_HORSE]: 'N',     // 马（Knight）
      [PIECES.R_CANNON]: 'C',    // 炮
      [PIECES.R_BISHOP]: 'A',    // 士/仕（Advisor）
      [PIECES.R_ELEPHANT]: 'B',  // 相/象（Bishop）
      [PIECES.R_PAWN]: 'P',      // 兵
      // 黑方棋子（小写）
      [PIECES.B_KING]: 'k',      // 将
      [PIECES.B_CAR]: 'r',       // 车
      [PIECES.B_HORSE]: 'n',     // 马（Knight）
      [PIECES.B_CANNON]: 'c',    // 炮
      [PIECES.B_BISHOP]: 'a',    // 士
      [PIECES.B_ELEPHANT]: 'b',  // 象（Bishop）
      [PIECES.B_PAWN]: 'p',      // 卒
    };
    
    return pieceChars[piece] || '';
  }

  /**
   * 从 FEN 串加载棋盘
   */
  function loadFromFEN(fenString: string) {
    // TODO: 实现 FEN 解析
    console.log('Loading from FEN:', fenString);
  }

  return {
    // 状态
    board,
    currentPlayer,
    moveHistory,
    selectedPiece,
    gameStatus,
    winner,
    redTime,
    blackTime,
    
    // 计算属性
    fen,
    canUndo,
    
    // 方法
    selectPiece,
    movePiece,
    undoMove,
    resetGame,
    generateFEN,
    loadFromFEN,
  };
});
