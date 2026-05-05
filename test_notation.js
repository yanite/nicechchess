/**
 * 棋谱解析测试脚本
 * 用于自动化测试棋谱导入功能
 */

import { detectAndParseNotation, parseSingleMove, resolveMovePosition } from './src/logic/chess/notation.js';
import { createInitialBoard } from './src/logic/chess/constants.js';

// 测试棋谱
const testNotation = `标题: 32.骏马献身保大局
赛事: 银川棋路
轮次: 银川棋谱完整版
结果: 红方胜
日期: 1996-10-28 00:00:00
地点: 宁波
备注: 96年全国个人赛与张强之战 
 
  1.兵七进一      卒７进１* 
  2.马八进七*     马８进７  
  3.车九进一 m    象３进５  
  4.相三进五      马２进４* 
  5.马二进四      车１平３  
  6.马七进六*     炮２进３* 
  7.车九平六      车９进１  
  8.车一平三      卒３进１  
  9.炮八平七      车３进２* 
 10.兵七进一      车３平４* 
 11.兵三进一      马４进２* 
 12.兵七平八      车９平４  
 13.炮二进二      卒７进１  
 14.炮七平六      前车进３  
 15.炮二平六      车４进４  
 16.车六平八*     马７进６* 
 17.炮六平九      炮８进１  
 18.马四进六*     马６进５  
 19.仕四进五      炮８进１  
 20.炮九进四      马５退４* 
 21.炮九退二      车４进１  
 22.兵八平七      马２进３  
 23.炮九进五      象５退３  
 24.车八进三      炮８平５  
 25.车八进二*     马４进５  
 26.兵九进一      象７进５  
 27.炮九退四      炮５进１  
 28.车八退一      炮５退１  
 29.车八进三      炮５进１  
 30.车八平四      车４退１  
 31.马六进五      车４平５  
 32.炮九进四      马３进２  
 33.帅五平四      士６进５  
 34.相五进三* 
`;

console.log('=== 开始棋谱解析测试 ===\n');

// 步骤1：解析棋谱
console.log('步骤1: 解析棋谱文本...');
const parsed = detectAndParseNotation(testNotation);

if (!parsed) {
  console.error('❌ 棋谱解析失败！');
  process.exit(1);
}

console.log(`✅ 棋谱解析成功`);
console.log(`   元数据: ${parsed.metadata.length} 项`);
console.log(`   着法回合数: ${parsed.moves.length}\n`);

// 打印前5回合的解析结果
console.log('前5回合解析结果:');
for (let i = 0; i < Math.min(5, parsed.moves.length); i++) {
  const move = parsed.moves[i];
  console.log(`  第${move.round}回合: 红方="${move.red || '无'}", 黑方="${move.black || '无'}"`);
}
console.log();

// 步骤2：逐步执行着法
console.log('步骤2: 逐步执行着法...\n');
let board = createInitialBoard();
let currentPlayer = 'red';
let successCount = 0;
let failCount = 0;
const failedMoves = [];

for (const move of parsed.moves) {
  // 执行红方着法
  if (move.red && currentPlayer === 'red') {
    const result = executeMove(move.red, board, currentPlayer);
    if (result.success) {
      board = result.newBoard;
      currentPlayer = 'black';
      successCount++;
      console.log(`✅ 第${move.round}回合 红方: ${move.red}`);
    } else {
      failCount++;
      failedMoves.push({ round: move.round, color: '红方', move: move.red, error: result.error });
      console.log(`❌ 第${move.round}回合 红方: ${move.red} - ${result.error}`);
    }
  }
  
  // 执行黑方着法
  if (move.black && currentPlayer === 'black') {
    const result = executeMove(move.black, board, currentPlayer);
    if (result.success) {
      board = result.newBoard;
      currentPlayer = 'red';
      successCount++;
      console.log(`✅ 第${move.round}回合 黑方: ${move.black}`);
    } else {
      failCount++;
      failedMoves.push({ round: move.round, color: '黑方', move: move.black, error: result.error });
      console.log(`❌ 第${move.round}回合 黑方: ${move.black} - ${result.error}`);
    }
  }
}

// 步骤3：输出测试结果
console.log('\n=== 测试结果汇总 ===');
console.log(`总着法数: ${successCount + failCount}`);
console.log(`成功: ${successCount}`);
console.log(`失败: ${failCount}`);
console.log(`成功率: ${((successCount / (successCount + failCount)) * 100).toFixed(2)}%`);

if (failedMoves.length > 0) {
  console.log('\n失败的着法:');
  failedMoves.forEach(fail => {
    console.log(`  - 第${fail.round}回合 ${fail.color}: ${fail.move} (${fail.error})`);
  });
}

if (failCount === 0) {
  console.log('\n🎉 所有着法执行成功！');
  process.exit(0);
} else {
  console.log('\n⚠️  存在失败的着法，请检查错误信息');
  process.exit(1);
}

/**
 * 执行单个着法
 */
function executeMove(notation, board, color) {
  try {
    // 解析着法
    const parsed = parseSingleMove(notation, board, color);
    if (!parsed) {
      return { success: false, error: '解析失败' };
    }
    
    // 计算位置
    const position = resolveMovePosition(parsed, board, color);
    if (!position) {
      return { success: false, error: '无法确定位置' };
    }
    
    const [fromRow, fromCol, toRow, toCol] = position;
    
    // 执行移动（简化版，不验证规则）
    const newBoard = board.map(row => [...row]);
    newBoard[toRow][toCol] = newBoard[fromRow][fromCol];
    newBoard[fromRow][fromCol] = 0; // EMPTY
    
    return { success: true, newBoard };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
