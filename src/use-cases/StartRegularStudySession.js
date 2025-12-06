/**
 * @fileoverview Use case for starting a "Regular Study" session.
 * This class orchestrates the logic to select a deck, prepare a prioritized
 * queue of new and due cards using FSRS, and initiate the study session.
 */

import { ReviewScheduler } from '../core/ReviewScheduler.js';
import { FSRS } from '../core/FSRS.js';
import { STORAGE_KEYS } from '../common/constants.js';

export class StartRegularStudySessionUseCase {
    /**
     * @param {object} dependencies - Dependencies from the main application.
     * @param {import('../infrastructure/StorageService.js').StorageService} dependencies.storageService
     * @param {import('../infrastructure/DatabaseManager.js').DatabaseManager} dependencies.dbManager
     * @param {import('./StatsService.js').StatsService} dependencies.statsService
     * @param {Array} dependencies.vocabularyWords - A reference to the main vocabulary array.
     * @param {Function} dependencies.startSessionCallback - Callback to start the UI session.
     */
    constructor({ storageService, dbManager, statsService, vocabularyWords, startSessionCallback }) {
        this.storageService = storageService;
        this.dbManager = dbManager;
        this.statsService = statsService;
        this.vocabularyWords = vocabularyWords;
        this.startSession = startSessionCallback;
        
        this.scheduler = new ReviewScheduler();
        this.settings = {
            maxReviewWords: 30,
            dailyNewWords: 10,
        };
        this.statsCache = new Map();
        this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
        this.MAX_CACHE_SIZE = 50;
    }

    /**
     * Asynchronously initializes the use case by loading necessary settings.
     */
    async initialize() {
        await this.loadSettings();
    }

    async loadSettings() {
        this.settings.maxReviewWords = await this.storageService.getSetting(STORAGE_KEYS.DAILY_REVIEW_WORDS, 30);
        this.settings.dailyNewWords = await this.storageService.getSetting(STORAGE_KEYS.DAILY_NEW_WORDS, 10);
    }

    isNewWord(word) {
        return !word.progress || !word.progress.stage || word.progress.stage === 0;
    }

    async getDeckProgressStats(words) {
        if (!words || words.length === 0) return { review: 0, new: 0, mastered: 0 };

        const arabicKeys = words.map(w => w.arabic);
        const progressMap = await this.dbManager.getWordProgressBatch(arabicKeys);
        const wordsWithProgress = words.map(word => {
            const savedProgress = progressMap.get(word.arabic);
            return savedProgress ? { ...word, progress: savedProgress } : this.scheduler.initializeWord(word);
        });
        
        const dueWords = this.scheduler.getDueWords(wordsWithProgress);
        const newWords = wordsWithProgress.filter(word => this.isNewWord(word));
        const masteredWords = wordsWithProgress.filter(word => (word.progress?.stage || 0) >= 4);
        
        return { review: dueWords.length, new: newWords.length, mastered: masteredWords.length };
    }

    async getAllDecksProgressStats() {
        const collections = this.vocabularyWords.reduce((acc, word) => {
            word.definitions.forEach(def => {
                const [collectionName] = def.sourceDeck.split('//');
                if (!acc[collectionName]) {
                    acc[collectionName] = { words: new Set() };
                }
                acc[collectionName].words.add(word);
            });
            return acc;
        }, {});

        const now = Date.now();
        const stats = [];
        for (const collectionName in collections) {
            const cached = this.statsCache.get(collectionName);
            if (cached && (now - cached.timestamp < this.CACHE_TTL)) {
                stats.push(cached.data);
                continue;
            }

            const collectionWords = Array.from(collections[collectionName].words);
            const collectionStats = await this.getDeckProgressStats(collectionWords);
            const finalStats = {
                deckName: collectionName,
                dueCount: collectionStats.review + collectionStats.new,
                ...collectionStats
            };

            this.statsCache.set(collectionName, { timestamp: now, data: finalStats });
            if (this.statsCache.size > this.MAX_CACHE_SIZE) {
                this.statsCache.delete(this.statsCache.keys().next().value);
            }
            stats.push(finalStats);
        }
        return stats;
    }

    async prepareStudyQueue(wordList = this.vocabularyWords) {
        await this.loadSettings();

        const arabicKeys = wordList.map(w => w.arabic);
        const progressMap = await this.dbManager.getWordProgressBatch(arabicKeys);

        const wordsWithProgress = wordList.map(word => {
            const savedProgress = progressMap.get(word.arabic);
            return savedProgress ? { ...word, progress: { ...savedProgress } } : this.scheduler.initializeWord(word);
        });

        const dueReviewWords = [];
        const newWords = [];
        const notDueWords = [];

        for (const word of wordsWithProgress) {
            if (this.isNewWord(word)) {
                newWords.push(word);
            } else if (FSRS.isDue(word.progress)) {
                dueReviewWords.push(word);
            } else {
                notDueWords.push(word);
            }
        }

        dueReviewWords.sort((a, b) => (a.progress?.dueDate || 0) - (b.progress?.dueDate || 0));
        return { dueReviewWords, newWords, notDueWords };
    }

    _generateTripleRandomQueue(wordsToShuffle) {
        if (!wordsToShuffle || wordsToShuffle.length === 0) return [];
        const collections = new Map();
        for (const word of wordsToShuffle) {
            for (const def of word.definitions) {
                const [collectionName, deckName] = def.sourceDeck.split('//');
                if (!collections.has(collectionName)) collections.set(collectionName, new Map());
                const decksMap = collections.get(collectionName);
                if (!decksMap.has(deckName)) decksMap.set(deckName, []);
                decksMap.get(deckName).push(word);
            }
        }

        const shuffledQueue = [];
        const pickedWords = new Set();
        let remainingWordsCount = wordsToShuffle.length;

        while (remainingWordsCount > 0) {
            const availableCollections = Array.from(collections.keys());
            if (availableCollections.length === 0) break;
            const randomCollectionName = availableCollections[Math.floor(Math.random() * availableCollections.length)];
            const decksMap = collections.get(randomCollectionName);

            const availableDecks = Array.from(decksMap.keys());
            if (availableDecks.length === 0) {
                collections.delete(randomCollectionName);
                continue;
            }
            const randomDeckName = availableDecks[Math.floor(Math.random() * availableDecks.length)];
            const wordsInDeck = decksMap.get(randomDeckName);

            if (wordsInDeck.length === 0) {
                decksMap.delete(randomDeckName);
                if (decksMap.size === 0) collections.delete(randomCollectionName);
                continue;
            }
            const randomIndex = Math.floor(Math.random() * wordsInDeck.length);
            const pickedWord = wordsInDeck[randomIndex];

            if (pickedWords.has(pickedWord.arabic)) {
                wordsInDeck.splice(randomIndex, 1);
                if (wordsInDeck.length === 0) {
                    decksMap.delete(randomDeckName);
                    if (decksMap.size === 0) collections.delete(randomCollectionName);
                }
                continue;
            }

            shuffledQueue.push(pickedWord);
            pickedWords.add(pickedWord.arabic);
            remainingWordsCount--;
            wordsInDeck.splice(randomIndex, 1);
            if (wordsInDeck.length === 0) {
                decksMap.delete(randomDeckName);
                if (decksMap.size === 0) collections.delete(randomCollectionName);
            }
        }
        return shuffledQueue;
    }
    
    beginStudySession(deckName, studyQueue, wordList) {
        if (!studyQueue || studyQueue.length === 0) {
            console.warn('[RegularStudy] Attempted to start session with an empty queue.');
            return;
        }
        this.startSession(deckName, true, {
            precomputedQueue: studyQueue,
            fullWordList: wordList
        });
    }

    async execute({ scopes = [{ type: 'global' }] }) {
        let wordList = [];
        let sessionDeckName = "规律学习";

        if (scopes.find(s => s.type === 'global')) {
            wordList = this.vocabularyWords;
            sessionDeckName = "全局学习";
        } else {
            const selectedWords = new Set();
            for (const scope of scopes) {
                let filteredWords = [];
                if (scope.type === 'collection') {
                    filteredWords = this.vocabularyWords.filter(word => 
                        word.definitions.some(def => def.sourceDeck.startsWith(scope.name + '//'))
                    );
                } else if (scope.type === 'deck') {
                    filteredWords = this.vocabularyWords.filter(word => 
                        word.definitions.some(def => def.sourceDeck === scope.name)
                    );
                }
                filteredWords.forEach(word => selectedWords.add(word));
            }
            wordList = Array.from(selectedWords);
            sessionDeckName = scopes.length === 1 ? (scopes[0].type === 'collection' ? scopes[0].name : scopes[0].name.split('//').pop()) : "自定义学习";
        }

        const { dueReviewWords, newWords, notDueWords } = await this.prepareStudyQueue(wordList);
        const wordsForRandomShuffle = newWords.length > 0 ? newWords : notDueWords;
        const isLearningNew = newWords.length > 0;
        const shuffledPart = this._generateTripleRandomQueue(wordsForRandomShuffle);

        const reviewQueue = dueReviewWords.slice(0, this.settings.maxReviewWords);
        
        // Use the unified stats service to get today's learned words
        const remainingNewWordsQuota = isLearningNew ? Math.max(0, this.settings.dailyNewWords - this.statsService.getTotalTodayLearnedWords()) : Infinity;
        const remainingCapacity = Math.max(0, this.settings.maxReviewWords - reviewQueue.length);
        
        const newPartCount = Math.min(shuffledPart.length, remainingNewWordsQuota, remainingCapacity);
        const newQueue = shuffledPart.slice(0, newPartCount);

        const finalQueue = [...reviewQueue, ...newQueue];

        if (finalQueue.length === 0) {
            console.log('[RegularStudy] No content available to study today.');
            return false;
        }

        this.beginStudySession(sessionDeckName, finalQueue, wordList);
        return true;
    }

    /**
     * Gets collections and decks for UI population.
     * @returns {Map<string, Array<string>>}
     */
    getCollectionsAndDecks() {
        const collections = new Map();
        this.vocabularyWords.forEach(word => {
            word.definitions.forEach(def => {
                const [collectionName, deckName] = def.sourceDeck.split('//');
                if (!collections.has(collectionName)) {
                    collections.set(collectionName, new Set());
                }
                if (deckName) {
                    collections.get(collectionName).add(deckName);
                }
            });
        });

        // Convert sets to sorted arrays
        const sortedCollections = new Map();
        Array.from(collections.keys()).sort().forEach(collectionName => {
            const sortedDecks = Array.from(collections.get(collectionName)).sort();
            sortedCollections.set(collectionName, sortedDecks);
        });

        return sortedCollections;
    }
}
