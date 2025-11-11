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
     * 为给定的一组词库单词准备一个优先的学习队列。
     * 队列由到期的复习单词和有限数量的新单词组成。
     * @param {Array<object>} deckWords - 属于正在学习的词库的单词。
     * @returns {Promise<Array<object>>} 经过优先级排序和打乱的学习队列。
     */
    async prepareStudyQueue(deckWords) {
        await this.loadSettings(); // 每次准备队列时重新加载设置，以确保使用的是最新值。
        const arabicKeys = deckWords.map(w => w.arabic);
        const progressMap = await dbManager.getWordProgressBatch(arabicKeys);
        const wordsWithProgress = deckWords.map(word => {
            const savedProgress = progressMap.get(word.arabic);
            return savedProgress ? { ...word, progress: savedProgress } : this.scheduler.initializeWord(word);
        });
        
        // 分离到期复习词和新词
        const reviewWords = wordsWithProgress.filter(word => 
            !this.isNewWord(word) && this.scheduler.fsrs.isCardDue(word)
        );
        const newWords = wordsWithProgress.filter(word => this.isNewWord(word));

        // 按到期时间对复习词排序
        reviewWords.sort((a, b) => (a.progress?.dueDate || 0) - (b.progress?.dueDate || 0));
        
        // 1. 优先处理复习单词，最多不超过设定的上限。
        const selectedReviewWords = reviewWords.slice(0, this.settings.maxReviewWords);

        // 2. 计算今天还可以学习多少新单词。
        const learnedTodayCount = this.getTodayLearnedWords(this.currentDeckNameRef.value);
        const newWordsDailyQuota = Math.max(0, this.settings.dailyNewWords - learnedTodayCount);

        // 3. 新单词不应使当前会话的总数超过复习上限。
        const remainingSessionCapacity = Math.max(0, this.settings.maxReviewWords - selectedReviewWords.length);

        // 4. 要添加的新单词数取所有约束条件下的最小值。
        const numberOfNewWordsToAdd = Math.min(newWords.length, newWordsDailyQuota, remainingSessionCapacity);
        
        const selectedNewWords = newWords.slice(0, numberOfNewWordsToAdd);

        // 新单词被打乱以避免按固定顺序学习。
        const shuffledNewWords = shuffleArray(selectedNewWords);
        
        return [...selectedReviewWords, ...shuffledNewWords];
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
     * 使用特定词库开始一个规律学习会话的主入口点。
     * @param {string} deckName - 要开始的词库名称。
     * @returns {Promise<boolean>} 如果会话成功开始则为 true，否则为 false。
     */
    async startRegularStudyWithDeckName(deckName) {
        const deckWords = this.vocabularyWords.filter(w => w.definitions.some(d => d.sourceDeck.startsWith(deckName)));

        if (!deckWords || deckWords.length === 0) {
            console.error(`[RegularStudy] 词库 "${deckName}" 未找到或为空。`);
            return false;
        }

        this.currentDeckNameRef.value = deckName;
        
        const studyQueue = await this.prepareStudyQueue(deckWords);
        
        if (studyQueue.length === 0) {
            console.log(`[RegularStudy] 今天没有 "${deckName}" 的学习内容。`);
            return false;
        }

        this.beginStudySession(deckName, studyQueue);
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
