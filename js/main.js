import * as dom from './dom.js';
import * as ui from './ui.js';
import * as storage from './storage.js';
import * as stats from './stats.js';
import { handleFileImport } from './parser.js';
import { setupRandomTest } from './random.js';
import ReviewScheduler, { RATING } from './memory.js'; // 导入新的记忆系统
import { setupRegularStudy } from './regularStudy.js';

// --- State Variables ---
const vocabularyDecks = {};
const currentDeckNameRef = { value: '' }; // 使用引用对象以允许跨模块修改
let activeWords = [];
let currentWord = null;
let historyStack = [];
const currentModeRef = { value: storage.getSetting('mode', 'zh-ar') }; // 使用引用对象以允许跨模块修改
let isReviewingHistory = false;
let sessionStartDate = null;
let isSessionActive = false;

// --- Session Management ---
let sessionQueue = []; // 当前学习会话的单词队列
let sessionLearnedCount = new Map(); // 跟踪每个单词在当前会话中被“记得”的次数
const MAX_SESSION_WORDS = 10000; // 每次会话最多学习的单词数
let currentSessionTotal = 0; // 当前会话的实际单词总数
let sessionWordsState = new Map(); // 跟踪会话中单词的状态，例如FSRS是否已锁定
let sessionState = {
    sessionQueue: [],
    sessionLearnedCount: new Map(),
    sessionWordsState: new Map(),
    currentSessionTotal: 0,
    completedCount: 0
};

// 新的记忆调度器
const scheduler = new ReviewScheduler();

// Random Test Module Interface
let randomTestModule = null;

// Regular Study Module Interface (Bug 5 依赖)
let regularStudyModule = null;

// --- Core Logic ---

function initialize(vocabulary, isRandomTest = false) {
  // Bug 4 修复：简化 FSRS 初始化，scheduler.initializeWords 应该负责确保必要的字段存在，避免重复初始化或覆盖。
  activeWords = scheduler.initializeWords(vocabulary);
  
  historyStack = [];
  currentWord = null;

  // 如果是随机测试，则直接填充会话队列
  if (isRandomTest) {
    sessionLearnedCount.clear();
    sessionWordsState.clear();
    // Bug 4 修复：使用 activeWords，其中包含 FSRS 初始化后的数据
    sessionQueue = [...activeWords]; 
    currentSessionTotal = sessionQueue.length;
    ui.updateProgressBar(0, currentSessionTotal);
  }
}


// 修改 startSession 函数
function startSession(vocabulary, deckName, isRandomTest = false) {
    currentDeckNameRef.value = deckName;
    sessionStartDate = new Date().toDateString();

    initialize(vocabulary, isRandomTest);

    const savedProgress = storage.loadProgress(deckName);
    if (savedProgress) {
        // 合并已保存的进度到单词
        activeWords = activeWords.map(word => {
            const saved = savedProgress.find(s => s.chinese === word.chinese && s.arabic === word.arabic);
            return saved ? { ...word, ...saved } : word;
        });
        
        // 恢复会话状态
        const savedSessionState = storage.loadSessionState(deckName);
        if (savedSessionState && !isRandomTest) {
            restoreSessionState(savedSessionState); // Bug 2 修复：不再传入 vocabulary
        }
    }

    // 如果没有恢复会话状态，则初始化新的会话
    if (sessionQueue.length === 0 && !isRandomTest) {
        initializeNewSession(vocabulary);
    }

    if (sessionQueue.length === 0) {
        const allMastered = activeWords.every(w => (w.stage || 0) >= 4);
        ui.showCompletionScreen(allMastered);
        return;
    }

    // 使用恢复的或新的进度更新进度条
    const completedCount = sessionState.completedCount || 0;
    const totalCount = sessionState.currentSessionTotal || sessionQueue.length;
    ui.updateProgressBar(completedCount, totalCount);

    ui.showScreen(dom.cardContainer);
    showNextWord();
}

// 新增函数：恢复会话状态
function restoreSessionState(savedState) {
    // 恢复基本会话状态
    sessionState = {
        ...savedState,
        sessionLearnedCount: new Map(savedState.sessionLearnedCount),
        sessionWordsState: new Map(savedState.sessionWordsState)
    };
    
    // 恢复会话队列（需要找到对应的单词对象）
    sessionQueue = savedState.sessionQueue.map(wordKey => {
        // Bug 2 修复：使用 activeWords 查找，activeWords 包含最新的进度信息
        return activeWords.find(w => w.chinese === wordKey.chinese && w.arabic === wordKey.arabic);
    }).filter(Boolean); // 过滤掉找不到的单词
    
    currentSessionTotal = sessionState.currentSessionTotal;
}

// 新增函数：初始化新会话
function initializeNewSession(vocabulary) {
    const dueWords = scheduler.getDueWords(vocabulary);
    const sessionWords = dueWords.slice(0, MAX_SESSION_WORDS)
                                 .sort(() => Math.random() - 0.5);
    
    sessionQueue = [...sessionWords];
    currentSessionTotal = sessionQueue.length;
    
    // 初始化会话状态
    sessionState = {
        sessionQueue: sessionQueue.map(w => ({ chinese: w.chinese, arabic: w.arabic })), // 只保存关键信息用于恢复
        sessionLearnedCount: new Map(),
        sessionWordsState: new Map(),
        currentSessionTotal: currentSessionTotal,
        completedCount: 0
    };
}

// 修改 showNextWord 函数，更新会话状态
function showNextWord() {
    isReviewingHistory = false;
    ui.exitReviewMode();

    if (currentWord && !historyStack.includes(currentWord)) {
        historyStack.push(currentWord);
    }
    dom.prevBtn.disabled = historyStack.length === 0;

    if (sessionQueue.length === 0) {
        const allMastered = activeWords.every(w => (w.stage || 0) >= 4);
        ui.showCompletionScreen(allMastered);
        // 确保会话结束时进度条达到100%
        ui.updateProgressBar(currentSessionTotal, currentSessionTotal);
        // 清除会话状态
        storage.clearSessionState(currentDeckNameRef.value);
        storage.saveProgress(currentDeckNameRef.value, activeWords);
        return;
    }

    currentWord = sessionQueue.shift();
    ui.displayCard(currentWord, currentModeRef.value);
    
    // 进度条更新逻辑已移至 handleEasy
}

// 修改各个处理函数，保存会话状态
function handleForgot() {
    if (!currentWord || isReviewingHistory) return;
    
    if (!isSessionActive) {
        stats.incrementSessionCount();
        isSessionActive = true;
    }

    const wordState = sessionWordsState.get(currentWord.chinese) || {};
    if (!wordState.fsrsLocked) {
        currentWord = scheduler.processReview(currentWord, RATING.AGAIN);
        wordState.fsrsLocked = true;
        sessionWordsState.set(currentWord.chinese, wordState);
    }

    sessionLearnedCount.set(currentWord.chinese, 0);

    const reinsertIndex = Math.min(sessionQueue.length, Math.floor(Math.random() * 4) + 2);
    sessionQueue.splice(reinsertIndex, 0, currentWord);
    
    // 更新并保存会话状态
    updateAndSaveSessionState();

    showNextWord();
}

function handleHard() {
    if (!currentWord || isReviewingHistory) return;

    if (!isSessionActive) {
        stats.incrementSessionCount();
        isSessionActive = true;
    }

    const wordState = sessionWordsState.get(currentWord.chinese) || {};
    if (!wordState.fsrsLocked) {
        currentWord = scheduler.processReview(currentWord, RATING.HARD);
        wordState.fsrsLocked = true;
        sessionWordsState.set(currentWord.chinese, wordState);
    }

    sessionLearnedCount.set(currentWord.chinese, 0);
    const reinsertIndex = Math.min(sessionQueue.length, Math.floor(Math.random() * 4) + 2);
    sessionQueue.splice(reinsertIndex, 0, currentWord);
    
    // 更新并保存会话状态
    updateAndSaveSessionState();

    showNextWord();
}

function handleEasy() {
    if (!currentWord || isReviewingHistory) return;

    if (!isSessionActive) {
        stats.incrementSessionCount();
        isSessionActive = true;
    }

    const wordId = currentWord.chinese;
    const currentCount = (sessionLearnedCount.get(wordId) || 0) + 1;
    sessionLearnedCount.set(wordId, currentCount);

    if (currentCount < 3) {
        sessionQueue.push(currentWord);
    } else {
        // 单词学习完成
        sessionState.completedCount = (sessionState.completedCount || 0) + 1;

        // Bug 5 依赖：实时跟踪新单词学习进度
        if (regularStudyModule && regularStudyModule.isNewWord(currentWord)) {
            regularStudyModule.incrementTodayLearned(currentDeckNameRef.value);
        }
        // Bug 3 修复：移除重复的进度条更新，现在在 updateAndSaveSessionState 中统一处理

        const wordState = sessionWordsState.get(currentWord.chinese) || {};
        if (!wordState.fsrsLocked) {
            currentWord = scheduler.processReview(currentWord, RATING.EASY);
        }
    }
    
    // 更新并保存会话状态
    updateAndSaveSessionState();

    showNextWord();
}

// 新增函数：更新并保存会话状态
function updateAndSaveSessionState() {
    sessionState = {
        sessionQueue: sessionQueue.map(w => ({ chinese: w.chinese, arabic: w.arabic })),
        sessionLearnedCount: Array.from(sessionLearnedCount.entries()),
        sessionWordsState: Array.from(sessionWordsState.entries()),
        currentSessionTotal: currentSessionTotal,
        completedCount: sessionState.completedCount || 0
    };
    
    storage.saveProgress(currentDeckNameRef.value, activeWords, sessionState);
    
    // Bug 3 修复：统一在此处更新进度条
    ui.updateProgressBar(sessionState.completedCount, currentSessionTotal);
}

function setupDeckSelectionScreen() {
    ui.setupSelectionScreen(vocabularyDecks, startSession);
}

function handlePrev() {
    if (historyStack.length > 0) {
        currentWord = historyStack.pop();
        ui.displayCard(currentWord, currentModeRef.value);
        dom.prevBtn.disabled = historyStack.length === 0;
        isReviewingHistory = true;
        ui.enterReviewMode();
    }
}

function goBackToMenu() {
    ui.showScreen(dom.startScreen);
    isSessionActive = false;
}

// --- Event Listeners ---

function setupEventListeners() {
    // Bug 7 修复：先移除旧监听器，防止重复绑定
    dom.answerDisplay.removeEventListener('click', ui.toggleAnswerVisibility);
    dom.explanationDisplay.removeEventListener('click', ui.toggleExplanationVisibility);
    dom.forgotBtn.removeEventListener('click', handleForgot);
    dom.hardBtn.removeEventListener('click', handleHard);
    dom.easyBtn.removeEventListener('click', handleEasy);
    dom.prevBtn.removeEventListener('click', handlePrev);
    dom.backToMenuBtn.removeEventListener('click', goBackToMenu);
    dom.finishBackToMenuBtn.removeEventListener('click', goBackToMenu);
    dom.nextWordInHistoryBtn.removeEventListener('click', showNextWord);

    dom.answerDisplay.addEventListener('click', ui.toggleAnswerVisibility);
    dom.explanationDisplay.addEventListener('click', ui.toggleExplanationVisibility);

    // 修改为三个按钮
    dom.forgotBtn.addEventListener('click', handleForgot);
    dom.hardBtn.addEventListener('click', handleHard); // 新增
    dom.easyBtn.addEventListener('click', handleEasy); // 新增

    dom.prevBtn.addEventListener('click', handlePrev);
    dom.backToMenuBtn.addEventListener('click', goBackToMenu);
    dom.finishBackToMenuBtn.addEventListener('click', goBackToMenu);
    dom.nextWordInHistoryBtn.addEventListener('click', showNextWord);

    // Settings Modal Listeners
    dom.settingsBtn.addEventListener('click', () => {
        ui.openSettingsModal();
        // 确保单选按钮状态与 currentMode 一致
        dom.modeRadioButtons.forEach(radio => {
            radio.checked = radio.value === currentModeRef.value;
        });
    });
    dom.closeSettingsBtn.addEventListener('click', ui.closeSettingsModal);
    dom.settingsModal.addEventListener('change', (event) => {
        if (event.target.name === 'mode') {
            currentModeRef.value = event.target.value;
            storage.saveSetting('mode', currentModeRef.value);
        }
    });

    // Import Button Listeners
    if (dom.importBtn && dom.fileInput) {
        dom.importBtn.addEventListener('click', () => dom.fileInput.click());
        dom.fileInput.addEventListener('change', (event) => {
            handleFileImport(event, vocabularyDecks,
                setupDeckSelectionScreen, // 使用新的封装函数
                () => storage.saveDecksToStorage(vocabularyDecks)
            );
        });
    } else {
        console.warn("Import buttons not found, import functionality disabled.");
    }

    // Data Management Button Listeners (在设置模态框内)
    if (dom.viewStatsBtn) {
        dom.viewStatsBtn.addEventListener('click', () => {
            alert(stats.getStatsSummary(vocabularyDecks));
        });
    }
    if (dom.exportBackupBtn) {
        dom.exportBackupBtn.addEventListener('click', storage.exportAllDataToFile);
    }
    if (dom.importBackupBtn) {
        dom.importBackupBtn.addEventListener('click', storage.importBackupFile);
    }
    if (dom.checkStorageBtn) {
        dom.checkStorageBtn.addEventListener('click', storage.checkStorageUsage);
    }
    if (dom.clearDataBtn) {
        dom.clearDataBtn.addEventListener('click', storage.clearAllData);
    }
}

// 数据迁移 (在应用启动时调用)
function migrateDataIfNeeded() {
  // Bug 1 修复：检查所有词库中的单词，而不是依赖可能为空的 activeWords
  let needsMigration = false;
  for (const deckName in vocabularyDecks) {
    const deck = vocabularyDecks[deckName];
    if (deck && Array.isArray(deck) && deck.some(word => word.difficulty === undefined)) {
      needsMigration = true;
      console.log(`检测到词库 "${deckName}" 包含旧数据，正在迁移到FSRS系统...`);
      // 使用 scheduler.migrateExistingProgress 处理特定词库
      vocabularyDecks[deckName] = scheduler.migrateExistingProgress(deck);
    }
  }

  if (needsMigration) {
    storage.saveDecksToStorage(vocabularyDecks);
  }
}

// --- Initial Load ---

window.onload = () => {
    storage.loadDecksFromStorage(vocabularyDecks);
    stats.loadStats();
    ui.setupSelectionScreen(vocabularyDecks, startSession);
    ui.showScreen(dom.startScreen);
    setupEventListeners();

    // 迁移数据（如果需要）
    migrateDataIfNeeded();

    // 初始化随机测试模块
    randomTestModule = setupRandomTest({
        vocabularyDecks,
        initialize,
        currentModeRef,
        currentDeckNameRef,
        cardContainer: dom.cardContainer,
        showScreen: ui.showScreen,
        showNextWord,
        incrementSessionCount: stats.incrementSessionCount,
    });
    // 初始化规律学习功能
    regularStudyModule = setupRegularStudy({ // Bug 5 依赖：捕获模块实例
        vocabularyDecks,
        currentDeckNameRef,
        currentModeRef,
        scheduler,
        startSession,
        showScreen: ui.showScreen,
        cardContainer: dom.cardContainer,
        showNextWord,
        incrementSessionCount: stats.incrementSessionCount
    });
};
