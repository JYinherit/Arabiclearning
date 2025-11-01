import * as dom from './dom.js';
import { saveSetting, getSetting } from './storage.js';
import { STORAGE_KEYS } from './constants.js';

export function showScreen(screen) {
    console.log('显示屏幕:', screen?.id);
    
    // 获取当前活动页面
    const activePage = document.querySelector('.page.active');
    if (!activePage) {
        console.error('没有找到活动页面');
        return;
    }
    
    // 隐藏当前页面内的所有主要屏幕
    const pageScreens = activePage.querySelectorAll('#start-screen, #card-container, #completion-screen');
    pageScreens.forEach(s => {
        if (s) {
            s.style.display = 'none';
            s.style.opacity = '0';
        }
    });
    
    // 显示目标屏幕
    if (screen) {
        screen.style.display = 'block';
        // 添加淡入效果
        setTimeout(() => {
            screen.style.opacity = '1';
            screen.style.transition = 'opacity 0.3s ease';
        }, 50);
    }
}

export function updateProgressBar(completed, total) {
    if (!dom.progressBar) return; 
    
    let progressPercentage = 0;
    if (total > 0 && completed >= 0) {
        progressPercentage = Math.round((completed / total) * 100);
        progressPercentage = Math.max(0, Math.min(100, progressPercentage));
    }
    
    dom.progressBar.style.width = progressPercentage + '%';
    dom.progressBar.textContent = `${completed} / ${total}`;
    
    // 添加视觉反馈
    if (progressPercentage === 100) {
        dom.progressBar.style.background = 'linear-gradient(135deg, #4caf50, #45a049)';
    } else if (progressPercentage >= 75) {
        dom.progressBar.style.background = 'linear-gradient(135deg, #8bc34a, #7cb342)';
    } else if (progressPercentage >= 50) {
        dom.progressBar.style.background = 'linear-gradient(135deg, #ffc107, #ffb300)';
    } else if (progressPercentage >= 25) {
        dom.progressBar.style.background = 'linear-gradient(135deg, #ff9800, #f57c00)';
    } else {
        dom.progressBar.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
    }
}

export function displayCard(word, currentMode) {
    console.log('显示卡片:', word?.chinese);
    
    if (!word) {
        console.error('没有单词数据');
        return;
    }

    const flashcardContainer = document.querySelector('.flashcard');
    const wordElement = dom.wordDisplay;
    const answerElement = dom.answerDisplay;
    const explanationElement = dom.explanationDisplay;

    // 验证核心元素是否存在
    if (!flashcardContainer || !wordElement || !answerElement || !explanationElement) {
        console.error('显示卡片失败：一个或多个核心DOM元素未找到。');
        return;
    }

    // 设置解释文本
    explanationElement.textContent = `💡 解释: ${word.explanation}`;

    let showChinese = true;

    if (currentMode === 'mixed') {
        showChinese = Math.random() < 0.5;
    } else if (currentMode === 'ar-zh') {
        showChinese = false;
    }

    if (showChinese) {
        // 显示中文，背阿拉伯语
        wordElement.textContent = word.chinese;
        wordElement.style.direction = 'ltr';
        wordElement.style.fontSize = '2.2rem';
        wordElement.style.fontWeight = 'bold';
        
        answerElement.innerHTML = word.arabic.replace(/\n/g, '<br>');
        answerElement.style.direction = 'rtl';
        answerElement.style.fontSize = '2rem';
        answerElement.style.fontWeight = '600';
    } else {
        // 显示阿拉伯语，背中文
        wordElement.innerHTML = word.arabic.replace(/\n/g, '<br>');
        wordElement.style.direction = 'rtl';
        wordElement.style.fontSize = '2rem';
        wordElement.style.fontWeight = '600';
        
        answerElement.textContent = word.chinese;
        answerElement.style.direction = 'ltr';
        answerElement.style.fontSize = '2.2rem';
        answerElement.style.fontWeight = 'bold';
    }

    // 解释文本样式
    explanationElement.style.fontSize = '1.4rem';
    explanationElement.style.color = '#e65100';
    explanationElement.style.fontWeight = '500';

    // 重置遮挡状态
    answerElement.classList.remove('revealed');
    answerElement.classList.add('spoiler');
    explanationElement.classList.remove('revealed');
    explanationElement.classList.add('spoiler');
    
    // 添加动画效果
    flashcardContainer.style.animation = 'cardAppear 0.5s ease-out';
    
    // 移除动画，以便下次可以重新触发
    setTimeout(() => {
        flashcardContainer.style.animation = '';
    }, 500);
}

export function setupSelectionScreen(vocabularyDecks, startSessionCallback) {
    dom.deckSelectionContainer.innerHTML = '';
    Object.keys(vocabularyDecks).forEach(deckName => {
        const button = document.createElement('button');
        button.textContent = `${deckName} (${vocabularyDecks[deckName].length}词)`;
        button.className = 'btn deck-btn';
        if (vocabularyDecks[deckName].length === 0) {
            button.disabled = true;
            button.title = '此词库暂无内容';
        }
        button.addEventListener('click', () => {
            console.log('Deck button clicked:', deckName);
            startSessionCallback(vocabularyDecks[deckName], deckName, false);
        });
        dom.deckSelectionContainer.appendChild(button);
    });
}

export function showImportMessage(message, isSuccess = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `import-message ${isSuccess ? 'import-success' : 'import-error'}`;
    messageDiv.textContent = message;
    
    const container = dom.notificationContainer;
    if (container) {
        container.appendChild(messageDiv);
    } else {
        document.body.appendChild(messageDiv);
    }

    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

export function toggleAnswerVisibility() {
    dom.answerDisplay.classList.toggle('spoiler');
    dom.answerDisplay.classList.toggle('revealed');
}

export function openSettingsModal() {
    dom.settingsModal.classList.add('visible');
    // 添加键盘事件监听，允许按 ESC 退出
    document.addEventListener('keydown', handleSettingsKeydown);
}

export function closeSettingsModal() {
    dom.settingsModal.classList.remove('visible');
    document.removeEventListener('keydown', handleSettingsKeydown);
    
    // 将焦点返回到设置按钮
    const settingsNavBtn = document.querySelector('.nav-btn[data-page="settings-page"]');
    if (settingsNavBtn) {
        settingsNavBtn.focus();
    }
}

function handleSettingsKeydown(event) {
    if (event.key === 'Escape') {
        closeSettingsModal();
    }
}

// Android Back Button handling (if applicable)
if (typeof document !== 'undefined') {
    document.addEventListener('backbutton', (e) => {
        if (dom.settingsModal.classList.contains('visible')) {
            e.preventDefault();
            closeSettingsModal();
        }
    });
}

// Close modal when clicking outside of it
window.addEventListener('click', (event) => {
    if (event.target === dom.settingsModal) {
        closeSettingsModal();
    }
});

export function toggleExplanationVisibility() {
    dom.explanationDisplay.classList.toggle('spoiler');
    dom.explanationDisplay.classList.toggle('revealed');
}

export function showCompletionScreen(allMastered) {
    if (!allMastered) {
        dom.completionScreen.querySelector('h2').textContent = '🎉 恭喜！今日任务已全部完成 🎉';
        dom.completionScreen.querySelector('p').textContent = '请明天再来复习吧！';
    } else {
        dom.completionScreen.querySelector('h2').textContent = '🎉 恭喜你完成了本词库的记忆 🎉';
        dom.completionScreen.querySelector('p').textContent = '所有单词都已牢牢记住！';
    }
    showScreen(dom.completionScreen);
}

export function enterReviewMode() {
    dom.forgotBtn.style.display = 'none';
    dom.hardBtn.style.display = 'none';
    dom.easyBtn.style.display = 'none';
    dom.nextWordInHistoryBtn.style.display = 'block';
}

export function exitReviewMode() {
    dom.forgotBtn.style.display = 'inline-block';
    dom.hardBtn.style.display = 'inline-block';
    dom.easyBtn.style.display = 'inline-block';
    dom.nextWordInHistoryBtn.style.display = 'none';
    dom.forgotBtn.disabled = false;
    dom.hardBtn.disabled = false;
    dom.easyBtn.disabled = false;
}

window.showImportMessage = showImportMessage;

export function openStatsModal(statsData) {
    if (dom.statsModal && dom.statsModalBody) {
        dom.statsModalBody.innerHTML = ''; // 清空旧内容

        statsData.forEach(categoryData => {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'stats-category';

            const categoryTitle = document.createElement('h3');
            categoryTitle.textContent = categoryData.category;
            categoryDiv.appendChild(categoryTitle);

            const statsList = document.createElement('ul');
            statsList.className = 'stats-list';

            categoryData.stats.forEach(stat => {
                const listItem = document.createElement('li');
                listItem.className = 'stats-item';
                listItem.innerHTML = `<span class="stats-label">${stat.label}:</span> <span class="stats-value">${stat.value}</span>`;
                statsList.appendChild(listItem);
            });

            categoryDiv.appendChild(statsList);
            dom.statsModalBody.appendChild(categoryDiv);
        });

        dom.statsModal.classList.add('visible');
    }
}

export function closeStatsModal() {
    if (dom.statsModal) {
        dom.statsModal.classList.remove('visible');
    }
}

export async function initSettingsUI() {
    // 初始化学习模式
    const savedMode = await getSetting(STORAGE_KEYS.STUDY_MODE, 'zh-ar');
    const modeRadioButton = document.querySelector(`input[name="mode"][value="${savedMode}"]`);
    if (modeRadioButton) {
        modeRadioButton.checked = true;
    }

    // 初始化主动回忆设置
    const recallEnabled = await getSetting(STORAGE_KEYS.RECALL_MODE, false);
    if (dom.recallSetting) {
        dom.recallSetting.checked = recallEnabled;
    }

    // 初始化规律学习设置
    const dailyReviewWords = await getSetting(STORAGE_KEYS.DAILY_REVIEW_WORDS, 30);
    if (dom.dailyReviewWordsInput) {
        dom.dailyReviewWordsInput.value = dailyReviewWords;
    }

    const dailyNewWords = await getSetting(STORAGE_KEYS.DAILY_NEW_WORDS, 10);
    if (dom.dailyNewWordsInput) {
        dom.dailyNewWordsInput.value = dailyNewWords;
    }

    // 初始化夜间模式设置
    const nightModeEnabled = await getSetting(STORAGE_KEYS.NIGHT_MODE, false);
    if (dom.nightModeToggle) {
        dom.nightModeToggle.checked = nightModeEnabled;
    }
    toggleNightMode(nightModeEnabled);
}

export function setupSettingsListeners() {
    // 学习模式切换
    dom.modeRadioButtons.forEach(radio => {
        radio.addEventListener('change', (e) => {
            saveSetting(STORAGE_KEYS.STUDY_MODE, e.target.value);
        });
    });

    // 主动回忆设置切换
    if (dom.recallSetting) {
        dom.recallSetting.addEventListener('change', (e) => {
            saveSetting(STORAGE_KEYS.RECALL_MODE, e.target.checked);
        });
    }

    // 规律学习设置切换
    if (dom.dailyReviewWordsInput) {
        dom.dailyReviewWordsInput.addEventListener('change', (e) => {
            saveSetting(STORAGE_KEYS.DAILY_REVIEW_WORDS, parseInt(e.target.value));
        });
    }

    if (dom.dailyNewWordsInput) {
        dom.dailyNewWordsInput.addEventListener('change', (e) => {
            saveSetting(STORAGE_KEYS.DAILY_NEW_WORDS, parseInt(e.target.value));
        });
    }

    // 夜间模式设置切换
    if (dom.nightModeToggle) {
        dom.nightModeToggle.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            saveSetting(STORAGE_KEYS.NIGHT_MODE, enabled);
            toggleNightMode(enabled);
        });
    }
}

export function toggleNightMode(enabled) {
    if (enabled) {
        document.body.classList.add('night-mode');
    } else {
        document.body.classList.remove('night-mode');
    }
}

export function showRecallOverlay(duration = 5) {
    if (!dom.recallOverlay || !dom.timerCountdown) {
        return;
    }

    dom.recallOverlay.style.display = 'flex';
    const countdownElement = dom.timerCountdown;
    const progressCircle = dom.recallOverlay.querySelector('.timer-progress');
    let countdown = duration;

    progressCircle.style.animation = 'none';
    // Trigger reflow
    progressCircle.getBoundingClientRect();
    progressCircle.style.animation = `countdown ${duration}s linear forwards`;


    const updateTimer = () => {
        countdownElement.textContent = countdown;
    };

    updateTimer();
    const interval = setInterval(() => {
        countdown--;
        updateTimer();
        if (countdown < 0) {
            clearInterval(interval);
            dom.recallOverlay.style.display = 'none';
        }
    }, 1000);
}
