/**
 * @fileoverview 负责学习卡片界面的所有逻辑，
 * 包括主动回忆、完成屏幕、复习模式等。
 */

import * as dom from './dom-elements.js';
import { showScreen } from './screen-manager.js';

let recallTimer = null;
let countdownInterval = null;

/** 
 * 显示主动回忆遮罩层，并开始倒计时。
 * @param {number} duration - 遮罩层显示的秒数。
 */
export function showRecallOverlay(duration = 5) {
    if (!dom.recallOverlay || !dom.timerCountdown) return;
    
    // 清理可能存在的旧定时器
    hideRecallOverlay();

    let timeLeft = duration;
    dom.timerCountdown.textContent = timeLeft;
    dom.recallOverlay.style.display = 'flex';

    // 立即隐藏答案，并显示遮罩层
    dom.answerDisplay.classList.replace('revealed', 'spoiler');
    dom.explanationDisplay.classList.replace('revealed', 'spoiler');

    // 计时结束后自动显示答案
    recallTimer = setTimeout(() => {
        dom.recallOverlay.style.display = 'none';
        dom.answerDisplay.classList.toggle('spoiler');
        dom.answerDisplay.classList.toggle('revealed');
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    }, duration * 1000);
    
    // 每秒更新倒计时显示
    countdownInterval = setInterval(() => {
        timeLeft--;
        dom.timerCountdown.textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    }, 1000);
}

/** 隐藏主动回忆遮罩层并清除其计时器。 */
export function hideRecallOverlay() {
    if (recallTimer) {
        clearTimeout(recallTimer);
        recallTimer = null;
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    if (dom.recallOverlay) {
        dom.recallOverlay.style.display = 'none';
    }
}

/**
 * 显示会话完成屏幕。
 * @param {boolean} allMastered - 如果为 true，则显示一条掌握整个词库的特殊消息。
 */
export function showCompletionScreen(allMastered) {
    if (dom.cardContainer) dom.cardContainer.style.display = 'none';
    
    if (allMastered) {
        dom.completionScreen.querySelector('h2').textContent = '🎉 恭喜你完成了本词库的记忆 🎉';
        dom.completionScreen.querySelector('p').textContent = '所有单词都已牢牢记住！';
    } else {
        dom.completionScreen.querySelector('h2').textContent = '🎉 恭喜！今日任务已全部完成 🎉';
        dom.completionScreen.querySelector('p').textContent = '请明天再来复习吧！';
    }
    showScreen(dom.completionScreen);
}

/** 将 UI 切换到“回顾历史”模式，禁用评分按钮。 */
export function enterReviewMode() {
    if (dom.forgotBtn) dom.forgotBtn.style.display = 'none';
    if (dom.hardBtn) dom.hardBtn.style.display = 'none';
    if (dom.easyBtn) dom.easyBtn.style.display = 'none';
    if (dom.nextWordInHistoryBtn) dom.nextWordInHistoryBtn.style.display = 'block';
}

/** 退出“回顾历史”模式，重新启用评分按钮。 */
export function exitReviewMode() {
    if (dom.forgotBtn) dom.forgotBtn.style.display = 'inline-block';
    if (dom.hardBtn) dom.hardBtn.style.display = 'inline-block';
    if (dom.easyBtn) dom.easyBtn.style.display = 'inline-block';
    if (dom.nextWordInHistoryBtn) dom.nextWordInHistoryBtn.style.display = 'none';
}
