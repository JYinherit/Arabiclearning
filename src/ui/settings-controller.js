/**
 * @fileoverview Manages the UI logic for the settings page.
 * (Refactored to accept dependencies).
 */

import * as dom from './dom-elements.js';
import { STORAGE_KEYS } from '../common/constants.js';

let storageSvc = null;
let ttsMgr = null;

/**
 * Applies the selected theme to the document body.
 * @param {string} themeName - The name of the theme to apply.
 */
function applyTheme(themeName) {
    document.body.className = ''; // Clear all existing classes
    if (themeName && themeName !== 'default') {
        document.body.classList.add(`theme-${themeName}`);
    }
}

/**
 * Initializes the TTS settings UI section.
 */
async function initTTSSettingsUI() {
    if (!ttsMgr || !ttsMgr.isTTSSupported()) {
        const container = document.getElementById('tts-settings-container');
        if (container) {
            container.innerHTML = '<p>当前浏览器不支持语音合成。</p>';
        }
        return;
    }

    // Load and set saved values
    dom.ttsEnableSetting.checked = await storageSvc.getSetting(STORAGE_KEYS.ARABIC_TTS_ENABLED, false);
    dom.ttsAutoPlaySetting.checked = await storageSvc.getSetting(STORAGE_KEYS.ARABIC_TTS_AUTO_PLAY, true);
    
    const rate = await storageSvc.getSetting(STORAGE_KEYS.ARABIC_TTS_RATE, 0.8);
    dom.ttsRateSetting.value = rate;
    if (dom.ttsRateValue) dom.ttsRateValue.textContent = rate;

    const pitch = await storageSvc.getSetting(STORAGE_KEYS.ARABIC_TTS_PITCH, 1.0);
    dom.ttsPitchSetting.value = pitch;
    if (dom.ttsPitchValue) dom.ttsPitchValue.textContent = pitch;

    const volume = await storageSvc.getSetting(STORAGE_KEYS.ARABIC_TTS_VOLUME, 1.0);
    dom.ttsVolumeSetting.value = volume;
    if (dom.ttsVolumeValue) dom.ttsVolumeValue.textContent = volume;

    // Populate voice dropdown
    const groupedVoices = ttsMgr.getGroupedVoices();
    const savedVoiceURI = await storageSvc.getSetting(STORAGE_KEYS.ARABIC_TTS_VOICE);
    
    dom.ttsVoiceSelect.innerHTML = '';

    const createOptGroup = (label, voices) => {
        if (voices.length === 0) return;
        const optgroup = document.createElement('optgroup');
        optgroup.label = label;
        voices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.voiceURI;
            option.textContent = `${voice.name} (${voice.lang})`;
            if (voice.voiceURI === savedVoiceURI) {
                option.selected = true;
            }
            optgroup.appendChild(option);
        });
        dom.ttsVoiceSelect.appendChild(optgroup);
    };

    createOptGroup('推荐的阿拉伯语语音', groupedVoices.recommended);
    createOptGroup('其他可用语音', groupedVoices.other);

    if (dom.ttsVoiceSelect.innerHTML === '') {
        dom.ttsVoiceSelect.innerHTML = '<option value="">无可用语音</option>';
    }
}

/**
 * Sets up event listeners for the TTS settings controls.
 */
function setupTTSSettingsListeners() {
    if (!ttsMgr || !ttsMgr.isTTSSupported()) return;

    const handleSlider = (slider, valueDisplay, key) => {
        if (slider) {
            slider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value).toFixed(1);
                if (valueDisplay) valueDisplay.textContent = value;
                storageSvc.saveSetting(key, parseFloat(value));
            });
        }
    };

    if (dom.ttsEnableSetting) {
        dom.ttsEnableSetting.addEventListener('change', (e) => {
            storageSvc.saveSetting(STORAGE_KEYS.ARABIC_TTS_ENABLED, e.target.checked);
        });
    }

    if (dom.ttsAutoPlaySetting) {
        dom.ttsAutoPlaySetting.addEventListener('change', (e) => {
            storageSvc.saveSetting(STORAGE_KEYS.ARABIC_TTS_AUTO_PLAY, e.target.checked);
        });
    }

    if (dom.ttsVoiceSelect) {
        dom.ttsVoiceSelect.addEventListener('change', (e) => {
            storageSvc.saveSetting(STORAGE_KEYS.ARABIC_TTS_VOICE, e.target.value);
        });
    }

    handleSlider(dom.ttsRateSetting, dom.ttsRateValue, STORAGE_KEYS.ARABIC_TTS_RATE);
    handleSlider(dom.ttsPitchSetting, dom.ttsPitchValue, STORAGE_KEYS.ARABIC_TTS_PITCH);
    handleSlider(dom.ttsVolumeSetting, dom.ttsVolumeValue, STORAGE_KEYS.ARABIC_TTS_VOLUME);
}

/**
 * Initializes the settings UI with values loaded from storage.
 * @param {import('../infrastructure/StorageService.js').StorageService} storageService
 * @param {import('../infrastructure/TTSManager.js').TTSManager} ttsManager
 */
export async function initSettingsUI(storageService, ttsManager) {
    storageSvc = storageService;
    ttsMgr = ttsManager;

    if (!dom.settingsPage) return;

    const settings = {
        [STORAGE_KEYS.STUDY_MODE]: 'zh-ar',
        [STORAGE_KEYS.RECALL_MODE]: false,
        [STORAGE_KEYS.DAILY_REVIEW_WORDS]: 30,
        [STORAGE_KEYS.DAILY_NEW_WORDS]: 10,
        [STORAGE_KEYS.THEME]: 'default',
    };

    for (const key in settings) {
        settings[key] = await storageSvc.getSetting(key, settings[key]);
    }

    const modeRadio = document.querySelector(`input[name="mode"][value="${settings[STORAGE_KEYS.STUDY_MODE]}"]`);
    if (modeRadio) modeRadio.checked = true;
    if (dom.recallSetting) dom.recallSetting.checked = settings[STORAGE_KEYS.RECALL_MODE];
    if (dom.dailyReviewWordsInput) dom.dailyReviewWordsInput.value = settings[STORAGE_KEYS.DAILY_REVIEW_WORDS];
    if (dom.dailyNewWordsInput) dom.dailyNewWordsInput.value = settings[STORAGE_KEYS.DAILY_NEW_WORDS];

    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
        themeSelect.value = settings[STORAGE_KEYS.THEME];
        applyTheme(settings[STORAGE_KEYS.THEME]);
    }
    
    await initTTSSettingsUI();
}

/**
 * Sets up event listeners for all controls on the settings page.
 * @param {object} callbacks - An object containing callbacks for specific setting changes.
 * @param {Function} [callbacks.onStudyPlanChange] - Called when daily new/review words change.
 */
export function setupSettingsListeners({ onStudyPlanChange } = {}) {
    if (!dom.settingsPage) return;

    setupTTSSettingsListeners();

    dom.settingsPage.addEventListener('change', (e) => {
        const target = e.target;
        let key = null;
        let value = null;
        let callback = null;

        if (target.closest('#tts-settings-container')) {
            return;
        }

        if (target.matches('input[name="mode"]')) {
            key = STORAGE_KEYS.STUDY_MODE;
            value = target.value;
        } else if (target.matches('#recall-setting')) {
            key = STORAGE_KEYS.RECALL_MODE;
            value = target.checked;
        } else if (target.matches('#daily-review-words')) {
            key = STORAGE_KEYS.DAILY_REVIEW_WORDS;
            value = parseInt(target.value, 10) || 30;
        } else if (target.matches('#daily-new-words')) {
            key = STORAGE_KEYS.DAILY_NEW_WORDS;
            value = parseInt(target.value, 10) || 10;
            if (onStudyPlanChange) callback = onStudyPlanChange;
        } else if (target.matches('#theme-select')) {
            key = STORAGE_KEYS.THEME;
            value = target.value;
            callback = () => applyTheme(value);
        }

        if (key !== null) {
            storageSvc.saveSetting(key, value);
            if (callback) {
                callback();
            }
        }
    });
}
