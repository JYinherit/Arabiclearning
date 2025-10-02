import * as dom from './dom.js';

export function showScreen(screen) {
    dom.startScreen.style.display = 'none';
    dom.cardContainer.style.display = 'none';
    dom.completionScreen.style.display = 'none';
    screen.style.display = 'block';
}

export function updateProgressBar(activeWords) {
    if (!activeWords || activeWords.length === 0) return;
    const learnedCount = activeWords.filter(w => (w.stage || 0) >= 1).length;
    const progress = Math.round((learnedCount / activeWords.length) * 100);
    dom.progressBar.style.width = progress + '%';
    dom.progressBar.textContent = progress + '%';
}

export function displayCard(word, currentMode) {
    dom.explanationDisplay.textContent = `💡 解释: ${word.explanation}`;

    let showChinese = true;

    if (currentMode === 'mixed') {
        showChinese = Math.random() < 0.5;
    } else if (currentMode === 'ar-zh') {
        showChinese = false;
    }

    if (showChinese) {
        dom.wordDisplay.textContent = word.chinese;
        dom.wordDisplay.style.direction = 'ltr';
        dom.answerDisplay.innerHTML = word.arabic.replace(/\n/g, '<br>');
        dom.answerDisplay.style.direction = 'rtl';
    } else {
        dom.wordDisplay.innerHTML = word.arabic.replace(/\n/g, '<br>');
        dom.wordDisplay.style.direction = 'rtl';
        dom.answerDisplay.textContent = word.chinese;
        dom.answerDisplay.style.direction = 'ltr';
    }

    dom.answerDisplay.classList.remove('revealed');
    dom.answerDisplay.classList.add('spoiler');
    dom.explanationDisplay.classList.remove('revealed');
    dom.explanationDisplay.classList.add('spoiler');
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
        button.addEventListener('click', () => startSessionCallback(vocabularyDecks[deckName], deckName));
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
    dom.rememberedBtn.style.display = 'none';
    dom.forgotBtn.style.display = 'none';
    dom.nextWordInHistoryBtn.style.display = 'block';
}

export function exitReviewMode() {
    dom.rememberedBtn.style.display = 'inline-block';
    dom.forgotBtn.style.display = 'inline-block';
    dom.nextWordInHistoryBtn.style.display = 'none';
    dom.rememberedBtn.disabled = false;
    dom.forgotBtn.disabled = false;
}

window.showImportMessage = showImportMessage;
