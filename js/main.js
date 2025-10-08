import * as dom from './dom.js';
import * as ui from './ui.js';
import * as storage from './storage.js';
import * as stats from './stats.js';
import { handleFileImport } from './parser.js';
import { setupRandomTest } from './random.js';
import ReviewScheduler, { RATING } from './memory.js'; // 导入新的记忆系统

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

// 新的记忆调度器
const scheduler = new ReviewScheduler();

// Random Test Module Interface
let randomTestModule = null;

// --- Core Logic ---

function initialize(vocabulary) {
  // 仅初始化单词的FSRS状态，不处理会话逻辑
  activeWords = scheduler.initializeWords(vocabulary.map(word => ({
    ...word,
    // 确保所有单词都有FSRS的默认字段
    ...scheduler.fsrs.initCard(),
    ...word // 原始单词数据覆盖默认值
  })));
  historyStack = [];
  currentWord = null;
}

function showNextWord() {
  isReviewingHistory = false;
  ui.exitReviewMode();

  if (currentWord && !historyStack.includes(currentWord)) {
      historyStack.push(currentWord);
  }
  dom.prevBtn.disabled = historyStack.length === 0;

  if (sessionQueue.length === 0) {
    // 如果会话队列为空，则认为本次学习结束
    const allMastered = activeWords.every(w => (w.stage || 0) >= 4);
    ui.showCompletionScreen(allMastered);
    // 可以在这里保存一次最终进度
    storage.saveProgress(currentDeckNameRef.value, activeWords);
    return;
  }

  // 从会话队列的头部取出一个单词
  currentWord = sessionQueue.shift();

  ui.displayCard(currentWord, currentModeRef.value);
}

function startSession(vocabulary, deckName) {
    currentDeckNameRef.value = deckName;
    sessionStartDate = new Date().toDateString();

    initialize(vocabulary); // 初始化所有单词的FSRS状态

    const savedProgress = storage.loadProgress(deckName);
    if (savedProgress) {
        // 合并已保存的进度
        activeWords = activeWords.map(word => {
            const saved = savedProgress.find(s => s.chinese === word.chinese && s.arabic === word.arabic);
            return saved ? { ...word, ...saved } : word;
        });
    }

    // --- 初始化会话队列 ---
    sessionLearnedCount.clear(); // 清空上次会话的计数
    sessionWordsState.clear(); // 清空会话单词状态
    const dueWords = scheduler.getDueWords(activeWords);

    // 限制本次会话的单词数量并随机打乱
    const sessionWords = dueWords.slice(0, MAX_SESSION_WORDS)
                                 .sort(() => Math.random() - 0.5);
    
    sessionQueue = [...sessionWords];
    currentSessionTotal = sessionQueue.length; // 记录当前会话的实际单词总数

    if (sessionQueue.length === 0) {
        // 如果没有到期的单词，也显示完成界面
        const allMastered = activeWords.every(w => (w.stage || 0) >= 4);
        ui.showCompletionScreen(allMastered);
        return;
    }

    // 在开始前初始化进度条
    ui.updateProgressBar(0, currentSessionTotal);

    ui.showScreen(dom.cardContainer);
    showNextWord();
}

function setupDeckSelectionScreen() {
    ui.setupSelectionScreen(vocabularyDecks, startSession);
}

// 修改按钮处理函数
function handleForgot() {
  if (!currentWord || isReviewingHistory) return;
  
  // 更新进度以反映刚刚完成的单词
  const completedCount = currentSessionTotal - sessionQueue.length;
  ui.updateProgressBar(completedCount, currentSessionTotal);

  if (!isSessionActive) {
    stats.incrementSessionCount();
    isSessionActive = true;
  }

  const wordState = sessionWordsState.get(currentWord.chinese) || {};
  if (!wordState.fsrsLocked) {
      // 第一次选择“忘记”或“模糊”，立即更新FSRS状态并锁定
      currentWord = scheduler.processReview(currentWord, RATING.AGAIN);
      wordState.fsrsLocked = true;
      sessionWordsState.set(currentWord.chinese, wordState);
      storage.saveProgress(currentDeckNameRef.value, activeWords);
  }

  // 重置会话中的“记得”次数
  sessionLearnedCount.set(currentWord.chinese, 0);

  // 将单词重新插入到队列的靠前位置（例如，2-5位之后）
  const reinsertIndex = Math.min(sessionQueue.length, Math.floor(Math.random() * 4) + 2);
  sessionQueue.splice(reinsertIndex, 0, currentWord);

  showNextWord();
}

function handleHard() {
  if (!currentWord || isReviewingHistory) return;

  // 更新进度以反映刚刚完成的单词
  const completedCount = currentSessionTotal - sessionQueue.length;
  ui.updateProgressBar(completedCount, currentSessionTotal);

  if (!isSessionActive) {
    stats.incrementSessionCount();
    isSessionActive = true;
  }

  const wordState = sessionWordsState.get(currentWord.chinese) || {};
  if (!wordState.fsrsLocked) {
      // 第一次选择“忘记”或“模糊”，立即更新FSRS状态并锁定
      currentWord = scheduler.processReview(currentWord, RATING.HARD);
      wordState.fsrsLocked = true;
      sessionWordsState.set(currentWord.chinese, wordState);
      storage.saveProgress(currentDeckNameRef.value, activeWords);
  }

  // 与“忘记”逻辑相同，重置计数并重新插入队列
  sessionLearnedCount.set(currentWord.chinese, 0);
  const reinsertIndex = Math.min(sessionQueue.length, Math.floor(Math.random() * 4) + 2);
  sessionQueue.splice(reinsertIndex, 0, currentWord);

  showNextWord();
}

function handleEasy() {
  if (!currentWord || isReviewingHistory) return;

  // 更新进度以反映刚刚完成的单词
  const completedCount = currentSessionTotal - sessionQueue.length;
  ui.updateProgressBar(completedCount, currentSessionTotal);

  if (!isSessionActive) {
    stats.incrementSessionCount();
    isSessionActive = true;
  }

  const wordId = currentWord.chinese;
  const currentCount = (sessionLearnedCount.get(wordId) || 0) + 1;
  sessionLearnedCount.set(wordId, currentCount);

  if (currentCount < 3) {
    // 未达到3次，将单词放到队列末尾
    sessionQueue.push(currentWord);
  } else {
    // 达到3次，认为本次会话已学会
    const wordState = sessionWordsState.get(currentWord.chinese) || {};
    if (!wordState.fsrsLocked) {
        // 仅当FSRS状态未被锁定时才更新为EASY
        currentWord = scheduler.processReview(currentWord, RATING.EASY);
        storage.saveProgress(currentDeckNameRef.value, activeWords);
    }
    // 如果已锁定，则不更新FSRS状态，仅从会话中移除
  }

  showNextWord();
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
  const needsMigration = activeWords.some(word => word.difficulty === undefined);
  if (needsMigration) {
    console.log('检测到旧数据，正在迁移到FSRS系统...');
    activeWords = scheduler.migrateExistingProgress(activeWords);
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
        incrementSessionCount: stats.incrementSessionCount
    });
};
