/**
 * Toast 提示工具
 * 提供非阻塞式的用户反馈
 */

// Toast 类型
export type ToastType = 'success' | 'error' | 'warning' | 'info';

// Toast 配置接口
interface ToastConfig {
  message: string;
  type?: ToastType;
  duration?: number; // 毫秒，默认 3000
}

// 当前显示的 Toast 元素
let currentToastElement: HTMLElement | null = null;
let hideTimeout: number | null = null;

/**
 * 显示 Toast 提示
 */
export function showToast(config: ToastConfig) {
  const { message, type = 'info', duration = 3000 } = config;
  
  // 隐藏当前的 Toast
  if (currentToastElement) {
    hideToast();
  }
  
  // 清除之前的定时器
  if (hideTimeout) {
    clearTimeout(hideTimeout);
  }
  
  // 创建 Toast 元素
  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${getIcon(type)}</span>
    <span class="toast-message">${message}</span>
  `;
  
  // 添加到 body
  document.body.appendChild(toast);
  currentToastElement = toast;
  
  // 触发动画
  requestAnimationFrame(() => {
    toast.classList.add('toast-show');
  });
  
  // 自动隐藏
  hideTimeout = window.setTimeout(() => {
    hideToast();
  }, duration);
}

/**
 * 隐藏 Toast
 */
function hideToast() {
  if (!currentToastElement) return;
  
  currentToastElement.classList.remove('toast-show');
  currentToastElement.classList.add('toast-hide');
  
  // 等待动画结束后移除元素
  setTimeout(() => {
    if (currentToastElement && currentToastElement.parentNode) {
      currentToastElement.parentNode.removeChild(currentToastElement);
    }
    currentToastElement = null;
  }, 300);
}

/**
 * 获取图标
 */
function getIcon(type: ToastType): string {
  switch (type) {
    case 'success':
      return '✓';
    case 'error':
      return '✕';
    case 'warning':
      return '⚠';
    case 'info':
    default:
      return 'ℹ';
  }
}

/**
 * 快捷方法
 */
export const toast = {
  success: (message: string, duration?: number) => 
    showToast({ message, type: 'success', duration }),
  error: (message: string, duration?: number) => 
    showToast({ message, type: 'error', duration }),
  warning: (message: string, duration?: number) => 
    showToast({ message, type: 'warning', duration }),
  info: (message: string, duration?: number) => 
    showToast({ message, type: 'info', duration }),
};
