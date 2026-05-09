// 测试解析ASCII棋盘
const line = '　┌─┬-[象][士][将]-┬─┬─┬─┐　';
console.log('原始行:', line);
console.log('字符分析:');
for (let i = 0; i < line.length; i++) {
  console.log(`  [${i}] '${line[i]}' (${line.charCodeAt(i)})`);
}

// 分析：
// ┌ 是左上角，不算列
// ┬ 是交叉点，算一列
// - 是连接线，不算
// [象] 是棋子，算一列
// [士] 是棋子，算一列
// [将] 是棋子，算一列
// ┬ 是交叉点，算一列
// ...

let col = 0;
let i = 0;
const pieces: Array<{col: number, char: string}> = [];

while (i < line.length) {
  const char = line[i];
  
  if (char === '┬' || char === '┼' || char === '├' || char === '┤' || char === '│') {
    console.log(`  col ${col}: 交叉点 '${char}'`);
    col++;
    i++;
  } else if (char === '┌' || char === '┐' || char === '└' || char === '┘') {
    console.log(`  边角 '${char}'`);
    i++;
  } else if (char === '[') {
    const endIndex = line.indexOf(']', i);
    const pieceChar = line.substring(i + 1, endIndex);
    console.log(`  col ${col}: 棋子 [${pieceChar}]`);
    pieces.push({col, char: pieceChar});
    col++;
    i = endIndex + 1;
  } else {
    i++;
  }
}

console.log('解析结果:', pieces);
console.log('总列数:', col);
