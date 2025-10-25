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
const isSessionActiveRef = { value: false };

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

// Regular Study Module Interface
let regularStudyModule = null;

// --- Core Logic ---

function initialize(vocabulary, isRandomTest = false) {
  console.log('初始化单词列表，数量:', vocabulary.length);
  
  // 深度克隆词汇表，避免引用问题
  const clonedVocabulary = JSON.parse(JSON.stringify(vocabulary));
  
  activeWords = scheduler.initializeWords(clonedVocabulary);
  
  // 验证每个单词的结构
  activeWords.forEach((word, index) => {
      if (!word.reviews || !Array.isArray(word.reviews)) {
          console.warn(`单词 ${index} (${word.chinese}) 的 reviews 无效，重新初始化`);
          activeWords[index] = scheduler.initializeWord(word);
      }
  });
  
  historyStack = [];
  currentWord = null;

  if (isRandomTest) {
    console.log('随机测试模式：初始化会话队列');
    sessionLearnedCount.clear();
    sessionWordsState.clear();
    sessionQueue = [...activeWords];
    currentSessionTotal = sessionQueue.length;
    ui.updateProgressBar(0, currentSessionTotal);
  } else {
    console.log('普通模式：会话队列将在 startSession 中初始化');
  }
  
  console.log('初始化完成，有效单词:', activeWords.length);
}


// 新增函数：重置会话状态
function validateWord(word) {
    if (!word) return false;
    
    // 基础字段验证
    const required = ['chinese', 'arabic'];
    const missing = required.filter(field => !word[field]);
    
    if (missing.length > 0) {
        console.error(`单词验证失败: ${word.chinese}, 缺失基础字段:`, missing);
        return false;
    }
    
    // 确保学习相关字段存在，如果不存在则修复
    const learningFields = {
        reviews: [],
        rememberedCount: 0,
        stage: 0
    };
    
    for (const [field, defaultValue] of Object.entries(learningFields)) {
        if (word[field] === undefined || word[field] === null) {
            console.warn(`单词 ${word.chinese} 缺少字段 ${field}，已修复为默认值:`, defaultValue);
            word[field] = defaultValue;
        }
    }
    
    // 特别确保 reviews 是一个数组
    if (!Array.isArray(word.reviews)) {
        console.warn(`单词 ${word.chinese} 的 reviews 字段不是数组，已修复`);
        word.reviews = [];
    }
    
    return true;
}

function debugSessionState() {
    console.log('=== 会话状态调试 ===');
    console.log('isSessionActive:', isSessionActiveRef.value);
    console.log('sessionQueue length:', sessionQueue.length);
    console.log('currentSessionTotal:', currentSessionTotal);
    console.log('activeWords length:', activeWords.length);
    console.log('currentWord:', currentWord);
    console.log('historyStack length:', historyStack.length);
    console.log('sessionState:', sessionState);
    console.log('===================');
}

function resetSessionState() {
    activeWords = [];
    currentWord = null;
    historyStack = [];
    sessionQueue = [];
    sessionLearnedCount.clear();
    sessionWordsState.clear();
    currentSessionTotal = 0;
    
    sessionState = {
        sessionQueue: [],
        sessionLearnedCount: new Map(),
        sessionWordsState: new Map(),
        currentSessionTotal: 0,
        completedCount: 0
    };
    
    isSessionActiveRef.value = false;
    isReviewingHistory = false;
}

function startSession(vocabulary, deckName, isRandomTest = false, isRegularStudy = false) {
    console.log('开始会话:', deckName, '单词数量:', vocabulary.length);
    
    // 验证输入词汇表 - 使用更宽松的验证
    const validWords = vocabulary.filter(word => {
        if (!word || !word.chinese || !word.arabic) {
            console.warn('跳过无效单词:', word);
            return false;
        }
        return true;
    });
    
    if (validWords.length === 0) {
        alert('所选词库中没有有效的单词！');
        return;
    }
    
    if (validWords.length < vocabulary.length) {
        console.warn(`跳过了 ${vocabulary.length - validWords.length} 个无效单词`);
    }
    
    // 使用验证后的单词列表
    initialize(validWords, isRandomTest);
    currentDeckNameRef.value = deckName;
    
    // 检查是否有保存的会话状态
    const savedState = storage.loadSessionState(deckName);
    if (savedState && confirm('检测到未完成的会话，是否继续？')) {
        restoreSessionState(savedState);
    } else {
        // 初始化新会话
        initializeNewSession(validWords);
    }
    
    sessionStartDate = new Date().toDateString();
    isSessionActiveRef.value = true;
    
    // 切换到学习页面
    switchToPage('study-page');
    ui.showScreen(dom.cardContainer);
    showNextWord();
    
    stats.incrementSessionCount();
}

// 新增函数：恢复会话状态
function restoreSessionState(savedState) {
    if (!savedState) return;
    
    try {
        // 恢复基本会话状态
        sessionState = {
            ...savedState,
            sessionLearnedCount: new Map(savedState.sessionLearnedCount),
            sessionWordsState: new Map(savedState.sessionWordsState)
        };
        
        // 恢复会话队列（需要找到对应的单词对象）
        sessionQueue = savedState.sessionQueue.map(wordKey => {
            const foundWord = activeWords.find(w => 
                w.chinese === wordKey.chinese && 
                w.arabic === wordKey.arabic
            );
            if (!foundWord) {
                console.warn('找不到对应的单词:', wordKey);
            }
            return foundWord;
        }).filter(Boolean);
        
        currentSessionTotal = sessionState.currentSessionTotal || sessionQueue.length;
        
        // 恢复学习计数
        sessionLearnedCount = new Map(savedState.sessionLearnedCount);
        sessionWordsState = new Map(savedState.sessionWordsState);
        
    } catch (error) {
        console.error('恢复会话状态失败:', error);
        // 如果恢复失败，初始化新会话
        initializeNewSession(activeWords);
    }
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

function showNextWord() {
    console.log('=== 显示下一个单词调试 ===');
    debugSessionState();
    console.log('显示下一个单词，当前队列长度:', sessionQueue.length);
    
    isReviewingHistory = false;
    ui.exitReviewMode();

    if (currentWord && !historyStack.includes(currentWord)) {
        historyStack.push(currentWord);
    }
    dom.prevBtn.disabled = historyStack.length === 0;

    // 检查会话队列是否为空
    if (sessionQueue.length === 0) {
        console.log('会话队列为空，显示完成界面');
        const allMastered = activeWords.every(w => (w.stage || 0) >= 4);
        ui.showCompletionScreen(allMastered);
        ui.updateProgressBar(currentSessionTotal, currentSessionTotal);
        
        // 会话结束，清除状态
        storage.clearSessionState(currentDeckNameRef.value);
        storage.saveProgress(currentDeckNameRef.value, activeWords);
        isSessionActiveRef.value = false;
        
        return;
    }

    // 从队列中获取下一个单词
    currentWord = sessionQueue.shift();
    console.log('当前单词:', currentWord?.chinese);
    
    if (!currentWord) {
        console.error('获取的单词为空，跳过');
        showNextWord(); // 递归调用直到找到有效单词
        return;
    }
    
    ui.displayCard(currentWord, currentModeRef.value);
    
    // 更新进度
    updateAndSaveSessionState();
}

function handleEasy() {
    if (!currentWord || isReviewingHistory) return;

    if (!isSessionActiveRef.value) {
        stats.incrementSessionCount();
        isSessionActiveRef.value = true;
    }

    const wordId = currentWord.chinese;
    const currentCount = (sessionLearnedCount.get(wordId) || 0) + 1;
    sessionLearnedCount.set(wordId, currentCount);

    // 修复：增强FSRS错误处理
    const wordState = sessionWordsState.get(currentWord.chinese) || {};
    if (!wordState.fsrsLocked) {
        try {
            currentWord = scheduler.processReview(currentWord, RATING.EASY);
            wordState.fsrsLocked = true;
            sessionWordsState.set(currentWord.chinese, wordState);
            
            // 更新统计信息
            stats.trackWordLearnedToday(currentWord, sessionStartDate);
            if (currentCount >= 3) {
                stats.trackWordMastered(currentWord);
            }
        } catch (error) {
            console.error('FSRS处理失败，使用备用逻辑:', error);
            ui.showImportMessage('处理单词状态时出错，已使用备用逻辑', false);
            
            // 备用逻辑
            currentWord.rememberedCount = (currentWord.rememberedCount || 0) + 1;
            if (currentWord.rememberedCount >= 3) {
                currentWord.stage = 4;
                stats.trackWordMastered(currentWord);
            }
            wordState.fsrsLocked = true;
            sessionWordsState.set(currentWord.chinese, wordState);
        }
    }

    if (currentCount < 3) {
        // 重新插入队列，继续学习
        const reinsertIndex = Math.min(sessionQueue.length, Math.floor(Math.random() * 3) + 1);
        sessionQueue.splice(reinsertIndex, 0, currentWord);
    } else {
        // 单词学习完成
        sessionState.completedCount = (sessionState.completedCount || 0) + 1;

        // 规律学习的新单词计数
        if (regularStudyModule && regularStudyModule.isNewWord(currentWord)) {
            regularStudyModule.incrementTodayLearned(currentDeckNameRef.value);
        }
    }
    
    updateAndSaveSessionState();
    showNextWord();
}

// 对 handleHard 和 handleForgot 也做类似的错误处理增强
function handleHard() {
    if (!currentWord || isReviewingHistory) return;

    if (!isSessionActiveRef.value) {
        stats.incrementSessionCount();
        isSessionActiveRef.value = true;
    }

    const wordState = sessionWordsState.get(currentWord.chinese) || {};
    if (!wordState.fsrsLocked) {
        try {
            currentWord = scheduler.processReview(currentWord, RATING.HARD);
            wordState.fsrsLocked = true;
            sessionWordsState.set(currentWord.chinese, wordState);
        } catch (error) {
            console.error('FSRS处理失败，使用备用逻辑:', error);
            // 备用逻辑：简单更新状态
            currentWord.mistakeCount = (currentWord.mistakeCount || 0) + 1;
            wordState.fsrsLocked = true;
            sessionWordsState.set(currentWord.chinese, wordState);
        }
    }

    sessionLearnedCount.set(currentWord.chinese, 0);
    
    // 重新插入队列
    const reinsertIndex = Math.min(sessionQueue.length, Math.floor(Math.random() * 4) + 2);
    sessionQueue.splice(reinsertIndex, 0, currentWord);
    
    updateAndSaveSessionState();
    showNextWord();
}

function handleForgot() {
    if (!currentWord || isReviewingHistory) return;
    
    if (!isSessionActiveRef.value) {
        stats.incrementSessionCount();
        isSessionActiveRef.value = true;
    }

    const wordState = sessionWordsState.get(currentWord.chinese) || {};
    if (!wordState.fsrsLocked) {
        try {
            currentWord = scheduler.processReview(currentWord, RATING.FORGOT);
            wordState.fsrsLocked = true;
            sessionWordsState.set(currentWord.chinese, wordState);
        } catch (error) {
            console.error('FSRS处理失败，使用备用逻辑:', error);
            // 备用逻辑：重置学习进度
            currentWord.rememberedCount = 0;
            currentWord.mistakeCount = (currentWord.mistakeCount || 0) + 1;
            currentWord.stage = 1;
            wordState.fsrsLocked = true;
            sessionWordsState.set(currentWord.chinese, wordState);
        }
    }

    sessionLearnedCount.set(currentWord.chinese, 0);

    // 重新插入队列（更靠前的位置）
    const reinsertIndex = Math.min(sessionQueue.length, Math.floor(Math.random() * 2) + 1);
    sessionQueue.splice(reinsertIndex, 0, currentWord);
    
    updateAndSaveSessionState();
    showNextWord();
}

// 新增函数：更新并保存会话状态
function updateAndSaveSessionState() {

    const actualCompleted = Math.min(sessionState.completedCount || 0, currentSessionTotal);
    
    sessionState = {
        sessionQueue: sessionQueue.map(w => ({ chinese: w.chinese, arabic: w.arabic })),
        sessionLearnedCount: Array.from(sessionLearnedCount.entries()),
        sessionWordsState: Array.from(sessionWordsState.entries()),
        currentSessionTotal: currentSessionTotal,
        completedCount: actualCompleted
    };
    
    storage.saveProgress(currentDeckNameRef.value, activeWords, sessionState);
   
    ui.updateProgressBar(actualCompleted, currentSessionTotal);

    console.log('更新会话状态 - 完成:', actualCompleted, '/', currentSessionTotal);
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

// 修改 goBackToMenu 函数
function goBackToMenu() {
    // 保存当前进度
    if (isSessionActiveRef.value) {
        updateAndSaveSessionState();
    }
    
    isSessionActiveRef.value = false;
    ui.showScreen(dom.startScreen);

    // 切换回词库页面
    switchToPage('decks-page');
    updateNavigationState('decks-page');
}

// --- Event Listeners ---

function setupEventListeners() {
    // 使用事件委托或延迟绑定，确保DOM就绪
    // 只需要保留非卡片相关的监听器，卡片相关的移动到单独的函数中
    
    setTimeout(() => {
        bindAnswerDisplayEvents();
        bindControlButtonEvents();
    }, 100);

    // Settings Modal Listeners
    document.querySelectorAll('input[name="mode"]').forEach(radio => {
        radio.addEventListener('change', (event) => {
            currentModeRef.value = event.target.value;
            storage.saveSetting('mode', currentModeRef.value);
        });
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

function bindAnswerDisplayEvents() {
    const answerDisplay = document.getElementById('answer-display');
    const explanationDisplay = document.getElementById('explanation-display');
    
    if (answerDisplay) {
        answerDisplay.removeEventListener('click', ui.toggleAnswerVisibility);
        answerDisplay.addEventListener('click', ui.toggleAnswerVisibility);
    }
    
    if (explanationDisplay) {
        explanationDisplay.removeEventListener('click', ui.toggleExplanationVisibility);
        explanationDisplay.addEventListener('click', ui.toggleExplanationVisibility);
    }
}

function bindControlButtonEvents() {
    // 绑定控制按钮事件
    const buttons = [
        { id: 'forgot-btn', handler: handleForgot },
        { id: 'hard-btn', handler: handleHard },
        { id: 'easy-btn', handler: handleEasy },
        { id: 'prev-btn', handler: handlePrev },
        { id: 'back-to-menu-btn', handler: goBackToMenu },
        { id: 'finish-back-to-menu-btn', handler: goBackToMenu },
        { id: 'next-word-in-history-btn', handler: showNextWord }
    ];
    
    buttons.forEach(({ id, handler }) => {
        const button = document.getElementById(id);
        if (button) {
            button.removeEventListener('click', handler);
            button.addEventListener('click', handler);
        }
    });
}

// 数据迁移 (在应用启动时调用)
function migrateDataIfNeeded() {
  let needsMigration = false;
  for (const deckName in vocabularyDecks) {
    const deck = vocabularyDecks[deckName];
    if (deck && Array.isArray(deck) && deck.some(word => word.difficulty === undefined)) {
      needsMigration = true;
      console.log(`检测到词库 "${deckName}" 包含旧数据，正在迁移到FSRS系统...`);
      vocabularyDecks[deckName] = scheduler.migrateExistingProgress(deck);
    }
  }

  if (needsMigration) {
    storage.saveDecksToStorage(vocabularyDecks);
  }
}

// 增强 updateNavigationState 函数
function updateNavigationState(activePage) {
    const navButtons = document.querySelectorAll('.nav-btn');
    navButtons.forEach(btn => {
        const page = btn.getAttribute('data-page');
        if (page === activePage) {
            btn.classList.add('active');
            btn.style.color = '#667eea';
            // 添加视觉反馈
            btn.style.transform = 'scale(1.05)';
            setTimeout(() => {
                btn.style.transform = 'scale(1)';
            }, 200);
        } else {
            btn.classList.remove('active');
            btn.style.color = '#666';
            btn.style.transform = 'scale(1)';
        }
    });
}

function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    
    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPage = button.getAttribute('data-page');
            
            // 切换页面
            switchToPage(targetPage);
            
            // 根据目标页面执行特定操作
            switch(targetPage) {
                case 'decks-page':
                    setupDeckSelectionScreen();
                    // 确保显示开始屏幕
                    const startScreen = document.querySelector('#decks-page #start-screen');
                    if (startScreen) startScreen.style.display = 'block';
                    break;
                case 'study-page':
                    // 如果有活跃会话，显示卡片容器，否则显示提示
                    if (isSessionActiveRef.value) {
                        const cardContainer = document.querySelector('#study-page #card-container');
                        if (cardContainer) cardContainer.style.display = 'block';
                        const completionScreen = document.querySelector('#study-page #completion-screen');
                        if (completionScreen) completionScreen.style.display = 'none';
                    } else {
                        // 显示提示信息
                        const cardContainer = document.querySelector('#study-page #card-container');
                        if (cardContainer) cardContainer.style.display = 'none';
                        alert('请先选择词库开始学习');
                        // 自动切换回词库页面
                        setTimeout(() => switchToPage('decks-page'), 100);
                    }
                    break;
                case 'settings-page':
                    // 设置页面不需要特殊处理
                    break;
            }
        });
    });
    
    // 初始化导航状态
    updateNavigationState('decks-page');
}

// 重写 switchToPage 函数
function switchToPage(pageId) {
    console.log('切换到页面:', pageId);
    
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => {
        page.classList.remove('active');
        page.style.display = 'none';
    });
    
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        targetPage.style.display = 'block';
    }
    
    updateNavigationState(pageId);
}

// 添加学习页面结构初始化函数
function initializeStudyPageStructure() {
    const studyPage = document.getElementById('study-page');
    if (!studyPage) return;
    
    const pageContent = studyPage.querySelector('.page-content');
    if (!pageContent) return;
    
    pageContent.innerHTML = `
        <div id="card-container">
            <!-- 进度条 -->
            <div id="progress-container">
                <div id="progress-bar">0%</div>
            </div>
            
            <!-- 闪卡内容 -->
            <div class="flashcard">
                <h2 id="word-display"></h2>
                <div id="answer-display" class="spoiler" title="点击显示/隐藏答案"></div>
                <p id="explanation-display" class="spoiler"></p>
            </div>

            <!-- 控制按钮 -->
            <div id="controls">
                <button id="forgot-btn" class="btn"><i class="fas fa-times"></i> 忘记</button>
                <button id="hard-btn" class="btn"><i class="fas fa-question"></i> 模糊</button> 
                <button id="easy-btn" class="btn"><i class="fas fa-check"></i> 记得</button> 
                <button id="next-word-in-history-btn" class="btn" style="display: none;">下一个词</button>
            </div>
            
            <!-- 导航控制 -->
            <div id="nav-controls">
                <button id="prev-btn" class="btn">上一个词</button>
                <button id="back-to-menu-btn" class="btn">返回</button>
            </div>
        </div>

        <!-- 完成屏幕 -->
        <div id="completion-screen">
            <h2>🎉 恭喜你完成了本词库的记忆 🎉</h2>
            <p>所有单词都已牢牢记住！</p>
            <button id="finish-back-to-menu-btn" class="btn" style="background-color: #00695c;">返回</button>
        </div>
    `;
    
    // 重新绑定事件
    setupEventListeners();
}

// --- Initial Load ---

window.onload = () => {
    console.log('应用启动...');
    
    // 验证DOM元素
    dom.validateDOMElements();
    
    // 确保学习页面有正确的内容结构
    const studyPage = document.getElementById('study-page');
    if (studyPage && !studyPage.querySelector('#card-container')) {
        console.warn('学习页面缺少卡片容器，重新初始化结构');
        initializeStudyPageStructure();
    }
    
    storage.loadDecksFromStorage(vocabularyDecks);
    stats.loadStats();
    ui.setupSelectionScreen(vocabularyDecks, startSession);
    ui.showScreen(dom.startScreen);
    setupEventListeners();
    
    // 添加导航栏功能
    setupNavigation();

    // 迁移数据（如果需要）
    migrateDataIfNeeded();

    // 初始化随机测试模块
    randomTestModule = setupRandomTest({
        vocabularyDecks,
        initialize,
        currentModeRef,
        currentDeckNameRef,
        isSessionActive: isSessionActiveRef, // 添加会话状态引用
        cardContainer: dom.cardContainer,
        showScreen: ui.showScreen,
        showNextWord,
        incrementSessionCount: stats.incrementSessionCount,
    });
    // 初始化规律学习功能
    regularStudyModule = setupRegularStudy({
        vocabularyDecks,
        currentDeckNameRef,
        currentModeRef,
        isSessionActive: isSessionActiveRef,
        scheduler,
        startSession: (vocabulary, deckName) => {
            // 重置会话状态
            resetSessionState();
            // 启动会话
            startSession(vocabulary, deckName, false, false);
        },
        showScreen: ui.showScreen,
        cardContainer: dom.cardContainer,
        showNextWord,
        incrementSessionCount: stats.incrementSessionCount,
        updateNavigationState: updateNavigationState
    });
};
