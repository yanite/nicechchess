/**
 * 棋谱管理服务
 * 提供棋谱文件的读取和管理功能
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * 列出棋谱目录下的所有棋谱文件
 * @returns 棋谱文件名列表
 */
export async function listChessScores(): Promise<string[]> {
  try {
    const scores = await invoke<string[]>('list_chess_scores');
    console.log('棋谱列表:', scores);
    return scores;
  } catch (error) {
    console.error('获取棋谱列表失败:', error);
    return [];
  }
}

/**
 * 读取指定棋谱文件的内容
 * @param filename 棋谱文件名
 * @returns 棋谱文本内容
 */
export async function readChessScore(filename: string): Promise<string> {
  try {
    const content = await invoke<string>('read_chess_score', { filename });
    console.log(`成功读取棋谱: ${filename}`);
    return content;
  } catch (error) {
    console.error(`读取棋谱文件失败 (${filename}):`, error);
    throw new Error(`读取棋谱文件失败: ${error}`);
  }
}
