/**
 * @fileoverview Controller for the Deck Management / Word Browser modal.
 * Handles listing words, searching, and toggling mistake notebook status.
 */

import * as dom from './dom-elements.js';

export class DeckManageController {
    /**
     * @param {import('../repositories/VocabularyRepository.js').VocabularyRepository} vocabularyRepository
     * @param {import('../repositories/MistakeRepository.js').MistakeRepository} mistakeRepository
     */
    constructor(vocabularyRepository, mistakeRepository) {
        this.vocabularyRepository = vocabularyRepository;
        this.mistakeRepository = mistakeRepository;
        this.currentWords = [];
        this.modal = document.getElementById('deck-manage-modal');
        this.listContainer = document.getElementById('deck-word-list');
        this.searchInput = document.getElementById('deck-manage-search-input');
        this.titleElement = document.getElementById('deck-manage-title');
        this.closeBtn = this.modal.querySelector('.close-button');

        this._bindEvents();
    }

    _bindEvents() {
        this.closeBtn.addEventListener('click', () => this.close());
        this.searchInput.addEventListener('input', (e) => this._filterWords(e.target.value));

        // Close on click outside
        window.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });
    }

    /**
     * Opens the modal for a specific deck.
     * @param {string} deckName - The name of the deck to manage.
     * @param {Array<import('../core/Word.js').Word>} allWords - All available words.
     */
    async open(deckName, allWords) {
        this.modal.style.display = 'block';
        this.titleElement.textContent = `管理词库: ${deckName.split('//').pop()}`;
        this.searchInput.value = '';

        // Filter words belonging to this deck
        this.currentWords = allWords.filter(word =>
            word.definitions.some(def => def.sourceDeck === deckName)
        );

        await this._renderList(this.currentWords);
    }

    close() {
        this.modal.style.display = 'none';
    }

    async _renderList(words) {
        this.listContainer.innerHTML = '';
        const fragment = document.createDocumentFragment();

        // Batch check mistake status for performance
        // Since MistakeRepository uses a Set cache, we can just check one by one or getAll.
        const mistakeSet = new Set(await this.mistakeRepository.getAllWords());

        words.forEach(word => {
            const item = document.createElement('div');
            item.className = 'word-item';

            const info = document.createElement('div');
            info.className = 'word-info';

            const arabic = document.createElement('span');
            arabic.className = 'word-arabic';
            arabic.textContent = word.arabic;

            const chinese = document.createElement('span');
            chinese.className = 'word-chinese';
            // Display first definition's chinese
            const def = word.definitions[0];
            chinese.textContent = def ? def.chinese : '无释义';

            info.appendChild(arabic);
            info.appendChild(chinese);

            const actions = document.createElement('div');
            actions.className = 'word-actions';

            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'add-mistake-btn';
            const isMistake = mistakeSet.has(word.arabic);
            this._updateButtonState(toggleBtn, isMistake);

            toggleBtn.onclick = async () => {
                const wasMistake = toggleBtn.classList.contains('added');
                if (wasMistake) {
                    await this.mistakeRepository.removeWord(word.arabic);
                    this._updateButtonState(toggleBtn, false);
                } else {
                    await this.mistakeRepository.addWord(word.arabic);
                    this._updateButtonState(toggleBtn, true);
                }
            };

            actions.appendChild(toggleBtn);
            item.appendChild(info);
            item.appendChild(actions);
            fragment.appendChild(item);
        });

        this.listContainer.appendChild(fragment);
    }

    _updateButtonState(btn, isAdded) {
        if (isAdded) {
            btn.classList.add('added');
            btn.textContent = '❤️ 已在错题本';
            btn.title = '从错题本移除';
        } else {
            btn.classList.remove('added');
            btn.textContent = '🤍 加入错题本';
            btn.title = '加入错题本';
        }
    }

    _filterWords(query) {
        if (!query) {
            this._renderList(this.currentWords);
            return;
        }
        const lowerQuery = query.toLowerCase();
        const filtered = this.currentWords.filter(w =>
            w.arabic.includes(query) ||
            w.definitions.some(d => d.chinese.includes(query))
        );
        this._renderList(filtered);
    }
}
