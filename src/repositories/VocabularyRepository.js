/**
 * @fileoverview 提供了 VocabularyRepository 类，作为词汇数据的统一访问层。
 *
 * 这个“数据管家”封装了所有与词汇相关的数据库操作（加载、保存），
 * 并实现了内存缓存策略以提高性能。它是第二阶段重构的核心产物。
 */

import { Word } from '../core/Word.js';
import { Progress } from '../core/Progress.js';

const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 分钟

export class VocabularyRepository {
    /**
     * @param {import('../js/db.js').DatabaseManager} dbManager - 数据库管理器实例。
     */
    constructor(dbManager) {
        this.db = dbManager;
        this._cache = {
            words: null,
            timestamp: 0,
        };
    }

    /**
     * 从数据源（缓存或数据库）获取所有单词。
     * @returns {Promise<Array<Word>>} 一个解析为 Word 实例数组的 Promise。
     */
    async getAll() {
        const now = Date.now();
        if (this._cache.words && (now - this._cache.timestamp < CACHE_DURATION_MS)) {
            console.log('[VocabRepo] Loading vocabulary from cache.');
            return [...this._cache.words]; // Return a clone to prevent external mutation
        }

        console.log('[VocabRepo] Loading vocabulary from database.');
        const plainWords = await this.db.loadDecks(); // this is actually loadAllWords
        if (!plainWords || plainWords.length === 0) {
            return [];
        }

        console.log(`[VocabRepo] Loaded ${plainWords.length} word definitions. Now fetching progress...`);
        const arabicKeys = plainWords.map(wordData => wordData.arabic);
        const progressMap = await this.db.getWordProgressBatch(arabicKeys);
        console.log(`[VocabRepo] Fetched ${progressMap.size} progress entries.`);

        // Combine word definitions with their progress
        const wordInstances = plainWords.map(wordData => {
            const wordProgress = progressMap.get(wordData.arabic) || null;
            return new Word(wordData.arabic, wordData.definitions, wordProgress);
        });

        this._cache.words = wordInstances;
        this._cache.timestamp = now;
        console.log('[VocabRepo] Cache updated with full word objects.');

        return [...this._cache.words];
    }

    /**
     * 将整个词汇列表保存到数据库。
     * @param {Array<Word>} words - 要保存的 Word 实例数组。
     */
    async save(words) {
        console.log(`[VocabRepo] Saving ${words.length} words and their progress to the database.`);

        const wordsToSave = words.map(word => ({
            arabic: word.arabic,
            definitions: word.definitions,
        }));

        const progressToSave = words
            .filter(word => word.progress) // Only include words that have a progress object
            .map(word => ({
                arabic: word.arabic,
                progress: word.progress,
            }));

        try {
            await this.db.ensureDB();
            const tx = this.db.db.transaction(['decks_v2', 'wordProgress'], 'readwrite');
            const decksStore = tx.objectStore('decks_v2');
            const progressStore = tx.objectStore('wordProgress');

            wordsToSave.forEach(word => decksStore.put(word));
            progressToSave.forEach(prog => progressStore.put(prog));
            
            await new Promise((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });

            this.invalidateCache();
            console.log(`[VocabRepo] Successfully saved ${words.length} words and ${progressToSave.length} progress entries.`);
            return words.length;

        } catch (error) {
            console.error('[VocabRepo] Failed to save words and progress:', error);
            throw error; // Re-throw the error to be handled by the caller
        }
    }

    /**
     * 更新单个单词。这是一个便捷方法，但效率较低。
     * 它会读取所有单词，替换其中一个，然后保存整个列表。
     * @param {Word} updatedWord - 更新后的 Word 实例。
     */
    async updateWord(updatedWord) {
        const allWords = await this.getAll();
        const index = allWords.findIndex(w => w.arabic === updatedWord.arabic);

        if (index !== -1) {
            allWords[index] = updatedWord;
        } else {
            allWords.push(updatedWord);
        }

        return this.save(allWords);
    }

    /**
     * 使内部缓存失效。
     */
    invalidateCache() {
        console.log('[VocabRepo] 缓存已失效。');
        this._cache.words = null;
        this._cache.timestamp = 0;
    }
}
