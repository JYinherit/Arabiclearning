/**
 * @fileoverview 应用的主入口和控制器。
 * 该文件协调整个应用的生命周期，包括：
 * - 初始化所有模块 (存储, UI, 统计等)。
 * - 管理全局状态 (词汇, 会话状态等)。
 * - 处理核心学习循环逻辑 (开始会话, 显示单词, 处理评分)。
 * - 设置所有主要的事件监听器。
 */

import * as dom from './dom.js';
import * as ui from './ui.js';
import * as storage from './storage.js';
import * as stats from './stats.js';
import { handleFileImport } from './parser.js';
import ReviewScheduler, { RATING } from './memory.js';
import { setupRegularStudy } from './regularStudy.js';
import { initImporter } from './importer.js';
import { STORAGE_KEYS } from './constants.js';
import { dbManager } from './db.js';

// --- 全局状态 ---
const arabicQuotes = [
    {
        arabic: "مَنْ طَلَبَ الْعُلَا سَهِرَ اللَّيَالِي",
        chinese: "追求卓越的人，必须彻夜不眠。"
    },
    {
        arabic: "اطلبوا العلم من المهد إلى اللحد",
        chinese: "从摇篮到坟墓，求知不倦。"
    },
    {
        arabic: "الصبر مفتاح الفرج",
        chinese: "忍耐是解脱的关键。"
    },
    {
        arabic: "العقل السليم في الجسم السليم",
        chinese: "健康的身体孕育健康的心灵。"
    },
    {
        arabic: "خير الكلام ما قل ودل",
        chinese: "最好的言辞是简明扼要的。"
    },
    {
        arabic: "لا تؤجل عمل اليوم إلى الغد",
        chinese: "今日事，今日毕。"
    },
    {
        arabic: "الوحدة خير من جليس السوء",
        chinese: "宁可孤独，不与恶为伴。"
    },
    {
        arabic: "من جد وجد",
        chinese: "功夫不负有心人。"
    },
    {
        arabic: "ما كل ما يتمنى المرء يدركه",
        chinese: "事事未必尽如人意。"
    },
    {
        arabic: "الوقاية خير من العلاج",
        chinese: "预防胜于治疗。"
    }
];
const vocabularyWords = []; // 所有单词数据的唯一真实来源，在启动时加载。
const currentDeckNameRef = { value: '' }; // 用于保存当前活动词库名称的引用对象。
let activeWords = []; // 当前会话单词的深拷贝，包含其学习进度。
let currentWord = null; // 当前在闪卡上显示的单词。
let historyStack = []; // 用于“上一个”按钮的单词历史记录栈。
const currentModeRef = { value: 'zh-ar' }; // 当前学习模式的引用 (例如, 'zh-ar', 'ar-zh')。
let isReviewingHistory = false; // 标记是否正在回顾历史，此时应禁用评分。
const isSessionActiveRef = { value: false }; // 标记学习会话是否正在进行中。

// --- 特定会话的状态 ---
let sessionQueue = []; // 当前会话中待学习的单词队列。
let sessionState = {}; // 保存整个当前会话状态的对象，用于保存/恢复。
let sessionStartDate = null; // 当前会话开始的日期，用于统计。
let isFsrsSession = false; // 标记当前是否为 FSRS 会话。

// --- 模块实例 ---
const scheduler = new ReviewScheduler(); // FSRS 记忆调度器实例。
let regularStudyModule = null; // “规律学习”功能的模块实例。

// --- 新增：规律学习模态框DOM引用 ---
const regularStudyScopeModal = document.getElementById('regular-study-scope-modal');
const regularStudyOptionsContainer = document.getElementById('regular-study-options-container');
const regularStudyModalCloseBtn = regularStudyScopeModal.querySelector('.close-button');


/**
 * 为当前会话准备一份词汇的深拷贝。
 * @param {Array} vocabulary - 用于会话的单词对象数组。
 */
function initialize(vocabulary) {
    activeWords = JSON.parse(JSON.stringify(vocabulary));
    historyStack = [];
    currentWord = null;
}

/**
 * 为给定的词库开始一个新的学习会话。
 * @param {string} deckName - 要学习的词库名称。
 * @param {boolean} [enableFsrs=false] - 标记这是否是一个规律 (FSRS) 学习会话。
 * @param {object} [options={}] - 附加选项，如预先计算好的学习队列。
 */
async function startSession(deckName, enableFsrs = false, options = {}) {
    isFsrsSession = enableFsrs; // 设置 FSRS 会话标志
    // 从全局词汇中筛选出所选词库的单词。
    const deckWords = vocabularyWords.filter(w => w.definitions.some(d => d.sourceDeck.startsWith(deckName)));
    console.log(`[Main] 开始词库会话: "${deckName}", 找到单词数: ${deckWords.length}, FSRS 启用: ${isFsrsSession}`);
    
    await stats.onSessionStart();

    if (deckWords.length === 0) {
        ui.showImportMessage('此词库中没有单词！', false);
        return;
    }

    // 获取词库中所有单词的进度，以确保它们已初始化。
    const arabicKeys = deckWords.map(w => w.arabic);
    const progressMap = await dbManager.getWordProgressBatch(arabicKeys);
    const wordsWithProgress = deckWords.map(word => {
        const savedProgress = progressMap.get(word.arabic);
        return savedProgress ? { ...word, progress: savedProgress } : scheduler.initializeWord(word);
    });

    initialize(wordsWithProgress);
    currentDeckNameRef.value = deckName;
    storage.saveSetting(STORAGE_KEYS.LAST_ACTIVE_DECK, deckName);

    let savedSession = null;
    try {
        savedSession = await storage.loadSessionState(deckName);
    } catch (error) {
        console.error(`[Main] 恢复会话 "${deckName}" 失败，可能数据已损坏。`, error);
        ui.showImportMessage('恢复会话失败，将开始新会话。', false);
        await storage.clearSessionState(deckName); // 清理损坏的会话状态
    }

    // 会话初始化后启动 UI 的通用逻辑。
    const start = () => {
        sessionStartDate = new Date().toDateString();
        isSessionActiveRef.value = true;
        switchToPage('study-page');
        ui.showScreen(dom.cardContainer);
        showNextWord();
    };

    // 如果存在已保存的会话，询问用户是否继续。
    if (savedSession) {
        ui.openContinueSessionModal(
            () => { // onConfirm: 恢复会话
                restoreSessionState(savedSession);
                start();
            },
            () => { // onDecline: 开始新会话
                if (options.precomputedQueue) {
                    initializeNewSessionWithQueue(options.precomputedQueue);
                } else {
                    initializeNewSession(activeWords);
                }
                start();
            }
        );
    } else {
        // 没有已保存的会话，开始一个新会话。
        if (options.precomputedQueue) {
            initializeNewSessionWithQueue(options.precomputedQueue);
        } else {
            initializeNewSession(activeWords);
        }
        start();
    }
}

/**
 * 恢复先前保存的会话状态。
 * @param {object} savedState - 从存储中加载的会话状态对象。
 */
function restoreSessionState(savedState) {
    if (!savedState) return;
    try {
        sessionState = {
            ...savedState,
            sessionLearnedCount: new Map(savedState.sessionLearnedCount || []),
            sessionWordsState: new Map(savedState.sessionWordsState || [])
        };
        // 从活动词库中重新关联完整的单词对象，以恢复会话队列。
        sessionQueue = savedState.sessionQueue
            .map(wordKey => activeWords.find(w => w.arabic === wordKey.arabic))
            .filter(Boolean); // 过滤掉任何可能已不存在的单词。
    } catch (error) {
        console.error('恢复会话失败，将开始一个新会话。', error);
        initializeNewSession(activeWords);
    }
}

/**
 * 使用从规律学习模块预先计算的队列来初始化新会话。
 * @param {Array} precomputedQueue - 要学习的有序单词列表。
 */
function initializeNewSessionWithQueue(precomputedQueue) {
    sessionQueue = [...precomputedQueue];
    sessionState = {
        sessionQueue: sessionQueue.map(w => ({ arabic: w.arabic })),
        completedCount: 0,
        currentSessionTotal: sessionQueue.length,
        sessionWordsState: new Map(),
        sessionLearnedCount: new Map()
    };
}

/**
 * 专为“规律学习”设计，直接从一个预先计算好的队列开始会话。
 * @param {string} deckName - 要用于显示和状态保存的会话名称。
 * @param {boolean} enableFsrs - 始终为 true，表示这是一个 FSRS 会话。
 * @param {object} options - 包含 precomputedQueue 和 fullWordList 的选项对象。
 */
export async function startSessionFromPrecomputedQueue(deckName, enableFsrs, options) {
    isFsrsSession = enableFsrs; // 设置 FSRS 会话标志
    if (!options || !options.precomputedQueue || !options.fullWordList) {
        console.error('[Main] 尝试用不完整的选项来开始预计算会话。');
        ui.showImportMessage('启动学习时发生内部错误。', false);
        return;
    }
    
    if (options.precomputedQueue.length === 0) {
        const quote = arabicQuotes[Math.floor(Math.random() * arabicQuotes.length)];
        dom.quoteContainer.innerHTML = `
            <p class="quote-arabic">${quote.arabic}</p>
            <p class="quote-chinese">${quote.chinese}</p>
        `;
        switchToPage('study-page');
        ui.showScreen(dom.quoteContainer);
        // 强制设置 display 为 flex 以覆盖 showScreen 中的 'block'
        dom.quoteContainer.style.display = 'flex';
        return;
    }

    console.log(`[Main] 开始一个预计算的会话: "${deckName}"`);
    await stats.onSessionStart();

    currentDeckNameRef.value = deckName;
    storage.saveSetting(STORAGE_KEYS.LAST_ACTIVE_DECK, deckName);

    let savedSession = null;
    try {
        savedSession = await storage.loadSessionState(deckName);
    } catch (error) {
        console.error(`[Main] 恢复会话 "${deckName}" 失败，可能数据已损坏。`, error);
        ui.showImportMessage('恢复会话失败，将开始新会话。', false);
        await storage.clearSessionState(deckName);
    }

    const start = () => {
        sessionStartDate = new Date().toDateString();
        isSessionActiveRef.value = true;
        switchToPage('study-page');
        ui.showScreen(dom.cardContainer);
        showNextWord();
    };

    if (savedSession) {
        ui.openContinueSessionModal(
            () => { // onConfirm: 恢复会话
                initialize(options.fullWordList); // 使用完整列表初始化
                restoreSessionState(savedSession);
                start();
            },
            () => { // onDecline: 开始新会话
                initialize(options.fullWordList); // 使用完整列表初始化
                initializeNewSessionWithQueue(options.precomputedQueue);
                start();
            }
        );
    } else {
        // 没有已保存的会话，开始一个新会话。
        initialize(options.fullWordList); // 使用完整列表初始化
        initializeNewSessionWithQueue(options.precomputedQueue);
        start();
    }
}

/**
 * 通过获取当前词库的所有到期单词来初始化新会话。
 * @param {Array} vocabulary - 当前活动词库中的单词。
 */
function initializeNewSession(vocabulary) {
    const dueWords = scheduler.getDueWords(vocabulary);
    sessionQueue = [...dueWords].sort(() => Math.random() - 0.5); // 随机排序以增加多样性
    sessionState = {
        sessionQueue: sessionQueue.map(w => ({ arabic: w.arabic })),
        completedCount: 0,
        currentSessionTotal: sessionQueue.length,
        sessionWordsState: new Map(),
        sessionLearnedCount: new Map()
    };
}

/**
 * 显示会话队列中的下一个单词，如果队列为空则结束会话。
 */
async function showNextWord() {
    isReviewingHistory = false;
    ui.exitReviewMode();

    if (currentWord) {
        historyStack.push(currentWord);
    }
    dom.prevBtn.disabled = historyStack.length === 0;

    if (sessionQueue.length === 0) {
        await completeSession();
        return;
    }

    currentWord = sessionQueue.shift();
    ui.displayCard(currentWord, currentModeRef.value);

    // 如果启用了主动回忆，则显示遮罩。
    if (await storage.getSetting(STORAGE_KEYS.RECALL_MODE, false)) {
        ui.showRecallOverlay(5);
    }
    updateAndSaveSessionState();
}

/**
 * 处理用户对当前单词的评分。
 * @param {number} rating - 来自 RATING 常量的评分 (1, 2, 或 3)。
 */
async function handleRating(rating) {
    if (!currentWord || isReviewingHistory) return;

    // FSRS 模式下，更新单词进度并记录统计数据
    if (isFsrsSession) {
        const { card: updatedWord, isNewCard } = scheduler.processReview(currentWord, rating);
        currentWord = updatedWord;

        if (rating === RATING.EASY) {
            if (isNewCard) {
                await stats.trackWordLearnedToday(currentWord, currentDeckNameRef.value);
                // 如果是规律学习会话，则更新每日新词计数。
                if (regularStudyModule) {
                    await regularStudyModule.incrementTodayLearnedWords(currentDeckNameRef.value);
                }
            }
            updateSessionProgress();
            await showNextWord();
        } else {
            // 重新插入队列中以供复习
            const reinsertPosition = Math.min(sessionQueue.length, Math.floor(Math.random() * 3) + 3);
            sessionQueue.splice(reinsertPosition, 0, currentWord);
            await showNextWord();
        }
    } else {
        // 预览模式下，不记录 FSRS，只处理会话队列
        if (rating === RATING.EASY) {
            updateSessionProgress(); // 仍然更新会话内部进度条
            await showNextWord();
        } else {
            // 重新插入队列中以供复习
            const reinsertPosition = Math.min(sessionQueue.length, Math.floor(Math.random() * 3) + 3);
            sessionQueue.splice(reinsertPosition, 0, currentWord);
            await showNextWord();
        }
    }
}

/**
 * 更新会话状态对象并将其保存到持久化存储中。
 */
async function updateAndSaveSessionState() {
    // 只有在 FSRS 会话中才保存进度。
    if (isFsrsSession) {
        sessionState.sessionQueue = sessionQueue.map(w => ({ arabic: w.arabic }));
        sessionState.sessionLearnedCount = Array.from(sessionState.sessionLearnedCount.entries()); // 序列化
        sessionState.sessionWordsState = Array.from(sessionState.sessionWordsState.entries()); // 序列化
        await storage.saveProgress(currentDeckNameRef.value, activeWords, sessionState);
    }
    ui.updateProgressBar(sessionState.completedCount || 0, sessionState.currentSessionTotal || 0);
}

/**
 * 通过对扁平化的词汇列表进行分组来渲染词库选择界面。
 */
function renderDeckSelection() {
    if (dom.skeletonLoader) dom.skeletonLoader.style.display = 'none';

    const collections = vocabularyWords.reduce((acc, word) => {
        word.definitions.forEach(def => {
            const [collectionName, deckName] = def.sourceDeck.split('//');
            if (!acc[collectionName]) {
                acc[collectionName] = { subDecks: {}, words: new Set() };
            }
            if (!acc[collectionName].subDecks[deckName]) {
                acc[collectionName].subDecks[deckName] = new Set();
            }
            acc[collectionName].subDecks[deckName].add(word);
            acc[collectionName].words.add(word);
        });
        return acc;
    }, {});

    // 将 Set 转换为数组并计算长度
    for (const collectionName in collections) {
        const collection = collections[collectionName];
        collection.wordCount = collection.words.size;
        delete collection.words; // 释放内存

        for (const deckName in collection.subDecks) {
            const wordSet = collection.subDecks[deckName];
            collection.subDecks[deckName] = {
                words: Array.from(wordSet),
                wordCount: wordSet.size
            };
        }
    }

    ui.setupSelectionScreen(collections, startSession);
    ui.showScreen(dom.startScreen);
}

/**
 * 处理从学习会话返回主菜单的逻辑。
 */
async function goBackToMenu() {
    if (isSessionActiveRef.value) {
        const confirmMsg = isFsrsSession
            ? '您确定要退出当前的学习会话吗？进度将会保存。'
            : '您确定要退出当前的预览会话吗？进度将不会被保存。';

        if (!confirm(confirmMsg)) {
            return; // 用户取消，则中止操作
        }

        if (isFsrsSession) {
            await updateAndSaveSessionState();
        }
    }
    isSessionActiveRef.value = false;
    renderDeckSelection();
    switchToPage('decks-page');
    updateNavigationState('decks-page');
}

/**
 * 填充并显示规律学习范围选择模态框。
 * 该函数现在管理一个Tab界面，允许用户在“全局”、“集合”和“词库”学习模式之间选择。
 */
function populateAndShowStudyScopeModal() {
    if (!regularStudyModule) return;

    const collections = regularStudyModule.getCollectionsAndDecks();

    // 获取新的DOM元素
    const tabs = regularStudyScopeModal.querySelectorAll('.tab-btn');
    const tabContents = regularStudyScopeModal.querySelectorAll('.tab-content');
    const collectionOptionsList = document.getElementById('collection-options-list');
    const deckOptionsList = document.getElementById('deck-options-list');

    // 清空旧内容
    collectionOptionsList.innerHTML = '';
    deckOptionsList.innerHTML = '';

    const createCheckboxOption = (text, scopeType, scopeName) => {
        const label = document.createElement('label');
        label.className = 'study-scope-option';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.scopeType = scopeType;
        if (scopeName) {
            checkbox.dataset.scopeName = scopeName;
        }
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(` ${text}`));
        return label;
    };

    // 1. 填充“学习集合”面板
    for (const collectionName of collections.keys()) {
        collectionOptionsList.appendChild(createCheckboxOption(collectionName, 'collection', collectionName));
    }

    // 2. 填充“学习词库”面板
    for (const [collectionName, decks] of collections.entries()) {
        const collectionGroup = document.createElement('div');
        collectionGroup.className = 'study-scope-collection-group';

        const collectionTitle = document.createElement('h4');
        collectionTitle.textContent = collectionName;
        collectionGroup.appendChild(collectionTitle);

        const deckList = document.createElement('div');
        deckList.className = 'study-scope-deck-list';
        for (const deckName of decks) {
            deckList.appendChild(createCheckboxOption(deckName, 'deck', `${collectionName}//${deckName}`));
        }
        collectionGroup.appendChild(deckList);
        deckOptionsList.appendChild(collectionGroup);
    }

    // 3. 重置到默认视图并显示模态框
    switchTab('global'); // 默认显示全局学习
    regularStudyScopeModal.style.display = 'block';
}

/**
 * 切换规律学习模态框中的Tab。
 * @param {string} targetTabId - 要切换到的Tab的ID ('global', 'collection', 'deck')。
 */
function switchTab(targetTabId) {
    const tabs = regularStudyScopeModal.querySelectorAll('.tab-btn');
    const tabContents = regularStudyScopeModal.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === targetTabId));
    tabContents.forEach(content => content.classList.toggle('active', content.id === `tab-${targetTabId}`));
}

/**
 * 为应用设置所有全局事件监听器。
 */
function setupEventListeners() {
    // 为应用设置所有全局事件监听器。
    // 这些事件在 window.onload 后绑定，此时所有核心 DOM 元素都应可用。
    
    // 学习页面核心交互
    dom.answerDisplay.addEventListener('click', ui.toggleAnswerVisibility);
    dom.explanationDisplay.addEventListener('click', ui.toggleExplanationVisibility);
    dom.forgotBtn.addEventListener('click', () => handleRating(RATING.FORGOT));
    dom.hardBtn.addEventListener('click', () => handleRating(RATING.HARD));
    dom.easyBtn.addEventListener('click', () => handleRating(RATING.EASY));
    
    // 历史记录导航
    dom.prevBtn.addEventListener('click', () => {
        if (historyStack.length > 0) {
            currentWord = historyStack.pop();
            ui.displayCard(currentWord, currentModeRef.value);
            dom.prevBtn.disabled = historyStack.length === 0;
            isReviewingHistory = true;
            ui.enterReviewMode();
        }
    });

    // 页面导航
    dom.backToMenuBtn.addEventListener('click', goBackToMenu);
    dom.finishBackToMenuBtn.addEventListener('click', goBackToMenu);
    dom.nextWordInHistoryBtn.addEventListener('click', showNextWord);

    // 监听学习模式设置的更改。
    dom.modeRadioButtons.forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentModeRef.value = e.target.value;
            storage.saveSetting(STORAGE_KEYS.STUDY_MODE, currentModeRef.value);
        });
    });

    // 监听文件导入事件。
    dom.importBtn.addEventListener('click', () => dom.fileInput.click());
    dom.fileInput.addEventListener('change', (event) => {
        handleFileImport(
            event,
            vocabularyWords,
            renderDeckSelection,
            () => storage.saveDecksToStorage(vocabularyWords)
        );
    });

    // 监听数据管理按钮的点击。
    dom.viewStatsBtn.addEventListener('click', () => {
        const summary = stats.getStatsSummary(vocabularyWords);
        ui.renderStats(summary); // Bug 修复：在打开模态框前渲染最新的统计数据。
        ui.openStatsModal();
    });
    dom.statsModalCloseBtn.addEventListener('click', ui.closeStatsModal);
    dom.exportBackupBtn.addEventListener('click', storage.exportAllDataToFile);
    dom.importBackupBtn.addEventListener('click', storage.importBackupFile);
    dom.checkStorageBtn.addEventListener('click', storage.checkStorageUsage);
    
    if (dom.openClearDataModalBtn) {
        dom.openClearDataModalBtn.addEventListener('click', ui.openClearDataModal);
    }
    if (dom.executeClearDataBtn) {
        dom.executeClearDataBtn.addEventListener('click', async () => {
            const options = {
                decks: document.querySelector('input[name="clear-option"][value="decks"]').checked,
                progress: document.querySelector('input[name="clear-option"][value="progress"]').checked,
                sessions: document.querySelector('input[name="clear-option"][value="sessions"]').checked, // 新增：清除未完成的会话状态
                stats: document.querySelector('input[name="clear-option"][value="stats"]').checked,
                settings: document.querySelector('input[name="clear-option"][value="settings"]').checked,
            };

            if (Object.values(options).every(v => !v)) {
                ui.showImportMessage('请至少选择一个要清除的选项', false);
                return;
            }
            if (confirm('此操作不可逆，确定要清除所选数据吗？')) {
                await storage.clearDataGranularly(options, vocabularyWords);
                ui.closeClearDataModal();
                ui.showImportMessage('所选数据已清除！', true);

                // Bug 修复：清除数据后手动重新渲染 UI，而不是依赖页面重载。
                // 这提供了更即时的反馈，并解决了 UI 状态与数据库不同步的问题。
                if (options.decks) {
                    renderDeckSelection();
                }
                if (options.settings) {
                    await ui.initSettingsUI();
                }
                // 无需特别处理统计数据，因为它们只在模态框中显示。
            }
        });
    }
    const closeModalBtn = document.querySelector('#clear-data-modal .close-button');
    if(closeModalBtn) {
        closeModalBtn.addEventListener('click', ui.closeClearDataModal);
    }

    // --- 规律学习模态框事件 ---
    if (dom.regularStudyBtn) {
        dom.regularStudyBtn.addEventListener('click', populateAndShowStudyScopeModal);
    }
    regularStudyModalCloseBtn.addEventListener('click', () => {
        regularStudyScopeModal.style.display = 'none';
    });
    
    // 将Tab切换事件的绑定移到这里，确保只绑定一次
    const tabs = regularStudyScopeModal.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    const startBtn = document.getElementById('regular-study-start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', async () => {
            const activeTab = regularStudyScopeModal.querySelector('.tab-btn.active').dataset.tab;
            let selectedScopes = [];

            if (activeTab === 'global') {
                selectedScopes.push({ type: 'global' });
            } else if (activeTab === 'collection') {
                const checkboxes = document.querySelectorAll('#collection-options-list input[type="checkbox"]:checked');
                checkboxes.forEach(cb => {
                    selectedScopes.push({
                        type: 'collection',
                        name: cb.dataset.scopeName
                    });
                });
            } else if (activeTab === 'deck') {
                const checkboxes = document.querySelectorAll('#deck-options-list input[type="checkbox"]:checked');
                checkboxes.forEach(cb => {
                    selectedScopes.push({
                        type: 'deck',
                        name: cb.dataset.scopeName
                    });
                });
            }

            if (activeTab !== 'global' && selectedScopes.length === 0) {
                ui.showImportMessage('请至少选择一个学习范围。', false);
                return;
            }

            regularStudyScopeModal.style.display = 'none';

            try {
                // `startScopedStudy` 现在接收一个统一的范围数组
                const success = await regularStudyModule.startScopedStudy(selectedScopes);
                if (!success) {
                    ui.showImportMessage('太棒了，所选范围内今天没有需要复习或学习的单词！', true);
                }
            } catch (error) {
                console.error(`[Main] 开始范围学习时出错`, error);
                ui.showImportMessage('开始学习时发生错误。', false);
            }
        });
    }
}

/**
 * 更新底部导航按钮的激活状态。
 * @param {string} activePage - 当前活动页面的 ID。
 */
function updateNavigationState(activePage) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === activePage);
    });
}

/**
 * 切换视图到指定的页面。
 * @param {string} pageId - 要显示的页面的 ID。
 */
function switchToPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }

    // Bug 修复：如果切换到学习页面且会话正在进行中，确保卡片容器是可见的。
    // 这解决了从其他页面（如设置）导航回学习页面时卡片消失的问题。
    if (pageId === 'study-page' && isSessionActiveRef.value) {
        ui.showScreen(dom.cardContainer);
    }

    updateNavigationState(pageId);
}

/**
 * 完成一个已结束的会话。
 */
async function completeSession() {
    await stats.onSessionComplete();
    const allMastered = activeWords.every(w => (w.progress?.stage || 0) >= 4);
    ui.showCompletionScreen(allMastered);
    isSessionActiveRef.value = false;
    await storage.clearSessionState(currentDeckNameRef.value);
    
    // 清理全局状态
    sessionState = {};
    sessionQueue = [];
    historyStack = [];
    currentWord = null;
}

/** 增加当前会话中已完成单词的计数。 */
function updateSessionProgress() {
    if (sessionState) {
        sessionState.completedCount = (sessionState.completedCount || 0) + 1;
    }
}

/**
 * 作为备用方案，显示手动词库选择界面。
 */
function showManualDeckSelection() {
    console.log('[Main] 后备方案: 显示手动词库选择界面。');
    renderDeckSelection();
    switchToPage('decks-page');
    updateNavigationState('decks-page');
}

/**
 * 触发一次全局的规律学习会话。
 * @param {boolean} [isManualTrigger=false] - 是否由用户手动触发。
 */
async function triggerRegularStudy(isManualTrigger = false) {
    if (!regularStudyModule) {
        console.warn('[Main] 规律学习模块未初始化，回退到手动选择。');
        showManualDeckSelection();
        return;
    }

    try {
        console.log('[Main] 尝试开始全局规律学习...');
        const success = await regularStudyModule.startGlobalRegularStudy();

        if (!success && isManualTrigger) {
            ui.showImportMessage('太棒了，今天没有需要复习或学习的单词！', true);
        } else if (!success) {
            // 如果是自动触发且无内容可学，则显示手动选择界面
            showManualDeckSelection();
        }
    } catch (error) {
        console.error('[Main] 开始规律学习时出错:', error);
        if (isManualTrigger) {
            ui.showImportMessage('开始学习时发生错误。', false);
        } else {
            showManualDeckSelection();
        }
    }
}

/**
 * 应用的主入口点，在窗口加载时执行。
 */
window.onload = async () => {
    console.log('应用启动中...');
    if (dom.skeletonLoader) dom.skeletonLoader.style.display = 'block';
    await storage.initializeStorage();
    
    // 并行加载关键的用户设置和数据。
    currentModeRef.value = await storage.getSetting(STORAGE_KEYS.STUDY_MODE, 'zh-ar');
    await Promise.all([
        storage.loadDecksFromStorage(vocabularyWords),
        stats.loadStats()
    ]);

    // 初始化 UI 组件和模块。
    setupNavigation();
    await ui.initSettingsUI();
    ui.setupSettingsListeners();
    setupEventListeners();
    ui.initCardEventListeners(() => currentWord, () => currentModeRef.value);

    initImporter({
        vocabularyWords,
        renderDeckSelection,
        saveDecksToStorageCallback: () => storage.saveDecksToStorage(vocabularyWords)
    });

    regularStudyModule = await setupRegularStudy({
        vocabularyWords,
        startSession: startSessionFromPrecomputedQueue, // 将规律学习的启动指向新函数
        currentDeckNameRef,
        isSessionActiveRef
    });

    console.log('[Main] 应用已加载，所有模块已初始化。');

    // 尝试自动开始一个会话，如果失败则回退到手动选择。
    try {
        await triggerRegularStudy(false);
    } catch (error) {
        console.error('[Main] 在自动开始序列中发生严重故障。正在恢复到手动模式。', error);
        // 清理任何可能已部分初始化的会话状态，以避免脏数据。
        isSessionActiveRef.value = false;
        if (currentDeckNameRef.value) {
            await storage.clearSessionState(currentDeckNameRef.value);
        }
        showManualDeckSelection();
    }
};

/**
 * 为主底部导航栏设置事件监听器。
 */
function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPage = button.getAttribute('data-page');
            
            // 特殊处理：导航到词库页面时，总是重新渲染列表。
            if (targetPage === 'decks-page') {
                renderDeckSelection();
            }
            
            switchToPage(targetPage);
        });
    });
    updateNavigationState('decks-page'); // 默认启动时显示词库页面。
}
