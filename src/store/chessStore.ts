import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { 
  initBoard, 
  PIECES, 
  PIECE_NAMES,
  type Board, 
  type PieceType,
  boardToUCI,
  getPieceColor,
  BOARD_ROWS,
  BOARD_COLS,
  generateChineseNotation
} from '../logic/chess/constants';
import {
  parseSingleMove,
  resolveMovePosition,
  exportGameNotation,
  detectAndParseNotation
} from '../logic/chess/notation';

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

// AI 引擎配置接口
export interface EngineConfig {
  threads: number;
  hash: number;
  calculationMode: 'time' | 'depth';
  movetime: number;
  depth: number;
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
  isStudyMode: boolean;            // 研究模式（导入棋谱后启用，不记录着法）
  redTime: number;  // 红方剩余时间（秒）
  blackTime: number;  // 黑方剩余时间（秒）
  blackPlayer: PlayerConfig;  // 黑方玩家配置
  redPlayer: PlayerConfig;    // 红方玩家配置
  engineConfig: EngineConfig;  // AI引擎配置
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
  const isStudyMode = ref<boolean>(false);  // 研究模式（导入棋谱后启用）
  const redTime = ref(600);  // 默认每方 10 分钟
  const blackTime = ref(600);
  const notationInfo = ref<{ title?: string; event?: string; result?: string; source?: string }>({});
  
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
  
  // AI引擎配置（默认值）
  const engineConfig = ref<EngineConfig>({
    threads: Math.max(1, Math.floor((typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4) / 2),
    hash: 2048,
    calculationMode: 'depth',
    movetime: 1000,
    depth: 20
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
    
    // 研究模式下不记录着法
    if (!isStudyMode.value) {
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
    }
    
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
      return false;
    }
    
    const lastMove = moveHistory.value[currentMoveIndex.value];
    if (!lastMove) return false;
    
    const { from, to, piece, captured } = lastMove;
    
    if (from[0] < 0 || from[1] < 0 || to[0] < 0 || to[1] < 0) {
      console.log('[Store] 无法撤销：着法坐标无效', lastMove);
      return false;
    }
    
    board.value[from[0]][from[1]] = piece;
    board.value[to[0]][to[1]] = captured || PIECES.EMPTY;
    
    currentPlayer.value = currentPlayer.value === 'red' ? 'black' : 'red';
    
    currentMoveIndex.value--;
    
    return true;
  }

  /**
   * 重做（恢复下一步）
   */
  function redoMove(): boolean {
    if (currentMoveIndex.value >= moveHistory.value.length - 1) {
      console.log('[Store] 无法重做：已在最新状态');
      return false;
    }
    
    currentMoveIndex.value++;
    const nextMove = moveHistory.value[currentMoveIndex.value];
    
    if (!nextMove) {
      console.log('[Store] nextMove is null');
      return false;
    }
    
    const { from, to, piece, captured } = nextMove;
    
    if (from[0] < 0 || from[1] < 0 || to[0] < 0 || to[1] < 0) {
      console.log('[Store] 无法重做：着法坐标无效', nextMove);
      currentMoveIndex.value--;
      return false;
    }
    
    console.log(`[Store] 重做着法: ${nextMove.chineseNotation}`);
    console.log(`[Store] 移动棋子: ${PIECE_NAMES[piece] || '?'} 从 [${from[0]}][${from[1]}] 到 [${to[0]}][${to[1]}]`);
    if (captured !== PIECES.EMPTY && captured) {
      console.log(`[Store] 吃掉 ${PIECE_NAMES[captured]} 子, 坐标 [${to[0]}][${to[1]}]`);
    }
    
    board.value[from[0]][from[1]] = PIECES.EMPTY;
    board.value[to[0]][to[1]] = piece;
    
    currentPlayer.value = currentPlayer.value === 'red' ? 'black' : 'red';
    
    console.log('[Store] Redo completed successfully');
    return true;
  }

  /**
   * 设置玩家配置
   */
  function setPlayers(black: PlayerConfig, red: PlayerConfig) {
    blackPlayer.value = { ...black };
    redPlayer.value = { ...red };
  }

  /**
   * 设置引擎配置
   */
  function setEngineConfig(config: EngineConfig) {
    engineConfig.value = { ...config };
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
    isStudyMode.value = false;  // 新游戏时退出研究模式
    redTime.value = 600;
    blackTime.value = 600;
  }

  /**
   * 跳转到指定着法位置
   * @param targetIndex 目标着法索引（从0开始）
   */
  function jumpToMove(targetIndex: number) {
    console.log('[Store] jumpToMove called, targetIndex:', targetIndex, 'currentMoveIndex:', currentMoveIndex.value);
    
    if (targetIndex < 0 || targetIndex >= moveHistory.value.length) {
      console.log('[Store] Invalid targetIndex, returning');
      return;
    }
    
    // 如果目标在当前之前，需要撤销
    while (currentMoveIndex.value > targetIndex) {
      console.log('[Store] Undoing move, currentMoveIndex:', currentMoveIndex.value);
      undoMove();
    }
    
    // 如果目标在当前之后，需要重做
    while (currentMoveIndex.value < targetIndex) {
      console.log('[Store] Redoing move, currentMoveIndex:', currentMoveIndex.value, 'targetIndex:', targetIndex);
      const success = redoMove();
      console.log('[Store] Redo result:', success, 'new currentMoveIndex:', currentMoveIndex.value);
      console.log('[Store] Board at (0,7):', board.value[0][7], 'Board at (0,8):', board.value[0][8]);
    }
    
    console.log('[Store] jumpToMove finished, final currentMoveIndex:', currentMoveIndex.value);
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
   * FEN 格式：position/position/.../position side_to_move - - 0 1
   * position: 数字表示空格数，字母表示棋子（大写=红方，小写=黑方）
   * K=帅, R=车, N=马, C=炮, A=仕, B=相, P=兵
   * side_to_move: w=红方先手, b=黑方先手
   */
  function loadFromFEN(fenString: string): boolean {
    try {
      const parts = fenString.trim().split(' ');
      const position = parts[0];
      const sideToMove = parts[1] || 'w';
      
      const rows = position.split('/');
      if (rows.length !== 10) {
        console.error('FEN 格式错误：行数不是 10');
        return false;
      }
      
      // FEN 字符到棋子类型的映射
      const fenCharToPiece: Record<string, PieceType> = {
        'K': PIECES.R_KING,
        'R': PIECES.R_CAR,
        'N': PIECES.R_HORSE,
        'C': PIECES.R_CANNON,
        'A': PIECES.R_BISHOP,
        'B': PIECES.R_ELEPHANT,
        'P': PIECES.R_PAWN,
        'k': PIECES.B_KING,
        'r': PIECES.B_CAR,
        'n': PIECES.B_HORSE,
        'c': PIECES.B_CANNON,
        'a': PIECES.B_BISHOP,
        'b': PIECES.B_ELEPHANT,
        'p': PIECES.B_PAWN,
      };
      
      const newBoard: Board = Array.from({ length: BOARD_ROWS }, () =>
        Array(BOARD_COLS).fill(PIECES.EMPTY)
      );
      
      for (let row = 0; row < 10; row++) {
        const rowStr = rows[row];
        let col = 0;
        
        for (const char of rowStr) {
          if (col >= BOARD_COLS) {
            console.error(`FEN 格式错误：第 ${row} 行列数超过 9`);
            return false;
          }
          
          if (char >= '1' && char <= '9') {
            // 数字表示空格数
            const emptyCount = parseInt(char);
            col += emptyCount;
          } else {
            // 棋子字符
            const piece = fenCharToPiece[char];
            if (piece === undefined) {
              console.error(`FEN 格式错误：未知棋子字符 '${char}'`);
              return false;
            }
            newBoard[row][col] = piece;
            col++;
          }
        }
        
        if (col !== BOARD_COLS) {
          console.error(`FEN 格式错误：第 ${row} 行列数不是 9（实际 ${col}）`);
          return false;
        }
      }
      
      // 更新棋盘状态
      board.value = newBoard;
      currentPlayer.value = sideToMove === 'w' ? 'red' : 'black';
      
      return true;
    } catch (error) {
      console.error('FEN 解析失败:', error);
      return false;
    }
  }

  /**
   * 导出当前对局为标准棋谱格式
   * @returns 标准棋谱文本字符串
   */
  function exportNotation(): string {
    if (moveHistory.value.length === 0) {
      return '';
    }
    
    // 将 MoveRecord[] 转换为 notation 模块需要的格式
    const moves: Array<{ round: number; red?: string; black?: string }> = [];
    
    moveHistory.value.forEach((record, index) => {
      const roundNum = Math.floor(index / 2) + 1;
      
      if (index % 2 === 0) {
        // 红方着法
        // 提取纯着法部分（去掉"红"前缀）
        const pureNotation = record.chineseNotation.replace(/^红/, '');
        moves.push({ round: roundNum, red: pureNotation });
      } else {
        // 黑方着法，添加到上一个回合
        const pureNotation = record.chineseNotation.replace(/^黑/, '');
        if (moves.length > 0) {
          moves[moves.length - 1].black = pureNotation;
        }
      }
    });
    
    return exportGameNotation(moves);
  }

  /**
   * 导入棋谱（尽力导入模式）
   * @param text 棋谱文本
   * @returns 是否成功解析（即使部分着法执行失败也返回true）
   */
  function importNotation(text: string): boolean {
    try {
      // 智能检测并解析棋谱
      const detected = detectAndParseNotation(text);
      
      if (!detected.isNotation || !detected.parsed) {
        console.error('无法识别为有效棋谱');
        return false;
      }
      
      const notation = detected.parsed;
      
      // 解析元数据
      notationInfo.value = {};
      for (const line of notation.metadata) {
        if (line.startsWith('标题:') || line.startsWith('Title:')) {
          notationInfo.value.title = line.split(':')[1]?.trim();
        } else if (line.startsWith('赛事:') || line.startsWith('Event:')) {
          notationInfo.value.event = line.split(':')[1]?.trim();
        } else if (line.startsWith('结果:') || line.startsWith('Result:')) {
          notationInfo.value.result = line.split(':')[1]?.trim();
        } else if (line.startsWith('来源网站:') || line.startsWith('Source:')) {
          notationInfo.value.source = line.split(':')[1]?.trim();
        }
      }
      
      resetGame();
      
      if (notation.asciiBoard) {
        console.log('[importNotation] 使用ASCII棋盘解析结果');
        board.value = notation.asciiBoard;
        currentPlayer.value = 'red';
      } else if (notation.fen) {
        console.log(`[importNotation] 检测到 FEN 初始局面: ${notation.fen}`);
        const fenLoaded = loadFromFEN(notation.fen);
        if (!fenLoaded) {
          console.error('[importNotation] FEN 加载失败，使用标准开局');
        }
      }
      
      currentMoveIndex.value = -1;
      
      moveHistory.value = [];
      
      for (const move of notation.moves) {
        if (move.red) {
          const parsed = parseSingleMove(move.red, board.value);
          let from: [number, number] = [-1, -1];
          let to: [number, number] = [-1, -1];
          let piece: PieceType = PIECES.EMPTY;
          let captured: PieceType = PIECES.EMPTY;
          
          if (parsed) {
            const position = resolveMovePosition(parsed, board.value, 'red');
            if (position) {
              from = [position[0], position[1]];
              to = [position[2], position[3]];
              piece = board.value[from[0]][from[1]];
              captured = board.value[to[0]][to[1]];
              
              console.log(`[importNotation] 红方着法: ${move.red} - ${PIECE_NAMES[piece] || '?'} [${from[0]}][${from[1]}] → [${to[0]}][${to[1]}]`);
              if (captured !== PIECES.EMPTY && captured) {
                console.log(`[importNotation] 吃掉 ${PIECE_NAMES[captured]} 子, 坐标 [${to[0]}][${to[1]}]`);
              }
              
              board.value[from[0]][from[1]] = PIECES.EMPTY;
              board.value[to[0]][to[1]] = piece;
              
              moveHistory.value.push({
                from,
                to,
                piece,
                captured,
                uci: '',
                chineseNotation: move.red,
                timestamp: Date.now()
              });
            } else {
              console.error(`[importNotation] ❌ 红方着法解析失败: ${move.red} (无法解析位置)`);
            }
          } else {
            console.error(`[importNotation] ❌ 红方着法解析失败: ${move.red} (无法解析着法)`);
          }
        }
        if (move.black) {
          const parsed = parseSingleMove(move.black, board.value);
          let from: [number, number] = [-1, -1];
          let to: [number, number] = [-1, -1];
          let piece: PieceType = PIECES.EMPTY;
          let captured: PieceType = PIECES.EMPTY;
          
          if (parsed) {
            const position = resolveMovePosition(parsed, board.value, 'black');
            if (position) {
              from = [position[0], position[1]];
              to = [position[2], position[3]];
              piece = board.value[from[0]][from[1]];
              captured = board.value[to[0]][to[1]];
              
              console.log(`[importNotation] 黑方着法: ${move.black} - ${PIECE_NAMES[piece] || '?'} [${from[0]}][${from[1]}] → [${to[0]}][${to[1]}]`);
              if (captured !== PIECES.EMPTY && captured) {
                console.log(`[importNotation] 吃掉 ${PIECE_NAMES[captured]} 子, 坐标 [${to[0]}][${to[1]}]`);
              }
              
              board.value[from[0]][from[1]] = PIECES.EMPTY;
              board.value[to[0]][to[1]] = piece;
              
              moveHistory.value.push({
                from,
                to,
                piece,
                captured,
                uci: '',
                chineseNotation: move.black,
                timestamp: Date.now()
              });
            } else {
              console.error(`[importNotation] ❌ 黑方着法解析失败: ${move.black} (无法解析位置)`);
            }
          } else {
            console.error(`[importNotation] ❌ 黑方着法解析失败: ${move.black} (无法解析着法)`);
          }
        }
      }
      
      if (notation.asciiBoard) {
        board.value = notation.asciiBoard;
      } else if (notation.fen) {
        loadFromFEN(notation.fen);
      } else {
        board.value = initBoard();
      }
      currentPlayer.value = 'red';
      
      isStudyMode.value = true;

      console.log(`已启用研究模式，导入 ${moveHistory.value.length} 步着法，当前索引: ${currentMoveIndex.value}`);
      
      return true;  // 只要格式正确就返回成功
    } catch (error) {
      console.error('导入棋谱时发生错误:', error);
      return false;
    }
  }

  /**
   * 获取当前棋谱的元数据（如果有）
   * @returns 元数据数组
   */
  function getNotationMetadata(): string[] {
    return [];
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
    isStudyMode,  // 研究模式状态
    redTime,
    blackTime,
    blackPlayer,
    redPlayer,
    engineConfig,
    notationInfo,
    
    // 计算属性
    fen,
    canUndo,
    canRedo,
    
    // 方法
    selectPiece,
    movePiece,
    undoMove,
    redoMove,
    jumpToMove,
    resetGame,
    generateFEN,
    loadFromFEN,
    setPlayers,
    setEngineConfig,
    getCurrentPlayerAILevel,
    isCurrentPlayerAI,
    exportNotation,
    importNotation,
    getNotationMetadata,
  };
});
