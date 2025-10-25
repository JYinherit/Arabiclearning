// stats.js - 完整修复版本
import * as storage from './storage.js';

export let learningStats = {
    totalWordsLearned: 0,
    totalSessions: 0,
    lastStudyDate: null,
    streakDays: 0,
    dailyGoal: 20,
    todayWords: 0,
    todayDate: null // 添加今日日期记录
};

export async function loadStats() {
    const savedStats = await storage.loadStats();
    if (savedStats) {
        learningStats = { ...learningStats, ...savedStats };
    }
    // 检查日期，如果不是今天则重置今日统计
    checkAndResetDaily();
}

// 修复：添加 updateDailyStatus 函数
function updateDailyStatus() {
    const today = new Date().toISOString().split('T')[0];
    
    // 更新上次学习日期
    const lastDate = learningStats.lastStudyDate;
    learningStats.lastStudyDate = today;
    
    // 更新连续学习天数
    if (!lastDate) {
        learningStats.streakDays = 1;
    } else if (lastDate !== today) {
        const last = new Date(lastDate);
        const current = new Date(today);
        const diffTime = current - last;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            // 连续学习
            learningStats.streakDays = (learningStats.streakDays || 0) + 1;
        } else if (diffDays > 1) {
            // 中断了，重新开始
            learningStats.streakDays = 1;
        }
    }
    
    console.log('更新每日状态:', { today, streakDays: learningStats.streakDays });
}

// 检查并重置每日统计
function checkAndResetDaily() {
    const today = new Date().toISOString().split('T')[0];
    
    if (learningStats.todayDate !== today) {
        console.log('新的一天，重置今日统计');
        learningStats.todayWords = 0;
        learningStats.todayDate = today;
    }
}

// 修复：跟踪今日学习的单词
export async function trackWordLearnedToday(word, sessionStartDate) {
    checkAndResetDaily(); // 先检查是否需要重置
    
    const today = new Date().toISOString().split('T')[0];
    
    // 只在单词首次学习时计数
    if (!word.firstLearnedDate) {
        word.firstLearnedDate = today;
        learningStats.todayWords = (learningStats.todayWords || 0) + 1;
        learningStats.totalWordsLearned = (learningStats.totalWordsLearned || 0) + 1;
        
        updateDailyStatus();
        await storage.saveStats(learningStats);
        
        console.log('记录新学单词:', {
            word: word.word || word.front,
            todayWords: learningStats.todayWords,
            totalWords: learningStats.totalWordsLearned
        });
    }
}

// 修复：跟踪掌握的单词（可选功能）
export async function trackWordMastered(word) {
    // 这个函数用于特殊的"掌握"标记，不影响总学习数
    if (word.mastered !== true) {
        word.mastered = true;
        word.masteredDate = new Date().toISOString().split('T')[0];
        await storage.saveStats(learningStats);
        
        console.log('单词已掌握:', word.word || word.front);
    }
}

// 修复：只在会话完成时增加计数
export async function incrementSessionCount() {
    learningStats.totalSessions = (learningStats.totalSessions || 0) + 1;
    updateDailyStatus();
    await storage.saveStats(learningStats);
    
    console.log('会话完成，总会话数:', learningStats.totalSessions);
}

// 会话开始时调用（不增加计数）
export async function onSessionStart() {
    checkAndResetDaily();
    updateDailyStatus();
    await storage.saveStats(learningStats);
    
    console.log('会话开始');
}

// 会话结束时调用（增加计数）
export async function onSessionComplete() {
    await incrementSessionCount();
    console.log('会话完成');
}

// 统计摘要函数
export function getStatsSummary(decks) {
    let totalWords = 0;
    let masteredWords = 0;
    let newWords = 0; // 新单词（未开始学习的）
    let learningWords = 0; // 学习中的单词
    
    // 假设 decks 是一个对象，键是词库名，值是单词数组
    for (const deckName in decks) {
        const deck = decks[deckName];
        if (Array.isArray(deck)) {
            totalWords += deck.length;
            
            deck.forEach(word => {
                // 根据 FSRS 状态统计
                if (word.state === 0 || !word.state) {
                    newWords++;
                } else if (word.state === 1 || word.state === 2) {
                    learningWords++;
                } else if (word.state === 3) {
                    masteredWords++;
                }
            });
        }
    }

    // 确保今日统计是最新的
    checkAndResetDaily();

    return [
        {
            category: '学习统计摘要',
            stats: [
                { label: '总词库数量', value: Object.keys(decks).length },
                { label: '总单词量', value: totalWords },
                { label: '新单词', value: newWords },
                { label: '学习中', value: learningWords },
                { label: '已掌握', value: masteredWords }
            ]
        },
        {
            category: '会话统计',
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

// 获取今日进度百分比
export function getTodayProgress() {
    const percentage = Math.min(100, (learningStats.todayWords / learningStats.dailyGoal) * 100);
    return {
        current: learningStats.todayWords || 0,
        goal: learningStats.dailyGoal,
        percentage: Math.round(percentage)
    };
}

// 设置每日目标
export async function setDailyGoal(goal) {
    learningStats.dailyGoal = goal;
    await storage.saveStats(learningStats);
}

// 重置统计（谨慎使用）
export async function resetStats() {
    learningStats = {
        totalWordsLearned: 0,
        totalSessions: 0,
        lastStudyDate: null,
        streakDays: 0,
        dailyGoal: 20,
        todayDate: new Date().toISOString().split('T')[0]
    };
    await storage.saveStats(learningStats);
    console.log('统计已重置');
}
