// db.js - IndexedDB数据库管理
import { STORAGE_KEYS } from './constants.js';

class DatabaseManager {
    constructor() {
        this.dbName = 'ArabicLearningDB';
        this.version = 3;
        this.db = null;
        this.isSupported = this.checkIndexedDBSupport();
    }

    checkIndexedDBSupport() {
        return 'indexedDB' in window;
    }

    async openDatabase() {
        if (!this.isSupported) {
            throw new Error('浏览器不支持IndexedDB');
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // 创建对象存储
                if (!db.objectStoreNames.contains('decks')) {
                    const deckStore = db.createObjectStore('decks', { keyPath: 'name' });
                    deckStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('progress')) {
                    const progressStore = db.createObjectStore('progress', { keyPath: 'deckName' });
                    progressStore.createIndex('lastUpdate', 'lastUpdate', { unique: false });
                }
                
                if (!db.objectStoreNames.contains('stats')) {
                    db.createObjectStore('stats', { keyPath: 'id' });
                }
                
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                if (!db.objectStoreNames.contains('sessionState')) {
                    db.createObjectStore('sessionState', { keyPath: 'deckName' });
                }
            };
        });
    }

    // 通用CRUD操作
    async add(storeName, data) {
        await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.add(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async put(storeName, data) {
        await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, key) {
        await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName) {
        await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, key) {
        await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async clear(storeName) {
        await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async ensureDB() {
        if (!this.db) {
            await this.openDatabase();
        }
    }

    // 专用方法
    async saveDecks(vocabularyDecks) {
        const decks = Object.keys(vocabularyDecks).map(name => ({
            name,
            words: vocabularyDecks[name],
            updatedAt: Date.now(),
            wordCount: vocabularyDecks[name].length
        }));

        for (const deck of decks) {
            await this.put('decks', deck);
        }

        return decks.length;
    }

    async loadDecks() {
        const deckRecords = await this.getAll('decks');
        const decks = {};
        
        deckRecords.forEach(record => {
            decks[record.name] = record.words;
        });

        return decks;
    }

    async saveProgress(deckName, activeWords, sessionState = null) {
        const progress = {
            deckName,
            wordStates: activeWords,
            lastUpdate: new Date().toISOString(),
            sessionState
        };

        await this.put('progress', progress);
    }

    async loadProgress(deckName) {
        return await this.get('progress', deckName);
    }

    async saveStats(stats) {
        await this.put('stats', {
            id: 'learningStats',
            ...stats,
            lastUpdate: Date.now()
        });
    }

    async loadStats() {
        const stats = await this.get('stats', 'learningStats');
        return stats || {};
    }

    async saveSetting(key, value) {
        await this.put('settings', { key, value, updatedAt: Date.now() });
    }

    async getSetting(key, defaultValue) {
        const setting = await this.get('settings', key);
        return setting ? setting.value : defaultValue;
    }

    async saveSessionState(deckName, sessionState) {
        await this.put('sessionState', {
            deckName,
            state: sessionState,
            savedAt: Date.now()
        });
    }

    async loadSessionState(deckName) {
        const session = await this.get('sessionState', deckName);
        return session ? session.state : null;
    }

    async clearSessionState(deckName) {
        await this.delete('sessionState', deckName);
    }

    // 数据迁移：从localStorage迁移到IndexedDB
    async migrateFromLocalStorage() {
        try {
            // 检查是否已经迁移过
            const migrated = await this.getSetting('migratedToIndexedDB', false);
            if (migrated) return;

            console.log('开始从localStorage迁移数据到IndexedDB...');

            // 迁移词库
            const decksJson = localStorage.getItem(STORAGE_KEYS.DECKS);
            if (decksJson) {
                const decks = JSON.parse(decksJson);
                await this.saveDecks(decks);
                console.log(`迁移了 ${Object.keys(decks).length} 个词库`);
            }

            // 迁移进度
            const progressJson = localStorage.getItem(STORAGE_KEYS.PROGRESS);
            if (progressJson) {
                const progress = JSON.parse(progressJson);
                if (progress.currentDeck) {
                    await this.saveProgress(progress.currentDeck, progress.wordStates);
                }
            }

            // 迁移统计
            const statsJson = localStorage.getItem(STORAGE_KEYS.STATS);
            if (statsJson) {
                const stats = JSON.parse(statsJson);
                await this.saveStats(stats);
            }

            // 迁移设置
            const settingsJson = localStorage.getItem(STORAGE_KEYS.SETTINGS);
            if (settingsJson) {
                const settings = JSON.parse(settingsJson);
                for (const [key, value] of Object.entries(settings)) {
                    await this.saveSetting(key, value);
                }
            }

            // 标记已迁移
            await this.saveSetting('migratedToIndexedDB', true);
            console.log('数据迁移完成');

            // 可选：清理localStorage
            // localStorage.clear();

        } catch (error) {
            console.error('数据迁移失败:', error);
        }
    }

    // 获取存储使用情况
    async getStorageUsage() {
        if (!this.db) return null;

        const stores = ['decks', 'progress', 'stats', 'settings', 'sessionState'];
        let totalSize = 0;

        for (const storeName of stores) {
            const data = await this.getAll(storeName);
            const size = new Blob([JSON.stringify(data)]).size;
            totalSize += size;
        }

        return {
            totalSize: totalSize,
            totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
            estimatedLimit: '至少 250MB', // IndexedDB通常有更大空间
            stores: stores.reduce((acc, storeName) => {
                acc[storeName] = '计算中...';
                return acc;
            }, {})
        };
    }

    // 导出所有数据
    async exportAllData() {
        const data = {
            decks: await this.getAll('decks'),
            progress: await this.getAll('progress'),
            stats: await this.getAll('stats'),
            settings: await this.getAll('settings'),
            sessionState: await this.getAll('sessionState'),
            exportDate: new Date().toISOString(),
            version: '2.0',
            storageType: 'IndexedDB'
        };

        return data;
    }

    // 导入备份数据
    async importBackupData(backupData) {
        if (!backupData.exportDate) {
            throw new Error('无效的备份文件');
        }

        // 清空现有数据
        await this.clear('decks');
        await this.clear('progress');
        await this.clear('stats');
        await this.clear('settings');
        await this.clear('sessionState');

        // 导入新数据
        if (backupData.decks) {
            for (const deck of backupData.decks) {
                await this.put('decks', deck);
            }
        }

        if (backupData.progress) {
            for (const progress of backupData.progress) {
                await this.put('progress', progress);
            }
        }

        if (backupData.stats) {
            for (const stat of backupData.stats) {
                await this.put('stats', stat);
            }
        }

        if (backupData.settings) {
            for (const setting of backupData.settings) {
                await this.put('settings', setting);
            }
        }

        if (backupData.sessionState) {
            for (const session of backupData.sessionState) {
                await this.put('sessionState', session);
            }
        }

        return true;
    }
}

// 创建单例实例
export const dbManager = new DatabaseManager();