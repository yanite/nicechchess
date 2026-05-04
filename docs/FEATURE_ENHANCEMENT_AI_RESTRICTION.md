# 功能增强 - AI行棋时禁用操作与阵营限制

## 📅 实施时间
2026-05-05

## 🎯 需求描述

### 核心问题
**游戏刚启动时配置未加载完成**，导致交互权限判断失效。需要等待配置应用成功后，再根据当前玩家是否是人类来决定是否允许操作。

### 功能1: 配置就绪前禁止操作
**需求**: 
- 游戏启动时，在配置加载完成前禁止所有棋子操作
- 配置加载完成后才启用交互功能

### 功能2: AI行棋时禁止操作
**需求**: 
- 当 AI 正在思考时，用户不能点击任何棋子
- 在棋盘上显示提示："红方/黑方 AI 正在行棋中，请勿操作"

### 功能3: 阵营限制
**需求**:
- **只有人类玩家可以操作**：当前玩家是 AI 时禁止所有手动操作
- 红方人类只能点击红方棋子
- 黑方人类只能点击黑方棋子

---

## ✅ 实施结果

### 步骤1: 修改 useInteraction 模块 ✅

**文件**: [useInteraction.ts](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\useInteraction.ts)

#### 1.1 添加配置就绪回调参数
```typescript
export function useInteraction(
  // ... 其他参数
  isAIThinking: () => boolean,      // AI 是否正在思考
  isConfigReady: () => boolean      // ✅ 新增：配置是否已就绪
) {
```

#### 1.2 在 onMouseDown 中添加五层防护逻辑
```typescript
function onMouseDown(event: MouseEvent) {
  if (!container) return;

  console.log('=== onMouseDown 触发 ===');

  // ✅ 第零层：配置未就绪时禁止所有操作（最高优先级）
  if (!isConfigReady()) {
    console.log('⚠️ 配置尚未加载完成，禁止操作');
    return;
  }

  // ✅ 第一层：AI 思考时完全禁用
  const aiThinking = isAIThinking();
  if (aiThinking) {
    console.log('❌ AI 正在思考中，禁止操作');
    return;
  }

  // 修饰键检查（交给 OrbitControls）
  if (event.altKey || event.ctrlKey || event.shiftKey) {
    return;
  }

  // ✅ 第二层：双方都是 AI 时禁用
  const blackIsAI = chessStore.blackPlayer.useAI;
  const redIsAI = chessStore.redPlayer.useAI;
  
  if (blackIsAI && redIsAI) {
    console.log('❌ 双方都是AI，禁止手动操作');
    return;
  }
  
  // ✅ 第三层：当前玩家是 AI 时禁用
  const currentIsAI = chessStore.currentPlayer === 'black' ? blackIsAI : redIsAI;
  if (currentIsAI) {
    console.log(`❌ 当前玩家 (${chessStore.currentPlayer}) 是AI，禁止手动操作`);
    return;
  }

  // ✅ 第四层：阵营限制（只能点击己方棋子）
  const pieceColor = piece > 0 ? 'red' : 'black';
  if (pieceColor !== chessStore.currentPlayer) {
    console.log(`❌ 不能点击对方棋子 (${pieceColor})`);
    
    // 红色闪烁视觉反馈
    const material = selectedObject.material;
    if (material instanceof THREE.MeshStandardMaterial) {
      const originalEmissive = material.emissive.getHex();
      material.emissive.setHex(0xff0000);
      setTimeout(() => {
        material.emissive.setHex(originalEmissive);
      }, 200);
    }
    
    return;
  }

  // 开始拖动
  draggedPiece = selectedObject;
  // ...
}
```

---

### 步骤2: 修改 ChessBoard3D.vue ✅

**文件**: [ChessBoard3D.vue](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\ChessBoard3D.vue)

#### 2.1 添加配置就绪标志
```typescript
// ✅ 配置就绪标志
const isConfigReady = ref(false);
```

#### 2.2 传递配置就绪状态到交互模块
```typescript
interaction = useInteraction(
  chessStore,
  piecesGroup,
  camera,
  raycaster,
  mouse,
  controls,
  renderer,
  container.value,
  currentPieceShape,
  executeMove,
  (piece) => resetPiecePositionFunc(piece, currentPieceShape),
  () => aiModule ? aiModule.isAIThinking.value : false,
  () => isConfigReady.value // ✅ 传递配置就绪状态
);
```

#### 2.3 在配置加载完成后启用交互
```typescript
onMounted(() => {
  initScene();
  window.addEventListener('resize', sceneManager.onWindowResize);
  
  // 加载配置并启动 AI 引擎
  loadConfig().then(config => {
    console.log('✅ 配置加载完成，启用交互');
    
    // ✅ 设置配置就绪标志，允许用户操作
    isConfigReady.value = true;
    
    // ... 其他初始化逻辑
  }).catch(error => {
    console.error('❌ 加载配置失败:', error);
    // 即使配置加载失败，也启用交互（使用默认配置）
    isConfigReady.value = true;
  });
});
```

#### 2.4 添加计算属性显示当前 AI 玩家
```typescript
// ✅ 计算当前行棋的 AI 玩家
const currentAIPlayer = computed(() => {
  if (!aiModule || !aiModule.isAIThinking.value) return '';
  return chessStore.currentPlayer === 'red' ? '红方' : '黑方';
});
```

#### 2.5 优化 AI 提示模板
```vue
<template>
  <div ref="container" class="chess-board-3d">
    <!-- 将军/绝杀提示图片 -->
    <div v-if="showCheckAlert" class="check-alert">
      <img :src="alertImage" alt="提示" class="alert-image" />
    </div>
    
    <!-- ✅ AI行棋提示 - 动态显示哪方 AI -->
    <div v-if="aiModule && aiModule.isAIThinking.value" class="ai-hint">
      <div class="hint-text">{{ currentAIPlayer }} AI 正在行棋中，请勿操作</div>
    </div>
  </div>
</template>
```

---

## 📊 功能对比

| 功能 | 实施前 | 实施后 |
|------|--------|--------|
| 配置加载前操作 | ❌ 可能误操作 | ✅ 完全禁用 |
| AI 思考时操作 | ❌ 可以点击棋子 | ✅ 完全禁用 |
| AI 提示信息 | ⚠️ 通用提示 | ✅ 明确显示"红方/黑方" |
| 当前玩家是AI时的限制 | ❌ 可以操作AI棋子 | ✅ 完全禁止 |
| 阵营限制 | ❌ 可以点击对方棋子 | ✅ 只能点击己方棋子 |
| 用户体验 | ⚠️ 容易误操作 | ✅ 清晰明确 |

---

## 🔍 问题根因分析

### 发现的问题
从日志可以看出：
```javascript
点击检测: {pieceColor: 'red', currentPlayer: 'red', isCurrentPlayer: true}
点击检测: {pieceColor: 'black', currentPlayer: 'black', isCurrentPlayer: true}
```

**问题1**：当 AI 走完一步后，[currentPlayer](file://v:\4_mydoc\tauri\nicechchess\src\store\chessStore.ts#L35-L35) 切换到 `'black'`，此时如果黑方是 AI，人类仍然可以点击黑方棋子并拖动。

**原因**：之前的阵营限制只检查了 `pieceColor === currentPlayer`，但没有检查**当前玩家是否是人类**。

**问题2**：游戏刚启动时，配置可能还没有加载完成，此时 [blackPlayer](file://v:\4_mydoc\tauri\nicechchess\src\store\chessStore.ts#L60-L63) 和 [redPlayer](file://v:\4_mydoc\tauri\nicechchess\src\store\chessStore.ts#L64-L67) 的值可能是默认值，导致判断错误。

**原因**：[initScene](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\useScene.ts#L21-L70) 在 [onMounted](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\ChessBoard3D.vue#L350-L380) 中立即调用，绑定事件监听器，但 [loadConfig()](file://v:\4_mydoc\tauri\nicechchess\src\services\configService.ts#L75-L89) 是异步的，可能在事件监听器绑定之后才完成。

### 修复方案
1. **添加配置就绪标志**：确保配置加载完成后再启用交互
2. **添加当前玩家是否为 AI 的检查**：防止操作 AI 玩家的棋子

---

## 🧪 测试验证

### 测试场景1: 配置加载前禁止操作
**步骤**:
1. 重启应用
2. **在游戏界面完全加载后立即尝试点击任意棋子**

**预期结果**:
- ✅ 控制台输出："⚠️ 配置尚未加载完成，禁止操作"
- ✅ 棋子无响应
- ✅ 等待配置加载完成后（约 1-2 秒），控制台输出："✅ 配置加载完成，启用交互"
- ✅ 此时才能正常操作

---

### 测试场景2: AI 行棋时禁用操作
**步骤**:
1. 启动应用，设置黑方为 AI
2. 红方走一步棋
3. 观察 AI 思考时的行为

**预期结果**:
- ✅ 显示提示："黑方 AI 正在行棋中，请勿操作"
- ✅ 点击任何棋子无响应
- ✅ 控制台输出："❌ AI 正在思考中，禁止操作"

---

### 测试场景3: 当前玩家是AI时禁止操作
**步骤**:
1. 设置为红方人类 vs 黑方 AI
2. 红方走一步棋
3. 等待 AI 走完，轮到红方
4. **尝试点击任意棋子**

**预期结果**:
- ✅ 红方回合时可以正常操作
- ✅ AI 回合时无法操作
- ✅ 控制台输出："❌ 当前玩家 (black) 是AI，禁止手动操作"

---

### 测试场景4: 红方玩家阵营限制
**步骤**:
1. 设置为红方人类 vs 黑方 AI
2. 尝试点击黑方棋子

**预期结果**:
- ✅ 点击黑方棋子无响应
- ✅ 控制台输出："❌ 不能点击对方棋子 (black)"
- ✅ 棋子短暂闪烁红色
- ✅ 只能点击红方棋子

---

### 测试场景5: 黑方玩家阵营限制
**步骤**:
1. 设置为红方 AI vs 黑方人类
2. 等待 AI 走完第一步
3. 尝试点击红方棋子

**预期结果**:
- ✅ 点击红方棋子无响应
- ✅ 控制台输出："❌ 不能点击对方棋子 (red)"
- ✅ 棋子短暂闪烁红色
- ✅ 只能点击黑方棋子

---

### 测试场景6: 双方都是 AI
**步骤**:
1. 设置红方和黑方都为 AI
2. 启动游戏

**预期结果**:
- ✅ 显示提示交替变化："红方 AI..." → "黑方 AI..."
- ✅ 全程无法手动操作
- ✅ 控制台输出："❌ 双方都是AI，禁止手动操作"

---

## 💡 实现亮点

### 1. 五层防护机制
```typescript
// 第零层：配置未就绪禁用（最高优先级）
if (!isConfigReady()) return;

// 第一层：AI 思考禁用
if (isAIThinking()) return;

// 第二层：双方 AI 禁用
if (blackIsAI && redIsAI) return;

// 第三层：当前玩家是 AI 禁用（关键修复）
if (currentIsAI) return;

// 第四层：阵营限制
if (pieceColor !== currentPlayer) return;
```

**优势**:
- ✅ 逐层过滤，逻辑清晰
- ✅ 每层都有明确的日志输出
- ✅ 便于调试和问题定位
- ✅ **配置就绪检查作为最高优先级，确保初始化时序正确**

---

### 2. 响应式状态管理
```typescript
// 使用 ref 追踪配置加载状态
const isConfigReady = ref(false);

// 配置加载完成后启用交互
loadConfig().then(() => {
  isConfigReady.value = true;
});
```

**优势**:
- ✅ 自动更新 UI，无需手动触发
- ✅ 代码简洁，易于维护
- ✅ 类型安全，TypeScript 完整支持

---

### 3. 视觉反馈增强
```typescript
// 点击对方棋子时红色闪烁
const material = selectedObject.material;
if (material instanceof THREE.MeshStandardMaterial) {
  const originalEmissive = material.emissive.getHex();
  material.emissive.setHex(0xff0000); // 红色闪烁
  setTimeout(() => {
    material.emissive.setHex(originalEmissive);
  }, 200);
}
```

**优势**:
- ✅ 用户立即感知操作被阻止
- ✅ 不影响游戏流程
- ✅ 优雅的动画效果

---

## 📝 相关文件修改

- ✅ [useInteraction.ts](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\useInteraction.ts) - 添加五层防护逻辑
- ✅ [ChessBoard3D.vue](file://v:\4_mydoc\tauri\nicechchess\src\components\3d\ChessBoard3D.vue) - 添加配置就绪标志和优化 AI 提示
- ✅ [FEATURE_ENHANCEMENT_AI_RESTRICTION.md](file://v:\4_mydoc\tauri\nicechchess\docs\FEATURE_ENHANCEMENT_AI_RESTRICTION.md) - 功能增强记录

---

## 🎯 后续优化建议

### 短期优化
1. **音效反馈**: 
   - 点击禁用棋子时播放提示音
   - AI 开始/结束思考时播放音效

2. **鼠标样式**:
   - 悬停在对方棋子上时显示禁止图标

### 长期优化
1. **可配置选项**:
   - 允许用户关闭阵营限制（自由模式）
   - 自定义 AI 提示样式

2. **无障碍支持**:
   - 屏幕阅读器支持
   - 键盘快捷键操作

---

**实施人**: Lingma Assistant  
**审核状态**: ✅ 已完成  
**测试状态**: ⏳ 待用户验证
