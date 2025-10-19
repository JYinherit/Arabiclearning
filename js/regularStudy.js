// regularStudy.js - 规律学习功能（每日新词+FSRS复习）

import * as dom from './dom.js';
import * as ui from './ui.js';
import * as storage from './storage.js';
import * as stats from './stats.js';
import ReviewScheduler, { RATING } from './memory.js';

export class RegularStudy {
    constructor(dependencies) {
        this.vocabularyDecks = dependencies.vocabularyDecks;
        this.currentDeckNameRef = dependencies.currentDeckNameRef;
        this.currentModeRef = dependencies.currentModeRef;
        this.scheduler = dependencies.scheduler || new ReviewScheduler();
        this.startSession = dependencies.startSession;
        this.showScreen = dependencies.showScreen;
        this.cardContainer = dependencies.cardContainer;
        this.showNextWord = dependencies.showNextWord;
        this.incrementSessionCount = dependencies.incrementSessionCount;
        
        // 规律学习设置
        this.settings = {
            dailyNewWords: 10, // 每日新单词数量
            maxReviewWords: 50, // 最大复习单词数量
            newWordsFirst: true, // 先学新词还是先复习
            autoProgress: true // 是否自动推进到下一个词库
        };
        
        this.loadSettings();
        this.setupUI();
    }

    loadSettings() {
        const saved = storage.getSetting('regularStudy', null);
        if (saved) {
            this.settings = { ...this.settings, ...saved };
        }
    }

    saveSettings() {
        storage.saveSetting('regularStudy', this.settings);
    }

    setupUI() {
        // 在开始屏幕添加规律学习按钮
        this.createRegularStudyButton();
        
        // 在设置模态框中添加规律学习设置
        this.addSettingsToModal();
    }

    createRegularStudyButton() {
        const regularStudyBtn = document.createElement('button');
        regularStudyBtn.id = 'regular-study-btn';
        regularStudyBtn.className = 'btn';
        regularStudyBtn.style.backgroundColor = '#9c27b0';
        regularStudyBtn.style.width = '80%';
        regularStudyBtn.style.margin = '0.6rem auto';
        regularStudyBtn.style.display = 'block';
        regularStudyBtn.innerHTML = '📅 规律学习';
        regularStudyBtn.title = '每日新单词 + 智能复习';

        regularStudyBtn.addEventListener('click', () => {
            this.startRegularStudy();
        });

        // 插入到随机测试区域之前
        const randomTestSection = document.getElementById('random-test-section');
        randomTestSection.parentNode.insertBefore(regularStudyBtn, randomTestSection);
    }

    addSettingsToModal() {
        // 在设置模态框中添加规律学习设置区域
        const settingsModal = document.getElementById('settings-modal');
        const dataManagementSection = document.getElementById('data-management-section');
        
        const regularStudySettings = document.createElement('div');
        regularStudySettings.id = 'regular-study-settings';
        regularStudySettings.style.marginTop = '1.5rem';
        regularStudySettings.style.paddingTop = '1.5rem';
        regularStudySettings.style.borderTop = '1px solid #e0e0e0';
        regularStudySettings.style.textAlign = 'center';
        
        regularStudySettings.innerHTML = `
            <h3 style="color: #37474f; margin-bottom: 1rem;">规律学习设置</h3>
            <div style="text-align: left; width: 80%; margin: 0 auto;">
                <label style="display: block; margin-bottom: 0.8rem;">
                    <span style="display: inline-block; width: 120px;">每日新词:</span>
                    <input type="number" id="daily-new-words" min="1" max="50" value="${this.settings.dailyNewWords}" 
                           style="width: 60px; text-align: center;">
                </label>
                <label style="display: block; margin-bottom: 0.8rem;">
                    <span style="display: inline-block; width: 120px;">最大复习:</span>
                    <input type="number" id="max-review-words" min="10" max="100" value="${this.settings.maxReviewWords}" 
                           style="width: 60px; text-align: center;">
                </label>
                <label style="display: block; margin-bottom: 0.8rem;">
                    <input type="checkbox" id="new-words-first" ${this.settings.newWordsFirst ? 'checked' : ''}>
                    <span>先学习新单词</span>
                </label>
                <label style="display: block; margin-bottom: 0.8rem;">
                    <input type="checkbox" id="auto-progress" ${this.settings.autoProgress ? 'checked' : ''}>
                    <span>自动推进词库</span>
                </label>
                <button id="save-regular-study-settings" class="btn" style="background-color: #9c27b0; width: 100%; margin-top: 1rem;">
                    保存规律学习设置
                </button>
            </div>
        `;

        dataManagementSection.parentNode.insertBefore(regularStudySettings, dataManagementSection);

        // 绑定保存设置事件
        document.getElementById('save-regular-study-settings').addEventListener('click', () => {
            this.saveRegularStudySettings();
        });
    }

    saveRegularStudySettings() {
        this.settings.dailyNewWords = parseInt(document.getElementById('daily-new-words').value) || 10;
        this.settings.maxReviewWords = parseInt(document.getElementById('max-review-words').value) || 50;
        this.settings.newWordsFirst = document.getElementById('new-words-first').checked;
        this.settings.autoProgress = document.getElementById('auto-progress').checked;
        
        this.saveSettings();
        ui.showImportMessage('规律学习设置已保存', true);
        ui.closeSettingsModal();
    }

    async startRegularStudy() {
        if (Object.keys(this.vocabularyDecks).length === 0) {
            alert('请先导入至少一个词库！');
            return;
        }

        // 选择词库
        const selectedDeck = await this.selectDeckForRegularStudy();
        if (!selectedDeck) return;

        this.currentDeckNameRef.value = selectedDeck.name;
        
        // 准备学习队列
        const studyQueue = await this.prepareStudyQueue(selectedDeck);
        
        if (studyQueue.length === 0) {
            alert('今天没有需要学习的单词！\n\n所有单词都已掌握或达到今日学习上限。');
            return;
        }

        // 显示今日学习概览
        this.showStudyOverview(selectedDeck, studyQueue);
    }

    async selectDeckForRegularStudy() {
        return new Promise((resolve) => {
            const deckNames = Object.keys(this.vocabularyDecks).filter(name => 
                this.vocabularyDecks[name].length > 0
            );

            if (deckNames.length === 1) {
                resolve({
                    name: deckNames[0],
                    words: this.vocabularyDecks[deckNames[0]]
                });
                return;
            }

            // 创建选择模态框
            const modal = document.createElement('div');
            modal.className = 'modal visible';
            modal.style.display = 'flex';
            
            modal.innerHTML = `
                <div class="modal-content">
                    <h2>选择学习词库</h2>
                    <div id="regular-study-deck-selector" style="max-height: 300px; overflow-y: auto; margin: 1rem 0;">
                        ${deckNames.map(deckName => `
                            <label style="display: block; margin-bottom: 0.8rem; padding: 0.5rem; border-radius: 4px; cursor: pointer;">
                                <input type="radio" name="regular-study-deck" value="${deckName}" 
                                       style="margin-right: 10px;">
                                ${deckName} (${this.vocabularyDecks[deckName].length}词)
                                <div style="font-size: 0.8em; color: #666; margin-top: 0.2rem;">
                                    ${this.getDeckProgressStats(deckName)}
                                </div>
                            </label>
                        `).join('')}
                    </div>
                    <div style="text-align: right; margin-top: 1rem;">
                        <button id="cancel-deck-select" class="btn" style="background-color: #9e9e9e; margin-right: 0.5rem;">取消</button>
                        <button id="confirm-deck-select" class="btn" style="background-color: #9c27b0;">开始学习</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            document.getElementById('cancel-deck-select').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(null);
            });

            document.getElementById('confirm-deck-select').addEventListener('click', () => {
                const selected = document.querySelector('input[name="regular-study-deck"]:checked');
                if (selected) {
                    document.body.removeChild(modal);
                    resolve({
                        name: selected.value,
                        words: this.vocabularyDecks[selected.value]
                    });
                } else {
                    alert('请选择一个词库！');
                }
            });

            // 点击外部关闭
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                    resolve(null);
                }
            });
        });
    }

    getDeckProgressStats(deckName) {
        const words = this.vocabularyDecks[deckName];
        const dueWords = this.scheduler.getDueWords(words);
        const newWords = words.filter(word => 
            !word.reviews || word.reviews.length === 0 || 
            (word.stage === 0 && word.rememberedCount === 0)
        );
        const masteredWords = words.filter(word => word.stage >= 4);
        
        return `复习: ${dueWords.length} | 新词: ${newWords.length} | 已掌握: ${masteredWords.length}`;
    }

    prepareStudyQueue(selectedDeck) {
        const words = selectedDeck.words;
        
        // 1. 获取需要复习的单词
        const dueWords = this.scheduler.getDueWords(words);
        const reviewWords = dueWords.slice(0, this.settings.maxReviewWords);
        
        // 2. 获取新单词（未学习过的）
        const newWords = words.filter(word => 
            !word.reviews || word.reviews.length === 0 || 
            (word.stage === 0 && word.rememberedCount === 0)
        );
        
        // 3. 检查今日新词学习限制
        const today = new Date().toDateString();
        const learnedToday = this.getTodayLearnedWords(selectedDeck.name);
        const availableNewWords = Math.max(0, this.settings.dailyNewWords - learnedToday);
        const selectedNewWords = newWords.slice(0, availableNewWords);
        
        // 4. 合并学习队列
        let studyQueue = [];
        
        if (this.settings.newWordsFirst) {
            studyQueue = [...selectedNewWords, ...reviewWords];
        } else {
            studyQueue = [...reviewWords, ...selectedNewWords];
        }
        
        // 5. 打乱顺序（但保持新词和复习词的分组）
        studyQueue = this.shuffleArray(studyQueue);
        
        return studyQueue;
    }

    getTodayLearnedWords(deckName) {
        const today = new Date().toDateString();
        const key = `regularStudy_${deckName}_${today}`;
        return parseInt(localStorage.getItem(key) || '0');
    }

    setTodayLearnedWords(deckName, count) {
        const today = new Date().toDateString();
        const key = `regularStudy_${deckName}_${today}`;
        localStorage.setItem(key, count.toString());
    }

    shuffleArray(array) {
        const newArray = [...array];
        for (let i = newArray.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
        }
        return newArray;
    }

    showStudyOverview(selectedDeck, studyQueue) {
        const words = selectedDeck.words;
        const dueWords = this.scheduler.getDueWords(words);
        const newWords = words.filter(word => 
            !word.reviews || word.reviews.length === 0 || 
            (word.stage === 0 && word.rememberedCount === 0)
        );
        const learnedToday = this.getTodayLearnedWords(selectedDeck.name);
        const availableNewWords = Math.max(0, this.settings.dailyNewWords - learnedToday);

        const modal = document.createElement('div');
        modal.className = 'modal visible';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-content">
                <h2>今日学习计划</h2>
                <div style="text-align: left; margin: 1.5rem 0;">
                    <p><strong>词库:</strong> ${selectedDeck.name}</p>
                    <p><strong>总单词:</strong> ${words.length} 个</p>
                    <p><strong>今日计划:</strong> ${studyQueue.length} 个单词</p>
                    <div style="background: #f5f5f5; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
                        <p>📚 需要复习: ${dueWords.length} 个</p>
                        <p>🆕 可学新词: ${availableNewWords} 个 (今日上限: ${this.settings.dailyNewWords})</p>
                        <p>✅ 已学新词: ${learnedToday} 个</p>
                    </div>
                    <p style="font-size: 0.9em; color: #666;">
                        ${availableNewWords === 0 ? '⚠️ 今日新词额度已用完，仅进行复习' : ''}
                    </p>
                </div>
                <div style="text-align: right; margin-top: 1rem;">
                    <button id="cancel-study" class="btn" style="background-color: #9e9e9e; margin-right: 0.5rem;">取消</button>
                    <button id="start-study" class="btn" style="background-color: #9c27b0;">开始学习</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('cancel-study').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        document.getElementById('start-study').addEventListener('click', () => {
            document.body.removeChild(modal);
            this.beginStudySession(selectedDeck, studyQueue);
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    isNewWord(word) {
        // 与 prepareStudyQueue 中的逻辑保持一致
        return !word.reviews || word.reviews.length === 0 || 
               (word.stage === 0 && word.rememberedCount === 0);
    }

    incrementTodayLearned(deckName) {
        const currentLearned = this.getTodayLearnedWords(deckName);
        this.setTodayLearnedWords(deckName, currentLearned + 1);
    }
    
    beginStudySession(selectedDeck, studyQueue) {
        // 标记为新单词学习会话
        const isNewWordSession = true;
        
        // 使用现有的startSession函数，但传入我们的学习队列
        this.startSession(studyQueue, selectedDeck.name);
        
        // 实时跟踪新单词学习数量的逻辑已移至 main.js 中的 handleEasy 函数。
    }
}

// 导出初始化函数
export function setupRegularStudy(dependencies) {
    return new RegularStudy(dependencies);
}
