import { ref } from 'vue';
import { startEngine, getBestMove } from '../../services/engineService';
import { UCIToMove } from '../../logic/chess/constants';
import { isValidMove } from '../../logic/chess/rules';
import type { useChessStore } from '../../store/chessStore';
import * as THREE from 'three';
import { animatePieceMove } from './usePieces';
import { BOARD_WIDTH, BOARD_HEIGHT, CELL_SIZE } from './useBoard';

/**
 * AI 引擎集成逻辑
 */
export function useAI(
  chessStore: ReturnType<typeof useChessStore>,
  piecesGroup: THREE.Group,
  _executeMoveCallback: (fromRow: number, fromCol: number, toRow: number, toCol: number) => void, // 保留参数以备将来使用
  checkCheckAndCheckmateCallback: (toRow: number, toCol: number) => void
) {
  const isAIThinking = ref(false); // AI 是否正在思考
  let engineStarted = false; // 引擎是否已启动

  /**
   * 触发 AI 行棋
   */
  async function triggerAIMove() {
    // 如果 AI 正在思考，不重复触发
    if (isAIThinking.value) {
      console.log('AI 正在思考中，跳过本次触发');
      return;
    }
    
    console.log('=== 开始触发 AI 行棋 ===');
    console.log('当前玩家:', chessStore.currentPlayer);
    console.log('引擎已启动:', engineStarted);
    
    // 启动引擎（如果尚未启动）
    if (!engineStarted) {
      try {
        // 从配置中获取引擎路径
        const config = await import('../../services/configService').then(m => m.loadConfig());
        const enginePath = config.engine.pikafish_path;
        await startEngine(enginePath);
        engineStarted = true;
        console.log('AI 引擎已启动');
      } catch (error) {
        console.error('启动 AI 引擎失败:', error);
        return;
      }
    }
    
    isAIThinking.value = true;
    console.log('AI 开始思考...');
    
    try {
      // 获取当前局面的 FEN
      const fen = chessStore.fen;
      console.log('当前 FEN:', fen);
      
      // 打印棋盘状态用于调试
      console.log('当前棋盘 (board[9]=红方, board[0]=黑方):');
      for (let r = 9; r >= 0; r--) {
        const rowPieces = chessStore.board[r].map(p => {
          if (p === 0) return '.';
          return p > 0 ? 'R' : 'B';
        }).join(' ');
        console.log(`  board[${r}]: ${rowPieces}`);
      }
      
      // 请求 AI 最佳着法
      console.log('调用 getBestMove...');
      
      // 获取当前玩家的 AI 等级
      const skillLevel = chessStore.getCurrentPlayerAILevel();
      console.log('当前玩家 AI 等级:', skillLevel);
      
      // 获取引擎配置
      const config = chessStore.engineConfig;
      console.log('引擎配置:', config);
      
      const bestMoveUCI = await getBestMove(
        fen, 
        config.depth,           // 深度
        skillLevel,             // AI等级
        config.threads,         // 线程数
        config.hash,            // Hash大小
        config.calculationMode, // 计算模式
        config.movetime         // 思考时间
      );
      
      console.log('AI 选择着法:', bestMoveUCI);
      console.log('着法长度:', bestMoveUCI.length);
      
      // 转换 UCI 着法为内部坐标
      console.log('开始转换坐标...');
      const [fromRow, fromCol, toRow, toCol] = UCIToMove(bestMoveUCI);
      console.log(`UCI: ${bestMoveUCI} → 内部坐标: (${fromRow},${fromCol}) → (${toRow},${toCol})`);
      console.log(`起始位置棋子: ${chessStore.board[fromRow][fromCol]} (${chessStore.board[fromRow][fromCol] > 0 ? '红方' : '黑方'})`);
      console.log(`目标位置棋子: ${chessStore.board[toRow][toCol]}`);
      
      // 执行 AI 移动
      console.log('执行 AI 移动...');
      executeAIMove(fromRow, fromCol, toRow, toCol);
      console.log('AI 移动完成');
      
    } catch (error) {
      console.error('AI 行棋失败:', error);
      console.error('错误堆栈:', error instanceof Error ? error.stack : 'N/A');
    } finally {
      isAIThinking.value = false;
      console.log('=== AI 行棋流程结束 ===');
    }
  }

  /**
   * 执行 AI 移动（更新 3D 场景）
   */
  function executeAIMove(fromRow: number, fromCol: number, toRow: number, toCol: number) {
    console.log(`AI 移动: (${fromRow},${fromCol}) → (${toRow},${toCol})`);
    
    // 验证 AI 着法是否符合规则
    const board = chessStore.board;
    if (!isValidMove(board, fromRow, fromCol, toRow, toCol)) {
      console.error(`AI 着法不合法: (${fromRow},${fromCol}) → (${toRow},${toCol})`);
      console.error('当前棋盘状态:', board);
      return;
    }
    console.log('AI 着法验证通过');
    
    // 找到 AI 要移动的棋子
    let aiPiece: THREE.Mesh | null = null;
    piecesGroup.children.forEach(child => {
      if (child instanceof THREE.Mesh) {
        const userData = child.userData as any;
        if (userData.row === fromRow && userData.col === fromCol && !userData.isCaptured) {
          aiPiece = child;
        }
      }
    });
    
    if (!aiPiece) {
      console.error('未找到 AI 棋子');
      return;
    }
    
    // 处理吃子
    const targetPiece = chessStore.board[toRow][toCol];
    if (targetPiece !== 0) {
      // 找到被吃的棋子并移到边缘
      let targetMesh: THREE.Mesh | null = null;
      piecesGroup.children.forEach(child => {
        if (child instanceof THREE.Mesh) {
          const userData = child.userData as any;
          if (userData.row === toRow && userData.col === toCol && !userData.isCaptured) {
            targetMesh = child;
          }
        }
      });
      
      if (targetMesh) {
        const targetUserData = (targetMesh as THREE.Mesh).userData as any;
        targetUserData.isCaptured = true;
        targetUserData.row = -1;
        targetUserData.col = -1;
        
        const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
        const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;
        const isRed = targetPiece > 0;
        
        let capturedCount = 0;
        piecesGroup.children.forEach(other => {
          if (other instanceof THREE.Mesh) {
            const otherUserData = other.userData as any;
            if (otherUserData.isCaptured) {
              const otherIsRed = otherUserData.piece > 0;
              if (otherIsRed === isRed) {
                capturedCount++;
              }
            }
          }
        });
        
        if (isRed) {
          const leftBoundary = startX - CELL_SIZE * 1.5;
          const offsetZ = capturedCount * CELL_SIZE * 0.75;
          (targetMesh as THREE.Mesh).position.x = leftBoundary;
          (targetMesh as THREE.Mesh).position.z = startZ + offsetZ;
        } else {
          const rightBoundary = startX + (BOARD_WIDTH - 1) * CELL_SIZE + CELL_SIZE * 1.5;
          const offsetZ = capturedCount * CELL_SIZE * 0.75;
          (targetMesh as THREE.Mesh).position.x = rightBoundary;
          (targetMesh as THREE.Mesh).position.z = startZ + offsetZ;
        }
        
        // 被吃掉的棋子也需要保持正确的高度
        (targetMesh as THREE.Mesh).position.y = 0.01; // 保持在棋盘平面上
      }
    }
    
    // 移动 AI 棋子（使用平滑动画）
    const aiUserData = (aiPiece as THREE.Mesh).userData as any;
    aiUserData.row = toRow;
    aiUserData.col = toCol;
    
    const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
    const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;
    const targetX = startX + toCol * CELL_SIZE;
    const targetZ = startZ + toRow * CELL_SIZE;
    
    // 使用平滑动画移动棋子（500ms）
    animatePieceMove(aiPiece as THREE.Mesh, targetX, targetZ, 500);
    
    // 延迟更新棋盘数据，等待动画完成
    setTimeout(() => {
      chessStore.movePiece(fromRow, fromCol, toRow, toCol);
      // 检查将军/绝杀
      checkCheckAndCheckmateCallback(toRow, toCol);
      
      // 检查下一位玩家是否是 AI（支持双 AI 对战）
      setTimeout(() => {
        if (chessStore.isCurrentPlayerAI()) {
          console.log('检测到下一位玩家也是AI，触发连续AI对战');
          triggerAIMove();
        }
      }, 600);
    }, 500);
  }

  return {
    isAIThinking,
    triggerAIMove,
    executeAIMove,
    getEngineStarted: () => engineStarted,
    setEngineStarted: (value: boolean) => { engineStarted = value; }
  };
}
