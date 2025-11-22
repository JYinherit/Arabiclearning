/**
 * @fileoverview StudyCard component, encapsulates all UI and interaction logic for the study card.
 *
 * This component is responsible for rendering words, handling user interactions
 * (like showing answers, toggling definitions, rating), and notifying the outside
 * world of the user's rating action via callbacks.
 */

import { RATING } from '../core/ReviewScheduler.js'; // Note: This should be from ReviewScheduler, not FSRS directly.

export class StudyCard {
    /**
     * @param {HTMLElement} container - The root DOM element for the card component.
     * @param {import('../infrastructure/EventBus.js').EventBus} eventBus - The event bus instance for decoupled communication.
     */
    constructor(container, eventBus) {
        if (!container) {
            throw new Error('StudyCard component requires a valid container element.');
        }
        this.container = container;
        this.eventBus = eventBus;
        this.word = null;
        this.currentMode = 'zh-ar';

        // Find all necessary DOM elements within the container using correct ID selectors
        this.dom = {
            wordDisplayWrapper: this.container.querySelector('#word-display-wrapper'),
            wordDisplay: this.container.querySelector('#word-display'),
            answerDisplay: this.container.querySelector('#answer-display'),
            explanationDisplay: this.container.querySelector('#explanation-display'),
            definitionToggleContainer: this.container.querySelector('#definition-toggle-container'),
            ttsPlayBtn: this.container.querySelector('#tts-play-btn'),
            ttsExplanationPlayBtn: this.container.querySelector('#tts-explanation-play-btn'),
            forgotBtn: this.container.querySelector('#forgot-btn'),
            hardBtn: this.container.querySelector('#hard-btn'),
            easyBtn: this.container.querySelector('#easy-btn'),
        };

        this._bindEventListeners();
    }

    /**
     * Renders a new word onto the card.
     * @param {import('../core/Word.js').Word} word - The word object to display.
     * @param {string} mode - The current study mode ('ar-zh', 'zh-ar', 'mixed').
     */
    render(word, mode) {
        this.word = word;
        this.currentMode = mode;

        if (!this.word || !this.word.definitions?.[0]) {
            console.error('Cannot display card: invalid word object.', this.word);
            this.container.style.display = 'none';
            return;
        }
        
        this.container.style.display = 'block';
        this._setupDefinitionToggles();
        this._updateView(0); // Display the first definition by default

        // Notify that a new word is being shown
        this.eventBus.emit('wordShown', this.word);
    }

    /**
     * Binds all internal event listeners.
     * @private
     */
    _bindEventListeners() {
        this.dom.answerDisplay?.addEventListener('click', () => this._toggleVisibility(this.dom.answerDisplay));
        this.dom.explanationDisplay?.addEventListener('click', () => this._toggleVisibility(this.dom.explanationDisplay));
        
        this.dom.definitionToggleContainer?.addEventListener('click', this._handleDefinitionToggle.bind(this));
        
        // Note: TTS button clicks are handled by SessionManager/TTSManager now,
        // but we can keep them here if direct interaction is needed.
        // For now, we assume App/SessionManager handles the main TTS button.
        // Let's re-add the explanation TTS logic here as it's self-contained.
        if (this.dom.ttsExplanationPlayBtn) {
            this.dom.ttsExplanationPlayBtn.onclick = () => {
                const explanationText = this.dom.explanationDisplay?.textContent;
                if (explanationText && this.word?.arabic) { // Ensure ttsManager is available
                    // This is tricky without direct access to ttsManager.
                    // The best way is to emit an event.
                    this.eventBus.emit('playExplanationTTS', { text: explanationText });
                }
            };
        }
         if (this.dom.ttsPlayBtn) {
            this.dom.ttsPlayBtn.onclick = () => {
                if (this.word) this.eventBus.emit('playWordTTS', { word: this.word });
            };
        }

        this.dom.forgotBtn?.addEventListener('click', () => this._handleRating(RATING.FORGOT));
        this.dom.hardBtn?.addEventListener('click', () => this._handleRating(RATING.HARD));
        this.dom.easyBtn?.addEventListener('click', () => this._handleRating(RATING.EASY));
    }

    /**
     * Sets up the toggle buttons based on the number of definitions the word has.
     * @private
     */
    _setupDefinitionToggles() {
        const toggleContainer = this.dom.definitionToggleContainer;
        if (!toggleContainer) return;

        toggleContainer.innerHTML = '';
        if (this.word.definitions.length > 1) {
            this.word.definitions.forEach((_, index) => {
                const button = document.createElement('button');
                button.className = 'definition-toggle-btn';
                button.textContent = `\u4e49\u9879 ${index + 1}`;
                button.dataset.index = index;
                toggleContainer.appendChild(button);
            });
            toggleContainer.firstChild?.classList.add('active');
        }
    }

    /**
     * Updates the card view to show a specific definition.
     * @param {number} definitionIndex - The index of the definition to display.
     * @private
     */
    _updateView(definitionIndex) {
        const definition = this.word.definitions[definitionIndex];
        if (!definition) return;

        const { wordDisplay, answerDisplay, explanationDisplay, wordDisplayWrapper } = this.dom;
        if (!wordDisplay || !answerDisplay || !explanationDisplay) return; // Safety check

        let isArZh;
        if (this.currentMode === 'mixed') {
            isArZh = Math.random() < 0.5;
        } else {
            isArZh = this.currentMode === 'ar-zh';
        }

        wordDisplay.innerHTML = (isArZh ? this.word.arabic : definition.chinese).replace(/\n/g, '<br>');
        answerDisplay.innerHTML = (isArZh ? definition.chinese : this.word.arabic).replace(/\n/g, '<br>');
        
        if (wordDisplayWrapper) wordDisplayWrapper.dir = isArZh ? 'rtl' : 'ltr';
        wordDisplay.dir = isArZh ? 'rtl' : 'ltr';
        answerDisplay.dir = isArZh ? 'ltr' : 'rtl';
        
        explanationDisplay.innerHTML = `💡 \u89e3\u91ca: ${definition.explanation.replace(/\n/g, '<br>')}`;

        // Reset spoiler state
        answerDisplay.classList.replace('revealed', 'spoiler');
        explanationDisplay.classList.replace('revealed', 'spoiler');
    }

    /**
     * Handles clicks on the definition toggle buttons.
     * @param {MouseEvent} e - The click event object.
     * @private
     */
    _handleDefinitionToggle(e) {
        const button = e.target.closest('.definition-toggle-btn');
        if (!button) return;

        const index = parseInt(button.dataset.index, 10);
        if (this.word && this.word.definitions[index]) {
            this._updateView(index);
            this.dom.definitionToggleContainer.querySelector('.active')?.classList.remove('active');
            button.classList.add('active');
        }
    }

    /**
     * Toggles an element's visibility (spoiler/revealed).
     * @param {HTMLElement} element - The element to toggle.
     * @private
     */
    _toggleVisibility(element) {
        if (!element) return;
        element.classList.toggle('spoiler');
        element.classList.toggle('revealed');
    }

    /**
     * Handles a rating button click.
     * @param {number} rating - The rating chosen by the user.
     * @private
     */
    _handleRating(rating) {
        if (this.eventBus && this.word) {
            this.eventBus.emit('wordRated', { word: this.word, rating: rating });
        }
    }
}
