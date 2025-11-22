/**
 * @fileoverview 集中管理应用中所有的 DOM 元素选择。
 * 缓存这些选择可以避免重复查询 DOM，从而提高性能。
 */

// --- 主要页面 ---
export const studyPage = document.getElementById('study-page');
export const decksPage = document.getElementById('decks-page');
export const settingsPage = document.getElementById('settings-page');

// --- 导航 ---
export const navButtons = document.querySelectorAll('.nav-btn');

// --- 主要屏幕 ---
export const startScreen = document.getElementById('start-screen');
export const cardContainer = document.getElementById('card-container');
export const switchStudyPlanBtn = document.getElementById('switch-study-plan-btn');
export const studyPlanDisplay = document.getElementById('study-plan-display');
export const completionScreen = document.getElementById('completion-screen');
export const deckSelectionContainer = document.getElementById('deck-selection-container');
export const skeletonLoader = document.getElementById('skeleton-loader');

// --- 学习卡片元素 ---
export const progressContainer = document.getElementById('progress-container');
export const progressBar = document.getElementById('progress-bar');
export const wordDisplay = document.getElementById('word-display');
export const answerDisplay = document.getElementById('answer-display');
export const explanationDisplay = document.getElementById('explanation-display');
export const definitionToggleContainer = document.getElementById('definition-toggle-container');

// --- 控制按钮 ---
export const regularStudyBtn = document.getElementById('regular-study-btn');
export const forgotBtn = document.getElementById('forgot-btn');
export const hardBtn = document.getElementById('hard-btn'); 
export const easyBtn = document.getElementById('easy-btn'); 
export const prevBtn = document.getElementById('prev-btn');
export const backToMenuBtn = document.getElementById('back-to-menu-btn');
export const finishBackToMenuBtn = document.getElementById('finish-back-to-menu-btn');
export const nextWordInHistoryBtn = document.getElementById('next-word-in-history-btn');

// --- 导入/导出 ---
export const fileInput = document.getElementById('file-input');
export const importBtn = document.getElementById('import-btn');

// --- 设置与数据管理 ---
export const viewStatsBtn = document.getElementById('view-stats-btn');
export const exportBackupBtn = document.getElementById('export-backup-btn');
export const importBackupBtn = document.getElementById('import-backup-btn');
export const checkStorageBtn = document.getElementById('check-storage-btn');
export const openClearDataModalBtn = document.getElementById('open-clear-data-modal-btn');
export const modeRadioButtons = document.querySelectorAll('input[name="mode"]');
export const dailyReviewWordsInput = document.getElementById('daily-review-words');
export const dailyNewWordsInput = document.getElementById('daily-new-words');
export const nightModeToggle = document.getElementById('night-mode-toggle');

// --- 主动回忆模式 ---
export const recallSetting = document.getElementById('recall-setting');
export const recallOverlay = document.getElementById('recall-overlay');
export const timerCountdown = document.querySelector('.timer-countdown');

// --- 模态框与通知 ---
export const notificationContainer = document.getElementById('notification-container');
export const statsModal = document.getElementById('stats-modal');
export const statsModalTitle = document.getElementById('stats-modal-title');
export const statsContent = document.getElementById('stats-modal-body');
export const statsModalCloseBtn = document.getElementById('stats-modal-close-btn');
export const clearDataModal = document.getElementById('clear-data-modal');
export const executeClearDataBtn = document.getElementById('execute-clear-data-btn');
export const continueSessionModal = document.getElementById('continue-session-modal');
export const confirmContinueBtn = document.getElementById('confirm-continue-btn');
export const declineContinueBtn = document.getElementById('decline-continue-btn');
export const regularStudyScopeModal = document.getElementById('regular-study-scope-modal');
export const studyPlanModal = document.getElementById('study-plan-modal');
export const studyPlanOptionsContainer = document.getElementById('study-plan-options-container');
export const cancelStudyPlanBtn = document.getElementById('cancel-study-plan-btn');
export const confirmStudyPlanBtn = document.getElementById('confirm-study-plan-btn');

// --- TTS (文本转语音) ---
export const ttsPlayBtn = document.getElementById('tts-play-btn');
export const ttsEnableSetting = document.getElementById('tts-enable-setting');
export const ttsAutoPlaySetting = document.getElementById('tts-autoplay-setting');
export const ttsVoiceSelect = document.getElementById('tts-voice-select');
export const ttsRateSetting = document.getElementById('tts-rate-setting');
export const ttsRateValue = document.getElementById('tts-rate-value');
export const ttsPitchSetting = document.getElementById('tts-pitch-setting');
export const ttsPitchValue = document.getElementById('tts-pitch-value');
export const ttsVolumeSetting = document.getElementById('tts-volume-setting');
export const ttsVolumeValue = document.getElementById('tts-volume-value');
export const ttsExplanationPlayBtn = document.getElementById('tts-explanation-play-btn');
