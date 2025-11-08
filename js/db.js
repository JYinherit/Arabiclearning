/**
 * @fileoverview 管理所有与 IndexedDB 数据库的交互。
 * 此类作为 IndexedDB 的单例包装器，为所有数据库操作提供了一个更简单的、
 * 基于 Promise 的 API。
 */

class DatabaseManager {
    constructor() {
        this.dbName = 'ArabicLearningDB';
        this.version = 5; // 仅在需要更改数据库结构时才增加此版本号。
        this.db = null;
    }

    /**
     * 打开并初始化 IndexedDB 数据库，如果对象仓库（object stores）不存在，则创建它们。
     * 这是所有数据库交互的入口点。
     * @returns {Promise<IDBDatabase>} 一个解析为数据库实例的 Promise。
     */
    async openDatabase() {
        if (!('indexedDB' in window)) {
            throw new Error('浏览器不支持 IndexedDB。');
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(new Error('打开数据库失败。'));
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            // 此事件仅在版本号变更时触发。
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // 为“一词多义”数据模型创建对象仓库。
                if (!db.objectStoreNames.contains('decks_v2')) {
                    db.createObjectStore('decks_v2', { keyPath: 'arabic' });
                }
                if (!db.objectStoreNames.contains('wordProgress')) {
                    const wordProgressStore = db.createObjectStore('wordProgress', { keyPath: 'arabic' });
                    wordProgressStore.createIndex('dueDate', 'progress.dueDate');
                } else {
                    const wordProgressStore = event.target.transaction.objectStore('wordProgress');
                    if (!wordProgressStore.indexNames.contains('dueDate')) {
                        wordProgressStore.createIndex('dueDate', 'progress.dueDate');
                    }
                }
                // 通用仓库。
                if (!db.objectStoreNames.contains('stats')) {
                    db.createObjectStore('stats', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
                if (!db.objectStoreNames.contains('sessionState')) {
                    db.createObjectStore('sessionState', { keyPath: 'deckName' });
                }
                // 清理旧的、未使用的仓库。
                // 注意：为确保数据迁移的安全性，旧仓库的删除应在迁移逻辑成功完成后手动处理，
                // 而不是在 onupgradeneeded 事件中自动删除。
                // if (db.objectStoreNames.contains('decks')) {
                //     db.deleteObjectStore('decks');
                // }
                // if (db.objectStoreNames.contains('progress')) {
                //     db.deleteObjectStore('progress');
                // }
            };
        });
    }

    /**
     * 一个辅助函数，确保在执行任何操作前数据库连接已建立。
     */
    async ensureDB() {
        if (!this.db) {
            await this.openDatabase();
        }
    }

    /**
     * 将 IDBRequest 包装在 Promise 中的辅助函数。
     * @param {IDBRequest} request 要 promisify 的请求。
     * @returns {Promise<any>} 一个在成功时解析为请求结果，在失败时拒绝的 Promise。
     */
    _promisifyRequest(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // --- 通用 CRUD 操作 ---
    // 这些方法为与任何对象仓库的交互提供了一个基本的、可重用的接口。

    async add(storeName, data) {
        await this.ensureDB();
        const transaction = this.db.transaction(storeName, 'readwrite');
        const request = transaction.objectStore(storeName).add(data);
        return this._promisifyRequest(request);
    }

    async put(storeName, data) {
        await this.ensureDB();
        const transaction = this.db.transaction(storeName, 'readwrite');
        const request = transaction.objectStore(storeName).put(data);
        return this._promisifyRequest(request);
    }

    async get(storeName, key) {
        await this.ensureDB();
        const transaction = this.db.transaction(storeName, 'readonly');
        const request = transaction.objectStore(storeName).get(key);
        return this._promisifyRequest(request);
    }

    async getAll(storeName) {
        await this.ensureDB();
        const transaction = this.db.transaction(storeName, 'readonly');
        const request = transaction.objectStore(storeName).getAll();
        return this._promisifyRequest(request);
    }

    async delete(storeName, key) {
        await this.ensureDB();
        const transaction = this.db.transaction(storeName, 'readwrite');
        const request = transaction.objectStore(storeName).delete(key);
        return this._promisifyRequest(request);
    }

    async clear(storeName) {
        await this.ensureDB();
        const transaction = this.db.transaction(storeName, 'readwrite');
        const request = transaction.objectStore(storeName).clear();
        return this._promisifyRequest(request);
    }

    async clearStores(storeNames) {
        if (!storeNames || storeNames.length === 0) return;
        await this.ensureDB();
        const tx = this.db.transaction(storeNames, 'readwrite');
        for (const storeName of storeNames) {
            tx.objectStore(storeName).clear();
        }
        await tx.done;
    }

    // --- 特定领域的方法 ---
    // 这些方法专为特定的应用数据类型量身定制，提供了清晰的 API。

    /** 保存整个扁平化的单词数组。 */
    async saveDecks(vocabularyWords) {
        const tx = this.db.transaction('decks_v2', 'readwrite');
        for (const word of vocabularyWords) {
            tx.objectStore('decks_v2').put(word);
        }
        await tx.done;
        return vocabularyWords.length;
    }

    /** 加载整个扁平化的单词数组。 */
    async loadDecks() {
        return this.getAll('decks_v2');
    }

    /** 检索单个单词的学习进度。 */
    async getWordProgress(arabicWord) {
        return this.get('wordProgress', arabicWord);
    }

    /** 保存单个单词的学习进度。 */
    async saveWordProgress(progressData) {
        return this.put('wordProgress', progressData);
    }
    
    async getWordProgressBatch(arabicKeys, batchSize = 100) {
        const results = new Map();
        for (let i = 0; i < arabicKeys.length; i += batchSize) {
            const batch = arabicKeys.slice(i, i + batchSize);
            const batchResults = await this._processBatch(batch);
            batchResults.forEach((v, k) => results.set(k, v));
        }
        return results;
    }

    async _processBatch(batchKeys) {
        await this.ensureDB();
        const tx = this.db.transaction('wordProgress', 'readonly');
        const store = tx.objectStore('wordProgress');
        const promises = batchKeys.map(key => 
            this._promisifyRequest(store.get(key)).then(res => ({ key, res }))
        );
        const settled = await Promise.allSettled(promises);
        const results = new Map();
        settled.forEach(result => {
            if (result.status === 'fulfilled' && result.value.res) {
                results.set(result.value.key, result.value.res.progress);
            }
        });
        return results;
    }

    /** 在单个事务中高效地保存多个单词的进度。 */
    async saveWordProgressBatch(progressArray) {
        if (progressArray.length === 0) return;
        await this.ensureDB();
        const tx = this.db.transaction('wordProgress', 'readwrite');
        const store = tx.objectStore('wordProgress');
        progressArray.forEach(progressData => store.put(progressData));
        await tx.done;
    }

    /** 在单个事务中保存单词进度和会话状态。 */
    async saveProgressTransaction(deckName, progressArray, sessionState) {
        await this.ensureDB();
        const storeNames = ['wordProgress'];
        // 只有在 sessionState 被明确传递时才将其包含在事务中
        if (sessionState !== undefined) {
            storeNames.push('sessionState');
        }
        const tx = this.db.transaction(storeNames, 'readwrite');
        
        if (progressArray && progressArray.length > 0) {
            const progressStore = tx.objectStore('wordProgress');
            progressArray.forEach(progressData => progressStore.put(progressData));
        }
    
        if (sessionState !== undefined) {
            const sessionStore = tx.objectStore('sessionState');
            if (sessionState === null) {
                // 如果 sessionState 为 null，则删除会话
                sessionStore.delete(deckName);
            } else {
                // 否则，保存会话状态
                sessionStore.put({ deckName, state: sessionState, savedAt: Date.now() });
            }
        }
        
        await tx.done;
    }
    
    /** 检索所有单词的进度数据，用于统计计算。 */
    async getAllWordProgress() {
        return this.getAll('wordProgress');
    }

    /** 保存应用范围的统计对象。 */
    async saveStats(stats) {
        return this.put('stats', { id: 'learningStats', ...stats, lastUpdate: Date.now() });
    }

    /** 加载应用范围的统计对象。 */
    async loadStats() {
        return (await this.get('stats', 'learningStats')) || {};
    }

    /** 保存单个键值对设置。 */
    async saveSetting(key, value) {
        return this.put('settings', { key, value, updatedAt: Date.now() });
    }

    /** 检索单个设置，如果未找到则返回默认值。 */
    async getSetting(key, defaultValue) {
        const setting = await this.get('settings', key);
        return setting ? setting.value : defaultValue;
    }

    /** 保存特定词库未完成的学习会话状态。 */
    async saveSessionState(deckName, sessionState) {
        return this.put('sessionState', { deckName, state: sessionState, savedAt: Date.now() });
    }

    /** 加载未完成的学习会话状态。 */
    async loadSessionState(deckName) {
        const session = await this.get('sessionState', deckName);
        return session ? session.state : null;
    }

    /** 删除特定词库的已保存状态。 */
    async clearSessionState(deckName) {
        return this.delete('sessionState', deckName);
    }

    /** 估算 IndexedDB 的总存储使用情况。 */
    async getStorageUsage() {
        if (navigator.storage && navigator.storage.estimate) {
            const estimation = await navigator.storage.estimate();
            return {
                totalSizeMB: (estimation.usage / (1024 * 1024)).toFixed(2),
                estimatedLimit: (estimation.quota / (1024 * 1024)).toFixed(2) + ' MB'
            };
        }
        return { totalSizeMB: 'N/A', estimatedLimit: 'N/A' };
    }

    /** 将所有应用数据导出为单个 JSON 对象用于备份。 */
    async exportAllData() {
        const data = {};
        const storesToExport = ['decks_v2', 'wordProgress', 'stats', 'settings', 'sessionState'];
        for (const storeName of storesToExport) {
            data[storeName] = await this.getAll(storeName);
        }
        data.exportDate = new Date().toISOString();
        data.version = '4.0'; // 对应于“一词多义”数据模型
        data.storageType = 'IndexedDB';
        return data;
    }

    /** 从备份文件导入数据，覆盖现有数据。 */
    async importBackupData(backupData) {
        if (!backupData.exportDate) throw new Error('无效的备份文件。');

        const storesToImport = ['decks_v2', 'wordProgress', 'stats', 'settings', 'sessionState'];
        for (const storeName of storesToImport) {
            if (this.db.objectStoreNames.contains(storeName)) {
                await this.clear(storeName);
                if (backupData[storeName]) {
                    const tx = this.db.transaction(storeName, 'readwrite');
                    const store = tx.objectStore(storeName);
                    for (const item of backupData[storeName]) {
                        store.put(item);
                    }
                    await tx.done;
                }
            }
        }
        return true;
    }
}

// 导出一个共享的单例管理器实例。
export const dbManager = new DatabaseManager();
