import { STORAGE_KEYS } from './constants.js';
import { showImportMessage } from './ui.js';

export function loadDecksFromStorage(vocabularyDecks) {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.DECKS);
        if (stored) {
            const decks = JSON.parse(stored);
            Object.assign(vocabularyDecks, decks);
            console.log(`已加载 ${Object.keys(decks).length} 个词库`);
        }
    } catch (e) {
        console.error('加载词库失败:', e);
    }
}

export function saveDecksToStorage(vocabularyDecks) {
    try {
        const data = JSON.stringify(vocabularyDecks);
        if (data.length > 4.5 * 1024 * 1024) { // 检查是否接近5MB限制
            showImportMessage('数据量较大，建议删除部分词库以释放空间', false);
        }
        localStorage.setItem(STORAGE_KEYS.DECKS, data);
        showImportMessage('词库已自动保存到本地', true);
    } catch (e) {
        // ... 现有错误处理
    }
}

export function saveProgress(currentDeckName, activeWords, sessionState = null) {
    const progress = {
        currentDeck: currentDeckName,
        wordStates: activeWords.map(w => ({
            chinese: w.chinese,
            arabic: w.arabic,
            explanation: w.explanation,
            rememberedCount: w.rememberedCount,
            cooldown: w.cooldown,
            mistakeCount: w.mistakeCount || 0,
            stage: w.stage || 0,
            nextReviewDate: w.nextReviewDate || null,
            firstLearnedDate: w.firstLearnedDate || null,
            difficulty: w.difficulty,
            stability: w.stability,
            retrievability: w.retrievability,
            reviews: w.reviews || [],
            lastReview: w.lastReview,
            dueDate: w.dueDate,
            consecutiveCorrect: w.consecutiveCorrect || 0,
            totalReviews: w.totalReviews || 0,
            easeFactor: w.easeFactor || 2.5
        })),
        lastUpdate: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
    if (sessionState) {
        saveSessionState(currentDeckName, sessionState);
    }
}

export function loadProgress(deckName) {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.PROGRESS);
        if (stored) {
            const progress = JSON.parse(stored);
            if (progress.currentDeck === deckName) {
                const confirmRestore = confirm('检测到上次的学习进度，是否继续？');
                if (confirmRestore) {
                    return progress.wordStates;
                }
            }
        }
    } catch (e) {
        console.error('加载进度失败:', e);
    }
    return null;
}

export function clearAllData() {
    if (confirm('确定要清除所有本地数据吗？（包括词库和学习进度）')) {
        localStorage.clear();
        location.reload();
    }
}

export function getSetting(key, defaultValue) {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        if (stored) {
            const settings = JSON.parse(stored);
            if (settings && settings[key] !== undefined) {
                return settings[key];
            }
        }
    } catch (e) {
        console.error('加载设置失败:', e);
    }
    return defaultValue;
}

export function saveSetting(key, value) {
    try {
        let settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
        settings[key] = value;
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
        console.error('保存设置失败:', e);
        if (e.name === 'QuotaExceededError') {
            showImportMessage('存储空间不足，无法保存设置', false);
        }
    }
}

export function exportAllDataToFile() {
    const allData = {
        decks: JSON.parse(localStorage.getItem(STORAGE_KEYS.DECKS) || '{}'),
        progress: JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESS) || '{}'),
        stats: JSON.parse(localStorage.getItem(STORAGE_KEYS.STATS) || '{}'),
        settings: JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}'),
        exportDate: new Date().toISOString(),
        version: '1.0'
    };

    const blob = new Blob([JSON.stringify(allData, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `阿语学习备份_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showImportMessage('✅ 数据已导出到下载文件夹！', true);
}

export function importBackupFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const backup = JSON.parse(event.target.result);

                if (!backup.exportDate) {
                    throw new Error('不是有效的备份文件');
                }

                const confirmMsg = `此备份创建于 ${new Date(backup.exportDate).toLocaleString()}\n确定要恢复此备份吗？（将覆盖当前所有数据）`;

                if (!confirm(confirmMsg)) return;

                if (backup.decks) {
                    localStorage.setItem(STORAGE_KEYS.DECKS, JSON.stringify(backup.decks));
                }
                if (backup.progress) {
                    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(backup.progress));
                }
                if (backup.stats) {
                    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(backup.stats));
                }
                if (backup.settings) {
                    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(backup.settings));
                }

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

export function checkStorageUsage() {
    let totalSize = 0;
    let details = {};

    for (let key in localStorage) {
        const value = localStorage.getItem(key);
        const keySize = new Blob([key]).size;
        const valueSize = value ? new Blob([value]).size : 0;
        const size = keySize + valueSize;
        totalSize += size;

        if (key.includes('decks')) {
            details['词库数据'] = (size / 1024).toFixed(2) + ' KB';
        } else if (key.includes('progress')) {
            details['学习进度'] = (size / 1024).toFixed(2) + ' KB';
        } else if (key.includes('stats')) {
            details['统计数据'] = (size / 1024).toFixed(2) + ' KB';
        }
    }

    const totalKB = (totalSize / 1024).toFixed(2);
    const usagePercent = ((totalSize / (5 * 1024 * 1024)) * 100).toFixed(1);

    let message = `📊 存储空间使用情况：\n\n`;
    message += `总使用量：${totalKB} KB (${usagePercent}%)\n`;
    message += `剩余空间：约 ${(5120 - parseFloat(totalKB)).toFixed(2)} KB\n\n`;
    message += `详细分类：\n`;

    for (let [type, size] of Object.entries(details)) {
        message += `  • ${type}：${size}\n`;
    }

    message += `\n预计还可导入约 ${Math.floor((5120 - parseFloat(totalKB)) / 50)} 个词库`;

    alert(message);
}
export function saveSessionState(deckName, sessionState) {
    const key = `${STORAGE_KEYS.PROGRESS}_${deckName}_session`;
    localStorage.setItem(key, JSON.stringify(sessionState));
}

export function loadSessionState(deckName) {
    const key = `${STORAGE_KEYS.PROGRESS}_${deckName}_session`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : null;
}

export function clearSessionState(deckName) {
    const key = `${STORAGE_KEYS.PROGRESS}_${deckName}_session`;
    localStorage.removeItem(key);
}
