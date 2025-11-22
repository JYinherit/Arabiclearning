/**
 * @fileoverview 管理应用中的临时通知消息。
 */

import * as dom from './dom-elements.js';

/**
 * 在屏幕顶部显示一条临时通知消息。
 * @param {string} message - 要显示的消息文本。
 * @param {boolean} isSuccess - 消息类型，true为成功（绿色），false为错误（红色）。
 */
export function showNotification(message, isSuccess = true) {
    const messageDiv = document.createElement('div');
    // Revert to using the class names that exist in the stable style.css
    messageDiv.className = `import-message ${isSuccess ? 'import-success' : 'import-error'}`;
    messageDiv.textContent = message;
    
    if (dom.notificationContainer) {
        dom.notificationContainer.appendChild(messageDiv);
        
        // 3秒后自动开始消失动画
        setTimeout(() => {
            messageDiv.classList.add('fade-out');
            // 确保动画结束后从DOM中移除元素
            // 添加一个额外的setTimeout，以防transitionend事件不按预期触发
            const transitionDuration = parseFloat(getComputedStyle(messageDiv).transitionDuration) * 1000;
            setTimeout(() => {
                console.log('[DEBUG] Forcing notification removal after transition time.');
                messageDiv.remove();
            }, transitionDuration + 100); // 动画时长 + 100ms 缓冲
            
            // 原始的transitionend监听器可以保留作为主要移除机制
            messageDiv.addEventListener('transitionend', () => {
                console.log('[DEBUG] Transition ended. Removing notification (via event listener).');
                messageDiv.remove();
            }, { once: true }); // 使用 once: true 确保只触发一次
        }, 3000);
    }
}
