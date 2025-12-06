/**
 * @fileoverview The main application class (refactored).
 * This class orchestrates the entire application lifecycle, focusing on:
 * - Initializing all modules (services, controllers, components).
 * - Handling high-level UI flow and page switching.
 * - Kicking off use cases (e.g., starting study sessions).
 * - Wiring everything together via dependency injection and an event bus.
 */

// Infrastructure & Services
import { DatabaseManager } from '../infrastructure/DatabaseManager.js';
import { StorageService } from '../infrastructure/StorageService.js';
import { TTSManager } from '../infrastructure/TTSManager.js';
import { ErrorHandler } from '../infrastructure/ErrorHandler.js';
import { EventBus } from '../infrastructure/EventBus.js';
import { StatsService } from '../services/StatsService.js';

// Repositories
import { VocabularyRepository } from '../repositories/VocabularyRepository.js';
import { MistakeRepository } from '../repositories/MistakeRepository.js';

// Core Logic & Models
import { Word } from '../core/Word.js';
import { SessionManager } from '../core/SessionManager.js';

// Use Cases
import { StartRegularStudySessionUseCase } from '../use-cases/StartRegularStudySession.js';
import { StartStudySession } from '../use-cases/StartStudySession.js';

// UI Controllers & Components
import { DeckList } from '../components/DeckList.js';
import { StudyCard } from '../components/StudyCard.js';
import { ProgressBar } from '../components/ProgressBar.js';
import { ImportController } from '../ui/import-controller.js';
import { UpdateController } from '../ui/update-controller.js';
import { DeckManageController } from '../ui/deck-manage-controller.js';
import * as dom from '../ui/dom-elements.js';
import * as modals from '../ui/modal-manager.js';
import { showNotification } from '../ui/notifications.js';
import * as screenManager from '../ui/screen-manager.js';
import * as settingsController from '../ui/settings-controller.js';
import * as cardController from '../ui/card-controller.js';

import { STORAGE_KEYS } from '../common/constants.js';

export class App {
    constructor() {
        // --- State ---
        this.vocabularyWords = [];
        this.currentModeRef = { value: 'zh-ar' };

        // --- Services & Infrastructure ---
        this.eventBus = new EventBus();
        this.errorHandler = new ErrorHandler();
        this.dbManager = new DatabaseManager();
        this.storageService = new StorageService(this.dbManager);
        this.statsService = new StatsService(this.storageService);
        this.ttsManager = new TTSManager(this.storageService);
        
        // --- Repositories ---
        this.vocabularyRepository = new VocabularyRepository(this.dbManager);
        this.mistakeRepository = new MistakeRepository(this.storageService);

        // --- UI Components & Controllers ---
        this.studyCardComponent = new StudyCard(dom.cardContainer, this.eventBus);
        this.progressBarComponent = new ProgressBar(dom.progressContainer);
        this.deckListComponent = new DeckList(dom.deckSelectionContainer, this.eventBus);
        this.deckManageController = new DeckManageController(this.vocabularyRepository, this.mistakeRepository);
        
        // --- Core Logic ---
        this.sessionManager = new SessionManager({
            storageService: this.storageService,
            statsService: this.statsService,
            ttsManager: this.ttsManager,
            studyCardComponent: this.studyCardComponent,
            progressBarComponent: this.progressBarComponent,
            eventBus: this.eventBus,
            errorHandler: this.errorHandler,
            mistakeRepository: this.mistakeRepository,
        });

        // --- Use Cases ---
        this.startStudySessionUseCase = new StartStudySession(this.dbManager, this.storageService, this.statsService, this.errorHandler);
        this.regularStudyUseCase = new StartRegularStudySessionUseCase({
            storageService: this.storageService,
            dbManager: this.dbManager,
            statsService: this.statsService,
            vocabularyWords: this.vocabularyWords,
            startSessionCallback: this._startSessionFromPrecomputedQueue.bind(this),
        });

        this.importController = new ImportController({
            vocabularyWords: this.vocabularyWords,
            renderDeckSelection: this._renderDeckSelection.bind(this),
            vocabularyRepository: this.vocabularyRepository,
        });
        this.updateController = new UpdateController(window.Android?.getAppVersion() || "1.0.1");
    }

    /**
     * Main entry point to initialize and start the application.
     */
    async init() {
        console.log('Application starting...');
        if (dom.skeletonLoader) dom.skeletonLoader.style.display = 'block';

        try {
            await this.storageService.initialize();
            
            // Use the repository to get full Word objects
            const loadedWords = await this.vocabularyRepository.getAll();
            
            await Promise.all([
                //this.dbManager.loadDecks(), // No longer needed
                this.statsService.load(),
                this.ttsManager.initialize(),
                this.regularStudyUseCase.initialize(),
            ]);

            this.vocabularyWords.push(...loadedWords); // Already Word instances
            
            this.currentModeRef.value = await this.storageService.getSetting(STORAGE_KEYS.STUDY_MODE, 'zh-ar');

            this._setupEventListeners();
            this.importController.initialize();
            this.updateController.initialize();
            
            // Pass dependencies to settings controller
            await settingsController.initSettingsUI(this.storageService, this.ttsManager);
            settingsController.setupSettingsListeners({ 
                onStudyPlanChange: this._updateStudyPlanDisplay.bind(this) 
            });

            // Initialize Card Controller
            cardController.initCardController(this.storageService);

            console.log('Application loaded. Determining start screen...');
            
            const defaultPlan = await this.storageService.getSetting(STORAGE_KEYS.DEFAULT_STUDY_PLAN);
            await this._updateStudyPlanDisplay();

            if (defaultPlan) {
                await this.regularStudyUseCase.execute({ scopes: [defaultPlan] });
            } else {
                this._showManualDeckSelection();
            }

        } catch (error) {
            this.errorHandler.devError(error, 'Application initialization failed');
            
            const detailedErrorMessage = `Error: ${error.message}\n\nStack: ${error.stack}`;

            // Show custom error modal instead of alert
            const errorModal = document.getElementById('error-modal');
            const errorTextElement = document.getElementById('error-modal-text');
            const copyBtn = document.getElementById('copy-error-btn');

            if (errorModal && errorTextElement && copyBtn) {
                errorTextElement.textContent = detailedErrorMessage;
                
                copyBtn.onclick = () => {
                    navigator.clipboard.writeText(detailedErrorMessage).then(() => {
                        copyBtn.textContent = '已复制!';
                        setTimeout(() => { copyBtn.textContent = '复制错误信息'; }, 2000);
                    }).catch(err => {
                        copyBtn.textContent = '复制失败';
                        console.error('Failed to copy error text: ', err);
                    });
                };
                
                // Make the modal visible
                errorModal.style.display = 'block';

            } else {
                // Fallback to alert if modal elements are not found for some reason
                alert(detailedErrorMessage);
            }
            
            this.errorHandler.userError('应用启动失败，请刷新页面或联系开发者。');
        } finally {
             if (dom.skeletonLoader) dom.skeletonLoader.style.display = 'none';
        }
    }

    /**
     * Sets up all global event listeners for the application.
     */
    _setupEventListeners() {
        console.log('[DEBUG] Entering _setupEventListeners...');

        // --- Event Bus Listeners (from SessionManager and other components) ---
        console.log('[DEBUG] Setting up Event Bus listeners...');
        this.eventBus.on('deckSelected', (deckName) => this._startSession(deckName, false));
        this.eventBus.on('sessionStarted', () => {
            this._switchToPage('study-page');
            screenManager.showScreen(dom.cardContainer);
        });
        this.eventBus.on('sessionStopped', () => {
             this._renderDeckSelection();
             this._switchToPage('decks-page');
        });
        this.eventBus.on('sessionCompleted', ({ allMastered }) => {
            cardController.showCompletionScreen(allMastered);
        });
        this.eventBus.on('historyStateChanged', ({ canGoBack }) => {
            dom.prevBtn.disabled = !canGoBack;
        });
        this.eventBus.on('reviewModeChanged', ({ isReviewing }) => {
            if (isReviewing) cardController.enterReviewMode();
            else cardController.exitReviewMode();
        });
        this.eventBus.on('wordShown', (word) => {
            cardController.setCurrentWord(word.arabic);
        });

        // Mistake Notebook Events
        this.eventBus.on('mistakeSessionStart', () => this._startMistakeSession());
        this.eventBus.on('manageDeck', (deckName) => this.deckManageController.open(deckName, this.vocabularyWords));

        console.log('[DEBUG] Event Bus listeners setup complete.');

        // --- DOM Event Listeners (for UI outside of components) ---
        console.log('[DEBUG] Setting up main DOM event listeners...');
        dom.navButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const targetPage = button.getAttribute('data-page');
                if (targetPage === 'decks-page') this._renderDeckSelection();
                this._switchToPage(targetPage);
            });
        });

        dom.backToMenuBtn.addEventListener('click', () => this._goBackToMenu());
        dom.finishBackToMenuBtn.addEventListener('click', () => this._goBackToMenu());
        dom.prevBtn.addEventListener('click', () => this.sessionManager.showPreviousWord());
        dom.nextWordInHistoryBtn.addEventListener('click', () => this.sessionManager.showNextWord());

        dom.regularStudyBtn.addEventListener('click', () => this._populateAndShowStudyScopeModal());
        dom.switchStudyPlanBtn.addEventListener('click', () => this._populateAndShowStudyPlanModal());
        
        // Fix: Added missing listener for the main import button
        if (dom.importBtn) {
            dom.importBtn.addEventListener('click', () => dom.fileInput.click());
        }

        console.log('[DEBUG] Main DOM listeners setup complete.');
        console.log('[DEBUG] Setting up data management listeners...');

        // Data management buttons
        dom.viewStatsBtn.addEventListener('click', () => this._showStats());
        dom.exportBackupBtn.addEventListener('click', () => this._exportData());
        dom.importBackupBtn.addEventListener('click', () => this.importController.triggerLocalFileImport());

        console.log('[DEBUG] Data management listeners setup complete.');
        console.log('[DEBUG] Setting up modal listeners...');

        // Modals
        dom.statsModalCloseBtn.addEventListener('click', () => modals.closeStatsModal());
        dom.openClearDataModalBtn.addEventListener('click', () => modals.openClearDataModal());
        document.querySelector('#clear-data-modal .close-button').addEventListener('click', () => modals.closeClearDataModal());
        dom.executeClearDataBtn.addEventListener('click', () => this._clearData());
        
        // Study Plan Modal
        dom.confirmStudyPlanBtn?.addEventListener('click', () => this._confirmStudyPlan());
        dom.cancelStudyPlanBtn?.addEventListener('click', () => dom.studyPlanModal.style.display = 'none');
        dom.studyPlanModal?.querySelector('.close-button')?.addEventListener('click', () => dom.studyPlanModal.style.display = 'none');
        
        // Study Scope Modal
        const scopeModal = dom.regularStudyScopeModal;
        scopeModal?.querySelector('.close-button')?.addEventListener('click', () => scopeModal.style.display = 'none');
        scopeModal?.querySelectorAll('.tab-btn').forEach(tab => {
            tab.addEventListener('click', () => this._switchStudyScopeTab(tab.dataset.tab));
        });
        scopeModal?.querySelector('#regular-study-start-btn')?.addEventListener('click', () => this._startRegularStudyFromModal());
        
        console.log('[DEBUG] All modal listeners setup complete.');
        console.log('[DEBUG] Exiting _setupEventListeners.');
    }

    // --- Page & Screen Management ---

    _switchToPage(pageId) {
        document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
        document.getElementById(pageId)?.classList.add('active');
        dom.navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.page === pageId));
    }

    // --- Core Session Logic (now orchestrated via SessionManager) ---

    async _startSession(deckName, enableFsrs = false, options = {}) {
        const result = await this.startStudySessionUseCase.execute(deckName, enableFsrs, options, this.vocabularyWords);
        if (!result) return;

        const { sessionQueue, fullWordList, savedSession, isFsrsSession, deckName: finalDeckName } = result;

        if (sessionQueue.length === 0 && fullWordList.length === 0) {
            showNotification('此词库中没有单词！', false);
            return;
        }

        const start = (sessionToStartWith) => {
            this.sessionManager.start({
                sessionQueue: sessionToStartWith,
                fullWordList: fullWordList,
                savedSession: null, // This is handled inside start() now
                isFsrsSession: enableFsrs, // Fix: Changed isFsrs to enableFsrs
                deckName: finalDeckName,
                studyMode: this.currentModeRef.value
            });
        };

        const startFromSaved = (saved) => {
             this.sessionManager.start({
                sessionQueue: [], // Will be loaded from saved state
                fullWordList: fullWordList,
                savedSession: saved,
                isFsrsSession: enableFsrs, // Fix: Changed isFsrs to enableFsrs
                deckName: finalDeckName,
                studyMode: this.currentModeRef.value
            });
        }

        if (savedSession) {
            modals.openContinueSessionModal(
                () => startFromSaved(savedSession), // onConfirm
                () => start(sessionQueue)           // onDecline
            );
        } else {
            start(sessionQueue);
        }
    }
    
    async _startSessionFromPrecomputedQueue(deckName, enableFsrs, options) {
        await this._startSession(deckName, enableFsrs, options);
    }
    
    async _goBackToMenu() {
        if (this.sessionManager.isSessionActive) {
            if (!confirm('您确定要退出当前的学习会话吗？进度将会保存。')) return;
            await this.sessionManager.stop();
        } else {
            // If no session is active, just go to the decks page
            this._renderDeckSelection();
            this._switchToPage('decks-page');
        }
    }

    // --- UI Rendering & Helpers ---

    async _renderDeckSelection() {
        const collections = this.vocabularyWords.reduce((acc, word) => {
            word.definitions.forEach(def => {
                const [collectionName, deckName] = def.sourceDeck.split('//');
                if (!acc[collectionName]) acc[collectionName] = { subDecks: {}, words: new Set() };
                if (!acc[collectionName].subDecks[deckName]) acc[collectionName].subDecks[deckName] = new Set();
                acc[collectionName].subDecks[deckName].add(word);
                acc[collectionName].words.add(word);
            });
            return acc;
        }, {});

        for (const name in collections) {
            const coll = collections[name];
            coll.wordCount = coll.words.size;
            delete coll.words;
            for (const deckName in coll.subDecks) {
                coll.subDecks[deckName] = { wordCount: coll.subDecks[deckName].size };
            }
        }

        // Load Mistake Notebook Stats
        const mistakeCount = await this.mistakeRepository.getCount();
        const mistakeData = { count: mistakeCount };

        this.deckListComponent.render(collections, mistakeData);
        screenManager.showScreen(dom.startScreen);
    }

    async _updateStudyPlanDisplay() {
        const plan = await this.storageService.getSetting(STORAGE_KEYS.DEFAULT_STUDY_PLAN);
        if (!plan || !dom.studyPlanDisplay) {
            if(dom.studyPlanDisplay) dom.studyPlanDisplay.innerHTML = '未设置默认学习计划。';
            return;
        }

        const dailyNewWords = await this.storageService.getSetting(STORAGE_KEYS.DAILY_NEW_WORDS, 10);
        let wordList = [];
        if (plan.type === 'global') wordList = this.vocabularyWords;
        else if (plan.type === 'collection') wordList = this.vocabularyWords.filter(w => w.definitions.some(d => d.sourceDeck.startsWith(plan.name + '//')));
        else if (plan.type === 'deck') wordList = this.vocabularyWords.filter(w => w.definitions.some(d => d.sourceDeck === plan.name));
        
        const newWordCount = wordList.filter(w => !w.progress || w.progress.stage === 0).length;
        let message = `当前计划: ${plan.name}`;
        if (newWordCount === 0) {
            message += ' (已完成)';
        } else if (dailyNewWords > 0) {
            const days = Math.ceil(newWordCount / dailyNewWords);
            const finishDate = new Date();
            finishDate.setDate(finishDate.getDate() + days);
            message += ` (预计 ${finishDate.toISOString().split('T')[0]} 完成)`;
        }
        dom.studyPlanDisplay.innerHTML = message;
    }

    _showManualDeckSelection() {
        this._renderDeckSelection();
        this._switchToPage('decks-page');
    }

    // --- Modal & Data Management Logic ---
    _populateAndShowStudyScopeModal() {
        const collections = this.regularStudyUseCase.getCollectionsAndDecks();
        const container = dom.regularStudyScopeModal;
        const collectionList = container.querySelector('#collection-options-list');
        const deckList = container.querySelector('#deck-options-list');
        collectionList.innerHTML = '';
        deckList.innerHTML = '';

        const createCheckbox = (text, type, name) => {
            const label = document.createElement('label');
            label.className = 'study-scope-option';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.dataset.scopeType = type;
            if (name) checkbox.dataset.scopeName = name;
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(` ${text}`));
            return label;
        };

        for (const name of collections.keys()) {
            collectionList.appendChild(createCheckbox(name, 'collection', name));
        }
        for (const [collName, decks] of collections.entries()) {
            const group = document.createElement('div');
            group.className = 'study-scope-collection-group';
            const title = document.createElement('h4');
            title.textContent = collName;
            group.appendChild(title);
            const list = document.createElement('div');
            list.className = 'study-scope-deck-list';
            for (const deckName of decks) {
                list.appendChild(createCheckbox(deckName, 'deck', `${collName}//${deckName}`));
            }
            group.appendChild(list);
            deckList.appendChild(group);
        }
        this._switchStudyScopeTab('global');
        container.style.display = 'block';
    }

    async _startRegularStudyFromModal() {
        const scopeModal = dom.regularStudyScopeModal;
        const activeTab = scopeModal.querySelector('.tab-btn.active').dataset.tab;
        let selectedScopes = [];
        if (activeTab === 'global') {
            selectedScopes.push({ type: 'global' });
        } else {
            const selector = activeTab === 'collection' ? '#collection-options-list' : '#deck-options-list';
            scopeModal.querySelectorAll(`${selector} input:checked`).forEach(cb => {
                selectedScopes.push({ type: cb.dataset.scopeType, name: cb.dataset.scopeName });
            });
        }
        if (activeTab !== 'global' && selectedScopes.length === 0) {
            showNotification('请至少选择一个学习范围。', false);
            return;
        }
        scopeModal.style.display = 'none';
        const success = await this.regularStudyUseCase.execute({ scopes: selectedScopes });
        if (!success) {
            showNotification('太棒了，所选范围内今天没有需要复习或学习的单词！', true);
        }
    }

    async _startMistakeSession() {
        const mistakeWords = await this.mistakeRepository.getAllWords();
        if (mistakeWords.length === 0) {
            showNotification('错题本为空！', false);
            return;
        }

        const fullWords = await this.vocabularyRepository.getWordsByArabic(mistakeWords);

        if (fullWords.length === 0) {
            showNotification('无法加载错题单词（可能已被删除）。', false);
            return;
        }

        // Mistake notebook is purely for practice, so no FSRS updates (Option A)
        // Enable FSRS? User said "Option A (Cram Mode): ...does *not* affect FSRS progress"
        // So enableFsrs = false.

        // We shuffle the queue
        const sessionQueue = fullWords.sort(() => Math.random() - 0.5);

        this.sessionManager.start({
            sessionQueue: sessionQueue,
            fullWordList: fullWords,
            savedSession: null,
            isFsrsSession: false, // Explicitly false
            deckName: 'mistake-notebook', // Special deck name
            studyMode: this.currentModeRef.value
        });
    }

    _populateAndShowStudyPlanModal() {
        const collections = this.regularStudyUseCase.getCollectionsAndDecks();
        const container = dom.studyPlanOptionsContainer;
        container.innerHTML = ''; // Clear previous options
        
        const createRadio = (text, type, name) => {
            const label = document.createElement('label');
            label.className = 'study-plan-option';
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'study-plan';
            radio.value = JSON.stringify({ type, name });
            label.appendChild(radio);
            label.appendChild(document.createTextNode(` ${text}`));
            return label;
        };
        
        container.appendChild(createRadio('全局学习 (所有词库)', 'global', 'global'));

        for (const [collName, decks] of collections.entries()) {
            const group = document.createElement('div');
            group.className = 'study-plan-collection-group';
            group.appendChild(createRadio(collName, 'collection', collName));
            const list = document.createElement('div');
            list.className = 'study-plan-deck-list';
            for (const deckName of decks) {
                list.appendChild(createRadio(deckName, 'deck', `${collName}//${deckName}`));
            }
            group.appendChild(list);
            container.appendChild(group);
        }
        dom.studyPlanModal.style.display = 'block';
    }

    async _confirmStudyPlan() {
        const selected = document.querySelector('input[name="study-plan"]:checked');
        if (selected) {
            const plan = JSON.parse(selected.value);
            await this.storageService.saveSetting(STORAGE_KEYS.DEFAULT_STUDY_PLAN, plan);
            await this._updateStudyPlanDisplay();
            dom.studyPlanModal.style.display = 'none';
            showNotification('默认学习计划已更新！', true);
        } else {
            showNotification('请选择一个学习计划。', false);
        }
    }

    _switchStudyScopeTab(tabId) {
        const modal = dom.regularStudyScopeModal;
        modal.querySelectorAll('.tab-btn').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabId));
        modal.querySelectorAll('.tab-content').forEach(content => content.classList.toggle('active', content.id === `tab-${tabId}`));
    }

    async _showStats() {
        const summary = this.statsService.getSummary(this.vocabularyWords);
        modals.renderStats(summary);
        modals.openStatsModal();
    }

async _exportData() {
        try {
            const data = await this.storageService.exportAllData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Arabic_Learning_Backup_${new Date().toLocaleDateString().replace(/\//g, '-')}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showNotification('数据导出成功！', true);
        } catch (error) {
            this.errorHandler.devError(error, 'Data export failed');
            showNotification('数据导出失败。', false);
        }
    }

    async _clearData() {
        const options = {
            decks: document.querySelector('input[name="clear-option"][value="decks"]').checked,
            progress: document.querySelector('input[name="clear-option"][value="progress"]').checked,
            sessions: document.querySelector('input[name="clear-option"][value="sessions"]').checked,
            stats: document.querySelector('input[name="clear-option"][value="stats"]').checked,
            settings: document.querySelector('input[name="clear-option"][value="settings"]').checked,
        };

        if (Object.values(options).every(v => !v)) {
            showNotification('请至少选择一个要清除的选项', false);
            return;
        }

        if (confirm('此操作不可逆，确定要清除所选数据吗？')) {
            await this.storageService.clearDataGranularly(options);
            if (options.decks) this.vocabularyWords.length = 0;
            
            if (options.stats) {
                const wordsToUpdate = await this.statsService.reset(this.vocabularyWords);
                if (wordsToUpdate.length > 0) {
                    await this.storageService.saveProgress(null, wordsToUpdate);
                }
            }

            modals.closeClearDataModal();
            showNotification('所选数据已清除！', true);
            if (options.decks) this._renderDeckSelection();
            if (options.settings) await settingsController.initSettingsUI(this.storageService, this.ttsManager);
        }
    }
}
