import * as dom from './dom.js';

export function showScreen(screen) {
    dom.startScreen.style.display = 'none';
    dom.cardContainer.style.display = 'none';
    dom.completionScreen.style.display = 'none';
    screen.style.display = 'block';
}

export function updateProgressBar(completed, total) {
    if (total > 0) {
        const progress = Math.round((completed / total) * 100);
        dom.progressBar.style.width = progress + '%';
        dom.progressBar.textContent = `${completed} / ${total}`;
    } else {
        // 如果没有单词，则重置进度条
        dom.progressBar.style.width = '0%';
        dom.progressBar.textContent = '0 / 0';
    }
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

// --- Random Test Modal ---

export function openRandomTestModal() {
    dom.randomTestModal.classList.add('visible');
    document.addEventListener('keydown', handleRandomTestKeydown);
}

export function closeRandomTestModal() {
    dom.randomTestModal.classList.remove('visible');
    document.removeEventListener('keydown', handleRandomTestKeydown);
}

function handleRandomTestKeydown(event) {
    if (event.key === 'Escape') {
        closeRandomTestModal();
    }
}

// Close random test modal when clicking outside of it
window.addEventListener('click', (event) => {
    if (event.target === dom.randomTestModal) {
        closeRandomTestModal();
    }
});
