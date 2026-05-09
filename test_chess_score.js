#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 读取棋谱文件
const filePath = path.join(__dirname, '..', 'assets', 'chess_score', '第092局 五丁凿路.txt');
const content = fs.readFileSync(filePath, 'utf8');

console.log('=== 验证棋谱文件 ===\n');

// 1. 验证元数据
const metadataPatterns = [
  /^标题:/,
  /^分类:/,
  /^赛事:/,
  /^轮次:/,
  /^结果:/,
  /^日期:/,
  /^棋谱主人:/,
  /^棋谱价值:/,
  /^浏览次数:/,
  /^来源网站:/
];

console.log('1. 元数据检查:');
metadataPatterns.forEach(pattern => {
  const found = content.match(pattern);
  console.log(`   ${pattern.toString().slice(1, -1)}: ${found ? '✓' : '✗'}`);
});

// 2. 验证FEN格式
const fenMatch = content.match(/初始局面[:：]\s*(.+)/);
if (fenMatch) {
  const fen = fenMatch[1].trim();
  console.log('\n2. FEN格式检查:');
  console.log(`   FEN: ${fen}`);

  // 验证FEN结构
  const fenParts = fen.split(' ');
  console.log(`   格式: ${fenParts.length === 6 ? '✓' : '✗'} (期望6个部分)`);
  console.log(`   棋盘: ${fenParts[0].split('/').length === 10 ? '✓' : '✗'} (期望10行)`);
  console.log(`   行棋方: ${fenParts[1] === 'w' ? '红方' : '黑方'}`);
} else {
  console.log('\n2. FEN格式检查: ✗ 未找到');
}

// 3. 验证着法序列
console.log('\n3. 着法序列检查:');
const moveLines = content.split('\n').filter(line => {
  const trimmed = line.trim();
  return trimmed && /^\d+\./.test(trimmed);
});

console.log(`   着法行数: ${moveLines.length}`);
if (moveLines.length > 0) {
  console.log(`   示例: ${moveLines[0].substring(0, 60)}...`);
}

// 4. 验证文件完整性
console.log('\n4. 文件完整性:');
console.log(`   总行数: ${content.split('\n').length}`);
console.log(`   总字符: ${content.length}`);
console.log(`   编码: UTF-8`);

console.log('\n=== 验证完成 ===');
