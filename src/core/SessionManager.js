/**
 * @fileoverview Manages the state and logic of an active study session.
 */

import { ReviewScheduler, RATING } from './ReviewScheduler.js';
import { STORAGE_KEYS } from '../common/constants.js';
import { showRecallOverlay } from '../ui/card-controller.js';

export class SessionManager {
    /**
     * @param {object} dependencies - An object containing all necessary dependencies.
     * @param {import('../infrastructure/StorageService.js').StorageService} dependencies.storageService
     * @param {import('../services/StatsService.js').StatsService} dependencies.statsService
     * @param {import('../infrastructure/TTSManager.js').TTSManager} dependencies.ttsManager
     * @param {import('../components/StudyCard.js').StudyCard} dependencies.studyCardComponent
     * @param {import('../components/ProgressBar.js').ProgressBar} dependencies.progressBarComponent
     * @param {import('../infrastructure/EventBus.js').EventBus} dependencies.eventBus
     * @param {import('../infrastructure/ErrorHandler.js').ErrorHandler} dependencies.errorHandler
     */
    constructor({ storageService, statsService, ttsManager, studyCardComponent, progressBarComponent, eventBus, errorHandler, mistakeRepository }) {
        // --- Services & Infrastructure ---
        this.storageService = storageService;
        this.statsService = statsService;
        this.ttsManager = ttsManager;
        this.eventBus = eventBus;
        this.errorHandler = errorHandler;
        this.mistakeRepository = mistakeRepository;

        // --- UI Components (as dependencies) ---
        this.studyCardComponent = studyCardComponent;
        this.progressBarComponent = progressBarComponent;

        // --- Core Logic ---
        this.scheduler = new ReviewScheduler();

        // --- State ---
        this.resetState();

        this._bindEvents();
    }

    _bindEvents() {
        this.eventBus.on('wordRated', ({ rating }) => this.handleRating(rating));
        this.eventBus.on('playWordTTS', ({ word }) => this.ttsManager.playWord(word));
        this.eventBus.on('playExplanationTTS', ({ text }) => {
            if (text) {
                const arabicParts = text.match(/[؀-ۿݐ-ݿ 0-9,.؟!?]+/g);
                if (arabicParts) {
                    const textToPlay = arabicParts.join(' ');
                    this.ttsManager.play(textToPlay);
                }
            }
        });
    }

    resetState() {
        this.activeWords = [];
        this.currentWord = null;
        this.historyStack = [];
        this.sessionQueue = [];
        this.sessionState = {};
        this.isFsrsSession = false;
        this.isReviewingHistory = false;
        this.isSessionActive = false;
        this.currentDeckName = '';
        this.currentMode = 'zh-ar';
        this.sessionMistakeCounts = new Map(); // Track 'Again' counts per word
    }

    /**
     * Starts a new study session.
     * @param {object} sessionData - Data required to start a session.
     */
    start(sessionData) {
        this.resetState();

        this.isFsrsSession = sessionData.isFsrsSession;
        this.currentDeckName = sessionData.deckName;
        this.currentMode = sessionData.studyMode;
        this.activeWords = sessionData.fullWordList;

        this.isSessionActive = true;
        this.eventBus.emit('sessionStarted');
        this.statsService.onSessionStart();

        if (sessionData.savedSession) {
            this.restoreState(sessionData.savedSession);
        } else {
            this.initializeNewSession(sessionData.sessionQueue);
        }
        
        this.showNextWord();
    }
    
    /**
     * Stops the current session, saving progress if necessary.
     */
    async stop() {
        if (!this.isSessionActive) return;

        this.ttsManager.stop();
        if (this.isFsrsSession) {
            await this.updateAndSaveState();
        }
        
        const wasActive = this.isSessionActive;
        this.isSessionActive = false;
        
        if (wasActive) {
            this.eventBus.emit('sessionStopped');
        }
    }

    initializeNewSession(queue) {
        this.sessionQueue = [...queue];
        this.sessionState = {
            sessionQueue: this.sessionQueue.map(w => ({ arabic: w.arabic })),
            completedCount: 0,
            currentSessionTotal: this.sessionQueue.length,
        };
    }

    restoreState(savedState) {
        try {
            this.sessionState = savedState;
            this.sessionQueue = savedState.sessionQueue
                .map(key => this.activeWords.find(w => w.arabic === key.arabic))
                .filter(Boolean);
        } catch (error) {
            this.errorHandler.devError(error, 'Failed to restore session state');
            this.errorHandler.userError('恢复会话失败，将开始一个新会话。');
            this.initializeNewSession(this.activeWords); // Fallback
        }
    }

    async showNextWord() {
        this.isReviewingHistory = false;
        if (this.currentWord) {
            this.historyStack.push(this.currentWord);
        }
        this.eventBus.emit('historyStateChanged', { canGoBack: this.historyStack.length > 0 });
        this.eventBus.emit('reviewModeChanged', { isReviewing: false });

        if (this.sessionQueue.length === 0) {
            await this.complete();
            return;
        }

        this.currentWord = this.sessionQueue.shift();
        this.studyCardComponent.render(this.currentWord, this.currentMode);
        
        const autoPlay = await this.storageService.getSetting(STORAGE_KEYS.ARABIC_TTS_AUTO_PLAY, true);
        if (autoPlay) {
            this.ttsManager.playWord(this.currentWord);
        }
        
        // Restore Recall Mode functionality
        const recallMode = await this.storageService.getSetting(STORAGE_KEYS.RECALL_MODE, false);
        if (recallMode) {
            showRecallOverlay(5);
        }
        
        this.updateAndSaveState();
    }

    showPreviousWord() {
        if (this.historyStack.length > 0) {
            if (this.currentWord) {
                this.sessionQueue.unshift(this.currentWord);
            }
            this.currentWord = this.historyStack.pop();
            this.studyCardComponent.render(this.currentWord, this.currentMode);
            this.eventBus.emit('historyStateChanged', { canGoBack: this.historyStack.length > 0 });
            this.isReviewingHistory = true;
            this.eventBus.emit('reviewModeChanged', { isReviewing: true });
        }
    }

    async handleRating(rating) {
        if (!this.currentWord || this.isReviewingHistory) return;

        // Track mistakes for "Mistake Notebook" auto-addition
        if (rating === RATING.AGAIN) { // AGAIN corresponds to Forget/Hard fail
            const currentCount = (this.sessionMistakeCounts.get(this.currentWord.arabic) || 0) + 1;
            this.sessionMistakeCounts.set(this.currentWord.arabic, currentCount);

            if (currentCount === 4 && this.mistakeRepository) {
                console.log(`[SessionManager] Word ${this.currentWord.arabic} hit 4 mistakes. Adding to Mistake Notebook.`);
                await this.mistakeRepository.addWord(this.currentWord.arabic);
                // Optional: Notify user via EventBus if we had a notification system capable of subtle toasts
            }
        }

        if (this.isFsrsSession) {
            const { card: updatedWord, isNewCard } = this.scheduler.processReview(this.currentWord, rating);
            this.currentWord = updatedWord;

            if (rating === RATING.EASY) {
                if (isNewCard) {
                    const learned = this.statsService.trackWordLearned(this.currentWord);
                    if (learned) {
                        // This is a per-deck count for regular study feature
                        this.statsService.incrementTodayLearnedWords(this.currentDeckName);
                        await this.storageService.saveProgress(this.currentDeckName, [this.currentWord]);
                    }
                }
                this.sessionState.completedCount = (this.sessionState.completedCount || 0) + 1;
                await this.showNextWord();
            } else {
                const reinsertPosition = Math.min(this.sessionQueue.length, Math.floor(Math.random() * 3) + 3);
                this.sessionQueue.splice(reinsertPosition, 0, this.currentWord);
                await this.showNextWord();
            }
        } else { // Non-FSRS session
            if (rating === RATING.EASY) {
                this.sessionState.completedCount = (this.sessionState.completedCount || 0) + 1;
            } else {
                const reinsertPosition = Math.min(this.sessionQueue.length, Math.floor(Math.random() * 3) + 3);
                this.sessionQueue.splice(reinsertPosition, 0, this.currentWord);
            }
            await this.showNextWord();
        }
    }

    async complete() {
        await this.statsService.onSessionComplete();
        const wasActive = this.isSessionActive;
        this.isSessionActive = false;
        await this.storageService.clearSessionState(this.currentDeckName);
        
        const allMastered = this.activeWords.every(w => (w.progress?.stage || 0) >= 4);
        
        if (wasActive) {
            this.eventBus.emit('sessionCompleted', { allMastered });
        }
        
        this.resetState();
    }

    async updateAndSaveState() {
        if (!this.isSessionActive) return;

        if (this.isFsrsSession) {
            this.sessionState.sessionQueue = this.sessionQueue.map(w => ({ arabic: w.arabic }));
            await this.storageService.saveProgress(this.currentDeckName, this.activeWords, this.sessionState);
        }
        
        console.log(`[DEBUG] Rendering ProgressBar: completed=${this.sessionState.completedCount || 0}, total=${this.sessionState.currentSessionTotal || 0}`);
        this.progressBarComponent.render(this.sessionState.completedCount || 0, this.sessionState.currentSessionTotal || 0);
    }
}
