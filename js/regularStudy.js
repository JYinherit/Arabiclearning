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
        this.dependencies = dependencies; // 保存所有依赖
        
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
        
        if (dom.regularStudyBtn) {
            dom.regularStudyBtn.addEventListener('click', () => {
                this.startRegularStudy();
            });
        }
        
        // 设置模态框内容保持不变...
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

        // 创建选择模态框 - 修复定位
        const modal = document.createElement('div');
        modal.className = 'modal visible';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 2000;
        `;
        
        modal.innerHTML = `
            <div class="modal-content" style="
                background: white;
                padding: 2rem;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                max-width: 90%;
                width: 500px;
                max-height: 80vh;
                overflow-y: auto;
                margin: 2rem;
            ">
                <h2 style="margin-top: 0; color: #333; border-bottom: 2px solid #667eea; padding-bottom: 0.5rem;">
                    选择学习词库
                </h2>
                <div id="regular-study-deck-selector" style="
                    max-height: 300px; 
                    overflow-y: auto; 
                    margin: 1.5rem 0;
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    padding: 1rem;
                ">
                    ${deckNames.map(deckName => `
                        <label style="
                            display: block; 
                            margin-bottom: 1rem; 
                            padding: 1rem;
                            border-radius: 8px;
                            cursor: pointer;
                            transition: background-color 0.3s;
                            border: 2px solid transparent;
                        " onmouseover="this.style.backgroundColor='#f5f5f5'; this.style.borderColor='#667eea'" 
                          onmouseout="this.style.backgroundColor=''; this.style.borderColor='transparent'">
                            <input type="radio" name="regular-study-deck" value="${deckName}" 
                                   style="margin-right: 12px; transform: scale(1.2);">
                            <strong>${deckName}</strong> (${this.vocabularyDecks[deckName].length}词)
                            <div style="font-size: 0.85em; color: #666; margin-top: 0.3rem;">
                                ${this.getDeckProgressStats(deckName)}
                            </div>
                        </label>
                    `).join('')}
                </div>
                <div style="text-align: right; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e0e0e0;">
                    <button id="cancel-deck-select" class="btn" style="background: linear-gradient(135deg, #757575 0%, #9e9e9e 100%); margin-right: 0.8rem;">取消</button>
                    <button id="confirm-deck-select" class="btn" style="background: linear-gradient(135deg, #9c27b0 0%, #6a1b9a 100%);">开始学习</button>
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
        if (!words || words.length === 0) return '无单词';
        
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
    console.log('显示学习概览:', selectedDeck.name, '单词数量:', studyQueue.length);
    
    // 移除任何已存在的模态框
    const existingModal = document.getElementById('regular-study-overview-modal');
    if (existingModal) {
        document.body.removeChild(existingModal);
    }

    const modal = document.createElement('div');
    modal.id = 'regular-study-overview-modal';
    modal.innerHTML = `
        <div class="modal-backdrop" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        ">
            <div class="modal-content" style="
                background: white;
                padding: 2rem;
                border-radius: 12px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                max-width: 90vw;
                width: 500px;
                max-height: 80vh;
                overflow-y: auto;
                position: relative;
                margin: 20px;
            ">
                <h2 style="margin-top: 0; color: #333; border-bottom: 2px solid #4caf50; padding-bottom: 0.5rem;">
                    📚 今日学习计划
                </h2>
                <div style="text-align: left; margin: 1.5rem 0; line-height: 1.8;">
                    <p><strong>词库:</strong> ${selectedDeck.name}</p>
                    <p><strong>总单词:</strong> ${selectedDeck.words.length} 个</p>
                    <p><strong>今日计划:</strong> ${studyQueue.length} 个单词</p>
                    <div style="background: #f8f9fa; padding: 1.2rem; border-radius: 8px; margin: 1.2rem 0; border-left: 4px solid #667eea;">
                        <p>📖 <strong>需要复习:</strong> ${this.scheduler.getDueWords(selectedDeck.words).length} 个</p>
                        <p>🆕 <strong>可学新词:</strong> ${studyQueue.filter(w => this.isNewWord(w)).length} 个</p>
                    </div>
                    ${studyQueue.length === 0 ? 
                        '<p style="color: #d32f2f; background: #ffebee; padding: 1rem; border-radius: 4px;">⚠️ 今天没有需要学习的单词，请明天再来！</p>' :
                        '<p style="color: #2e7d32; background: #e8f5e8; padding: 1rem; border-radius: 4px;">💡 点击"开始学习"立即开始今日计划</p>'
                    }
                </div>
                <div style="text-align: right; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid #e0e0e0;">
                    <button id="cancel-regular-study" class="btn" style="background: #6c757d; margin-right: 0.8rem;">取消</button>
                    ${studyQueue.length > 0 ? 
                        `<button id="start-regular-study" class="btn" style="background: #4caf50;">开始学习</button>` :
                        `<button id="close-regular-study" class="btn" style="background: #6c757d;">关闭</button>`
                    }
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // 事件监听
    document.getElementById('cancel-regular-study')?.addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    document.getElementById('close-regular-study')?.addEventListener('click', () => {
        document.body.removeChild(modal);
    });

    document.getElementById('start-regular-study')?.addEventListener('click', () => {
        document.body.removeChild(modal);
        this.beginStudySession(selectedDeck, studyQueue);
    });

    // 点击背景关闭
    modal.querySelector('.modal-backdrop').addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop')) {
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
    
// 修改 beginStudySession 方法
    beginStudySession(selectedDeck, studyQueue) {
        console.log('开始规律学习会话:', selectedDeck.name, '队列长度:', studyQueue.length);
        
        if (studyQueue.length === 0) {
            alert('今天没有需要学习的单词！\n\n所有单词都已掌握或达到今日学习上限。');
            return;
        }
        
        // 确保会话状态重置
        if (this.dependencies.isSessionActive) {
            this.dependencies.isSessionActive.value = false;
        }
        
        // 直接调用 startSession，不传入规律学习标志
        this.startSession(studyQueue, selectedDeck.name);
        
        // 切换到学习页面
        this.dependencies.updateNavigationState('study-page');
    }

    async startRegularStudyWithDeckName(deckName) {
        if (!this.vocabularyDecks[deckName]) {
            console.error(`词库 "${deckName}" 未找到，无法开始规律学习。`);
            return false; // 返回false表示失败
        }

        const selectedDeck = {
            name: deckName,
            words: this.vocabularyDecks[deckName]
        };

        this.currentDeckNameRef.value = selectedDeck.name;
        
        const studyQueue = await this.prepareStudyQueue(selectedDeck);
        
        if (studyQueue.length === 0) {
            console.log(`词库 "${deckName}" 今日无学习内容。`);
            return false; // 返回false表示没有可学内容
        }

        this.beginStudySession(selectedDeck, studyQueue);
        return true; // 返回true表示成功
    }
}
// 导出初始化函数
export function setupRegularStudy(dependencies) {
    return new RegularStudy(dependencies);
}
