/**
 * @fileoverview Repository for managing application statistics.
 * This class provides methods to interact with the 'stats' object store
 * via the DatabaseManager.
 */

import { DatabaseManager } from '../infrastructure/DatabaseManager.js';

export class StatsRepository {
    /**
     * @param {DatabaseManager} dbManager - The DatabaseManager instance.
     */
    constructor(dbManager) {
        this.dbManager = dbManager;
        this.storeName = 'stats';
        this.statsId = 'learningStats'; // The fixed ID for the single stats entry
    }

    /**
     * Saves the application statistics.
     * @param {object} statsData - The statistics data object.
     * @returns {Promise<any>} The result of the put operation.
     */
    async saveStats(statsData) {
        return this.dbManager.put(this.storeName, { id: this.statsId, ...statsData, lastUpdate: Date.now() });
    }

    /**
     * Retrieves the application statistics.
     * @returns {Promise<object>} The statistics data object, or an empty object if not found.
     */
    async loadStats() {
        return (await this.dbManager.get(this.storeName, this.statsId)) || {};
    }

    /**
     * Clears all statistics data.
     * @returns {Promise<void>}
     */
    async clearAllStats() {
        return this.dbManager.clear(this.storeName);
    }
}
