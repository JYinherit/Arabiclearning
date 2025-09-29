import { STORAGE_KEYS } from './constants.js';

export let learningStats = {
    totalWordsLearned: 0,
    totalSessions: 0,
    lastStudyDate: null,
    streakDays: 0,
    dailyGoal: 20,
    todayWords: 0
};

export function loadStats() {
    const savedStats = localStorage.getItem(STORAGE_KEYS.STATS);
    if (savedStats) {
        learningStats = JSON.parse(savedStats);
    }
}

export function updateDailyStatus() {
    const today = new Date().toDateString();
    const lastDate = learningStats.lastStudyDate;

    if (lastDate !== today) {
        learningStats.todayWords = 0; // 重置今日学习单词数
        learningStats.lastStudyDate = today;

        if (lastDate) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            if (lastDate === yesterday.toDateString()) {
                learningStats.streakDays++;
            } else {
                learningStats.streakDays = 1;
            }
        } else {
            learningStats.streakDays = 1;
        }
    }
}

export function trackWordLearnedToday(word, sessionStartDate) {
    updateDailyStatus();
    if (!word.firstLearnedDate || word.firstLearnedDate !== sessionStartDate) {
         word.firstLearnedDate = sessionStartDate;
         learningStats.todayWords = (learningStats.todayWords || 0) + 1;
         localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(learningStats));
    }
}

export function trackWordMastered(word) {
    if (word.stage !== 4) {
        word.stage = 4;
        learningStats.totalWordsLearned = (learningStats.totalWordsLearned || 0) + 1;
        localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(learningStats));
    }
}

export function incrementSessionCount() {
    learningStats.totalSessions = (learningStats.totalSessions || 0) + 1;
    updateDailyStatus();
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(learningStats));
}

export function getStatsSummary(vocabularyDecks) {
    const totalDecks = Object.keys(vocabularyDecks).length;
    const totalWords = Object.values(vocabularyDecks).reduce((sum, deck) => sum + deck.length, 0);

    return `📊 学习统计：

        📚 词库数量：${totalDecks}
        📝 总词汇量：${totalWords}
        ✅ 已掌握：${learningStats.totalWordsLearned || 0}
        📅 连续学习：${learningStats.streakDays || 0} 天
        🎯 今日学习：${learningStats.todayWords || 0} 词
        🏆 总学习次数：${learningStats.totalSessions || 0}`;
}