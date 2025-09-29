import * as dom from './dom.js';
import * as ui from './ui.js';
import * as storage from './storage.js';
import * as stats from './stats.js';
import { handleFileImport } from './parser.js';

// --- State Variables ---
const vocabularyDecks = {};
let currentDeckName = '';
let activeWords = [];
let currentWord = null;
let historyStack = [];
let currentMode = 'zh-ar';
let isReviewingHistory = false;
let sessionStartDate = null;
let isSessionActive = false;

// --- Core Logic ---

function initialize(vocabulary) {
    activeWords = vocabulary.map(word => ({
        ...word,
        rememberedCount: 0,
        cooldown: 0,
        mistakeCount: 0,
        stage: 0, // 0: learning, 1: 3d, 2: 7d, 3: 30d, 4: mastered
        nextReviewDate: null,
        firstLearnedDate: null
    }));
    historyStack = [];
    currentWord = null;
    ui.updateProgressBar(activeWords);
}

function showNextWord() {
    isReviewingHistory = false;
    ui.exitReviewMode();

    if (currentWord) {
        historyStack.push(currentWord);
    }
    dom.prevBtn.disabled = historyStack.length === 0;

    activeWords.forEach(w => {
        if (w.cooldown > 0) w.cooldown--;
    });

    const today = new Date();

    const hasLearningWords = activeWords.some(w => (w.stage || 0) === 0);
    const hasReviewWordsToday = activeWords.some(w =>
        w.stage > 0 &&
        w.nextReviewDate &&
        new Date(w.nextReviewDate) <= today
    );

    if (!hasLearningWords && !hasReviewWordsToday) {
        const allMastered = activeWords.every(w => (w.stage || 0) >= 4);
        ui.showCompletionScreen(allMastered);
        return;
    }

    let wordsToLearn = activeWords.filter(w => (w.stage || 0) < 4);

    let reviewPool = wordsToLearn.filter(w =>
        w.stage > 0 &&
        w.nextReviewDate &&
        new Date(w.nextReviewDate) <= today
    );

    if (reviewPool.length > 0) {
        const randomIndex = Math.floor(Math.random() * reviewPool.length);
        currentWord = reviewPool[randomIndex];
        ui.displayCard(currentWord, currentMode);
        ui.updateProgressBar(activeWords);
        return;
    }

    let learningPool = wordsToLearn.filter(w => (w.stage || 0) === 0 && w.cooldown === 0);

    if (learningPool.length > 0) {
        const randomIndex = Math.floor(Math.random() * learningPool.length);
        currentWord = learningPool[randomIndex];
    } else {
        const allMastered = activeWords.every(w => (w.stage || 0) >= 4);
        ui.showCompletionScreen(allMastered);
        return;
    }

    ui.displayCard(currentWord, currentMode);
    ui.updateProgressBar(activeWords);
}

function startSession(vocabulary, deckName) {
    currentDeckName = deckName;
    sessionStartDate = new Date().toDateString();

    const selectedMode = document.querySelector('input[name="mode"]:checked');
    currentMode = selectedMode ? selectedMode.value : 'zh-ar';

    const savedProgress = storage.loadProgress(deckName);
    if (savedProgress) {
        activeWords = vocabulary.map(word => {
            const saved = savedProgress.find(s =>
                s.chinese === word.chinese && s.arabic === word.arabic
            );
            return {
                ...word,
                rememberedCount: 0,
                cooldown: 0,
                mistakeCount: 0,
                stage: 0,
                nextReviewDate: null,
                firstLearnedDate: null,
                ...saved
            };
        });
    } else {
        initialize(vocabulary);
    }

    ui.showScreen(dom.cardContainer);
    showNextWord();
}

function handleRemembered() {
    if (!currentWord || isReviewingHistory) return;

    const today = new Date();

    if (!isSessionActive) {
        stats.incrementSessionCount();
        isSessionActive = true;
    }

    if (currentWord.stage > 0 && currentWord.nextReviewDate && new Date(currentWord.nextReviewDate) <= today) {
        currentWord.stage++;

        let nextReviewDays = null;
        if (currentWord.stage === 2) nextReviewDays = 7;
        if (currentWord.stage === 3) nextReviewDays = 30;

        if (nextReviewDays) {
            const nextDate = new Date();
            nextDate.setDate(today.getDate() + nextReviewDays);
            currentWord.nextReviewDate = nextDate.toISOString();
        } else if (currentWord.stage >= 4) {
            stats.trackWordMastered(currentWord);
            currentWord.nextReviewDate = null;
        }
    } else if ((currentWord.stage || 0) === 0) {
        currentWord.rememberedCount++;
        if (currentWord.rememberedCount === 3) {
            currentWord.stage = 1;
            const nextDate = new Date();
            nextDate.setDate(today.getDate() + 3);
            currentWord.nextReviewDate = nextDate.toISOString();
            stats.trackWordLearnedToday(currentWord, sessionStartDate);
        }
    }

    currentWord.cooldown = 11;
    storage.saveProgress(currentDeckName, activeWords);
    showNextWord();
}

function handleForgot() {
    if (!currentWord || isReviewingHistory) return;

    if (!isSessionActive) {
        stats.incrementSessionCount();
        isSessionActive = true;
    }

    if (currentWord.stage > 0) {
        currentWord.stage = 0;
        currentWord.rememberedCount = 0;
        currentWord.nextReviewDate = null;
    }

    currentWord.cooldown = Math.floor(Math.random() * 4) + 2;
    currentWord.mistakeCount = (currentWord.mistakeCount || 0) + 1;
    storage.saveProgress(currentDeckName, activeWords);
    showNextWord();
}

function handlePrev() {
    if (historyStack.length > 0) {
        currentWord = historyStack.pop();
        ui.displayCard(currentWord, currentMode);
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
    dom.answerDisplay.addEventListener('click', ui.toggleAnswerSpoiler);
    dom.rememberedBtn.addEventListener('click', handleRemembered);
    dom.forgotBtn.addEventListener('click', handleForgot);
    dom.prevBtn.addEventListener('click', handlePrev);
    dom.backToMenuBtn.addEventListener('click', goBackToMenu);
    dom.finishBackToMenuBtn.addEventListener('click', goBackToMenu);
    dom.nextWordInHistoryBtn.addEventListener('click', showNextWord);

    dom.importBtn.addEventListener('click', () => dom.fileInput.click());
    dom.fileInput.addEventListener('change', (event) => {
        handleFileImport(event, vocabularyDecks,
            () => ui.setupSelectionScreen(vocabularyDecks, startSession),
            () => storage.saveDecksToStorage(vocabularyDecks)
        );
    });

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

// --- Initial Load ---

window.onload = () => {
    storage.loadDecksFromStorage(vocabularyDecks);
    stats.loadStats();
    ui.setupSelectionScreen(vocabularyDecks, startSession);
    ui.showScreen(dom.startScreen);
    setupEventListeners();
};