/**
 * @fileoverview 负责管理应用中主要屏幕/视图的显示与隐藏。
 */

import * as dom from './dom-elements.js';
import { hideRecallOverlay } from './card-controller.js';

/**
 * 在当前页面内显示一个特定的屏幕（例如，开始、卡片、完成屏幕）。
 * @param {HTMLElement} screen - 要显示的屏幕元素。
 */
export function showScreen(screen) {
    // 隐藏所有页面中的所有主要屏幕，以确保状态干净。
    const allScreens = document.querySelectorAll('#start-screen, #card-container, #completion-screen');
    allScreens.forEach(s => {
        if (s) {
            // 如果正在隐藏卡片容器，请确保回忆遮罩层也被隐藏并清除其计时器。
            if (s.id === 'card-container' && s.style.display !== 'none') {
                hideRecallOverlay();
            }
            s.style.display = 'none';
        }
    });
    
    // 显示目标屏幕。
    if (screen) {
        screen.style.display = 'block';
    }
}
