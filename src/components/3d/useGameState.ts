import { ref } from 'vue';
import { isInCheck, isValidMove } from '../../logic/chess/rules';
import type { useChessStore } from '../../store/chessStore';
import checkImage from '../../../assets/将军.png';
import checkmateImage from '../../../assets/绝杀.png';

/**
 * 游戏状态管理（将军/绝杀提示等）
 */
export function useGameState(chessStore: ReturnType<typeof useChessStore>) {
  const showCheckAlert = ref(false);
  const alertImage = ref('');
  let alertTimer: number | null = null;

  const showAIHint = ref(false);
  let aiHintTimer: number | null = null;

  /**
   * 检查并显示将军/绝杀提示
   */
  function checkCheckAndCheckmate(_movedToRow: number, _movedToCol: number) {
    const board = chessStore.board;
    const nextPlayer = chessStore.currentPlayer; // 移动后切换到对方
    
    // 检查对方是否被将军
    const isOpponentInCheck = isInCheck(board, nextPlayer);
    
    if (isOpponentInCheck) {
      // 检查对方是否有解将的着法（即是否绝杀）
      const hasEscape = hasAnyLegalMove(board, nextPlayer);
      
      if (!hasEscape) {
        // 绝杀
        displayCheckmateAlert();
      } else {
        // 将军
        displayCheckAlert();
      }
    }
  }

  /**
   * 检查指定颜色是否有任何合法的移动
   */
  function hasAnyLegalMove(board: any[][], color: 'red' | 'black'): boolean {
    for (let fromRow = 0; fromRow < 10; fromRow++) {
      for (let fromCol = 0; fromCol < 9; fromCol++) {
        const piece = board[fromRow][fromCol];
        
        // 跳过空位和对方的棋子
        if (piece === 0) continue;
        const pieceColor = piece > 0 ? 'red' : 'black';
        if (pieceColor !== color) continue;
        
        // 尝试所有可能的目标位置
        for (let toRow = 0; toRow < 10; toRow++) {
          for (let toCol = 0; toCol < 9; toCol++) {
            if (fromRow === toRow && fromCol === toCol) continue;
            
            // 验证这个移动是否合法
            if (isValidMove(board, fromRow, fromCol, toRow, toCol)) {
              return true; // 找到一个合法移动
            }
          }
        }
      }
    }
    return false;
  }

  /**
   * 显示将军提示
   */
  function displayCheckAlert() {
    // 清除之前的定时器
    if (alertTimer !== null) {
      clearTimeout(alertTimer);
    }
    
    alertImage.value = checkImage;
    showCheckAlert.value = true;
    
    // 3秒后隐藏
    alertTimer = window.setTimeout(() => {
      showCheckAlert.value = false;
      alertTimer = null;
    }, 3000);
  }

  /**
   * 显示绝杀提示
   */
  function displayCheckmateAlert() {
    // 清除之前的定时器
    if (alertTimer !== null) {
      clearTimeout(alertTimer);
    }
    
    alertImage.value = checkmateImage;
    showCheckAlert.value = true;
    
    // 3秒后隐藏
    alertTimer = window.setTimeout(() => {
      showCheckAlert.value = false;
      alertTimer = null;
    }, 3000);
  }

  /**
   * 显示AI行棋提示
   */
  function showAIThinkingHint() {
    // 清除之前的定时器
    if (aiHintTimer !== null) {
      clearTimeout(aiHintTimer);
    }
    
    showAIHint.value = true;
    
    // 2秒后隐藏
    aiHintTimer = window.setTimeout(() => {
      showAIHint.value = false;
      aiHintTimer = null;
    }, 2000);
  }

  /**
   * 隐藏将军/绝杀提示
   */
  function hideCheckAlert() {
    if (showCheckAlert.value) {
      // 清除定时器
      if (alertTimer !== null) {
        clearTimeout(alertTimer);
        alertTimer = null;
      }
      // 隐藏提示
      showCheckAlert.value = false;
    }
  }

  /**
   * 清理定时器
   */
  function cleanup() {
    if (alertTimer !== null) {
      clearTimeout(alertTimer);
      alertTimer = null;
    }
    if (aiHintTimer !== null) {
      clearTimeout(aiHintTimer);
      aiHintTimer = null;
    }
  }

  return {
    showCheckAlert,
    alertImage,
    showAIHint,
    checkCheckAndCheckmate,
    displayCheckAlert,
    displayCheckmateAlert,
    showAIThinkingHint,
    hideCheckAlert,
    cleanup
  };
}
