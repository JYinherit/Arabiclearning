import { STORAGE_KEYS } from './constants.js';
import { dbManager } from './db.js';
import { showImportMessage } from './ui.js';

// --- 常量/辅助函数（针对 fallback 模式） ---
// 使用 PROGRESS_PREFIX 加上 'session_' 后缀作为 localStorage 中的会话状态键前缀
const SESSION_STATE_KEY = (deckName) => `${STORAGE_KEYS.PROGRESS_PREFIX}session_${deckName}`;

// 初始化数据库
export async function initializeStorage() {
    try {
        await dbManager.openDatabase();
        await dbManager.migrateFromLocalStorage();
        return true;
    } catch (error) {
        console.error('存储初始化失败:', error);
        showImportMessage('存储初始化失败，将使用localStorage', false);
        return false;
    }
}

// 词库管理
export async function loadDecksFromStorage(vocabularyDecks) {
    try {
        const decks = await dbManager.loadDecks();
        Object.assign(vocabularyDecks, decks);
        console.log(`已加载 ${Object.keys(decks).length} 个词库`);
    } catch (error) {
        console.error('加载词库失败:', error);
        // 回退到localStorage
        fallbackLoadDecks(vocabularyDecks);
    }
}

export async function saveDecksToStorage(vocabularyDecks) {
    try {
        const count = await dbManager.saveDecks(vocabularyDecks);
        showImportMessage(`词库已保存 (${count}个)`, true);
    } catch (error) {
        console.error('保存词库失败:', error);
        showImportMessage('保存词库失败', false);
        // 回退到localStorage
        fallbackSaveDecks(vocabularyDecks);
    }
}

// 进度管理
export async function saveProgress(currentDeckName, activeWords, sessionState = null) {
    try {
        // IndexedDB版本在一个事务中同时保存 activeWords (进度) 和 sessionState (临时会话)
        await dbManager.saveProgress(currentDeckName, activeWords, sessionState);
    } catch (error) {
        console.error('保存进度失败:', error);
        fallbackSaveProgress(currentDeckName, activeWords, sessionState);
    }
}

export async function loadProgress(deckName) {
    try {
        const progress = await dbManager.loadProgress(deckName);
        if (progress) {
            const confirmRestore = confirm('检测到上次的学习进度，是否继续？');
            if (confirmRestore) {
                return progress.wordStates;
            }
        }
    } catch (error) {
        console.error('加载进度失败:', error);
    }
    return null;
}

// 统计管理
export async function saveStats(stats) {
    try {
        await dbManager.saveStats(stats);
    } catch (error) {
        console.error('保存统计失败:', error);
        fallbackSaveStats(stats);
    }
}

export async function loadStats() {
    try {
        const stats = await dbManager.loadStats();
        return stats || {};
    } catch (error) {
        console.error('加载统计失败:', error);
        return fallbackLoadStats();
    }
}

// 设置管理
export async function saveSetting(key, value) {
    try {
        await dbManager.saveSetting(key, value);
    } catch (error) {
        console.error('保存设置失败:', error);
        fallbackSaveSetting(key, value);
    }
}

export async function getSetting(key, defaultValue) {
    try {
        return await dbManager.getSetting(key, defaultValue);
    } catch (error) {
        console.error('加载设置失败:', error);
        return fallbackGetSetting(key, defaultValue);
    }
}

// 会话状态管理
export async function saveSessionState(deckName, sessionState) {
    try {
        await dbManager.saveSessionState(deckName, sessionState);
    } catch (error) {
        console.error('保存会话状态失败:', error);
        fallbackSaveSessionState(deckName, sessionState);
    }
}

export async function loadSessionState(deckName) {
    try {
        return await dbManager.loadSessionState(deckName);
    } catch (error) {
        console.error('加载会话状态失败:', error);
        return fallbackLoadSessionState(deckName);
    }
}

export async function clearSessionState(deckName) {
    try {
        await dbManager.clearSessionState(deckName);
    } catch (error) {
        console.error('清除会话状态失败:', error);
        fallbackClearSessionState(deckName);
    }
}

// 数据管理功能
export async function clearAllData() {
    if (confirm('确定要清除所有数据吗？（包括词库、学习进度和统计）')) {
        try {
            await dbManager.clear('decks');
            await dbManager.clear('progress');
            await dbManager.clear('stats');
            await dbManager.clear('settings');
            await dbManager.clear('sessionState');
            showImportMessage('所有数据已清除', true);
            setTimeout(() => location.reload(), 1000);
        } catch (error) {
            console.error('清除数据失败:', error);
            showImportMessage('清除数据失败', false);
        }
    }
}

export async function exportAllDataToFile() {
    try {
        const allData = await dbManager.exportAllData();
        const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `阿语学习备份_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showImportMessage('✅ 数据已导出到下载文件夹！', true);
    } catch (error) {
        console.error('导出数据失败:', error);
        showImportMessage('导出数据失败', false);
    }
}

export async function importBackupFile() {
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
                const confirmMsg = `此备份创建于 ${new Date(backup.exportDate).toLocaleString()}\n确定要恢复此备份吗？（将覆盖当前所有数据）`;

                if (!confirm(confirmMsg)) return;

                await dbManager.importBackupData(backup);
                showImportMessage('✅ 备份恢复成功！即将刷新页面...', true);
                setTimeout(() => location.reload(), 1500);
            } catch (err) {
                showImportMessage('❌ 备份文件格式错误：' + err.message, false);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

export async function checkStorageUsage() {
    try {
        const usage = await dbManager.getStorageUsage();
        let message = `📊 IndexedDB存储使用情况：\n\n`;
        message += `总使用量：${usage.totalSizeMB} MB\n`;
        message += `存储限制：${usage.estimatedLimit}\n\n`;
        message += `💡 提示：IndexedDB提供更大的存储空间，适合存储大量词库数据`;

        alert(message);
    } catch (error) {
        console.error('获取存储使用情况失败:', error);
        showImportMessage('获取存储信息失败', false);
    }
}

// --- 回退到localStorage的函数（兼容性） ---

// 词库管理回退
function fallbackLoadDecks(vocabularyDecks) {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.DECKS);
        if (stored) {
            const decks = JSON.parse(stored);
            Object.assign(vocabularyDecks, decks);
        }
    } catch (e) {
        console.error('回退加载词库失败:', e);
    }
}

function fallbackSaveDecks(vocabularyDecks) {
    try {
        localStorage.setItem(STORAGE_KEYS.DECKS, JSON.stringify(vocabularyDecks));
    } catch (e) {
        console.error('回退保存词库失败:', e);
    }
}

// 进度管理回退
function fallbackSaveProgress(currentDeckName, activeWords, sessionState = null) {
    try {
        // 保存 activeWords（历史进度）
        localStorage.setItem(`${STORAGE_KEYS.PROGRESS_PREFIX}${currentDeckName}`, JSON.stringify(activeWords));
        
        // 如果 sessionState 为 null，尝试清除会话状态
        if (sessionState === null) {
            fallbackClearSessionState(currentDeckName);
        }
        // 如果提供了 sessionState，也保存它
        if (sessionState) {
            fallbackSaveSessionState(currentDeckName, sessionState);
        }
    } catch (e) {
        console.error('回退保存进度失败:', e);
    }
}

// 统计管理回退
function fallbackSaveStats(stats) {
    try {
        localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
    } catch (e) {
        console.error('回退保存统计失败:', e);
    }
}

function fallbackLoadStats() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.STATS);
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.error('回退加载统计失败:', e);
        return {};
    }
}

// 设置管理回退
function fallbackSaveSetting(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error('回退保存设置失败:', e);
    }
}

function fallbackGetSetting(key, defaultValue) {
    try {
        const stored = localStorage.getItem(key);
        if (stored !== null) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('回退加载设置失败:', e);
    }
    return defaultValue;
}

// 会话状态管理回退
function fallbackSaveSessionState(deckName, sessionState) {
    try {
        localStorage.setItem(SESSION_STATE_KEY(deckName), JSON.stringify(sessionState));
    } catch (e) {
        console.error('回退保存会话状态失败:', e);
    }
}

function fallbackLoadSessionState(deckName) {
    try {
        const stored = localStorage.getItem(SESSION_STATE_KEY(deckName));
        return stored ? JSON.parse(stored) : null;
    } catch (e) {
        console.error('回退加载会话状态失败:', e);
        return null;
    }
}

function fallbackClearSessionState(deckName) {
    try {
        localStorage.removeItem(SESSION_STATE_KEY(deckName));
    } catch (e) {
        console.error('回退清除会话状态失败:', e);
    }
}
