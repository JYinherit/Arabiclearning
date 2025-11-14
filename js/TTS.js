/**
 * @fileoverview 阿拉伯语TTS（文本转语音）管理模块
 * 封装Web Speech API，提供统一的语音播放接口
 * 支持语音选择、语速调节和自动播放
 */

import { STORAGE_KEYS } from './constants.js';
import { getSetting } from './storage.js';

class TTSManager {
  constructor() {
    // 检测浏览器支持
    this.isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    this.voices = [];
    this.arabicVoices = [];
    this.currentUtterance = null;
    this.isInitialized = false;
    
    // 绑定事件处理函数
    this.handleVoicesChanged = this._onVoicesChanged.bind(this);
  }

  /**
   * 初始化TTS系统
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize() {
    if (!this.isSupported) {
      console.warn('[TTS] 当前浏览器不支持Web Speech API');
      return false;
    }

    // 加载语音列表
    await this._loadVoices();
    
    // 监听语音变化事件（某些浏览器延迟加载语音）
    if (speechSynthesis.addEventListener) {
      speechSynthesis.addEventListener('voiceschanged', this.handleVoicesChanged);
    }
    
    this.isInitialized = true;
    console.log('[TTS] 初始化成功');
    return true;
  }

  /**
   * 加载系统语音列表
   * @private
   */
  async _loadVoices() {
    return new Promise((resolve) => {
      const loadVoices = () => {
        this.voices = window.speechSynthesis.getVoices();
        // 筛选阿拉伯语语音
        this.arabicVoices = this.voices.filter(voice => 
          voice.lang && voice.lang.toLowerCase().startsWith('ar')
        );
        console.log(`[TTS] 找到 ${this.arabicVoices.length} 个阿拉伯语语音`);
        resolve();
      };

      // 立即尝试加载
      loadVoices();

      // 如果为空，等待voiceschanged事件
      if (this.voices.length === 0) {
        speechSynthesis.addEventListener('voiceschanged', loadVoices, { once: true });
      }
    });
  }

  /**
   * 语音列表变化事件处理
   * @private
   */
  async _onVoicesChanged() {
    console.log('[TTS] 语音列表已更新');
    await this._loadVoices();
  }

  /**
   * 播放阿拉伯语文本
   * @param {string} text - 要播放的阿拉伯语文本
   * @param {object} options - 播放选项
   * @returns {Promise<boolean>} 是否开始播放
   */
  async play(text, options = {}) {
    if (!this.isSupported) return false;
    if (!this.isInitialized) {
      await this.initialize();
    }

    // 检查是否启用TTS
    const enabled = await getSetting(STORAGE_KEYS.ARABIC_TTS_ENABLED, false);
    if (!enabled) {
      console.log('[TTS] TTS功能未启用，跳过播放');
      return false;
    }

    // 停止当前播放（避免重叠）
    this.stop();

    // 创建语音实例
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ar-SA'; // 标准阿拉伯语

    // 获取用户设置
    const settings = await this._getSettings();
    
    // 应用设置
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.volume = settings.volume;

    // 选择语音
    if (settings.voiceURI && this.arabicVoices.length > 0) {
      const selectedVoice = this.arabicVoices.find(v => v.voiceURI === settings.voiceURI);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    } else if (this.arabicVoices.length > 0) {
      // 默认使用第一个阿拉伯语语音
      utterance.voice = this.arabicVoices[0];
    }

    // 设置事件监听
    utterance.onstart = () => {
      console.log('[TTS] 开始播放:', text);
    };

    utterance.onend = () => {
      console.log('[TTS] 播放完成');
      this.currentUtterance = null;
    };

    utterance.onerror = (event) => {
      console.error('[TTS] 播放失败:', event.error);
      this.currentUtterance = null;
    };

    // 开始播放
    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    return true;
  }

  /**
   * 播放单词对象
   * @param {object} word - 单词对象
   * @returns {Promise<boolean>}
   */
  async playWord(word) {
    if (!word?.arabic) {
      console.error('[TTS] 无效的单词对象:', word);
      return false;
    }
    return this.play(word.arabic);
  }

  /**
   * 停止播放
   */
  stop() {
    if (this.currentUtterance) {
      window.speechSynthesis.cancel();
      this.currentUtterance = null;
      console.log('[TTS] 播放已停止');
    }
  }

  /**
   * 暂停播放
   */
  pause() {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      console.log('[TTS] 播放已暂停');
    }
  }

  /**
   * 恢复播放
   */
  resume() {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      console.log('[TTS] 播放已恢复');
    }
  }

  /**
   * 获取TTS设置
   * @private
   */
  async _getSettings() {
    return {
      rate: await getSetting(STORAGE_KEYS.ARABIC_TTS_RATE, 0.8),      // 语速
      pitch: await getSetting(STORAGE_KEYS.ARABIC_TTS_PITCH, 1.0),    // 音调
      volume: await getSetting(STORAGE_KEYS.ARABIC_TTS_VOLUME, 1.0),  // 音量
      voiceURI: await getSetting(STORAGE_KEYS.ARABIC_TTS_VOICE),      // 选中的语音
      autoPlay: await getSetting(STORAGE_KEYS.ARABIC_TTS_AUTO_PLAY, true) // 自动播放
    };
  }

  /**
   * 获取分组后的语音列表，分为推荐的阿拉伯语语音和其他语音
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
   * 检查是否支持TTS
   * @returns {boolean}
   */
  isTTSSupported() {
    return this.isSupported;
  }

  /**
   * 获取当前播放状态
   * @returns {object}
   */
  getStatus() {
    return {
      speaking: window.speechSynthesis?.speaking || false,
      paused: window.speechSynthesis?.paused || false,
      currentUtterance: this.currentUtterance
    };
  }

  /**
   * 清理资源
   */
  destroy() {
    this.stop();
    if (speechSynthesis.removeEventListener) {
      speechSynthesis.removeEventListener('voiceschanged', this.handleVoicesChanged);
    }
    this.isInitialized = false;
  }
}

// 创建单例实例并导出
export const ttsManager = new TTSManager();

// 导出便捷函数
export const playArabicTTS = (text) => ttsManager.play(text);
export const stopArabicTTS = () => ttsManager.stop();
export const getAvailableArabicVoices = () => ttsManager.getArabicVoices();