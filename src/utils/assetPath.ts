/**
 * 资源路径工具
 * 统一处理开发和生产环境的资源路径
 */

import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * 资源类型
 */
export type ResourceType = 'texture' | 'font' | 'chess_score' | 'hdr' | 'image';

/**
 * 资源目录映射
 */
const RESOURCE_DIRS: Record<ResourceType, string> = {
  texture: 'textures',
  font: 'fonts',
  chess_score: 'chess_score',
  hdr: '',
  image: ''
};

/**
 * 获取资源路径
 * @param resourceType 资源类型
 * @param filename 文件名
 * @returns 资源的完整路径
 */
export function getAssetPath(resourceType: ResourceType, filename: string): string {
  // 开发和生产环境都使用 assets 目录（相对于项目根目录）
  
  const subdir = RESOURCE_DIRS[resourceType];
  const relativePath = subdir ? `${subdir}/${filename}` : filename;
  
  const finalPath = `assets/${relativePath}`;
  
  console.log(`[资源加载] 读取 ${resourceType} 资源 "${filename}" 于目录 "${finalPath}"`);
  
  return finalPath;
}

/**
 * 获取纹理路径
 * @param textureName 纹理名称（如 'tx1'）
 * @param filename 文件名
 * @returns 纹理的完整路径
 */
export function getTexturePath(textureName: string, filename: string): string {
  const path = getAssetPath('texture', `${textureName}/${filename}`);
  return path;
}

/**
 * 获取字体路径
 * @param filename 字体文件名
 * @returns 字体的完整路径
 */
export function getFontPath(filename: string): string {
  return getAssetPath('font', filename);
}

/**
 * 获取棋谱路径
 * @param filename 棋谱文件名
 * @returns 棋谱的完整路径
 */
export function getChessScorePath(filename: string): string {
  return getAssetPath('chess_score', filename);
}

/**
 * 获取 HDR 环境贴图路径
 * @param filename HDR 文件名
 * @returns HDR 文件的完整路径
 */
export function getHDRPath(filename: string): string {
  return getAssetPath('hdr', filename);
}

/**
 * 获取图片路径
 * @param filename 图片文件名
 * @returns 图片的完整路径
 */
export function getImagePath(filename: string): string {
  return getAssetPath('image', filename);
}

/**
 * 获取资源的 URL（用于 Three.js 加载器）
 * @param path 相对路径
 * @returns 可访问的 URL
 */
export function getAssetUrl(path: string): string {
  // 开发环境：直接使用路径
  if (import.meta.env.DEV) {
    return path;
  }
  
  // 生产环境：使用 Tauri 的 convertFileSrc 转换路径
  // 将相对路径转换为绝对路径
  const absolutePath = convertToAbsolutePath(path);
  return convertFileSrc(absolutePath);
}

/**
 * 将相对路径转换为绝对路径
 * @param relativePath 相对路径
 * @returns 绝对路径
 */
function convertToAbsolutePath(relativePath: string): string {
  // 在 Tauri 应用中，相对路径是相对于可执行文件的
  // 使用 window.location.pathname 获取当前路径
  const basePath = window.location.pathname.replace(/\/[^/]*$/, '');
  return `${basePath}/${relativePath}`;
}

/**
 * 获取资源目录路径
 * @param resourceType 资源类型
 * @returns 资源目录路径
 */
export function getAssetDir(resourceType: ResourceType): string {
  const subdir = RESOURCE_DIRS[resourceType];
  return subdir ? `assets/${subdir}` : 'assets';
}
