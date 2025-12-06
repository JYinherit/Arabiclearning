/**
 * @fileoverview Responsible for the use case of starting a new study session.
 *
 * This use case encapsulates all the business logic required to prepare a study session,
 * including filtering words, initializing progress, and loading/saving session state.
 * It does not interact directly with the UI, but returns the necessary data for the session.
 */

import { STORAGE_KEYS } from '../common/constants.js';
import { Word } from '../core/Word.js';
import { Progress } from '../core/Progress.js';
import { ReviewScheduler } from '../core/ReviewScheduler.js';

export class StartStudySession {
    /**
     * @param {import('../infrastructure/DatabaseManager.js').DatabaseManager} dbManager
     * @param {import('../infrastructure/StorageService.js').StorageService} storageService
     * @param {import('../services/StatsService.js').StatsService} statsService
     * @param {import('../infrastructure/ErrorHandler.js').ErrorHandler} errorHandler
     */
    constructor(dbManager, storageService, statsService, errorHandler) {
        this.dbManager = dbManager;
        this.storageService = storageService;
        this.statsService = statsService;
        this.errorHandler = errorHandler;
        this.scheduler = new ReviewScheduler();
    }

    /**
     * Starts a new study session for the given deck name.
     * @param {string} deckName - The name of the deck to study.
     * @param {boolean} [enableFsrs=false] - Flag for a regular (FSRS) study session.
     * @param {object} [options={}] - Additional options, like a precomputed study queue.
     * @param {Array<Word>} allVocabularyWords - The complete list of all vocabulary in the app.
     * @returns {Promise<object|null>} A promise containing the data needed for the session, or null if it fails.
     */
    async execute(deckName, enableFsrs = false, options = {}, allVocabularyWords) {
        if (options.precomputedQueue) {
            return this.executeFromPrecomputedQueue(deckName, enableFsrs, options);
        }

        await this.statsService.onSessionStart();

        const deckWords = allVocabularyWords.filter(w => w.definitions.some(d => d.sourceDeck.startsWith(deckName)));

        if (deckWords.length === 0) {
            return { sessionQueue: [], fullWordList: [] };
        }

        const arabicKeys = deckWords.map(w => w.arabic);
        const progressMap = await this.dbManager.getWordProgressBatch(arabicKeys);
        
        const wordsWithProgress = deckWords.map(word => {
            const savedProgress = progressMap.get(word.arabic);
            const progressInstance = savedProgress ? new Progress(savedProgress) : null;
            const wordInstance = new Word(word.arabic, word.definitions, progressInstance);
            return this.scheduler.initializeWord(wordInstance);
        });

        await this.storageService.saveSetting(STORAGE_KEYS.LAST_ACTIVE_DECK, deckName);

        let savedSession = null;
        try {
            savedSession = await this.storageService.loadSessionState(deckName);
        } catch (error) {
            this.errorHandler.devError(error, `Failed to restore session "${deckName}"`);
            this.errorHandler.userError(`恢复会话 "${deckName}" 失败，数据可能已损坏。将开始新会话。`);
            await this.storageService.clearSessionState(deckName);
        }
        
        const dueWords = this.scheduler.getDueWords(wordsWithProgress);
        
        // Simple shuffle for non-FSRS sessions, just like the original app
        const sessionQueue = [...dueWords].sort(() => Math.random() - 0.5);

        return {
            sessionQueue,
            isFsrsSession: enableFsrs,
            deckName: deckName,
            savedSession: savedSession,
            fullWordList: wordsWithProgress
        };
    }

    /**
     * Designed for "Regular Study", starts a session directly from a pre-calculated queue.
     * @private
     */
    async executeFromPrecomputedQueue(deckName, enableFsrs, options) {
        if (!options.fullWordList) {
            throw new Error('Attempted to start a precomputed session with incomplete options.');
        }

        if (!options.precomputedQueue || options.precomputedQueue.length === 0) {
            return { sessionQueue: [], fullWordList: options.fullWordList };
        }

        await this.statsService.onSessionStart();
        await this.storageService.saveSetting(STORAGE_KEYS.LAST_ACTIVE_DECK, deckName);

        let savedSession = null;
        try {
            savedSession = await this.storageService.loadSessionState(deckName);
        } catch (error) {
            this.errorHandler.devError(error, `Failed to restore precomputed session "${deckName}"`);
            this.errorHandler.userError(`恢复会话 "${deckName}" 失败，数据可能已损坏。将开始新会话。`);
            await this.storageService.clearSessionState(deckName);
        }

        return {
            sessionQueue: options.precomputedQueue,
            isFsrsSession: enableFsrs,
            deckName: deckName,
            savedSession: savedSession,
            fullWordList: options.fullWordList
        };
    }
}
