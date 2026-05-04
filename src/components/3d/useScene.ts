import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Ref } from 'vue';

export interface SceneObjects {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  raycaster: THREE.Raycaster;
  mouse: THREE.Vector2;
  lineMaterials: any[];
}

/**
 * Three.js 场景初始化和管理
 */
export function useScene(container: Ref<HTMLDivElement | null>) {
  let scene!: THREE.Scene;
  let camera!: THREE.PerspectiveCamera;
  let renderer!: THREE.WebGLRenderer;
  let controls!: OrbitControls;
  let lineMaterials: any[] = []; // 存储所有 LineMaterial，用于更新分辨率

  // 默认相机位置和视角（用于Ctrl+H重置）
  const DEFAULT_CAMERA_POSITION = new THREE.Vector3(0, 15, 0);
  const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 0, 0);

  /**
   * 初始化 Three.js 场景
   */
  async function initScene(): Promise<SceneObjects> {
    if (!container.value) {
      throw new Error('Container element is not available');
    }

    // 创建场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // 创建相机 - 初始位置正对棋盘（俯视）
    const aspect = container.value.clientWidth / container.value.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(0, 15, 0); // 正上方俯视
    camera.lookAt(0, 0, 0);

    // 创建渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.value.clientWidth, container.value.clientHeight);
    renderer.shadowMap.enabled = true;
    container.value.appendChild(renderer.domElement);

    // 添加轨道控制器 - 始终启用，通过修饰键控制不同操作
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enabled = true; // 始终启用
    
    // 配置鼠标按钮：默认禁用所有操作，由键盘修饰键动态控制
    controls.mouseButtons = {
      LEFT: null,        // 左键默认不执行任何操作
      MIDDLE: null,      // 中键禁用
      RIGHT: null        // 右键禁用
    };

    // 添加灯光
    setupLights();

    // 初始化射线检测
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // 开始渲染循环
    animate();

    return {
      scene,
      camera,
      renderer,
      controls,
      raycaster,
      mouse,
      lineMaterials
    };
  }

  /**
   * 设置灯光
   */
  function setupLights() {
    // 环境光（增强亮度）
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    // 方向光（主光源，增强亮度）
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    scene.add(directionalLight);
  }

  /**
   * 动画循环
   */
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  /**
   * 处理窗口大小变化
   */
  function onWindowResize() {
    if (!container.value) return;
    
    const width = container.value.clientWidth;
    const height = container.value.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    
    // 更新所有 LineMaterial 的分辨率
    lineMaterials.forEach(material => {
      material.resolution.set(width, height);
    });
  }

  /**
   * 重置相机视角到默认位置（棋盘面向视口）
   */
  function resetCameraView() {
    console.log('重置相机视角到默认位置');
    
    // 平滑过渡到默认位置
    const startPosition = camera.position.clone();
    const targetPosition = DEFAULT_CAMERA_POSITION.clone();
    
    // 简单的动画效果（10帧完成）
    let frame = 0;
    const totalFrames = 10;
    
    function animateReset() {
      frame++;
      const t = frame / totalFrames;
      
      // 线性插值
      camera.position.lerpVectors(startPosition, targetPosition, t);
      camera.lookAt(DEFAULT_CAMERA_TARGET);
      
      if (frame < totalFrames) {
        requestAnimationFrame(animateReset);
      } else {
        // 确保最终位置准确
        camera.position.copy(targetPosition);
        camera.lookAt(DEFAULT_CAMERA_TARGET);
        console.log('相机视角已重置');
      }
    }
    
    animateReset();
  }

  /**
   * 清理资源
   */
  function dispose() {
    if (renderer) {
      renderer.dispose();
    }
  }

  return {
    initScene,
    onWindowResize,
    resetCameraView,
    dispose,
    getLineMaterials: () => lineMaterials
  };
}
