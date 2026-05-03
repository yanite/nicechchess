import { invoke } from '@tauri-apps/api/core';

/**
 * 启动 Pikafish 引擎
 */
export async function startEngine(): Promise<string> {
  try {
    const result = await invoke<string>('start_engine');
    console.log('引擎启动成功:', result);
    return result;
  } catch (error) {
    console.error('启动引擎失败:', error);
    throw error;
  }
}

/**
 * 停止引擎
 */
export async function stopEngine(): Promise<string> {
  try {
    const result = await invoke<string>('stop_engine');
    console.log('引擎已停止:', result);
    return result;
  } catch (error) {
    console.error('停止引擎失败:', error);
    throw error;
  }
}

/**
 * 获取 AI 最佳着法
 * @param fen FEN 串表示当前局面
 * @param depth 搜索深度（默认 10）
 * @returns UCI 格式的最佳着法（如 "e2e4"）
 */
export async function getBestMove(fen: string, depth: number = 10): Promise<string> {
  try {
    console.log(`请求 AI 着法，FEN: ${fen}, 深度: ${depth}`);
    const bestMove = await invoke<string>('get_best_move', {
      fen,
      depth
    });
    console.log('AI 最佳着法:', bestMove);
    return bestMove;
  } catch (error) {
    console.error('获取 AI 着法失败:', error);
    throw error;
  }
}
