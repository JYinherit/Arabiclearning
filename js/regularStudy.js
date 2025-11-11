/**
 * @fileoverview 管理“规律学习”功能。
 * 该模块选择一个合适的词库进行学习，根据 FSRS 准备一个优先的
 * 新词和到期词的队列，并启动学习会话。
 */

import ReviewScheduler from './memory.js';
import { dbManager } from './db.js';
import { STORAGE_KEYS } from './constants.js';
import { shuffleArray } from './utils.js';
import { getSetting } from './storage.js';

export class RegularStudy {
    /**
     * @param {object} dependencies - 来自主应用的依赖项。
     * @param {Array} dependencies.vocabularyWords - 对主词汇数组的引用。
     * @param {Function} dependencies.startSession - 用于开始学习会话的主函数。
     * @param {object} dependencies.currentDeckNameRef - 对当前词库名称的引用。
     */
    constructor(dependencies) {
        this.vocabularyWords = dependencies.vocabularyWords;
        this.startSession = dependencies.startSession;
        this.currentDeckNameRef = dependencies.currentDeckNameRef;
        this.scheduler = new ReviewScheduler();
        this.settings = {
            maxReviewWords: 30,
            dailyNewWords: 10,
        };
        this.learnedToday = new Map(); // 跟踪每个词库今天学习的新词。
        this.statsCache = new Map();
        this.CACHE_TTL = 5 * 60 * 1000; // 5 分钟
        this.MAX_CACHE_SIZE = 50; // 添加最大限制
    }

    /**
     * 从存储中加载规律学习相关的设置。
     */
    async loadSettings() {
        this.settings.maxReviewWords = await getSetting(STORAGE_KEYS.DAILY_REVIEW_WORDS, 30);
        this.settings.dailyNewWords = await getSetting(STORAGE_KEYS.DAILY_NEW_WORDS, 10);
        console.log('[RegularStudy] 已加载学习设置:', this.settings);
    }

    /**
     * 从 IndexedDB 加载今天已学习的新词统计信息。
     * 如果记录是昨天的，则会忽略。
     */
    async loadLearnedToday() {
        const storedStats = await dbManager.getSetting(STORAGE_KEYS.REGULAR_STUDY_STATS);
        const today = new Date().toISOString().split('T')[0];
        if (storedStats && storedStats.date === today && Array.isArray(storedStats.learnedToday)) {
            this.learnedToday = new Map(storedStats.learnedToday);
            console.log('[RegularStudy] 已从存储中加载今日学习统计。');
        }
    }

    /** 检查一个单词是否是新学的。 */
    isNewWord(word) {
        return !word.progress || !word.progress.stage || word.progress.stage === 0;
    }

    /** 获取今天为指定词库学习的新单词数。 */
    getTodayLearnedWords(deckName) {
        const today = new Date().toISOString().split('T')[0];
        const record = this.learnedToday.get(deckName);
        if (record && record.date === today) {
            return record.count;
        }
        return 0;
    }

    /** 
     * 为指定词库增加今天学习的新单词计数，并持久化结果。
     */
    async incrementTodayLearnedWords(deckName) {
        const today = new Date().toISOString().split('T')[0];

        // 清理掉其他日期的过时条目
        for (const [key, value] of this.learnedToday.entries()) {
            if (value.date !== today) {
                this.learnedToday.delete(key);
            }
        }

        const record = this.learnedToday.get(deckName);
        if (record) { // 记录必定是今天的
            record.count++;
        } else {
            this.learnedToday.set(deckName, { date: today, count: 1 });
        }

        console.log(`[RegularStudy] Deck "${deckName}" new words learned today: ${this.getTodayLearnedWords(deckName)}`);

        // 持久化更新后的 Map
        await dbManager.saveSetting(STORAGE_KEYS.REGULAR_STUDY_STATS, {
            date: today,
            learnedToday: Array.from(this.learnedToday.entries()) // 为可序列化，将 Map 转为数组
        });
    }

    /**
     * 为给定的一组单词计算进度统计（新词、复习、已掌握）。
     * @param {Array<object>} words - 要分析的单词。
     * @returns {Promise<object>} 一个包含单词统计信息的对象。
     */
    async getDeckProgressStats(words) {
        if (!words || words.length === 0) return { review: 0, new: 0, mastered: 0 };

        const arabicKeys = words.map(w => w.arabic);
        const progressMap = await dbManager.getWordProgressBatch(arabicKeys);
        const wordsWithProgress = words.map(word => {
            const savedProgress = progressMap.get(word.arabic);
            return savedProgress ? { ...word, progress: savedProgress } : this.scheduler.initializeWord(word);
        });
        
        const dueWords = this.scheduler.getDueWords(wordsWithProgress);
        const newWords = wordsWithProgress.filter(word => this.isNewWord(word));
        const masteredWords = wordsWithProgress.filter(word => (word.progress?.stage || 0) >= 4);
        
        return { review: dueWords.length, new: newWords.length, mastered: masteredWords.length };
    }

    /**
     * 通过对扁平化的单词列表进行分组，计算所有词库的进度统计。
     * @returns {Promise<Array<object>>} 每个词库的统计对象列表。
     */
    async getAllDecksProgressStats() {
        const collections = this.vocabularyWords.reduce((acc, word) => {
            word.definitions.forEach(def => {
                const [collectionName, deckName] = def.sourceDeck.split('//');
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
                deckName: collectionName, // Use collectionName as the identifier
                dueCount: collectionStats.review + collectionStats.new,
                ...collectionStats
            };

            this.statsCache.set(collectionName, {
                timestamp: now,
                data: finalStats
            });

            if (this.statsCache.size >= this.MAX_CACHE_SIZE) {
                const oldestKey = this.statsCache.keys().next().value;
                this.statsCache.delete(oldestKey);
            }

            stats.push(finalStats);
        }
        return stats;
    }


    /**
     * 为所有词库准备一个全局学习队列。
     * 该函数首先将所有单词分为三类：到期、新、未到期。
     * 然后，它将根据我们定义的逻辑构建最终的学习队列。
     * @returns {Promise<{dueReviewWords: Array, newWords: Array, notDueWords: Array}>} 一个包含所有分类后单词的对象。
     */
    async prepareStudyQueue() {
        await this.loadSettings(); // 确保设置是最新的

        const allWords = this.vocabularyWords;
        const arabicKeys = allWords.map(w => w.arabic);
        const progressMap = await dbManager.getWordProgressBatch(arabicKeys);

        const wordsWithProgress = allWords.map(word => {
            const savedProgress = progressMap.get(word.arabic);
            return savedProgress ? { ...word, progress: savedProgress } : this.scheduler.initializeWord(word);
        });

        const dueReviewWords = [];
        const newWords = [];
        const notDueWords = [];

        for (const word of wordsWithProgress) {
            if (this.isNewWord(word)) {
                newWords.push(word);
            } else if (this.scheduler.fsrs.isCardDue(word)) {
                dueReviewWords.push(word);
            } else {
                notDueWords.push(word);
            }
        }

        // 按到期时间对复习词进行排序，最先到期的排在前面
        dueReviewWords.sort((a, b) => (a.progress?.dueDate || 0) - (b.progress?.dueDate || 0));

        return { dueReviewWords, newWords, notDueWords };
    }

    /**
     * 根据“三重随机”原则（随机集合 -> 随机词库 -> 随机单词）生成一个打乱顺序的学习队列。
     * @param {Array<object>} wordsToShuffle - 需要打乱顺序的单词数组。
     * @returns {Array<object>} 一个包含了所有输入单词的、被打乱顺序的新数组。
     */
    _generateTripleRandomQueue(wordsToShuffle) {
        if (!wordsToShuffle || wordsToShuffle.length === 0) {
            return [];
        }

        // 步骤 1: 构建 Collection -> Deck -> [Words] 的嵌套结构
        const collections = new Map();
        for (const word of wordsToShuffle) {
            for (const def of word.definitions) {
                const [collectionName, deckName] = def.sourceDeck.split('//');

                if (!collections.has(collectionName)) {
                    collections.set(collectionName, new Map());
                }
                const decksMap = collections.get(collectionName);
                if (!decksMap.has(deckName)) {
                    decksMap.set(deckName, []);
                }
                decksMap.get(deckName).push(word);
            }
        }

        const shuffledQueue = [];
        const pickedWords = new Set(); // 用于跟踪已选中的单词，确保唯一性
        let remainingWordsCount = wordsToShuffle.length;

        // 步骤 2: 循环随机抽取，直到所有单词都被选中
        while (remainingWordsCount > 0) {
            // 2a: 随机选择一个集合
            const availableCollections = Array.from(collections.keys());
            if (availableCollections.length === 0) break; // 所有集合都空了，提前退出
            const randomCollectionName = availableCollections[Math.floor(Math.random() * availableCollections.length)];
            const decksMap = collections.get(randomCollectionName);

            // 2b: 随机选择一个词库
            const availableDecks = Array.from(decksMap.keys());
            if (availableDecks.length === 0) {
                collections.delete(randomCollectionName); // 这个集合已经空了，删除并重试
                continue;
            }
            const randomDeckName = availableDecks[Math.floor(Math.random() * availableDecks.length)];
            const wordsInDeck = decksMap.get(randomDeckName);

            // 2c: 随机选择一个单词
            if (wordsInDeck.length === 0) {
                decksMap.delete(randomDeckName); // 这个词库已经空了，删除并重试
                if (decksMap.size === 0) collections.delete(randomCollectionName);
                continue;
            }
            const randomIndex = Math.floor(Math.random() * wordsInDeck.length);
            const pickedWord = wordsInDeck[randomIndex];

            // 步骤 3: 检查唯一性
            if (pickedWords.has(pickedWord.arabic)) {
                // 这个单词之前从别的词库被选过了，将它从当前词库移除，然后重试
                wordsInDeck.splice(randomIndex, 1);
                if (wordsInDeck.length === 0) {
                    decksMap.delete(randomDeckName);
                    if (decksMap.size === 0) collections.delete(randomCollectionName);
                }
                continue;
            }

            // 步骤 4: 添加到队列并更新状态
            shuffledQueue.push(pickedWord);
            pickedWords.add(pickedWord.arabic);
            remainingWordsCount--;

            // 从当前词库数组中移除，避免重复选择
            wordsInDeck.splice(randomIndex, 1);
            if (wordsInDeck.length === 0) {
                decksMap.delete(randomDeckName);
                if (decksMap.size === 0) collections.delete(randomCollectionName);
            }
        }

        return shuffledQueue;
    }
    
    /**
     * 将准备好的学习队列交给主会话管理器。
     * @param {string} deckName - 词库的名称。
     * @param {Array<object>} studyQueue - 准备好的待学习单词列表。
     */
    beginStudySession(deckName, studyQueue) {
        if (!studyQueue || studyQueue.length === 0) {
            console.warn('[RegularStudy] 尝试用空队列开始会话。');
            return;
        }
        // `true` 标志表示这是一个启用 FSRS 的会话。
        this.startSession(deckName, true, { precomputedQueue: studyQueue });
    }

    /**
     * 开始一个全局的“规律学习”会话。
     * 这个函数会从所有词库中准备一个学习队列，优先处理到期的复习卡片，
     * 然后是随机顺序的新卡片（或未到期的卡片，如果没有新卡片的话）。
     * @returns {Promise<boolean>} 如果会话成功开始则为 true，否则为 false。
     */
    async startGlobalRegularStudy() {
        const { dueReviewWords, newWords, notDueWords } = await this.prepareStudyQueue();

        let wordsForRandomShuffle;
        let isLearningNew = true;

        if (newWords.length > 0) {
            wordsForRandomShuffle = newWords;
        } else {
            wordsForRandomShuffle = notDueWords;
            isLearningNew = false;
        }

        const shuffledPart = this._generateTripleRandomQueue(wordsForRandomShuffle);

        // 应用每日新词和最大复习数的限制
        const maxReviews = this.settings.maxReviewWords;
        const dailyNew = this.settings.dailyNewWords;

        const reviewQueue = dueReviewWords.slice(0, maxReviews);
        
        const newWordsQuota = isLearningNew ? dailyNew : Infinity; // 如果是复习未到期词，则不应用新词限额
        const remainingCapacity = Math.max(0, maxReviews - reviewQueue.length);
        
        const newPartCount = Math.min(shuffledPart.length, newWordsQuota, remainingCapacity);
        const newQueue = shuffledPart.slice(0, newPartCount);

        const finalQueue = [...reviewQueue, ...newQueue];

        if (finalQueue.length === 0) {
            console.log('[RegularStudy] 今天没有可学习的内容。');
            // 这里可以考虑向用户显示一个消息
            return false;
        }

        // 对于全局学习，我们将 deckName 设为一个通用标签
        const sessionDeckName = "规律学习";
        this.currentDeckNameRef.value = sessionDeckName;
        this.beginStudySession(sessionDeckName, finalQueue);

        return true;
    }
}

/**
 * 用于创建并异步初始化 RegularStudy 模块实例的工厂函数。
 * @param {object} dependencies - 来自主应用的依赖项。
 * @returns {Promise<RegularStudy>} RegularStudy 类的新实例。
 */
export async function setupRegularStudy(dependencies) {
    const module = new RegularStudy(dependencies);
    await module.loadLearnedToday();
    await module.loadSettings();
    return module;
}
