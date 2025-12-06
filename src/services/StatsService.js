/**
 * @fileoverview Manages user's learning statistics.
 * This service tracks data such as learning streak, daily progress,
 * total words learned, and session counts.
 */

import { debounce } from '../common/utils.js';
import { STORAGE_KEYS } from '../common/constants.js';

export class StatsService {
    /**
     * @param {import('../infrastructure/StorageService.js').StorageService} storageService 
     */
    constructor(storageService) {
        this.storageService = storageService;
        this.stats = {
            totalWordsLearned: 0,
            totalSessions: 0,
            lastStudyDate: null,
            streakDays: 0,
            todayWords: 0,
            todayDate: null,
        };
        this.learnedToday = new Map(); // Tracks learned words per deck for today.
        this._isDirty = false;
        this._saveDebounced = debounce(this._saveToStorage.bind(this), 1500);
    }

    /**
     * Loads stats from storage and resets daily stats if it's a new day.
     */
    async load() {
        const [savedStats, storedLearnedToday] = await Promise.all([
            this.storageService.loadStats(),
            this.storageService.getSetting(STORAGE_KEYS.REGULAR_STUDY_STATS)
        ]);

        if (savedStats) {
            this.stats = { ...this.stats, ...savedStats };
        }
        
        const today = this._getLocalDateString();
        if (storedLearnedToday && storedLearnedToday.date === today && Array.isArray(storedLearnedToday.learnedToday)) {
            this.learnedToday = new Map(storedLearnedToday.learnedToday);
        }

        this._checkAndResetDaily();
    }

    /**
     * The actual function to save all stats to storage.
     * @private
     */
    async _saveToStorage() {
        if (this._isDirty) {
            const today = this._getLocalDateString();
            await Promise.all([
                this.storageService.saveStats(this.stats),
                this.storageService.saveSetting(STORAGE_KEYS.REGULAR_STUDY_STATS, {
                    date: today,
                    learnedToday: Array.from(this.learnedToday.entries())
                })
            ]);
            this._isDirty = false;
            console.log('Statistics saved (debounced).');
        }
    }

    _getLocalDateString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    _updateDailyStatus() {
        const today = this._getLocalDateString();
        const lastDate = this.stats.lastStudyDate;
        
        if (!lastDate) {
            this.stats.streakDays = 1;
        } else if (lastDate !== today) {
            const last = new Date(lastDate);
            const current = new Date(today);
            const diffDays = Math.floor((Date.UTC(current.getFullYear(), current.getMonth(), current.getDate()) - Date.UTC(last.getFullYear(), last.getMonth(), last.getDate())) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                this.stats.streakDays = (this.stats.streakDays || 0) + 1;
            } else if (diffDays > 1) {
                this.stats.streakDays = 1;
            }
        }
        this.stats.lastStudyDate = today;
    }

    _checkAndResetDaily() {
        const today = this._getLocalDateString();
        if (this.stats.todayDate !== today) {
            this.stats.todayWords = 0;
            this.stats.todayDate = today;
            // Also clear per-deck stats for the new day
            this.learnedToday.clear();
            this._isDirty = true;
        }
    }

    trackWordLearned(word) {
        this._checkAndResetDaily();

        if (!word.progress) {
            console.error("trackWordLearned was called on a word without a progress object.", word);
            return false;
        }
        
        // The FSRS module is now responsible for setting the firstLearnedDate.
        // The caller (SessionManager) is responsible for calling this method only
        // when a card is truly new and learned for the first time.
        // This service's only job is to increment its internal counters.
        this.stats.todayWords = (this.stats.todayWords || 0) + 1;
        this.stats.totalWordsLearned = (this.stats.totalWordsLearned || 0) + 1;
        
        this._updateDailyStatus();
        this._isDirty = true;
        this._saveDebounced();
        return true;
    }

    onSessionStart() {
        this._checkAndResetDaily();
        this._updateDailyStatus();
        this._isDirty = true;
        this._saveDebounced();
    }

    onSessionComplete() {
        this.stats.totalSessions = (this.stats.totalSessions || 0) + 1;
        this._isDirty = true;
        this._saveDebounced();
    }
    
    // --- Methods moved from StartRegularStudySessionUseCase ---

    getTodayLearnedWords(deckName) {
        const today = this._getLocalDateString();
        const record = this.learnedToday.get(deckName);
        return (record && record.date === today) ? record.count : 0;
    }

    getTotalTodayLearnedWords() {
        const today = this._getLocalDateString();
        return Array.from(this.learnedToday.values())
            .filter(record => record.date === today)
            .reduce((total, record) => total + record.count, 0);
    }

    incrementTodayLearnedWords(deckName) {
        const today = this._getLocalDateString();
        
        // Clean up old entries from other days
        for (const [key, value] of this.learnedToday.entries()) {
            if (value.date !== today) {
                this.learnedToday.delete(key);
            }
        }
        
        const record = this.learnedToday.get(deckName) || { date: today, count: 0 };
        record.count++;
        this.learnedToday.set(deckName, record);
        
        this._isDirty = true;
        this._saveDebounced();
    }

    getSummary(vocabularyWords) {
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

        this._checkAndResetDaily();

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
                    { label: '已完成会话', value: this.stats.totalSessions || 0 },
                    { label: '今日已学新词', value: this.stats.todayWords || 0 },
                    { label: '总已学单词', value: this.stats.totalWordsLearned || 0 },
                    { label: '连续学习天数', value: this.stats.streakDays || 0 },
                    { label: '上次学习日期', value: this.stats.lastStudyDate || '无记录' }
                ]
            }
        ];
    }

    async reset(vocabularyWords) {
        this.stats = {
            totalWordsLearned: 0,
            totalSessions: 0,
            lastStudyDate: null,
            streakDays: 0,
            todayWords: 0,
            todayDate: this._getLocalDateString(),
        };
        this.learnedToday.clear();
        this._isDirty = true;
        await this._saveToStorage(); // Save immediately

        const wordsToUpdate = [];
        if (vocabularyWords) {
            vocabularyWords.forEach(word => {
                if (word.progress && word.progress.firstLearnedDate) {
                    word.progress.firstLearnedDate = null;
                    wordsToUpdate.push(word);
                }
            });
        }
        
        console.log('All statistics have been reset.');
        return wordsToUpdate;
    }
}
