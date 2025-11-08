/**
 * @fileoverview 该模块作为高级存储层。
 * 它与 `dbManager` 通信以执行所有数据持久化操作，
 * 例如加载/保存词库、进度和设置。它还处理
 * 一次性的数据迁移。
 */

import { dbManager } from './db.js';
import { showImportMessage } from './ui.js';
import * as stats from './stats.js';

/**
 * 一个包装器函数，用于为异步存储操作添加统一的错误处理。
 * @param {Function} fn - 要包装的异步函数。
 * @param {string} operationName - 操作的名称，用于错误消息。
 * @param {any} [returnValueOnError=null] - 发生错误时返回的值。
 * @returns {Function} 带有错误处理的包装后函数。
 */
function withErrorHandling(fn, operationName, returnValueOnError = null) {
    return async function(...args) {
        try {
            return await fn(...args);
        } catch (error) {
            console.error(`${operationName} 失败:`, error);
            // 可选择在这里显示一个通用的UI错误消息
            showImportMessage(`${operationName} 失败`, false);
            if (typeof returnValueOnError === 'function') {
                return returnValueOnError(...args);
            }
            return returnValueOnError;
        }
    };
}

/**
 * 一个一次性的迁移函数，用于将旧的、基于词库的数据结构
 * 转换为新的“一词多义”扁平化结构。
 * 它会检查数据库中的一个标志，以确保只运行一次。
 */
async function migrateToMultiDefinitionStructure() {
    const MIGRATION_FLAG = 'multiDefMigration_Completed_v2';
    try {
        const migrated = await dbManager.getSetting(MIGRATION_FLAG, false);
        if (migrated) {
            return; // 静默返回，因为迁移已完成。
        }

        // 在尝试读取之前，检查旧的 objectStore 是否存在。
        if (!dbManager.db.objectStoreNames.contains('decks')) {
            console.log('未找到旧的 "decks" 词库数据，跳过迁移。');
            await dbManager.saveSetting(MIGRATION_FLAG, true);
            return;
        }

        console.log('开始数据迁移至新的“一词多义”结构...');
        const oldDecks = await dbManager.getAll('decks');
        if (!oldDecks || oldDecks.length === 0) {
            console.log('旧的 "decks" 词库为空，完成迁移。');
            await dbManager.saveSetting(MIGRATION_FLAG, true);
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
            await dbManager.saveDecks(wordsToSave);
            console.log(`成功迁移了 ${wordsToSave.length} 个独立单词。`);
        }

        await dbManager.saveSetting(MIGRATION_FLAG, true);
        console.log('数据迁移成功完成！');

    } catch (error) {
        console.error('数据迁移失败:', error);
    }
}

/**
 * 初始化数据库连接并运行任何必要的数据迁移。
 * @returns {Promise<boolean>} 如果初始化成功则为 true。
 */
export const initializeStorage = withErrorHandling(async () => {
    await dbManager.openDatabase();
    await migrateToMultiDefinitionStructure();
    return true;
}, '存储初始化', false);

/**
 * 从数据库加载扁平化的词汇单词数组。
 * @param {Array} vocabularyWords - 要填充的主词汇数组的引用。
 */
export const loadDecksFromStorage = withErrorHandling(async (vocabularyWords) => {
    const words = await dbManager.loadDecks();
    vocabularyWords.length = 0; // 原地清空数组。
    if (words && Array.isArray(words)) {
        vocabularyWords.push(...words); // 用加载的数据填充它。
    }
    console.log(`从存储中加载了 ${vocabularyWords.length} 个独立单词。`);
}, '加载词库');

/**
 * 将整个词汇列表保存到数据库。
 * @param {Array} vocabularyWords - 主词汇数组。
 */
export const saveDecksToStorage = withErrorHandling(async (vocabularyWords) => {
    // 确保进度对象不会与核心单词数据一起保存。
    const cleanedWords = vocabularyWords.map(({ progress, ...rest }) => rest);
    const count = await dbManager.saveDecks(cleanedWords);
    showImportMessage(`词库已保存 (${count} 个单词)`, true);
}, '保存词库');

/**
 * 保存一批单词的学习进度和当前会话状态。
 * @param {string} deckName - 当前词库的名称。
 * @param {Array} activeWords - 来自当前会话的、带有更新进度的单词。
 * @param {object|null} sessionState - 当前会话的状态，或为 null 以清除它。
 */
export const saveProgress = withErrorHandling(async (deckName, activeWords, sessionState) => {
    // 添加参数校验
    if (deckName === null || deckName === undefined) {
        console.warn('saveProgress: deckName 为 null/undefined，已跳过 sessionState 操作');
        sessionState = undefined; // 避免尝试删除操作
    }
    
    const progressBatch = activeWords
        .filter(word => word.progress) // 只保存有进度信息的单词。
        .map(word => ({ arabic: word.arabic, progress: word.progress }));
    
    await dbManager.saveProgressTransaction(deckName, progressBatch, sessionState);
}, '保存进度');

/** 保存应用范围的统计数据。 */
export const saveStats = withErrorHandling(async (stats) => {
    await dbManager.saveStats(stats);
}, '保存统计数据');

/** 加载应用范围的统计数据。 */
export const loadStats = withErrorHandling(async () => {
    return (await dbManager.loadStats()) || {};
}, '加载统计数据', {});

/** 保存单个键值对设置。 */
export const saveSetting = withErrorHandling(async (key, value) => {
    await dbManager.saveSetting(key, value);
}, '保存设置');

/** 检索单个设置，并提供备用的默认值。 */
export const getSetting = withErrorHandling(async (key, defaultValue) => {
    return await dbManager.getSetting(key, defaultValue);
}, '加载设置', (key, defaultValue) => defaultValue);

/** 加载未完成会话的已保存状态。 */
export const loadSessionState = withErrorHandling(async (deckName) => {
    return await dbManager.loadSessionState(deckName);
}, '加载会话状态', null);

/** 清除特定词库会话的已保存状态。 */
export const clearSessionState = withErrorHandling(async (deckName) => {
    return await dbManager.clearSessionState(deckName);
}, '清除会话状态', null);

// --- 数据管理函数 ---

/**
 * 根据用户选项清除数据库的选定部分。
 * @param {object} options - 一个包含每个要清除数据类型的布尔标志的对象。
 * @param {Array<object>} vocabularyWords - 主词汇数组，用于在清除进度时更新内存状态。
 * @param {Function} [renderCallback] - 可选的回调函数，用于在清除词库后刷新UI。
 */
export const clearDataGranularly = withErrorHandling(async (options, vocabularyWords, renderCallback) => {
    const storesToClear = [];
    if (options.decks) storesToClear.push('decks_v2');
    if (options.progress) storesToClear.push('wordProgress');
    if (options.stats) storesToClear.push('stats');
    if (options.settings) storesToClear.push('settings');
    if (options.sessions) storesToClear.push('sessionState');

    if (storesToClear.length > 0) {
        await dbManager.clearStores(storesToClear);
    }

    // 如果清除词库，则重置内存中的词汇数组并刷新 UI。
    if (options.decks) {
        vocabularyWords.length = 0;
        if (renderCallback) renderCallback();
    }

    // 如果清除统计数据，则调用 stats 模块中的重置函数来清理内存中的统计数据和单词的 firstLearnedDate。
    if (options.stats) {
        await stats.resetStats(vocabularyWords);
    }
    
    showImportMessage('所选数据已清除！页面即将重新加载。', true);
    setTimeout(() => location.reload(), 1500);
}, '清除数据');

/**
 * 将所有用户数据从 IndexedDB 导出到 JSON 文件以进行备份。
 */
export const exportAllDataToFile = withErrorHandling(async () => {
    const allData = await dbManager.exportAllData();
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Arabic_Learning_Backup_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showImportMessage('数据导出成功！', true);
}, '导出数据');

/**
 * 从备份 JSON 文件导入用户数据，覆盖所有当前数据。
 */
export const importBackupFile = withErrorHandling(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const backup = JSON.parse(event.target.result);
                const confirmMsg = `此备份创建于 ${new Date(backup.exportDate).toLocaleString()}.\n您确定要恢复吗？这将覆盖所有当前数据。`;

                if (!confirm(confirmMsg)) return;

                await dbManager.importBackupData(backup);
                showImportMessage('备份恢复成功！页面即将重新加载。', true);
                setTimeout(() => location.reload(), 1500);
            } catch (err) {
                showImportMessage(`无效的备份文件: ${err.message}`, false);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}, '导入备份');

/**
 * 显示一个包含当前 IndexedDB 存储使用情况的警报。
 */
export const checkStorageUsage = withErrorHandling(async () => {
    const usage = await dbManager.getStorageUsage();
    const message = `存储使用情况:\n\n` +
                    `总使用量: ${usage.totalSizeMB} MB\n` +
                    `预估限制: ${usage.estimatedLimit}`;
    alert(message);
}, '检查存储使用情况');
