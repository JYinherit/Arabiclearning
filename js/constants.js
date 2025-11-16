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
    THEME: 'theme',
    LAST_ACTIVE_DECK: 'last_active_deck',
    REGULAR_STUDY_STATS: 'regular_study_stats',
    DEFAULT_STUDY_PLAN: 'default_study_plan',
    ARABIC_TTS_ENABLED: 'arabic_tts_enabled',
    ARABIC_TTS_VOICE: 'arabic_tts_voice',
    ARABIC_TTS_RATE: 'arabic_tts_rate',
    ARABIC_TTS_PITCH: 'arabic_tts_pitch',
    ARABIC_TTS_VOLUME: 'arabic_tts_volume',
    ARABIC_TTS_AUTO_PLAY: 'arabic_tts_auto_play'
};