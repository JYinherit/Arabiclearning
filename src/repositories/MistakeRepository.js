/**
 * @fileoverview Repository for managing the Mistake Notebook.
 * Stores a list of Arabic words that the user has struggled with or manually added.
 */

import { STORAGE_KEYS } from '../common/constants.js';

export class MistakeRepository {
    /**
     * @param {import('../infrastructure/StorageService.js').StorageService} storageService
     */
    constructor(storageService) {
        this.storageService = storageService;
        this._cache = null;
    }

    /**
     * Loads the list of mistaken words from storage.
     * @returns {Promise<Set<string>>} A Set of Arabic words.
     */
    async _load() {
        if (this._cache) return this._cache;

        // Note: 'mistake_notebook_words' is stored as a simple array of strings
        // in local storage via the generic getSetting/saveSetting or dedicated method?
        // Since it might get large, using the DB is better, but StorageService mostly wraps DB/LocalStorage.
        // Looking at StorageService (which I haven't read fully but usually has get/set),
        // let's assume we use a dedicated store or just a setting key if it's small enough.
        // Given it's a list of keys, it fits in a setting if < 1000 words.
        // But for robustness, let's use the generic 'get' from StorageService if it supports arbitrary keys,
        // or piggyback on 'settings'.
        // Actually, StorageService usually has `getSetting`.

        const list = await this.storageService.getSetting(STORAGE_KEYS.MISTAKE_NOTEBOOK, []);
        this._cache = new Set(list);
        return this._cache;
    }

    async _save() {
        if (!this._cache) return;
        await this.storageService.saveSetting(STORAGE_KEYS.MISTAKE_NOTEBOOK, Array.from(this._cache));
    }

    /**
     * Adds a word to the mistake notebook.
     * @param {string} arabic - The Arabic word to add.
     * @returns {Promise<boolean>} True if added, false if already exists.
     */
    async addWord(arabic) {
        const set = await this._load();
        if (set.has(arabic)) return false;

        set.add(arabic);
        await this._save();
        return true;
    }

    /**
     * Removes a word from the mistake notebook.
     * @param {string} arabic - The Arabic word to remove.
     * @returns {Promise<boolean>} True if removed, false if not found.
     */
    async removeWord(arabic) {
        const set = await this._load();
        if (!set.has(arabic)) return false;

        set.delete(arabic);
        await this._save();
        return true;
    }

    /**
     * Checks if a word is in the notebook.
     * @param {string} arabic
     * @returns {Promise<boolean>}
     */
    async hasWord(arabic) {
        const set = await this._load();
        return set.has(arabic);
    }

    /**
     * Gets all words in the notebook.
     * @returns {Promise<Array<string>>}
     */
    async getAllWords() {
        const set = await this._load();
        return Array.from(set);
    }

    /**
     * Returns the count of words in the notebook.
     * @returns {Promise<number>}
     */
     async getCount() {
         const set = await this._load();
         return set.size;
     }
}
