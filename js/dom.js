// 添加新的页面引用
export const studyPage = document.getElementById('study-page');
export const decksPage = document.getElementById('decks-page');
export const settingsPage = document.getElementById('settings-page');

// 更新现有的引用
export const startScreen = document.getElementById('start-screen');
export const cardContainer = document.getElementById('card-container');
export const completionScreen = document.getElementById('completion-screen');
export const deckSelectionContainer = document.getElementById('deck-selection-container');

// 新增 progressContainer 引用
export const progressContainer = document.getElementById('progress-container');

// 添加新的按钮引用
export const regularStudyBtn = document.getElementById('regular-study-btn');

export const wordDisplay = document.getElementById('word-display');
export const answerDisplay = document.getElementById('answer-display');
export const explanationDisplay = document.getElementById('explanation-display');

export const forgotBtn = document.getElementById('forgot-btn');
export const hardBtn = document.getElementById('hard-btn'); 
export const easyBtn = document.getElementById('easy-btn'); 
export const prevBtn = document.getElementById('prev-btn');
export const backToMenuBtn = document.getElementById('back-to-menu-btn');
export const finishBackToMenuBtn = document.getElementById('finish-back-to-menu-btn');
export const nextWordInHistoryBtn = document.getElementById('next-word-in-history-btn');

export const progressBar = document.getElementById('progress-bar');

export const fileInput = document.getElementById('file-input');
export const importBtn = document.getElementById('import-btn');

export const viewStatsBtn = document.getElementById('view-stats-btn');
export const exportBackupBtn = document.getElementById('export-backup-btn');
export const importBackupBtn = document.getElementById('import-backup-btn');
export const checkStorageBtn = document.getElementById('check-storage-btn');
export const clearDataBtn = document.getElementById('clear-data-btn');

export const modeRadioButtons = document.querySelectorAll('input[name="mode"]');


// 确保所有必需的DOM元素都存在
export function validateDOMElements() {
    const elements = {
        studyPage: document.getElementById('study-page'),
        decksPage: document.getElementById('decks-page'),
        settingsPage: document.getElementById('settings-page'),
        startScreen: document.getElementById('start-screen'),
        cardContainer: document.getElementById('card-container'),
        completionScreen: document.getElementById('completion-screen'),
        progressContainer: document.getElementById('progress-container'),
        progressBar: document.getElementById('progress-bar'),
        wordDisplay: document.getElementById('word-display'),
        answerDisplay: document.getElementById('answer-display'),
        explanationDisplay: document.getElementById('explanation-display'),
        forgotBtn: document.getElementById('forgot-btn'),
        hardBtn: document.getElementById('hard-btn'),
        easyBtn: document.getElementById('easy-btn'),
        prevBtn: document.getElementById('prev-btn'),
        backToMenuBtn: document.getElementById('back-to-menu-btn'),
        finishBackToMenuBtn: document.getElementById('finish-back-to-menu-btn'),
        nextWordInHistoryBtn: document.getElementById('next-word-in-history-btn')
    };
    
    console.log('DOM元素验证:', elements);
    return elements;
}

// 统计模态框
export const statsModal = document.getElementById('stats-modal');
export const statsModalTitle = document.getElementById('stats-modal-title');
export const statsModalBody = document.getElementById('stats-modal-body');
export const statsModalCloseBtn = document.getElementById('stats-modal-close-btn');
