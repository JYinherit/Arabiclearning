/**
 * @fileoverview Manages Text-to-Speech (TTS) for Arabic.
 * Encapsulates the Web Speech API to provide a unified interface for speech playback,
 * supporting voice selection, rate adjustment, and auto-play.
 */

import { STORAGE_KEYS } from '../common/constants.js';

export class TTSManager {
  /**
   * @param {import('./StorageService.js').StorageService} storageService 
   */
  constructor(storageService) {
    this.storageService = storageService;
    
    // Detect browser support
    this.isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    this.voices = [];
    this.arabicVoices = [];
    this.currentUtterance = null;
    this.isInitialized = false;
    
    // Bind event handler
    this.handleVoicesChanged = this._onVoicesChanged.bind(this);
  }

  /**
   * Initializes the TTS system.
   * @returns {Promise<boolean>} Whether initialization was successful.
   */
  async initialize() {
    if (!this.isSupported) {
      console.warn('[TTS] Web Speech API is not supported in this browser.');
      return false;
    }

    // Load voice list
    await this._loadVoices();
    
    // Listen for voice changes (some browsers load voices late)
    if (speechSynthesis.addEventListener) {
      speechSynthesis.addEventListener('voiceschanged', this.handleVoicesChanged);
    }
    
    this.isInitialized = true;
    console.log('[TTS] Initialized successfully.');
    return true;
  }

  /**
   * Loads the system's voice list.
   * @private
   */
  async _loadVoices() {
    return new Promise((resolve) => {
      const load = () => {
        this.voices = window.speechSynthesis.getVoices();
        // Filter for Arabic voices
        this.arabicVoices = this.voices.filter(voice => 
          voice.lang && voice.lang.toLowerCase().startsWith('ar')
        );
        console.log(`[TTS] Found ${this.arabicVoices.length} Arabic voices.`);
        resolve();
      };

      // Try to load immediately
      load();

      // If empty, wait for the voiceschanged event
      if (this.voices.length === 0) {
        speechSynthesis.addEventListener('voiceschanged', load, { once: true });
      }
    });
  }

  /**
   * Handles the voiceschanged event.
   * @private
   */
  async _onVoicesChanged() {
    console.log('[TTS] Voice list updated.');
    await this._loadVoices();
  }

  /**
   * Plays Arabic text.
   * @param {string} text - The Arabic text to play.
   * @returns {Promise<boolean>} Whether playback was started.
   */
  async play(text) {
    if (!this.isSupported) return false;
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Check if TTS is enabled
    const enabled = await this.storageService.getSetting(STORAGE_KEYS.ARABIC_TTS_ENABLED, false);
    if (!enabled) {
      console.log('[TTS] TTS is disabled, skipping playback.');
      return false;
    }

    // Stop any current playback
    this.stop();

    // Create utterance instance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ar-SA'; // Standard Arabic

    // Get user settings
    const settings = await this._getSettings();
    
    // Apply settings
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.volume = settings.volume;

    // Select voice
    if (settings.voiceURI && this.arabicVoices.length > 0) {
      const selectedVoice = this.arabicVoices.find(v => v.voiceURI === settings.voiceURI);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    } else if (this.arabicVoices.length > 0) {
      // Default to the first available Arabic voice
      utterance.voice = this.arabicVoices[0];
    }

    // Set event listeners
    utterance.onstart = () => {
      console.log('[TTS] Started playback:', text);
    };

    utterance.onend = () => {
      console.log('[TTS] Playback finished.');
      this.currentUtterance = null;
    };

    utterance.onerror = (event) => {
      console.error('[TTS] Playback error:', event.error);
      this.currentUtterance = null;
    };

    // Start playback
    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    return true;
  }

  /**
   * Plays a word object.
   * @param {import('../core/Word.js').Word} word - The word object.
   * @returns {Promise<boolean>}
   */
  async playWord(word) {
    if (!word?.arabic) {
      console.error('[TTS] Invalid word object:', word);
      return false;
    }
    return this.play(word.arabic);
  }

  /**
   * Stops playback.
   */
  stop() {
    if (this.isSupported && this.currentUtterance) {
      window.speechSynthesis.cancel();
      this.currentUtterance = null;
      console.log('[TTS] Playback stopped.');
    }
  }

  /**
   * Pauses playback.
   */
  pause() {
    if (this.isSupported && window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      console.log('[TTS] Playback paused.');
    }
  }

  /**
   * Resumes playback.
   */
  resume() {
    if (this.isSupported && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      console.log('[TTS] Playback resumed.');
    }
  }

  /**
   * Retrieves TTS settings from storage.
   * @private
   */
  async _getSettings() {
    return {
      rate: await this.storageService.getSetting(STORAGE_KEYS.ARABIC_TTS_RATE, 0.8),
      pitch: await this.storageService.getSetting(STORAGE_KEYS.ARABIC_TTS_PITCH, 1.0),
      volume: await this.storageService.getSetting(STORAGE_KEYS.ARABIC_TTS_VOLUME, 1.0),
      voiceURI: await this.storageService.getSetting(STORAGE_KEYS.ARABIC_TTS_VOICE),
      autoPlay: await this.storageService.getSetting(STORAGE_KEYS.ARABIC_TTS_AUTO_PLAY, true)
    };
  }

  /**
   * Gets the list of available Arabic voices.
   * @returns {Array<SpeechSynthesisVoice>}
   */
  getArabicVoices() {
      return this.arabicVoices;
  }

  /**
   * Gets a grouped list of voices, separating recommended Arabic voices from others.
   * @returns {{recommended: Array<object>, other: Array<object>}}
   */
  getGroupedVoices() {
    const recommended = [];
    const other = [];
    this.voices.forEach(voice => {
      const voiceData = {
        name: voice.name,
        voiceURI: voice.voiceURI,
        lang: voice.lang,
        default: voice.default,
        localService: voice.localService
      };
      if (voice.lang && voice.lang.toLowerCase().startsWith('ar')) {
        recommended.push(voiceData);
      } else {
        other.push(voiceData);
      }
    });
    return { recommended, other };
  }

  /**
   * Checks if TTS is supported by the browser.
   * @returns {boolean}
   */
  isTTSSupported() {
    return this.isSupported;
  }

  /**
   * Gets the current playback status.
   * @returns {{speaking: boolean, paused: boolean}}
   */
  getStatus() {
    if (!this.isSupported) {
        return { speaking: false, paused: false };
    }
    return {
      speaking: window.speechSynthesis.speaking,
      paused: window.speechSynthesis.paused,
    };
  }

  /**
   * Cleans up resources.
   */
  destroy() {
    this.stop();
    if (this.isSupported && speechSynthesis.removeEventListener) {
      speechSynthesis.removeEventListener('voiceschanged', this.handleVoicesChanged);
    }
    this.isInitialized = false;
  }
}
