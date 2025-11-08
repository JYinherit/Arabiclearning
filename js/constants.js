/**
 * @fileoverview 集中管理应用中用于浏览器存储 (localStorage, IndexedDB) 的所有键 (key)。
 * 这样做可以防止因拼写错误导致的 bug，并确保整个应用的一致性。
 */

export const STORAGE_KEYS = {
    DECKS: 'arabic_vocabulary_decks',
    PROGRESS: 'arabic_learning_progress',
    SETTINGS: 'arabic_app_settings',
    STATS: 'arabic_learning_stats',
    STUDY_MODE: 'study_mode',
    RECALL_MODE: 'recall_mode',
    DAILY_REVIEW_WORDS: 'daily_review_words',
    DAILY_NEW_WORDS: 'daily_new_words',
    NIGHT_MODE: 'night_mode',
    LAST_ACTIVE_DECK: 'last_active_deck',
    REGULAR_STUDY_STATS: 'regular_study_stats'
};