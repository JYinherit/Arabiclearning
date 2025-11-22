/**
 * @fileoverview Controller for the import UI.
 * Manages the online import modal, fetches and renders the list of lexicons,
 * and handles user interactions for both online and local file imports.
 */

import * as dom from './dom-elements.js';
import { showNotification } from './notifications.js';
import { ImportService } from '../services/ImportService.js';

export class ImportController {
    /**
     * @param {object} appDependencies - Dependencies from the main application.
     * @param {Array} appDependencies.vocabularyWords - A reference to the main vocabulary array.
     * @param {Function} appDependencies.renderDeckSelection - Callback to re-render the deck selection UI.
     * @param {import('../infrastructure/StorageService.js').StorageService} appDependencies.storageService - The application's storage service.
     */
    constructor({ vocabularyWords, renderDeckSelection, vocabularyRepository }) {
        this.importService = new ImportService();
        this.vocabularyWords = vocabularyWords;
        this.renderDeckSelection = renderDeckSelection;
        this.vocabularyRepository = vocabularyRepository;

        this.modal = document.getElementById('import-modal');
        this.onlineImportBtn = document.getElementById('online-import-btn');
        this.closeBtn = document.querySelector('#import-modal .close-button');
        this.localImportBtn = document.getElementById('import-local-lexicon-btn');
        this.listContainer = document.getElementById('online-lexicon-list');

        this.handleLocalFileSelect = this.handleLocalFileSelect.bind(this);
    }

    /**
     * Initializes the import controller by setting up event listeners.
     */
    initialize() {
        if (this.onlineImportBtn) {
            this.onlineImportBtn.addEventListener('click', () => this.openModal());
        }
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.closeModal());
        }
        if (this.modal) {
            window.addEventListener('click', (event) => {
                if (event.target === this.modal) {
                    this.closeModal();
                }
            });
        }
        if (this.localImportBtn && dom.fileInput) {
            this.localImportBtn.addEventListener('click', () => {
                dom.fileInput.click();
                this.closeModal();
            });
        }
        if (dom.fileInput) {
            dom.fileInput.addEventListener('change', this.handleLocalFileSelect);
        }
    }

    openModal() {
        if (this.modal) {
            this.modal.style.display = 'flex';
            this.fetchAndRenderLexicons();
        }
    }

    closeModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
        }
    }

    async fetchAndRenderLexicons() {
        if (!this.listContainer) return;
        this.listContainer.innerHTML = '<p>正在加载在线词库...</p>';

        try {
            const files = await this.importService.getOnlineLexicons();
            this.listContainer.innerHTML = '';
            if (files.length === 0) {
                this.listContainer.innerHTML = '<p>未找到在线词库文件。</p>';
                return;
            }

            files.forEach(file => {
                const item = document.createElement('div');
                item.className = 'online-lexicon-item';
                item.textContent = file.name.replace('.json', '');
                item.title = `点击导入 ${file.name}`;
                item.addEventListener('click', () => {
                    this.importOnline(file.download_url, file.name, item);
                });
                this.listContainer.appendChild(item);
            });
        } catch (error) {
            console.error('获取在线词库列表失败:', error);
            this.listContainer.innerHTML = `<p style="color: red;">加载失败: ${error.message}</p>`;
        }
    }

    async importOnline(url, fileName, itemElement) {
        itemElement.textContent = '正在导入...';
        itemElement.style.pointerEvents = 'none';

        try {
            const { newWordsCount, newDefsCount } = await this.importService.importFromUrl(url, fileName, this.vocabularyWords);
            
            if (newWordsCount > 0 || newDefsCount > 0) {
                await this.vocabularyRepository.save(this.vocabularyWords);
                this.renderDeckSelection();
                showNotification(`导入完成: 新增 ${newWordsCount} 个单词, 追加 ${newDefsCount} 个新义项。`, true);
            } else {
                showNotification('没有新增内容被导入。词库可能已存在。', false);
            }

            setTimeout(() => this.closeModal(), 500);

        } catch (error) {
            console.error(`导入在线词库 ${fileName} 失败:`, error);
            showNotification(`导入 "${fileName}" 失败: ${error.message}`, false);
            itemElement.textContent = fileName.replace('.json', '');
            itemElement.style.pointerEvents = 'auto';
        }
    }

    async handleLocalFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
        if (file.size > MAX_FILE_SIZE) {
            showNotification(`文件过大 (超过 ${MAX_FILE_SIZE / 1024 / 1024}MB)。`, false);
            if (dom.fileInput) dom.fileInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target.result;
                const { newWordsCount, newDefsCount } = this.importService.importFromFileContent(content, file.name, this.vocabularyWords);

                if (newWordsCount > 0 || newDefsCount > 0) {
                    await this.vocabularyRepository.save(this.vocabularyWords);
                    this.renderDeckSelection();
                    showNotification(`导入完成: 新增 ${newWordsCount} 个单词, 追加 ${newDefsCount} 个新义项。`, true);
                } else {
                    showNotification('没有新增内容被导入。词库可能已存在。', false);
                }
            } catch (error) {
                console.error('文件导入失败:', error);
                showNotification(`导入失败: ${error.message}`, false);
            } finally {
                if (dom.fileInput) dom.fileInput.value = '';
            }
        };
        reader.readAsText(file, 'UTF-8');
    }
}
