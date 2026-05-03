import { type Board, type PieceType, PIECES, BOARD_ROWS, BOARD_COLS, PIECE_NAMES } from './constants';

/**
 * 获取棋子的颜色
 * @param piece 棋子类型
 * @returns 'red' | 'black' | null
 */
function getPieceColor(piece: PieceType): 'red' | 'black' | null {
  if (piece === PIECES.EMPTY) return null;
  // 假设红方为正数，黑方为负数，具体取决于 constants 的定义
  // 通常实现中：红车=1, 黑车=-1 等。如果 constants 定义不同，需调整此处逻辑。
  // 参考代码暗示: piece > 0 ? 'red' : 'black'
  return piece > 0 ? 'red' : 'black';
}

/**
 * 检查位置是否在棋盘范围内
 */
function isInBoard(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS;
}

/**
 * 检查位置是否在九宫格内
 * @param row 行
 * @param col  列
 * @param color 颜色
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
 * 检查两点之间是否有阻挡（不包括起点和终点）
 */
function hasObstacle(
  board: Board,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): boolean {
  if (fromRow === toRow) {
    // 横向移动
    const minCol = Math.min(fromCol, toCol);
    const maxCol = Math.max(fromCol, toCol);
    for (let c = minCol + 1; c < maxCol; c++) {
      if (board[fromRow][c] !== PIECES.EMPTY) {
        return true;
      }
    }
  } else if (fromCol === toCol) {
    // 纵向移动
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
 * 计算两点之间的棋子数量（不包括起点和终点）
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
    // 横向
    const minCol = Math.min(fromCol, toCol);
    const maxCol = Math.max(fromCol, toCol);
    for (let c = minCol + 1; c < maxCol; c++) {
      if (board[fromRow][c] !== PIECES.EMPTY) {
        count++;
      }
    }
  } else if (fromCol === toCol) {
    // 纵向
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
 * 检查马是否被蹩腿
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

  // 马走日字，蹩腿位置在移动方向的第一步
  if (Math.abs(dRow) === 2 && Math.abs(dCol) === 1) {
    // 竖直方向移动2格，检查中间位置
    const checkRow = fromRow + (dRow > 0 ? 1 : -1);
    return board[checkRow][fromCol] !== PIECES.EMPTY;
  } else if (Math.abs(dRow) === 1 && Math.abs(dCol) === 2) {
    // 水平方向移动2格，检查中间位置
    const checkCol = fromCol + (dCol > 0 ? 1 : -1);
    return board[fromRow][checkCol] !== PIECES.EMPTY;
  }
  return false;
}

/**
 * 检查相/象是否被塞象眼
 */
function isElephantBlocked(
  board: Board,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number
): boolean {
  // 象眼在田字的中心
  const eyeRow = (fromRow + toRow) / 2;
  const eyeCol = (fromCol + toCol) / 2;
  // 确保坐标是整数且有效，虽然逻辑上走田字中心一定是整数
  if (!Number.isInteger(eyeRow) || !Number.isInteger(eyeCol)) return true; 
  return board[eyeRow][eyeCol] !== PIECES.EMPTY;
}

/**
 * 第一层：基础移动规则验证
 * 验证每个棋子的基本移动方式是否合法
 */
function validateBasicMove(
  board: Board,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  piece: PieceType
): { valid: boolean; reason?: string } {
  const color = getPieceColor(piece);
  if (!color) {
    return { valid: false, reason: '空棋子不能移动' };
  }

  const dRow = toRow - fromRow;
  const dCol = toCol - fromCol;
  const absRow = Math.abs(dRow);
  const absCol = Math.abs(dCol);

  // 使用绝对值匹配棋子类型，因为红黑棋子数值可能正负不同
  switch (Math.abs(piece)) {
    case Math.abs(PIECES.R_KING): // 帅/将
      // 只能在九宫格内移动，每次一格（横或竖）
      if (!isInPalace(toRow, toCol, color)) {
        return { valid: false, reason: '将/帅不能离开九宫格' };
      }
      if ((absRow === 1 && absCol === 0) || (absRow === 0 && absCol === 1)) {
        return { valid: true };
      }
      return { valid: false, reason: '将/帅只能横或竖移动一格' };

    case Math.abs(PIECES.R_CAR): // 车
      // 直线移动，不能有阻挡
      if (fromRow !== toRow && fromCol !== toCol) {
        return { valid: false, reason: '车只能直线移动' };
      }
      // 检查路径上是否有阻挡
      if (hasObstacle(board, fromRow, fromCol, toRow, toCol)) {
        return { valid: false, reason: '车的路径上有阻挡' };
      }
      return { valid: true };

    case Math.abs(PIECES.R_HORSE): // 马
      // 日字形移动
      if (!((absRow === 2 && absCol === 1) || (absRow === 1 && absCol === 2))) {
        return { valid: false, reason: '马必须走日字' };
      }
      // 检查蹩马腿
      if (isHorseBlocked(board, fromRow, fromCol, toRow, toCol)) {
        return { valid: false, reason: '马被蹩腿' };
      }
      return { valid: true };

    case Math.abs(PIECES.R_CANNON): // 炮
      // 直线移动
      if (fromRow !== toRow && fromCol !== toCol) {
        return { valid: false, reason: '炮只能直线移动' };
      }
      // 检查路径上的棋子数量
      const pieceCount = countPiecesBetween(board, fromRow, fromCol, toRow, toCol);
      const targetPiece = board[toRow][toCol];
      
      if (targetPiece === PIECES.EMPTY) {
        // 不吃子时，路径上不能有棋子
        if (pieceCount !== 0) {
          return { valid: false, reason: '炮不吃子时路径上不能有棋子' };
        }
      } else {
        // 吃子时，路径上必须恰好有一个棋子（炮架）
        if (pieceCount !== 1) {
          return { valid: false, reason: '炮吃子时必须隔一个棋子' };
        }
      }
      return { valid: true };

    case Math.abs(PIECES.R_BISHOP): // 仕/士
      // 斜线移动一格，限制在九宫格内
      if (!isInPalace(toRow, toCol, color)) {
        return { valid: false, reason: '仕/士不能离开九宫格' };
      }
      if (absRow === 1 && absCol === 1) {
        return { valid: true };
      }
      return { valid: false, reason: '仕/士只能斜线移动一格' };

    case Math.abs(PIECES.R_ELEPHANT): // 相/象
      // 田字移动（2,2），不能过河
      if (absRow !== 2 || absCol !== 2) {
        return { valid: false, reason: '相/象必须走田字' };
      }
      // 检查是否过河
      if (color === 'red' && toRow < 5) {
        return { valid: false, reason: '红相不能过河' };
      }
      if (color === 'black' && toRow > 4) {
        return { valid: false, reason: '黑象不能过河' };
      }
      // 检查塞象眼
      if (isElephantBlocked(board, fromRow, fromCol, toRow, toCol)) {
        return { valid: false, reason: '相/象被塞象眼' };
      }
      return { valid: true };

    case Math.abs(PIECES.R_PAWN): // 兵/卒
      // 未过河只能前进，过河后可以横移
      if (color === 'red') {
        // 红兵向上移动（row减小）
        if (fromRow > 4) {
          // 未过河，只能前进
          if (dRow === -1 && dCol === 0) {
            return { valid: true };
          }
          return { valid: false, reason: '红兵未过河只能前进' };
        } else {
          // 已过河，可以前进或横移
          if ((dRow === -1 && dCol === 0) || (dRow === 0 && absCol === 1)) {
            return { valid: true };
          }
          return { valid: false, reason: '红兵过河后只能前进或横移一格' };
        }
      } else {
        // 黑卒向下移动（row增加）
        if (fromRow < 5) {
          // 未过河，只能前进
          if (dRow === 1 && dCol === 0) {
            return { valid: true };
          }
          return { valid: false, reason: '黑卒未过河只能前进' };
        } else {
          // 已过河，可以前进或横移
          if ((dRow === 1 && dCol === 0) || (dRow === 0 && absCol === 1)) {
            return { valid: true };
          }
          return { valid: false, reason: '黑卒过河后只能前进或横移一格' };
        }
      }

    default:
      return { valid: false, reason: '未知的棋子类型' };
  }
}

/**
 * 第二层：吃子规则验证
 * 验证吃子是否合法
 */
function validateCapture(
  board: Board,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  piece: PieceType
): { valid: boolean; reason?: string } {
  const targetPiece = board[toRow][toCol];
  
  // 如果目标位置为空，不需要验证吃子规则
  if (targetPiece === PIECES.EMPTY) {
    return { valid: true };
  }

  const moverColor = getPieceColor(piece);
  const targetColor = getPieceColor(targetPiece);

  // 不能吃自己的棋子
  if (moverColor === targetColor) {
    return { valid: false, reason: '不能吃自己的棋子' };
  }

  return { valid: true };
}

/**
 * 检查指定颜色是否有合法的着法可以解除将军状态
 * @param board 棋盘状态
 * @param color 颜色
 * @returns 是否有合法的解将着法
 */
function hasLegalEscapeMoves(board: Board, color: 'red' | 'black'): boolean {
  // 遍历该颜色的所有棋子
  for (let fromRow = 0; fromRow < BOARD_ROWS; fromRow++) {
    for (let fromCol = 0; fromCol < BOARD_COLS; fromCol++) {
      const piece = board[fromRow][fromCol];
      
      // 跳过空位和对方的棋子
      if (piece === PIECES.EMPTY || getPieceColor(piece) !== color) {
        continue;
      }
      
      // 尝试所有可能的目标位置
      for (let toRow = 0; toRow < BOARD_ROWS; toRow++) {
        for (let toCol = 0; toCol < BOARD_COLS; toCol++) {
          // 跳过同一位置
          if (fromRow === toRow && fromCol === toCol) {
            continue;
          }
          
          // 检查这个移动是否合法（基础规则 + 吃子规则）
          // 注意：这里不需要递归检查高级规则（如是否导致对方无解），
          // 只需要检查移动后己方是否不再被将军即可。
          const basicResult = validateBasicMove(board, fromRow, fromCol, toRow, toCol, piece);
          if (!basicResult.valid) {
            continue;
          }
          
          const captureResult = validateCapture(board, fromRow, fromCol, toRow, toCol, piece);
          if (!captureResult.valid) {
            continue;
          }
          
          // 模拟这个移动
          const tempBoard = board.map(row => [...row]);
          tempBoard[toRow][toCol] = piece;
          tempBoard[fromRow][fromCol] = PIECES.EMPTY;
          
          // 检查移动后是否还被将军
          // 同时也需要检查是否违反“对将”规则，因为解将的移动也不能导致对将
          if (!isInCheck(tempBoard, color) && !areKingsFacing(tempBoard)) {
            // 找到一个可以解将的移动
            return true;
          }
        }
      }
    }
  }
  
  // 没有找到任何可以解将的移动
  return false;
}

/**
 * 第二层扩展：叫将规则验证
 * 检查移动后是否形成对方无法解将的局面
 * 
 * 根据需求：如果叫将后对方任何行棋都不能解将，则当前走棋不成立
 */
function validateCheckRule(
  board: Board,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  piece: PieceType
): { valid: boolean; reason?: string } {
  const moverColor = getPieceColor(piece);
  if (!moverColor) {
    return { valid: false, reason: '无效的棋子' };
  }

  const opponentColor = moverColor === 'red' ? 'black' : 'red';

  // 模拟移动后的棋盘状态
  const tempBoard = board.map(row => [...row]);
  tempBoard[toRow][toCol] = piece;
  tempBoard[fromRow][fromCol] = PIECES.EMPTY;

  // 检查移动后是否对对方叫将
  const isGivingCheck = isInCheck(tempBoard, opponentColor);
  
  if (isGivingCheck) {
    console.log(`⚠️  此移动对${opponentColor === 'red' ? '红方' : '黑方'}叫将`);
    
    // 检查对方是否有任何合法的着法可以解将
    const hasEscapeMove = hasLegalEscapeMoves(tempBoard, opponentColor);
    
    if (!hasEscapeMove) {
      // 对方无法解将，形成绝杀
      // 根据需求：这种情况走棋不能成立
      return { 
        valid: false, 
        reason: `移动后对${opponentColor === 'red' ? '红方' : '黑方'}叫将，且对方无法解将（形成绝杀）` 
      };
    }
    
    console.log(`✅ 对方有解将的着法，叫将合法`);
  }

  return { valid: true };
}

/**
 * 检查两将是否面对面
 */
function areKingsFacing(board: Board): boolean {
  let redKingRow = -1, redKingCol = -1;
  let blackKingRow = -1, blackKingCol = -1;

  // 找到两个将/帅的位置
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

  // 如果找不到任意一个将，无法判断对将（通常不会发生除非游戏结束）
  if (redKingRow === -1 || blackKingRow === -1) {
    return false;
  }

  // 如果不在同一列，不可能对将
  if (redKingCol !== blackKingCol) {
    return false;
  }

  // 检查两将之间是否有棋子
  const minRow = Math.min(redKingRow, blackKingRow);
  const maxRow = Math.max(redKingRow, blackKingRow);
  
  for (let r = minRow + 1; r < maxRow; r++) {
    if (board[r][redKingCol] !== PIECES.EMPTY) {
      return false; // 有阻挡，不对将
    }
  }

  return true; // 没有阻挡，对将了
}

/**
 * 第三层：高级规则验证
 * 包括：不能对将、不能送将、长走检测
 */
function validateAdvancedRules(
  board: Board,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  piece: PieceType
): { valid: boolean; reason?: string } {
  const color = getPieceColor(piece);
  if (!color) {
    return { valid: false, reason: '无效的棋子' };
  }

  // 模拟移动后的棋盘状态
  const tempBoard = board.map(row => [...row]);
  tempBoard[toRow][toCol] = piece;
  tempBoard[fromRow][fromCol] = PIECES.EMPTY;

  // 检查是否会导致自己被将军
  if (isInCheck(tempBoard, color)) {
    return { valid: false, reason: '移动后会被将军（不能送将）' };
  }

  // 检查是否对将（两将面对面）
  if (areKingsFacing(tempBoard)) {
    return { valid: false, reason: '两将不能直接面对面' };
  }

  // TODO: 长走检测（长将、长捉等）- 需要历史记录支持
  // 这里先简化处理，暂不检测

  return { valid: true };
}

/**
 * 验证移动是否合法（完整验证）
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
  // 基本检查：不能移动到同一个位置
  if (fromRow === toRow && fromCol === toCol) {
    console.log('❌ 规则验证失败：不能移动到同一位置');
    return false;
  }

  // 检查起始位置是否有棋子
  const piece = board[fromRow][fromCol];
  if (piece === PIECES.EMPTY) {
    console.log('❌ 规则验证失败：起始位置没有棋子');
    return false;
  }

  // 检查目标位置是否在棋盘内
  if (!isInBoard(toRow, toCol)) {
    console.log('❌ 规则验证失败：目标位置超出棋盘范围');
    return false;
  }

  const pieceName = PIECE_NAMES[piece] || '?';
  console.log(`\n🔍 开始验证移动：${pieceName} (${fromRow},${fromCol}) → (${toRow},${toCol})`);

  // 第一层：基础移动规则
  const basicResult = validateBasicMove(board, fromRow, fromCol, toRow, toCol, piece);
  if (!basicResult.valid) {
    console.log(`❌ 第一层验证失败（基础移动规则）：${basicResult.reason}`);
    return false;
  }
  console.log('✅ 第一层验证通过（基础移动规则）');

  // 第二层：吃子规则和叫将规则
  const captureResult = validateCapture(board, fromRow, fromCol, toRow, toCol, piece);
  if (!captureResult.valid) {
    console.log(`❌ 第二层验证失败（吃子规则）：${captureResult.reason}`);
    return false;
  }
  console.log('✅ 第二层验证通过（吃子规则）');

  // 第二层扩展：检查是否叫将且无法解将
  const checkResult = validateCheckRule(board, fromRow, fromCol, toRow, toCol, piece);
  if (!checkResult.valid) {
    console.log(`❌ 第二层验证失败（叫将规则）：${checkResult.reason}`);
    return false;
  }
  console.log('✅ 第二层验证通过（叫将规则）');

  // 第三层：高级规则
  const advancedResult = validateAdvancedRules(board, fromRow, fromCol, toRow, toCol, piece);
  if (!advancedResult.valid) {
    console.log(`❌ 第三层验证失败（高级规则）：${advancedResult.reason}`);
    return false;
  }
  console.log('✅ 第三层验证通过（高级规则）');

  console.log(`✅ 移动验证通过：${pieceName} (${fromRow},${fromCol}) → (${toRow},${toCol})\n`);
  return true;
}

/**
 * 检查指定颜色是否被将军
 * @param board 棋盘状态
 * @param color 'red' | 'black'
 * @returns 是否被将军
 */
export function isInCheck(board: Board, color: 'red' | 'black'): boolean {
  // 找到该颜色的将/帅位置
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

  if (kingRow === -1) {
    // 如果找不到将帅，说明可能已经被吃掉（游戏结束），这里返回false或者根据游戏状态处理
    // 在中国象棋中，将帅被吃掉是不合法的，通常是通过“将死”来判定胜负
    // 但如果棋盘数据异常，这里保守返回false
    return false;
  }

  // 检查对方所有棋子是否能攻击到将/帅
  const opponentColor = color === 'red' ? 'black' : 'red';
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      const piece = board[r][c];
      if (piece !== PIECES.EMPTY && getPieceColor(piece) === opponentColor) {
        // 检查这个棋子是否能攻击到将/帅
        // 注意：这里只检查基础移动规则，因为“将军”判定不需要考虑“送将”等高级规则，
        // 只需要看对方棋子能否物理上吃到己方将帅。
        // 另外，对方吃将帅时，将帅位置视为“敌方棋子”，所以 validateCapture 会允许（颜色不同）。
        // 但是，我们这里的 validateBasicMove 不包含吃子逻辑，只包含移动方式。
        // 而 isInCheck 的目的是看是否“受攻击”。
        // 我们可以复用 validateBasicMove 并手动确认目标是可以吃的（即颜色不同，这已经由 opponentColor 保证）。
        // 还需要注意：炮的特殊吃子规则在 validateBasicMove 里已经包含。
        
        const result = validateBasicMove(board, r, c, kingRow, kingCol, piece);
        if (result.valid) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * 检查游戏是否结束
 * @param board 棋盘状态
 * @returns 'playing' | 'red_win' | 'black_win' | 'stalemate'
 */
export function checkGameEnd(board: Board): 'playing' | 'red_win' | 'black_win' | 'stalemate' {
  // 简单实现：检查双方将帅是否存在
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

  // 更复杂的困毙检测需要遍历当前行棋方所有棋子是否有合法移动
  // 这里暂不实现完整的困毙检测，仅作为占位
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
  const moves: Array<[number, number]> = [];
  
  // 遍历所有可能的位置
  for (let r = 0; r < BOARD_ROWS; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      if (isValidMove(board, row, col, r, c)) {
        moves.push([r, c]);
      }
    }
  }
  
  return moves;
}
