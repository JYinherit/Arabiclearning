/**
 * @fileoverview Repository for managing active study session state.
 * This class provides methods to interact with the 'sessionState' object store
 * via the DatabaseManager.
 */

import { DatabaseManager } from '../infrastructure/DatabaseManager.js';

export class SessionRepository {
    /**
     * @param {DatabaseManager} dbManager - The DatabaseManager instance.
     */
    constructor(dbManager) {
        this.dbManager = dbManager;
        this.storeName = 'sessionState';
    }

    /**
     * Saves the state of a specific study session.
     * @param {string} deckName - The name of the deck for which the session state is being saved.
     * @param {object} sessionState - The session state object to save.
     * @returns {Promise<any>} The result of the put operation.
     */
    async saveSessionState(deckName, sessionState) {
        return this.dbManager.put(this.storeName, { deckName, state: sessionState, savedAt: Date.now() });
    }

    /**
     * Retrieves the state of a specific study session.
     * @param {string} deckName - The name of the deck to retrieve session state for.
     * @returns {Promise<object|null>} The session state object, or null if not found.
     */
    async loadSessionState(deckName) {
        const session = await this.dbManager.get(this.storeName, deckName);
        return session ? session.state : null;
    }

    /**
     * Clears the state of a specific study session.
     * @param {string} deckName - The name of the deck to clear session state for.
     * @returns {Promise<void>}
     */
    async clearSessionState(deckName) {
        return this.dbManager.delete(this.storeName, deckName);
    }

    /**
     * Retrieves all session states.
     * @returns {Promise<Array<object>>} An array of all session states.
     */
    async getAllSessionStates() {
        return this.dbManager.getAll(this.storeName);
    }

    /**
     * Clears all session state data.
     * @returns {Promise<void>}
     */
    async clearAllSessionStates() {
        return this.dbManager.clear(this.storeName);
    }
}
