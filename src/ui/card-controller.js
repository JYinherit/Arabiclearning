/**
 * @fileoverview 负责学习卡片界面的所有逻辑，
 * 包括主动回忆、完成屏幕、复习模式等。
 */

import * as dom from './dom-elements.js';
import { showScreen } from './screen-manager.js';
import { AIService } from '../services/AIService.js';
import { STORAGE_KEYS, DEFAULT_AI_PROMPT } from '../common/constants.js';
import { showNotification } from './notifications.js';

let recallTimer = null;
let countdownInterval = null;
let storageSvc = null;
let currentWord = null;

/**
 * Initializes the Card Controller with dependencies.
 * @param {import('../infrastructure/StorageService.js').StorageService} storageService
 */
export function initCardController(storageService) {
    storageSvc = storageService;
    setupAIListeners();
}

/**
 * Updates the current word being studied.
 * @param {string} word - The current word.
 */
export function setCurrentWord(word) {
    currentWord = word;
}

/**
 * Helper function to copy text to clipboard with fallback.
 * @param {string} text - The text to copy.
 * @returns {Promise<boolean>} - True if successful, false otherwise.
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.warn('navigator.clipboard failed, trying fallback:', err);
        try {
            const textArea = document.createElement("textarea");
            textArea.value = text;

            // Ensure it's not visible but part of the DOM
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            textArea.style.top = "0";
            document.body.appendChild(textArea);

            textArea.focus();
            textArea.select();

            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            return successful;
        } catch (fallbackErr) {
            console.error('Fallback copy failed:', fallbackErr);
            return false;
        }
    }
}

/**
 * Sets up event listeners for AI features.
 */
function setupAIListeners() {
    const aiBtn = document.getElementById('ai-assist-btn');
    const aiModal = document.getElementById('ai-result-modal');
    const closeAiBtn = document.getElementById('close-ai-result-btn');
    const copyAiBtn = document.getElementById('copy-ai-result-btn');
    const aiContent = document.getElementById('ai-result-content');
    const modalCloseBtn = aiModal ? aiModal.querySelector('.close-button') : null;

    if (aiBtn) {
        aiBtn.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent triggering other card clicks if any
            await handleAIAssist();
        });
    }

    const closeModal = () => {
        if (aiModal) aiModal.style.display = 'none';
    };

    if (closeAiBtn) closeAiBtn.addEventListener('click', closeModal);
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);

    if (aiModal) {
        window.addEventListener('click', (e) => {
            if (e.target === aiModal) {
                closeModal();
            }
        });
    }

    if (copyAiBtn) {
        copyAiBtn.addEventListener('click', async () => {
            if (aiContent && aiContent.textContent) {
                const success = await copyToClipboard(aiContent.textContent);
                if (success) {
                    showNotification('已复制到剪贴板', true);
                } else {
                    showNotification('复制失败', false);
                }
            }
        });
    }
}

/**
 * Handles the AI Assistant button click.
 */
async function handleAIAssist() {
    if (!currentWord) return;

    const apiKey = await storageSvc.getSetting(STORAGE_KEYS.AI_API_KEY);
    const apiUrl = await storageSvc.getSetting(STORAGE_KEYS.AI_API_URL);
    const model = await storageSvc.getSetting(STORAGE_KEYS.AI_MODEL);
    const promptTemplate = await storageSvc.getSetting(STORAGE_KEYS.AI_PROMPT_TEMPLATE) || DEFAULT_AI_PROMPT;

    // If API Key is missing, fallback to Copy Prompt
    if (!apiKey) {
        const prompt = AIService.constructPrompt(promptTemplate, currentWord);
        const success = await copyToClipboard(prompt);
        if (success) {
            showNotification('API 未配置，已复制提示词到剪贴板', true);
        } else {
            showNotification('复制失败，请检查浏览器权限', false);
        }
        return;
    }

    // If API is configured, open modal and stream
    const aiModal = document.getElementById('ai-result-modal');
    const aiContent = document.getElementById('ai-result-content');

    if (aiModal && aiContent) {
        aiContent.textContent = '正在思考中...\n';
        aiModal.style.display = 'block';

        await AIService.generateExplanation(
            {
                word: currentWord,
                apiUrl,
                apiKey,
                model,
                promptTemplate
            },
            (chunk) => {
                // If it's the first chunk, clear the "Thinking..." text
                if (aiContent.textContent === '正在思考中...\n') {
                    aiContent.textContent = '';
                }
                aiContent.textContent += chunk;
                // Auto scroll to bottom
                aiContent.scrollTop = aiContent.scrollHeight;
            },
            (error) => {
                aiContent.textContent += `\n\n[错误]: ${error.message}`;
            },
            () => {
                // Completion callback
            }
        );
    }
}


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
