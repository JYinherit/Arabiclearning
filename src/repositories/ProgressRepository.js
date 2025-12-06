/**
 * @fileoverview Repository for managing word progress data.
 * This class provides methods to interact with the 'wordProgress' object store
 * via the DatabaseManager.
 */

import { DatabaseManager } from '../infrastructure/DatabaseManager.js';

export class ProgressRepository {
    /**
     * @param {DatabaseManager} dbManager - The DatabaseManager instance.
     */
    constructor(dbManager) {
        this.dbManager = dbManager;
        this.storeName = 'wordProgress';
    }

    /**
     * Retrieves the progress for a single word.
     * @param {string} arabicWord - The Arabic word to get progress for.
     * @returns {Promise<object|null>} The progress object, or null if not found.
     */
    async getWordProgress(arabicWord) {
        const progressEntry = await this.dbManager.get(this.storeName, arabicWord);
        return progressEntry ? progressEntry.progress : null;
    }

    /**
     * Saves the progress for a single word.
     * @param {string} arabicWord - The Arabic word.
     * @param {object} progressData - The progress data object (e.g., {reviews, stage}).
     * @returns {Promise<any>} The result of the put operation.
     */
    async saveWordProgress(arabicWord, progressData) {
        return this.dbManager.put(this.storeName, { arabic: arabicWord, progress: progressData });
    }

    /**
     * Retrieves progress for a batch of words.
     * @param {Array<string>} arabicWords - An array of Arabic words.
     * @returns {Promise<Map<string, object>>} A Map where keys are Arabic words and values are their progress.
     */
    async getWordProgressBatch(arabicWords) {
        return this.dbManager.getWordProgressBatch(arabicWords);
    }

    /**
     * Saves progress for a batch of words.
     * @param {Array<object>} progressArray - An array of progress objects {arabic: string, progress: object}.
     * @returns {Promise<void>}
     */
    async saveWordProgressBatch(progressArray) {
        return this.dbManager.saveWordProgressBatch(progressArray);
    }

    /**
     * Retrieves all word progress entries.
     * @returns {Promise<Array<object>>} An array of all progress entries.
     */
    async getAllWordProgress() {
        return this.dbManager.getAll(this.storeName);
    }

    /**
     * Clears all word progress data.
     * @returns {Promise<void>}
     */
    async clearAllProgress() {
        return this.dbManager.clear(this.storeName);
    }
}
