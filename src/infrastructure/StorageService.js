/**
 * @fileoverview This module acts as a high-level storage layer.
 * It communicates with the dbManager to perform all data persistence operations,
 * such as loading/saving vocabularies, progress, and settings. It also handles
 * one-time data migrations.
 */

export class StorageService {
    /**
     * @param {import('./DatabaseManager.js').DatabaseManager} dbManager 
     */
    constructor(dbManager) {
        this.dbManager = dbManager;
    }

    /**
     * Initializes the database connection and runs any necessary data migrations.
     * @returns {Promise<boolean>} True if initialization is successful.
     */
    async initialize() {
        await this.dbManager.openDatabase();
        await this._migrateToMultiDefinitionStructure();
        return true;
    }

    /**
     * One-time migration function to convert the old, deck-based data structure
     * to the new "multi-definition" flat structure.
     * It checks a flag in the database to ensure it only runs once.
     */
    async _migrateToMultiDefinitionStructure() {
        const MIGRATION_FLAG = 'multiDefMigration_Completed_v2';
        try {
            const migrated = await this.dbManager.getSetting(MIGRATION_FLAG, false);
            if (migrated) {
                return; // Silently return as migration is already done.
            }

            // Check if the old objectStore exists before trying to read from it.
            if (!this.dbManager.db.objectStoreNames.contains('decks')) {
                console.log('Old "decks" store not found, skipping migration.');
                await this.dbManager.saveSetting(MIGRATION_FLAG, true);
                return;
            }

            console.log('Starting data migration to new multi-definition structure...');
            const oldDecks = await this.dbManager.getAll('decks');
            if (!oldDecks || oldDecks.length === 0) {
                console.log('Old "decks" store is empty, completing migration.');
                await this.dbManager.saveSetting(MIGRATION_FLAG, true);
                return;
            }

            const newWordsMap = new Map();

            for (const deck of oldDecks) {
                if (!deck.words) continue;
                for (const oldWord of deck.words) {
                    if (!oldWord.arabic || !oldWord.chinese) continue;

                    const newDefinition = {
                        id: `def_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        chinese: oldWord.chinese,
                        explanation: oldWord.explanation || '暂无解释',
                        sourceDeck: deck.name
                    };

                    if (newWordsMap.has(oldWord.arabic)) {
                        newWordsMap.get(oldWord.arabic).definitions.push(newDefinition);
                    } else {
                        newWordsMap.set(oldWord.arabic, {
                            arabic: oldWord.arabic,
                            definitions: [newDefinition]
                        });
                    }
                }
            }

            const wordsToSave = Array.from(newWordsMap.values());
            if (wordsToSave.length > 0) {
                await this.dbManager.saveDecks(wordsToSave);
                console.log(`Successfully migrated ${wordsToSave.length} unique words.`);
            }

            await this.dbManager.saveSetting(MIGRATION_FLAG, true);
            console.log('Data migration completed successfully!');

        } catch (error) {
            console.error('Data migration failed:', error);
            // We throw the error so the calling layer can handle it, maybe by notifying the user.
            throw new Error('数据迁移失败。');
        }
    }

    /**
     * Saves the learning progress for a batch of words and the current session state.
     * @param {string} deckName - The name of the current deck.
     * @param {Array<import('../core/Word.js').Word>} activeWords - The words from the current session with updated progress.
     * @param {object|null} sessionState - The current session state, or null to clear it.
     */
    async saveProgress(deckName, activeWords, sessionState) {
        if (deckName === null || deckName === undefined) {
            console.warn('saveProgress: deckName was null/undefined, skipping sessionState operation');
            sessionState = undefined; // Avoid trying a delete operation
        }
        
        const progressBatch = activeWords
            .filter(word => word.progress) // Only save words that have progress info.
            .map(word => ({ arabic: word.arabic, progress: word.progress }));
        
        await this.dbManager.saveProgressTransaction(deckName, progressBatch, sessionState);
    }

    /** Saves application-wide statistics. */
    async saveStats(stats) {
        await this.dbManager.saveStats(stats);
    }

    /** Loads application-wide statistics. */
    async loadStats() {
        return (await this.dbManager.loadStats()) || {};
    }

    /** Saves a single key-value setting. */
    async saveSetting(key, value) {
        await this.dbManager.saveSetting(key, value);
    }

    /** Retrieves a single setting, with a fallback default value. */
    async getSetting(key, defaultValue) {
        return await this.dbManager.getSetting(key, defaultValue);
    }

    /** Loads the saved state for an unfinished session. */
    async loadSessionState(deckName) {
        return await this.dbManager.loadSessionState(deckName);
    }

    /** Clears the saved state for a specific deck session. */
    async clearSessionState(deckName) {
        return await this.dbManager.clearSessionState(deckName);
    }

    /**
     * Clears selected parts of the database based on user options.
     * @param {object} options - An object with boolean flags for each data type to clear.
     */
    async clearDataGranularly(options) {
        const storesToClear = [];
        if (options.decks) storesToClear.push('decks_v2');
        if (options.progress) storesToClear.push('wordProgress');
        if (options.stats) storesToClear.push('stats');
        if (options.settings) storesToClear.push('settings');
        if (options.sessions) storesToClear.push('sessionState');

        if (storesToClear.length > 0) {
            await this.dbManager.clearStores(storesToClear);
        }
    }

    /**
     * Exports all user data from IndexedDB for backup.
     * @returns {Promise<object>} A JSON object containing all data.
     */
    async exportAllData() {
        return await this.dbManager.exportAllData();
    }

    /**
     * Imports user data from a backup object, overwriting all current data.
     * @param {object} backupData 
     */
    async importBackupData(backupData) {
        return await this.dbManager.importBackupData(backupData);
    }

    /**
     * Gets the current IndexedDB storage usage estimate.
     * @returns {Promise<{totalSizeMB: string, estimatedLimit: string}>}
     */
    async getStorageUsage() {
        return await this.dbManager.getStorageUsage();
    }
}
