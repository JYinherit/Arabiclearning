import * as dom from './dom.js';
import * as ui from './ui.js';

/**
 * 设置随机测试功能，注入必要的依赖项。
 * 
 * @param {object} dependencies 
 * @param {object} dependencies.vocabularyDecks - 词库数据对象
 * @param {function} dependencies.initialize - main.js 中的初始化函数
 * @param {object} dependencies.currentModeRef - 对 currentMode 变量的引用 ({ value: string })
 * @param {object} dependencies.currentDeckNameRef - 对 currentDeckName 变量的引用 ({ value: string })
 * @param {object} dependencies.isSessionActive - 对 isSessionActive 变量的引用 ({ value: boolean })
 * @param {Element} dependencies.cardContainer - 卡片学习容器 DOM 元素
 * @param {function} dependencies.showScreen - ui.js 中的屏幕切换函数
 * @param {function} dependencies.showNextWord - main.js 中的显示下一个词函数
 * @param {function} dependencies.incrementSessionCount - stats.js 中的会话计数函数
 */
export function setupRandomTest(dependencies) {
    const { 
        vocabularyDecks, initialize, currentModeRef, currentDeckNameRef, 
        cardContainer, showScreen, showNextWord, 
        incrementSessionCount, isSessionActive 
    } = dependencies;

    // --- Helper Functions ---

    function getRandomWords(count, selectedDecks) {
        const allWords = [];
        selectedDecks.forEach(deckName => {
            if (vocabularyDecks[deckName]) {
                allWords.push(...vocabularyDecks[deckName]);
            }
        });
        
        const actualCount = Math.min(count, allWords.length);
        const selectedWords = [];
        const usedIndices = new Set();
        
        while (selectedWords.length < actualCount && usedIndices.size < allWords.length) {
            const randomIndex = Math.floor(Math.random() * allWords.length);
            if (!usedIndices.has(randomIndex)) {
                selectedWords.push(allWords[randomIndex]);
                usedIndices.add(randomIndex);
            }
        }
        return selectedWords;
    }

    // --- Modal Logic ---

    function updateWordCountLimit() {
        const selectedDecks = Array.from(dom.randomTestDeckSelector.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => cb.value);
        
        let totalWords = 0;
        if (selectedDecks.length > 0) {
            totalWords = selectedDecks.reduce((sum, deckName) => {
                return sum + (vocabularyDecks[deckName] ? vocabularyDecks[deckName].length : 0);
            }, 0);
        }

        const maxLimit = Math.min(totalWords, 300);
        dom.randomTestWordCountInput.max = maxLimit;
        if (parseInt(dom.randomTestWordCountInput.value) > maxLimit) {
            dom.randomTestWordCountInput.value = maxLimit;
        }
        dom.randomTestMaxWordsInfo.textContent = `(最多可选 ${maxLimit} 个单词)`;
    }

    function populateDeckSelector() {
        dom.randomTestDeckSelector.innerHTML = '<p>请选择要抽取的词库范围：</p>'; // Reset
        
        Object.keys(vocabularyDecks).forEach(deckName => {
            if (vocabularyDecks[deckName].length > 0) {
                const label = document.createElement('label');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = deckName;
                checkbox.checked = true;
                
                checkbox.addEventListener('change', updateWordCountLimit);

                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(` ${deckName} (${vocabularyDecks[deckName].length}词)`));
                dom.randomTestDeckSelector.appendChild(label);
            }
        });
    }

    function openAndConfigureRandomTest() {
        if (Object.keys(vocabularyDecks).length === 0) {
            alert('请先导入至少一个词库！');
            return;
        }
        populateDeckSelector();
        updateWordCountLimit();
        ui.openRandomTestModal();
    }

    function startTestFromModal() {
        const selectedDecks = Array.from(dom.randomTestDeckSelector.querySelectorAll('input[type="checkbox"]:checked'))
            .map(cb => cb.value);

        if (selectedDecks.length === 0) {
            alert('请至少选择一个词库！');
            return;
        }

        const count = parseInt(dom.randomTestWordCountInput.value);
        if (isNaN(count) || count < 1) {
            alert('请输入有效的单词数量！');
            return;
        }

        const randomWords = getRandomWords(count, selectedDecks);
        
        if (randomWords.length === 0) {
            alert('所选词库中没有单词可供测试。');
            return;
        }

        const selectedMode = document.querySelector('input[name="mode"]:checked');
        currentModeRef.value = selectedMode ? selectedMode.value : 'zh-ar';
        
        const deckNames = selectedDecks.join('、');
        const newDeckName = `随机测试 (从${deckNames}中选${randomWords.length}词)`;
        
        // 检查是否正在学习其他词库
        if (isSessionActive.value && 
            currentDeckNameRef.value !== newDeckName) {
            const confirmSwitch = confirm(`当前正在学习词库"${currentDeckNameRef.value}"，确定要切换到"${newDeckName}"吗？当前进度将自动保存。`);
            if (!confirmSwitch) {
                return; // 用户取消切换
            }
        }
        
        currentDeckNameRef.value = newDeckName;
        
        initialize(randomWords, true); // 传入 true 启动随机测试模式
        
        ui.closeRandomTestModal();
        showScreen(cardContainer);
        showNextWord();
        
        incrementSessionCount();
    }

    // --- Event Listeners ---

    if (dom.startRandomTestBtn) {
        dom.startRandomTestBtn.addEventListener('click', openAndConfigureRandomTest);
    }
    if (dom.confirmRandomTestBtn) {
        dom.confirmRandomTestBtn.addEventListener('click', startTestFromModal);
    }
    if (dom.closeRandomTestModalBtn) {
        dom.closeRandomTestModalBtn.addEventListener('click', ui.closeRandomTestModal);
    }
    if (dom.cancelRandomTestBtn) {
        dom.cancelRandomTestBtn.addEventListener('click', ui.closeRandomTestModal);
    }

    // No methods need to be returned as the UI is self-contained now.
    return {};
}
