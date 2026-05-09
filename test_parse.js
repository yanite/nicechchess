#!/usr/bin/env node

// 测试棋谱解析
const fs = require('fs');

// 读取棋谱文件
const filePath = 'v:/4_mydoc/tauri/nicechchess/assets/chess_score/第092局 五丁凿路.txt';
const content = fs.readFileSync(filePath, 'utf8');

console.log('=== 测试棋谱文件 ===\n');
console.log('文件内容:');
console.log(content);
console.log('\n');

// 测试 containsStandardMoves 正则
function containsStandardMoves(line) {
  const movePattern = /[帥帅俥車车傌馬马炮砲仕士相象兵卒][一二三四五六七八九1-9１２３４５６７８９][进退平]/;
  return movePattern.test(line);
}

// 测试棋谱行
console.log('=== containsStandardMoves 测试 ===');
const lines = content.split('\n');
lines.forEach((line, i) => {
  const trimmed = line.trim();
  if (trimmed) {
    const result = containsStandardMoves(trimmed);
    console.log(`行 ${i + 1}: ${result ? '✓' : '✗'} | ${trimmed.substring(0, 60)}`);
  }
});

// 测试 parseMovesFromLines
console.log('\n=== parseMovesFromLines 测试 ===');

// 找到包含着法的行
const moveLines = lines.filter(line => containsStandardMoves(line.trim()));
console.log('找到着法行:', moveLines.length);

// 测试正则
const allText = moveLines.join(' ');
console.log('合并文本:', allText);

// 尝试匹配
const roundRegex = /(\d+)\.\s*([^\d]+?)\s+(?:[*m!?\s]*\s*)([^\d]+?)(?:\s+[*m!?\s]*|\s*$)/g;
let match;
let matches = [];
while ((match = roundRegex.exec(allText)) !== null) {
  matches.push({
    round: match[1],
    red: match[2].trim(),
    black: match[3].trim()
  });
}

console.log('\n匹配结果:', matches);

// 测试 detectAndParseNotation
console.log('\n=== detectAndParseNotation 测试 ===');

let moveLines2 = [];
let metadataLines = [];
let totalMoves = 0;

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed) continue;

  if (containsStandardMoves(trimmed)) {
    moveLines2.push(line);
    // 统计该行中的着法数量
    const matches2 = trimmed.match(/[帥俥馬砲仕相兵將車馬砲士象卒][一二三四五六七八九1-9][进退平][一二三四五六七八九1-9]/g);
    if (matches2) {
      totalMoves += matches2.length;
    }
  } else {
    metadataLines.push(line);
  }
}

console.log('是否为棋谱:', totalMoves > 0);
console.log('总着法数:', totalMoves);
console.log('着法行:', moveLines2);
console.log('元数据行:', metadataLines.length);
