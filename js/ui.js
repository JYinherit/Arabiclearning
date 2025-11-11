/**
 * @fileoverview 管理所有与 UI 相关的逻辑和 DOM 操作。
 * 该模块负责显示/隐藏屏幕、更新学习卡片、
 * 管理模态框以及处理应用的所有视觉方面。
 */

import * as dom from './dom.js';
import { saveSetting, getSetting } from './storage.js';
import { STORAGE_KEYS } from './constants.js';

// ui.js模块级变量
let isCardListenerAdded = false;

// --- 屏幕管理 ---

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

// --- 学习卡片 UI ---

/**
 * 更新会话进度条。
 * @param {number} completed - 已完成的单词数。
 * @param {number} total - 会话中的总单词数。
 */
export function updateProgressBar(completed, total) {
    if (!dom.progressBar) return; 
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    dom.progressBar.style.width = `${percentage}%`;
    dom.progressBar.textContent = `${completed} / ${total}`;
}

/**
 * 根据当前学习模式在闪卡上渲染一个单词。
 * @param {object} word - 要显示的单词对象。
 * @param {string} currentMode - 当前的学习模式 ('ar-zh', 'zh-ar', 或 'mixed')。
 */
let _wordProvider = () => null;
let _currentModeProvider = () => 'zh-ar';

/**
 * 更新卡片以显示特定的义项。
 * @param {object} definition - 要显示的义项对象。
 * @param {object} word - 包含该义项的完整单词对象。
 * @private
 */
function _updateCardDefinition(definition, word) {
    const { wordDisplay, answerDisplay, explanationDisplay } = dom;
    const mode = _currentModeProvider();
    const isArZh = mode === 'ar-zh';

    wordDisplay.innerHTML = (isArZh ? word.arabic : definition.chinese).replace(/\n/g, '<br>');
    answerDisplay.innerHTML = (isArZh ? definition.chinese : word.arabic).replace(/\n/g, '<br>');
    wordDisplay.dir = isArZh ? 'rtl' : 'ltr';
    answerDisplay.dir = isArZh ? 'ltr' : 'rtl';
    
    explanationDisplay.textContent = `💡 解释: ${definition.explanation}`;

    // 重置遮挡状态
    answerDisplay.classList.replace('revealed', 'spoiler');
    explanationDisplay.classList.replace('revealed', 'spoiler');
}

/**
 * 为卡片屏幕上的交互元素（如义项切换）设置事件监听器。
 * @param {Function} wordProvider - 一个返回当前活动单词的函数。
 * @param {Function} currentModeProvider - 一个返回当前学习模式的函数。
 */
export function initCardEventListeners(wordProvider, currentModeProvider) {
    _wordProvider = wordProvider;
    _currentModeProvider = currentModeProvider;
    
    if (!isCardListenerAdded) {
        dom.definitionToggleContainer.addEventListener('click', handleDefinitionToggle);
        isCardListenerAdded = true;
    }
}

function handleDefinitionToggle(e) {
    const button = e.target.closest('.definition-toggle-btn');
    if (!button) return;

    const word = _wordProvider();
    const index = parseInt(button.dataset.index, 10);

    if (word && word.definitions[index]) {
        _updateCardDefinition(word.definitions[index], word);
        dom.definitionToggleContainer.querySelector('.active')?.classList.remove('active');
        button.classList.add('active');
    }
}


/**
 * 根据当前学习模式在闪卡上渲染一个单词。
 * @param {object} word - 要显示的单词对象。
 * @param {string} currentMode - 当前的学习模式 ('ar-zh', 'zh-ar', 或 'mixed')。
 */
export function displayCard(word, currentMode) {
    if (!word || !word.definitions?.[0]) {
        console.error('无法显示卡片：无效的单词对象。', word);
        return;
    }

    const { definitionToggleContainer: toggleContainer } = dom;
    toggleContainer.innerHTML = '';

    // 如果单词有多个义项，则创建义项切换按钮。
    if (word.definitions.length > 1) {
        word.definitions.forEach((def, index) => {
            const button = document.createElement('button');
            button.className = 'definition-toggle-btn';
            button.textContent = `义项 ${index + 1}`;
            button.dataset.index = index;
            toggleContainer.appendChild(button);
        });
        // 默认激活第一个按钮。
        toggleContainer.firstChild?.classList.add('active');
    }
    
    // 默认显示第一个义项。
    _updateCardDefinition(word.definitions[0], word);
}

/** 切换闪卡上答案的可见性。 */
export function toggleAnswerVisibility() {
    dom.answerDisplay.classList.toggle('spoiler');
    dom.answerDisplay.classList.toggle('revealed');
}

/** 切换闪卡上解释的可见性。 */
export function toggleExplanationVisibility() {
    dom.explanationDisplay.classList.toggle('spoiler');
    dom.explanationDisplay.classList.toggle('revealed');
}

let recallTimer = null;
let countdownInterval = null;

/** 显示主动回忆遮罩层，持续一段时间。 */
export function showRecallOverlay(duration = 5) {
    if (!dom.recallOverlay || !dom.timerCountdown) return;
    
    // 清理旧定时器
    if (recallTimer) {
        clearTimeout(recallTimer);
        recallTimer = null;
    }
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    let timeLeft = duration;
    dom.timerCountdown.textContent = timeLeft;
    dom.recallOverlay.style.display = 'flex';

    // 立即隐藏答案，并显示遮罩层。
    dom.answerDisplay.classList.replace('revealed', 'spoiler');
    dom.explanationDisplay.classList.replace('revealed', 'spoiler');


    // 计时结束后自动显示答案
    recallTimer = setTimeout(() => {
        dom.recallOverlay.style.display = 'none';
        toggleAnswerVisibility(); // 自动显示答案
        // 确保清除倒计时，以防它还在运行
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    }, duration * 1000); // 持续 duration 秒
    
    // 每秒更新倒计时显示
    countdownInterval = setInterval(() => {
        timeLeft--;
        dom.timerCountdown.textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(countdownInterval); // 倒计时结束
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

// --- 主屏幕 UI ---

/**
 * 在主屏幕上生成词库选择按钮。
 * @param {object} decks - 一个对象，键是词库名，值是单词数组。
 * @param {Function} startSessionCallback - 当选择一个词库时触发的回调函数。
 */
export function setupSelectionScreen(collections, startSessionCallback) {
    dom.deckSelectionContainer.innerHTML = ''; // 清空容器

    Object.keys(collections).forEach(collectionName => {
        const collection = collections[collectionName];

        // 创建一个 <details> 元素作为可折叠的容器
        const details = document.createElement('details');
        details.className = 'collection-container';

        // 创建 <summary> 作为集合的头部和切换器
        const summary = document.createElement('summary');
        summary.className = 'collection-header';

        const title = document.createElement('span');
        title.textContent = `${collectionName} (${collection.wordCount}词)`;
        summary.appendChild(title);

        const studyButton = document.createElement('button');
        studyButton.textContent = '学习此集合';
        studyButton.className = 'btn btn-small';
        studyButton.onclick = (e) => {
            e.preventDefault(); // 阻止 <details> 折叠/展开
            startSessionCallback(collectionName, false);
        };
        summary.appendChild(studyButton);

        details.appendChild(summary);

        // 为该集合下的每个子词库创建按钮
        const subDecksContainer = document.createElement('div');
        subDecksContainer.className = 'sub-decks-container';

        for (const deckName in collection.subDecks) {
            const subDeck = collection.subDecks[deckName];
            const button = document.createElement('button');
            button.textContent = `${deckName} (${subDeck.wordCount}词)`;
            button.className = 'btn deck-btn';
            button.disabled = subDeck.wordCount === 0;
            button.onclick = () => {
                const fullDeckIdentifier = `${collectionName}//${deckName}`;
                startSessionCallback(fullDeckIdentifier, false);
            };
            subDecksContainer.appendChild(button);
        }

        details.appendChild(subDecksContainer);
        dom.deckSelectionContainer.appendChild(details);
    });
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
    dom.forgotBtn.style.display = 'none';
    dom.hardBtn.style.display = 'none';
    dom.easyBtn.style.display = 'none';
    dom.nextWordInHistoryBtn.style.display = 'block';
}

/** 退出“回顾历史”模式，重新启用评分按钮。 */
export function exitReviewMode() {
    dom.forgotBtn.style.display = 'inline-block';
    dom.hardBtn.style.display = 'inline-block';
    dom.easyBtn.style.display = 'inline-block';
    dom.nextWordInHistoryBtn.style.display = 'none';
}

// --- 模态框与通知 ---

/** 在屏幕顶部显示一条临时通知消息。 */
export function showImportMessage(message, isSuccess = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `import-message ${isSuccess ? 'import-success' : 'import-error'}`;
    messageDiv.textContent = message;
    dom.notificationContainer.appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 3000);
}

/** 通过添加 'visible' 类来打开一个模态框。 */
function openModal(modalElement) {
    // 为确保一次只显示一个模态框，先关闭所有已打开的。
    const visibleModals = document.querySelectorAll('.modal.visible');
    visibleModals.forEach(modal => modal.classList.remove('visible'));

    if (modalElement) modalElement.classList.add('visible');
}

/** 通过移除 'visible' 类来关闭一个模态框。 */
function closeModal(modalElement) {
    if (modalElement) modalElement.classList.remove('visible');
}

export const openStatsModal = () => openModal(dom.statsModal);

/**
 * Bug 修复：动态渲染学习统计模态框中的内容。
 * 此函数解决了统计数据只在页面加载时渲染一次的问题，
 * 确保了每次打开模态框时都能显示最新的统计数据。
 * @param {Array<object>} statsSummary - 从 stats.js 的 getStatsSummary 生成的数据。
 */
export function renderStats(statsSummary) {
    if (!dom.statsContent) return;
    dom.statsContent.innerHTML = ''; // 清空现有内容

    statsSummary.forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'stats-category';

        const categoryTitle = document.createElement('h3');
        categoryTitle.textContent = category.category;
        categoryDiv.appendChild(categoryTitle);

        const statsList = document.createElement('ul');
        category.stats.forEach(stat => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `<strong>${stat.label}:</strong> ${stat.value}`;
            statsList.appendChild(listItem);
        });

        categoryDiv.appendChild(statsList);
        dom.statsContent.appendChild(categoryDiv);
    });
}

export const closeStatsModal = () => closeModal(dom.statsModal);
export const openClearDataModal = () => openModal(dom.clearDataModal);
export const closeClearDataModal = () => closeModal(dom.clearDataModal);
export const closeContinueSessionModal = () => closeModal(dom.continueSessionModal);

/**
 * 打开“继续会话”模态框并为其按钮附加回调。
 * @param {Function} onConfirm - “继续”按钮的回调。
 * @param {Function} onDecline - “重新开始”按钮的回调。
 */
export function openContinueSessionModal(onConfirm, onDecline) {
    if (!dom.continueSessionModal) return;

    // 使用cloneNode清理旧监听器
    dom.confirmContinueBtn.replaceWith(dom.confirmContinueBtn.cloneNode(true));
    dom.declineContinueBtn.replaceWith(dom.declineContinueBtn.cloneNode(true));
    
    // 重新获取引用
    const confirmBtn = document.getElementById('confirm-continue-btn');
    const declineBtn = document.getElementById('decline-continue-btn');
    
    confirmBtn.addEventListener('click', () => {
        onConfirm();
        closeContinueSessionModal();
    });
    
    declineBtn.addEventListener('click', () => {
        onDecline();
        closeContinueSessionModal();
    });
    
    openModal(dom.continueSessionModal);
}

// --- 设置 UI ---

/**
 * 使用从存储中加载的值初始化设置 UI。
 */
export async function initSettingsUI() {
    const settings = {
        [STORAGE_KEYS.STUDY_MODE]: 'zh-ar',
        [STORAGE_KEYS.RECALL_MODE]: false,
        [STORAGE_KEYS.DAILY_REVIEW_WORDS]: 30,
        [STORAGE_KEYS.DAILY_NEW_WORDS]: 10,
        [STORAGE_KEYS.THEME]: 'default',
    };

    for (const key in settings) {
        settings[key] = await getSetting(key, settings[key]);
    }

    const modeRadio = document.querySelector(`input[name="mode"][value="${settings[STORAGE_KEYS.STUDY_MODE]}"]`);
    if (modeRadio) modeRadio.checked = true;
    if (dom.recallSetting) dom.recallSetting.checked = settings[STORAGE_KEYS.RECALL_MODE];
    if (dom.dailyReviewWordsInput) dom.dailyReviewWordsInput.value = settings[STORAGE_KEYS.DAILY_REVIEW_WORDS];
    if (dom.dailyNewWordsInput) dom.dailyNewWordsInput.value = settings[STORAGE_KEYS.DAILY_NEW_WORDS];

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.value = settings[STORAGE_KEYS.THEME];
        applyTheme(settings[STORAGE_KEYS.THEME]);
    }
}

/**
 * 为设置页面上的所有控件设置事件监听器。
 */
export function setupSettingsListeners() {
    if (!dom.settingsPage) return;

    dom.settingsPage.addEventListener('change', (e) => {
        const target = e.target;
        let key = null;
        let value = null;
        let callback = null;

        if (target.matches('input[name="mode"]')) {
            key = STORAGE_KEYS.STUDY_MODE;
            value = target.value;
        } else if (target.matches('#recall-setting')) {
            key = STORAGE_KEYS.RECALL_MODE;
            value = target.checked;
        } else if (target.matches('#daily-review-words')) {
            key = STORAGE_KEYS.DAILY_REVIEW_WORDS;
            value = parseInt(target.value, 10) || 30;
        } else if (target.matches('#daily-new-words')) {
            key = STORAGE_KEYS.DAILY_NEW_WORDS;
            value = parseInt(target.value, 10) || 10;
        } else if (target.matches('#theme-select')) {
            key = STORAGE_KEYS.THEME;
            value = target.value;
            callback = applyTheme;
        }

        if (key !== null) {
            saveSetting(key, value);
            if (callback) {
                callback(value);
            }
        }
    });
}

/**
 * 在文档 body 上应用选定的主题类。
 * @param {string} themeName - 要应用的主题名称。
 */
export function applyTheme(themeName) {
    document.body.className = ''; // 清除所有现有类
    if (themeName !== 'default') {
        document.body.classList.add(`theme-${themeName}`);
    }
}
