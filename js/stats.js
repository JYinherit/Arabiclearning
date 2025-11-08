/**
 * @fileoverview 管理用户的学习统计数据。
 * 该模块跟踪诸如学习连续天数、每日进度、
 * 总学习单词数和会话次数等数据。
 */

import * as storage from './storage.js';
import { loadDecksFromStorage, saveProgress } from './storage.js';
import { debounce } from './utils.js';

// 用于统计的全局内存对象。
export let learningStats = {
    totalWordsLearned: 0,
    totalSessions: 0,
    lastStudyDate: null,
    streakDays: 0,
    todayWords: 0,
    todayDate: null,
    _statsDirty: false, // 脏标记，表示统计数据是否已更改，需要保存
};

/**
 * 实际将统计数据保存到存储的函数。
 * @private
 */
async function _saveStatsToStorage() {
    if (learningStats._statsDirty) {
        await storage.saveStats(learningStats);
        learningStats._statsDirty = false;
        console.log('统计数据已保存 (通过防抖)。');
    }
}

// 创建一个防抖版本的保存函数，每 1000 毫秒最多执行一次。
const saveStatsDebounced = debounce(_saveStatsToStorage, 1000);

/**
 * 获取当前日期的本地字符串表示形式 (YYYY-MM-DD)。
 * @returns {string} 当前日期的本地字符串。
 */
function getLocalDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 从存储中加载统计数据，如果是新的一天，则重置每日统计。
 */
export async function loadStats() {
    const savedStats = await storage.loadStats();
    if (savedStats) {
        learningStats = { ...learningStats, ...savedStats };
    }
    checkAndResetDaily();
}

/**
 * 根据上次学习日期更新用户的学习连续天数。
 */
function updateDailyStatus() {
    const today = getLocalDateString();
    const lastDate = learningStats.lastStudyDate;
    
    if (!lastDate) {
        // 首次学习。
        learningStats.streakDays = 1;
    } else if (lastDate !== today) {
        const last = new Date(lastDate);
        const current = new Date(today);
        // 计算天数差异时，使用UTC时间，避免本地时区影响
        const diffDays = Math.floor((Date.UTC(current.getFullYear(), current.getMonth(), current.getDate()) - Date.UTC(last.getFullYear(), last.getMonth(), last.getDate())) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            // 连续的一天。
            learningStats.streakDays = (learningStats.streakDays || 0) + 1;
        } else if (diffDays > 1) {
            // 连续天数中断。
            learningStats.streakDays = 1;
        }
    }
    learningStats.lastStudyDate = today;
}

/**
 * 检查自上次会话以来日期是否已更改，如果是，则重置每日统计数据。
 */
function checkAndResetDaily() {
    const today = getLocalDateString();
    if (learningStats.todayDate !== today) {
        learningStats.todayWords = 0;
        learningStats.todayDate = today;
    }
}

/**
 * 跟踪今天新学的一个单词以用于统计。
 * 一个单词在用户第一次将其评为“简单”时被认为是“已学会”。
 * @param {object} word - 已学会的单词对象。
 */
export async function trackWordLearnedToday(word, deckName) {
    checkAndResetDaily();

    // 确保单词有 progress 对象
    if (!word.progress) {
        console.error("trackWordLearnedToday was called on a word without a progress object.", word);
        return;
    }
    
    // 仅当单词是第一次学会时才计数。
    if (!word.progress.firstLearnedDate) {
        word.progress.firstLearnedDate = new Date().toISOString().split('T')[0];
        learningStats.todayWords = (learningStats.todayWords || 0) + 1;
        learningStats.totalWordsLearned = (learningStats.totalWordsLearned || 0) + 1;
        
        updateDailyStatus();
        learningStats._statsDirty = true; // 设置脏标记
        saveStatsDebounced(); // 调用防抖保存
        // 保存更新后的单词进度
        await storage.saveProgress(deckName, [word]);
    }
}

/**
 * 在任何学习会话开始时调用，以更新连续天数。
 */
export async function onSessionStart() {
    checkAndResetDaily();
    updateDailyStatus();
    learningStats._statsDirty = true; // 设置脏标记
    saveStatsDebounced(); // 调用防抖保存
}

/**
 * 在学习会话结束时调用，以增加总会话次数。
 */
export async function onSessionComplete() {
    learningStats.totalSessions = (learningStats.totalSessions || 0) + 1;
    learningStats._statsDirty = true; // 设置脏标记
    saveStatsDebounced(); // 调用防抖保存
}

/**
 * 生成用于在 UI 中显示的统计摘要。
 * @param {Array<object>} vocabularyWords - 所有单词的完整列表。
 * @returns {Array<object>} 一个用于 UI 的结构化统计数组。
 */
export function getStatsSummary(vocabularyWords) {
    const decks = new Set(vocabularyWords.flatMap(w => w.definitions.map(d => d.sourceDeck)));
    
    let masteredWords = 0;
    let newWords = 0;
    let learningWords = 0;

    vocabularyWords.forEach(word => {
        const stage = word.progress?.stage || 0;
        if (stage === 0) {
            newWords++;
        } else if (stage >= 4) {
            masteredWords++;
        } else {
            learningWords++;
        }
    });

    checkAndResetDaily();

    return [
        {
            category: '词库摘要',
            stats: [
                { label: '总词库数量', value: decks.size },
                { label: '总单词量', value: vocabularyWords.length },
                { label: '新单词', value: newWords },
                { label: '学习中', value: learningWords },
                { label: '已掌握', value: masteredWords }
            ]
        },
        {
            category: '学习统计',
            stats: [
                { label: '已完成会话', value: learningStats.totalSessions || 0 },
                { label: '今日已学新词', value: learningStats.todayWords || 0 },
                { label: '总已学单词', value: learningStats.totalWordsLearned || 0 },
                { label: '连续学习天数', value: learningStats.streakDays || 0 },
                { label: '上次学习日期', value: learningStats.lastStudyDate || '无记录' }
            ]
        }
    ];
}

/**
 * 将所有统计数据重置为初始状态。(用于调试/用户请求)。
 */
export async function resetStats(vocabularyWords) {
    learningStats = {
        totalWordsLearned: 0,
        totalSessions: 0,
        lastStudyDate: null,
        streakDays: 0,
        todayWords: 0,
        todayDate: getLocalDateString(), // 使用本地日期字符串
    };
    await storage.saveStats(learningStats);
    learningStats._statsDirty = false; // 重置后清除脏标记

    // 清理所有单词的 firstLearnedDate 字段
    if (!vocabularyWords) {
        console.warn('resetStats 调用时未提供 vocabularyWords，无法清理单词进度。');
        return;
    }
    
    const wordsToUpdate = [];
    vocabularyWords.forEach(word => {
        if (word.progress && word.progress.firstLearnedDate) {
            word.progress.firstLearnedDate = null;
            wordsToUpdate.push(word);
        }
    });
    if (wordsToUpdate.length > 0) {
        await saveProgress(null, wordsToUpdate); // 保存更新后的单词进度
    }

    console.log('所有统计数据已被重置。');
}
