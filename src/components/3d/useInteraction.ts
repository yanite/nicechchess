import * as THREE from 'three';
import { isValidMove } from '../../logic/chess/rules';
import type { useChessStore } from '../../store/chessStore';

/**
 * 鼠标交互和拖动逻辑
 */
export function useInteraction(
  chessStore: ReturnType<typeof useChessStore>,
  piecesGroup: THREE.Group,
  camera: THREE.PerspectiveCamera,
  raycaster: THREE.Raycaster,
  mouse: THREE.Vector2,
  controls: any,
  renderer: THREE.WebGLRenderer,
  container: HTMLDivElement | null,
  _pieceShape: 'cylinder' | 'standard', // 保留参数以备将来使用
  executeMoveCallback: (fromRow: number, fromCol: number, toRow: number, toCol: number) => void,
  resetPiecePositionFunc: (piece: THREE.Mesh) => void,
  isAIThinking: () => boolean, // AI 是否正在思考
  isConfigReady: () => boolean, // 配置是否已就绪
  onPieceSelected?: (pieceType: number, row: number, col: number) => void, // 棋子选中回调
  onPieceDeselected?: () => void, // 棋子取消选中回调
  moveMode: 'drag' | 'click' = 'drag' // 移动模式：拖动或点击
) {
  let draggedPiece: THREE.Mesh | null = null; // 当前拖动的棋子
  let isDragging = false; // 是否正在拖动
  let dragOffset = new THREE.Vector3(); // 拖动偏移量
  let selectedPiece: THREE.Mesh | null = null; // 两次点击模式下选中的棋子

  /**
   * 鼠标按下事件 - 开始拖动棋子或相机控制
   */
  function onMouseDown(event: MouseEvent) {
    if (!container) return;

    // ✅ 第零层：配置未就绪时禁止所有操作
    if (!isConfigReady()) {
      return;
    }

    // ✅ 第一层：AI 思考时完全禁用
    if (isAIThinking()) {
      return;
    }

    // 如果按下了修饰键（Alt/Ctrl/Shift），不处理棋子移动，交给OrbitControls处理
    if (event.altKey || event.ctrlKey || event.shiftKey) {
      return; // 让OrbitControls处理相机操作
    }

    // 检查是否双方都是AI，如果是则提示用户
    const blackIsAI = chessStore.blackPlayer.useAI;
    const redIsAI = chessStore.redPlayer.useAI;
    
    if (blackIsAI && redIsAI) {
      return;
    }
    
    // ✅ 第二层：非研究模式下，当前玩家是 AI 时禁用
    const currentIsAI = chessStore.currentPlayer === 'black' ? blackIsAI : redIsAI;
    if (!chessStore.isStudyMode && currentIsAI) {
      return;
    }

    // 计算鼠标位置
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // 射线检测
    raycaster.setFromCamera(mouse, camera);
    
    // 只响应左键
    if (event.button === 0) {
      // ✅ 两次点击模式：如果已选中棋子，检查是否点击了目标位置
      if (moveMode === 'click' && selectedPiece) {
        // 递归检测所有子对象（包括文字贴图）
        const pieceIntersects = raycaster.intersectObjects(piecesGroup.children, true);
        
        if (pieceIntersects.length > 0) {
          // 点击了另一个棋子，可能是吃子操作
          let targetObject = pieceIntersects[0].object as THREE.Mesh;
          
          // 如果点击的是文字贴图（子对象），找到父对象（棋子主体）
          while (targetObject.parent && targetObject.parent !== piecesGroup) {
            targetObject = targetObject.parent as THREE.Mesh;
          }
          
          // 检查是否是死子
          if ((targetObject as any).userData.isCaptured) {
            return;
          }
          
          // 获取起始和目标位置
          const fromRow = (selectedPiece as any).userData.row;
          const fromCol = (selectedPiece as any).userData.col;
          const toRow = (targetObject as any).userData.row;
          const toCol = (targetObject as any).userData.col;
          
          // 验证移动是否合法
          if (isValidMove(chessStore.board, fromRow, fromCol, toRow, toCol)) {
            // 执行移动
            executeMoveCallback(fromRow, fromCol, toRow, toCol);
            
            // 清除选中状态
            selectedPiece.position.y = 0.15; // 恢复原始高度
            selectedPiece = null;
            if (onPieceDeselected) {
              onPieceDeselected();
            }
          } else {
            // 移动不合法，取消选择
            selectedPiece.position.y = 0.15;
            selectedPiece = null;
            if (onPieceDeselected) {
              onPieceDeselected();
            }
          }
        } else {
          // 点击了棋盘空白处，计算目标格子坐标
          const planeY = 0;
          const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
          const intersectPoint = new THREE.Vector3();
          
          if (raycaster.ray.intersectPlane(plane, intersectPoint)) {
            const BOARD_WIDTH = 9;
            const BOARD_HEIGHT = 10;
            const CELL_SIZE = 1;
            const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
            const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;
            
            const toCol = Math.round((intersectPoint.x - startX) / CELL_SIZE);
            const toRow = Math.round((intersectPoint.z - startZ) / CELL_SIZE);
            
            // 获取起始位置
            const fromRow = (selectedPiece as any).userData.row;
            const fromCol = (selectedPiece as any).userData.col;
            
            // 验证移动是否合法
            if (isValidMove(chessStore.board, fromRow, fromCol, toRow, toCol)) {
              // 执行移动
              executeMoveCallback(fromRow, fromCol, toRow, toCol);
              
              // 清除选中状态
              selectedPiece.position.y = 0.15;
              selectedPiece = null;
              if (onPieceDeselected) {
                onPieceDeselected();
              }
            } else {
              // 移动不合法，取消选择
              selectedPiece.position.y = 0.15;
              selectedPiece = null;
              if (onPieceDeselected) {
                onPieceDeselected();
              }
            }
          }
        }
        
        return;
      }
      
      // 递归检测所有子对象（包括文字贴图）
      const pieceIntersects = raycaster.intersectObjects(piecesGroup.children, true);

      if (pieceIntersects.length > 0) {
        let selectedObject = pieceIntersects[0].object as THREE.Mesh;
        
        // 如果点击的是文字贴图（子对象），找到父对象（棋子主体）
        while (selectedObject.parent && selectedObject.parent !== piecesGroup) {
          selectedObject = selectedObject.parent as THREE.Mesh;
        }
        
        // 检查是否是死子（被吃掉的棋子不能再移动）
        if ((selectedObject as any).userData.isCaptured) {
          return; // 死子不能拖动
        }
        
        // 检查是否是当前行棋方的棋子
        const { piece } = (selectedObject as any).userData;
        const pieceColor = piece > 0 ? 'red' : 'black';
        
        // 研究模式：可以点击任何棋子；普通模式：只能点击己方棋子
        if (!chessStore.isStudyMode && pieceColor !== chessStore.currentPlayer) {
          // 可选：添加视觉反馈（如闪烁效果）
          const material = (selectedObject as THREE.Mesh).material;
          if (material instanceof THREE.MeshStandardMaterial) {
            const originalEmissive = material.emissive.getHex();
            material.emissive.setHex(0xff0000); // 红色闪烁
            setTimeout(() => {
              material.emissive.setHex(originalEmissive);
            }, 200);
          }
          
          return;
        }
        
        // ✅ 根据移动模式处理
        if (moveMode === 'drag') {
          // 拖动模式：立即开始拖动
          draggedPiece = selectedObject;
          isDragging = true;
            
          // 计算拖动偏移量（保持棋子与鼠标的相对位置）
          const planeY = 0.5; // 拖动平面高度
          const intersectPoint = new THREE.Vector3();
          const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
          raycaster.ray.intersectPlane(plane, intersectPoint);
            
          dragOffset.copy(selectedObject.position).sub(intersectPoint);
            
          // 抬起棋子
          selectedObject.position.y = 0.8;
          
          // ✅ 触发棋子选中回调，显示合法落点指示器
          if (onPieceSelected) {
            onPieceSelected(piece, (selectedObject as any).userData.row, (selectedObject as any).userData.col);
          }
            
          // 临时禁用控制器，避免冲突
          controls.enabled = false;
        } else {
          // 两次点击模式
          if (selectedPiece === selectedObject) {
            // 点击同一个棋子，取消选择
            selectedPiece = null;
            if (onPieceDeselected) {
              onPieceDeselected();
            }
          } else {
            // 如果有之前选中的棋子，先清除
            if (selectedPiece && onPieceDeselected) {
              onPieceDeselected();
            }
            
            // 选中新棋子
            selectedPiece = selectedObject;
            
            // 抬起棋子（更高）
            selectedObject.position.y = 1.2;
            
            // 触发棋子选中回调，显示合法落点指示器
            if (onPieceSelected) {
              onPieceSelected(piece, (selectedObject as any).userData.row, (selectedObject as any).userData.col);
            }
          }
        }

        return;
      }
    }
  }

  /**
   * 鼠标移动事件 - 拖动棋子跟随鼠标
   */
  function onMouseMove(event: MouseEvent) {
    if (!isDragging || !draggedPiece || !container) return;

    // 计算鼠标位置
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // 射线检测
    raycaster.setFromCamera(mouse, camera);
    
    // 在水平面上投射
    const planeY = 0.5;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
    const intersectPoint = new THREE.Vector3();
    
    if (raycaster.ray.intersectPlane(plane, intersectPoint)) {
      // 更新棋子位置（保持偏移量）
      draggedPiece.position.x = intersectPoint.x + dragOffset.x;
      draggedPiece.position.z = intersectPoint.z + dragOffset.z;
    }
  }

  /**
   * 鼠标释放事件 - 放置棋子
   */
  function onMouseUp(event: MouseEvent) {
    if (!isDragging || !draggedPiece || !container) {
      isDragging = false;
      draggedPiece = null;
      return;
    }

    // 计算鼠标位置
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // 射线检测棋盘平面
    raycaster.setFromCamera(mouse, camera);
    const planeY = 0;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
    const intersectPoint = new THREE.Vector3();
    
    if (raycaster.ray.intersectPlane(plane, intersectPoint)) {
      // 计算目标格子坐标
      const BOARD_WIDTH = 9;
      const BOARD_HEIGHT = 10;
      const CELL_SIZE = 1;
      const startX = -((BOARD_WIDTH - 1) * CELL_SIZE) / 2;
      const startZ = -((BOARD_HEIGHT - 1) * CELL_SIZE) / 2;
      
      const toCol = Math.round((intersectPoint.x - startX) / CELL_SIZE);
      const toRow = Math.round((intersectPoint.z - startZ) / CELL_SIZE);
      
      // 获取起始位置
      const fromRow = (draggedPiece as any).userData.row;
      const fromCol = (draggedPiece as any).userData.col;
      
      // 验证移动是否合法
      if (isValidMove(chessStore.board, fromRow, fromCol, toRow, toCol)) {
        // 执行移动
        executeMoveCallback(fromRow, fromCol, toRow, toCol);
      } else {
        // 移动不合法，回到原位
        resetPiecePositionFunc(draggedPiece);
      }
    } else {
      // 没有命中棋盘，回到原位
      resetPiecePositionFunc(draggedPiece);
    }
    
    // 重置拖动状态
    isDragging = false;
    draggedPiece = null;
    
    // ✅ 触发棋子取消选中回调，清除合法落点指示器
    if (onPieceDeselected) {
      onPieceDeselected();
    }
    
    // 恢复控制器状态（根据当前修饰键状态）
    if (controls) {
      controls.enabled = true;
    }
  }

  /**
   * 清理鼠标事件监听
   */
  function cleanup() {
    if (renderer && renderer.domElement) {
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
    }
  }

  /**
   * 设置鼠标事件监听
   */
  function setupEventListeners() {
    if (renderer && renderer.domElement) {
      renderer.domElement.addEventListener('mousedown', onMouseDown);
      renderer.domElement.addEventListener('mousemove', onMouseMove);
      renderer.domElement.addEventListener('mouseup', onMouseUp);
    }
  }

  return {
    setupEventListeners,
    cleanup,
    getDraggedPiece: () => draggedPiece,
    setIsDragging: (value: boolean) => { isDragging = value; }
  };
}
