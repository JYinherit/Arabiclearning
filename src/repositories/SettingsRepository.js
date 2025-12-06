/**
 * @fileoverview Repository for managing application settings.
 * This class provides methods to interact with the 'settings' object store
 * via the DatabaseManager.
 */

import { DatabaseManager } from '../infrastructure/DatabaseManager.js';

export class SettingsRepository {
    /**
     * @param {DatabaseManager} dbManager - The DatabaseManager instance.
     */
    constructor(dbManager) {
        this.dbManager = dbManager;
        this.storeName = 'settings';
    }

    /**
     * Saves a single application setting.
     * @param {string} key - The key of the setting.
     * @param {any} value - The value of the setting.
     * @returns {Promise<any>} The result of the the put operation.
     */
    async saveSetting(key, value) {
        return this.dbManager.put(this.storeName, { key, value, updatedAt: Date.now() });
    }

    /**
     * Retrieves a single application setting.
     * @param {string} key - The key of the setting.
     * @param {any} defaultValue - The default value to return if the setting is not found.
     * @returns {Promise<any>} The value of the setting, or the defaultValue if not found.
     */
    async getSetting(key, defaultValue) {
        const setting = await this.dbManager.get(this.storeName, key);
        return setting ? setting.value : defaultValue;
    }

    /**
     * Retrieves all settings.
     * @returns {Promise<Array<object>>} An array of all settings.
     */
    async getAllSettings() {
        return this.dbManager.getAll(this.storeName);
    }

    /**
     * Clears all settings data.
     * @returns {Promise<void>}
     */
    async clearAllSettings() {
        return this.dbManager.clear(this.storeName);
    }
}
