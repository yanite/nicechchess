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

// 玩家配置接口
export interface PlayerConfig {
  name: string;
  useAI: boolean;
  aiLevel: number;
}

// 棋局状态接口
export interface GameState {
  board: Board;
  currentPlayer: 'red' | 'black';  // 当前行棋方
  moveHistory: MoveRecord[];       // 着法历史
  currentMoveIndex: number;        // 当前着法索引（用于redo支持）
  selectedPiece: [number, number] | null;  // 当前选中的棋子
  gameStatus: 'playing' | 'paused' | 'finished';  // 游戏状态
  winner: 'red' | 'black' | null;  // 获胜方
  redTime: number;  // 红方剩余时间（秒）
  blackTime: number;  // 黑方剩余时间（秒）
  blackPlayer: PlayerConfig;  // 黑方玩家配置
  redPlayer: PlayerConfig;    // 红方玩家配置
}

export const useChessStore = defineStore('chess', () => {
  // 状态
  const board = ref<Board>(initBoard());
  const currentPlayer = ref<'red' | 'black'>('red');
  const moveHistory = ref<MoveRecord[]>([]);
  const currentMoveIndex = ref<number>(-1);  // -1表示初始状态
  const selectedPiece = ref<[number, number] | null>(null);
  const gameStatus = ref<'playing' | 'paused' | 'finished'>('playing');
  const winner = ref<'red' | 'black' | null>(null);
  const redTime = ref(600);  // 默认每方 10 分钟
  const blackTime = ref(600);
  
  // 玩家配置（默认值）
  const blackPlayer = ref<PlayerConfig>({
    name: 'Play1',
    useAI: true,
    aiLevel: 15
  });
  const redPlayer = ref<PlayerConfig>({
    name: 'Play2',
    useAI: false,
    aiLevel: 15
  });

  // 计算属性：获取 FEN 串
  const fen = computed(() => {
    return generateFEN();
  });

  // 计算属性：是否可以悔棋
  const canUndo = computed(() => {
    return currentMoveIndex.value >= 0;
  });

  // 计算属性：是否可以重做
  const canRedo = computed(() => {
    return currentMoveIndex.value < moveHistory.value.length - 1;
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
    
    // 如果在历史记录中间位置移动新棋，删除后续所有记录
    if (currentMoveIndex.value < moveHistory.value.length - 1) {
      moveHistory.value = moveHistory.value.slice(0, currentMoveIndex.value + 1);
    }
    
    moveHistory.value.push(moveRecord);
    currentMoveIndex.value = moveHistory.value.length - 1;
    
    // 切换行棋方
    currentPlayer.value = currentPlayer.value === 'red' ? 'black' : 'red';
    
    // 清除选中状态
    selectedPiece.value = null;
    
    return true;
  }

  /**
   * 悔棋（撤销上一步）
   */
  function undoMove(): boolean {
    if (currentMoveIndex.value < 0) {
      console.log('无法悔棋：已回到初始状态');
      return false;
    }
    
    const lastMove = moveHistory.value[currentMoveIndex.value];
    if (!lastMove) return false;
    
    // 恢复棋盘状态
    const { from, to, piece, captured } = lastMove;
    board.value[from[0]][from[1]] = piece;
    board.value[to[0]][to[1]] = captured || PIECES.EMPTY;
    
    // 切换回上一个行棋方
    currentPlayer.value = currentPlayer.value === 'red' ? 'black' : 'red';
    
    // 移动索引减1
    currentMoveIndex.value--;
    
    console.log('悔棋成功，当前索引:', currentMoveIndex.value);
    return true;
  }

  /**
   * 重做（恢复下一步）
   */
  function redoMove(): boolean {
    if (currentMoveIndex.value >= moveHistory.value.length - 1) {
      console.log('无法重做：已在最新状态');
      return false;
    }
    
    // 移动到下一个索引
    currentMoveIndex.value++;
    const nextMove = moveHistory.value[currentMoveIndex.value];
    
    if (!nextMove) return false;
    
    // 应用着法
    const { from, to, piece, captured } = nextMove;
    board.value[from[0]][from[1]] = PIECES.EMPTY;
    board.value[to[0]][to[1]] = piece;
    
    // 切换行棋方
    currentPlayer.value = currentPlayer.value === 'red' ? 'black' : 'red';
    
    console.log('重做成功，当前索引:', currentMoveIndex.value);
    return true;
  }

  /**
   * 设置玩家配置
   */
  function setPlayers(black: PlayerConfig, red: PlayerConfig) {
    blackPlayer.value = { ...black };
    redPlayer.value = { ...red };
    console.log('玩家配置已更新:', { black, red });
  }

  /**
   * 获取当前玩家的 AI 等级
   */
  function getCurrentPlayerAILevel(): number | undefined {
    const player = currentPlayer.value === 'black' ? blackPlayer.value : redPlayer.value;
    return player.useAI ? player.aiLevel : undefined;
  }

  /**
   * 检查当前玩家是否使用 AI
   */
  function isCurrentPlayerAI(): boolean {
    const player = currentPlayer.value === 'black' ? blackPlayer.value : redPlayer.value;
    return player.useAI;
  }

  /**
   * 重置游戏
   */
  function resetGame() {
    board.value = initBoard();
    currentPlayer.value = 'red';
    moveHistory.value = [];
    currentMoveIndex.value = -1;  // 重置索引
    selectedPiece.value = null;
    gameStatus.value = 'playing';
    winner.value = null;
    redTime.value = 600;
    blackTime.value = 600;
  }

  /**
   * 生成 FEN 串
   * 
   * 注意：UCI 协议要求 FEN 从黑方底线（第9行）开始，到红方底线（第0行）结束
   * 内部坐标系：board[0] = 黑方底线，board[9] = 红方底线
   * 所以应该从 row=0 遍历到 row=9
   */
  function generateFEN(): string {
    let fen = '';
    
    // 从黑方底线（row=0）开始，到红方底线（row=9）结束
    for (let row = 0; row < 10; row++) {
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
      
      if (row < 9) {
        fen += '/';
      }
    }
    
    // 添加当前行棋方
    // 使用国际象棋标准：w=红方(先手), b=黑方(后手)
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
    currentMoveIndex,
    selectedPiece,
    gameStatus,
    winner,
    redTime,
    blackTime,
    blackPlayer,
    redPlayer,
    
    // 计算属性
    fen,
    canUndo,
    canRedo,
    
    // 方法
    selectPiece,
    movePiece,
    undoMove,
    redoMove,
    resetGame,
    generateFEN,
    loadFromFEN,
    setPlayers,
    getCurrentPlayerAILevel,
    isCurrentPlayerAI,
  };
});
