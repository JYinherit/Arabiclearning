import * as dom from './dom.js';

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
    
    // 确保有闪卡容器
    let flashcardContainer = document.querySelector('.flashcard');
    if (!flashcardContainer) {
        console.log('创建新的闪卡容器');
        
        // 创建闪卡容器
        flashcardContainer = document.createElement('div');
        flashcardContainer.className = 'flashcard';
        
        // 重新组织DOM结构 - 添加安全检查
        const cardContainer = dom.cardContainer;
        const progressContainer = dom.progressContainer || document.getElementById('progress-container');
        const wordDisplay = dom.wordDisplay || document.getElementById('word-display');
        const answerDisplay = dom.answerDisplay || document.getElementById('answer-display');
        const explanationDisplay = dom.explanationDisplay || document.getElementById('explanation-display');
        
        // 获取控制按钮容器 - 添加更可靠的获取方式
        let controls = dom.forgotBtn?.parentElement;
        if (!controls) {
            controls = document.querySelector('#controls');
        }
        
        let navControls = dom.prevBtn?.parentElement;
        if (!navControls) {
            navControls = document.querySelector('#nav-controls');
        }
        
        // 验证所有必需的DOM元素都存在
        if (!cardContainer || !progressContainer || !wordDisplay || !answerDisplay || !explanationDisplay || !controls || !navControls) {
            console.error('缺少必需的DOM元素:', {
                cardContainer: !!cardContainer,
                progressContainer: !!progressContainer,
                wordDisplay: !!wordDisplay,
                answerDisplay: !!answerDisplay,
                explanationDisplay: !!explanationDisplay,
                controls: !!controls,
                navControls: !!navControls
            });
            return;
        }
        
        // 清空卡片容器并重新组织结构
        cardContainer.innerHTML = '';
        
        // 安全地添加子元素
        try {
            cardContainer.appendChild(progressContainer);
            cardContainer.appendChild(flashcardContainer);
            flashcardContainer.appendChild(wordDisplay);
            flashcardContainer.appendChild(answerDisplay);
            flashcardContainer.appendChild(explanationDisplay);
            cardContainer.appendChild(controls);
            cardContainer.appendChild(navControls);
        } catch (error) {
            console.error('DOM操作失败:', error);
            // 备用方案：使用innerHTML直接设置结构
            cardContainer.innerHTML = `
                <div id="progress-container">
                    <div id="progress-bar">0%</div>
                </div>
                <div class="flashcard">
                    <h2 id="word-display"></h2>
                    <div id="answer-display" class="spoiler" title="点击显示/隐藏答案"></div>
                    <p id="explanation-display" class="spoiler"></p>
                </div>
                <div id="controls">
                    <button id="forgot-btn" class="btn"><i class="fas fa-times"></i> 忘记</button>
                    <button id="hard-btn" class="btn"><i class="fas fa-question"></i> 模糊</button> 
                    <button id="easy-btn" class="btn"><i class="fas fa-check"></i> 记得</button> 
                    <button id="next-word-in-history-btn" class="btn" style="display: none;">下一个词</button>
                </div>
                <div id="nav-controls">
                    <button id="prev-btn" class="btn">上一个词</button>
                    <button id="back-to-menu-btn" class="btn">返回</button>
                </div>
            `;
            
            // 重新获取DOM引用
            flashcardContainer = document.querySelector('.flashcard');
        }
    }

    // 设置解释文本
    const explanationElement = dom.explanationDisplay || document.getElementById('explanation-display');
    if (explanationElement) {
        explanationElement.textContent = `💡 解释: ${word.explanation}`;
    }

    let showChinese = true;

    if (currentMode === 'mixed') {
        showChinese = Math.random() < 0.5;
    } else if (currentMode === 'ar-zh') {
        showChinese = false;
    }

    // 获取显示元素
    const wordElement = dom.wordDisplay || document.getElementById('word-display');
    const answerElement = dom.answerDisplay || document.getElementById('answer-display');

    if (showChinese) {
        // 显示中文，背阿拉伯语
        if (wordElement) {
            wordElement.textContent = word.chinese;
            wordElement.style.direction = 'ltr';
            wordElement.style.fontSize = '2.2rem';
            wordElement.style.fontWeight = 'bold';
        }
        
        if (answerElement) {
            answerElement.innerHTML = word.arabic.replace(/\n/g, '<br>');
            answerElement.style.direction = 'rtl';
            answerElement.style.fontSize = '2rem';
            answerElement.style.fontWeight = '600';
        }
    } else {
        // 显示阿拉伯语，背中文
        if (wordElement) {
            wordElement.innerHTML = word.arabic.replace(/\n/g, '<br>');
            wordElement.style.direction = 'rtl';
            wordElement.style.fontSize = '2rem';
            wordElement.style.fontWeight = '600';
        }
        
        if (answerElement) {
            answerElement.textContent = word.chinese;
            answerElement.style.direction = 'ltr';
            answerElement.style.fontSize = '2.2rem';
            answerElement.style.fontWeight = 'bold';
        }
    }

    // 解释文本样式
    if (explanationElement) {
        explanationElement.style.fontSize = '1.4rem';
        explanationElement.style.color = '#e65100';
        explanationElement.style.fontWeight = '500';
    }

    // 重置遮挡状态
    if (answerElement) {
        answerElement.classList.remove('revealed');
        answerElement.classList.add('spoiler');
    }
    if (explanationElement) {
        explanationElement.classList.remove('revealed');
        explanationElement.classList.add('spoiler');
    }
    
    // 添加动画效果
    if (flashcardContainer) {
        flashcardContainer.style.animation = 'cardAppear 0.5s ease-out';
        
        // 移除动画，以便下次可以重新触发
        setTimeout(() => {
            flashcardContainer.style.animation = '';
        }, 500);
    }
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
            startSessionCallback(vocabularyDecks[deckName], deckName);
        });
        dom.deckSelectionContainer.appendChild(button);
    });
}

export function showImportMessage(message, isSuccess = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `import-message ${isSuccess ? 'import-success' : 'import-error'}`;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);

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
