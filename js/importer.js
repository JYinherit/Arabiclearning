/**
 * @fileoverview 处理在线词库导入功能。
 * 该模块负责从 GitHub 仓库获取可用的词库列表，
 * 在一个模态框中显示它们，并在用户选择后处理导入流程。
 */

import { handleFileImport } from './parser.js';
import * as ui from './ui.js';
import * as dom from './dom.js';

// --- LRU 缓存实现 ---
class LRUCache {
    constructor(capacity) {
        this.capacity = capacity;
        this.cache = new Map();
    }

    get(key) {
        if (!this.cache.has(key)) return null;
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);
        return value;
    }

    put(key, value) {
        if (this.cache.has(key)) {
            this.cache.delete(key);
        } else if (this.cache.size >= this.capacity) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
        this.cache.set(key, value);
    }
}

const lexiconCache = new LRUCache(1); 
const CACHE_KEY = 'onlineLexicons';

// 一个共享的状态对象，用于持有主应用数据和回调函数的引用。
const appState = {};

/**
 * 初始化导入器模块并设置事件监听器。
 * @param {object} options - 来自主应用的依赖项。
 * @param {Array} options.vocabularyWords - 对主词汇数组的引用。
 * @param {Function} options.renderDeckSelection - 用于重新渲染词库选择界面的回调函数。
 * @param {Function} options.saveDecksToStorageCallback - 用于将更新后的词汇保存到存储的回调函数。
 */
export function initImporter(options) {
    appState.vocabularyWords = options.vocabularyWords;
    appState.renderDeckSelection = options.renderDeckSelection;
    appState.saveDecksToStorageCallback = options.saveDecksToStorageCallback;

    // 为打开和关闭导入模态框绑定事件监听器。
    const onlineImportBtn = document.getElementById('online-import-btn');
    if (onlineImportBtn) {
        onlineImportBtn.addEventListener('click', openImportModal);
    }

    const modal = document.getElementById('import-modal');
    const closeBtn = document.querySelector('#import-modal .close-button');
    if (modal && closeBtn) {
        closeBtn.addEventListener('click', closeImportModal);
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeImportModal();
            }
        });
    }

    // 模态框内的“从本地文件导入”按钮触发主文件输入框。
    const localImportBtn = document.getElementById('import-local-lexicon-btn');
    if (localImportBtn && dom.fileInput) {
        localImportBtn.addEventListener('click', () => {
            dom.fileInput.click();
            closeImportModal();
        });
    }
}

/**
 * 打开在线词库导入模态框并开始获取列表。
 */
function openImportModal() {
    const modal = document.getElementById('import-modal');
    if (modal) {
        modal.style.display = 'flex';
        fetchOnlineLexicons();
    }
}

/**
 * 关闭在线词库导入模态框。
 */
function closeImportModal() {
    const modal = document.getElementById('import-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * 渲染在线词库列表到UI。
 * @param {Array} files - 从API或缓存获取的文件列表。
 */
function renderLexiconList(files) {
    const listContainer = document.getElementById('online-lexicon-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    const jsonFiles = files.filter(file => file.name.endsWith('.json') && file.type === 'file');

    if (jsonFiles.length === 0) {
        listContainer.innerHTML = '<p>未找到在线词库文件。</p>';
        return;
    }

    jsonFiles.forEach(file => {
        const item = document.createElement('div');
        item.className = 'online-lexicon-item';
        item.textContent = file.name.replace('.json', '');
        item.title = `点击导入 ${file.name}`;
        item.addEventListener('click', () => {
            importOnlineLexicon(file.download_url, file.name, item);
        });
        listContainer.appendChild(item);
    });
}

/**
 * 从 GitHub 仓库 API 获取词库文件列表并在模态框中渲染它们。
 */
async function fetchOnlineLexicons() {
    const listContainer = document.getElementById('online-lexicon-list');
    if (!listContainer) return;

    const cachedFiles = lexiconCache.get(CACHE_KEY);
    if (cachedFiles) {
        renderLexiconList(cachedFiles);
        return;
    }

    listContainer.innerHTML = '<p>正在加载在线词库...</p>';

    try {
        // 注意：这里使用的是未经身份验证的 GitHub API 端点，其速率限制较低。
        const response = await fetch('https://api.github.com/repos/JYinherit/Arabiclearning/contents/%E8%AF%8D%E5%BA%93');
        if (!response.ok) {
            throw new Error(`GitHub API 请求失败: ${response.statusText}`);
        }
        const files = await response.json();
        lexiconCache.put(CACHE_KEY, files); // 存入缓存
        renderLexiconList(files);

    } catch (error) {
        console.error('获取在线词库列表失败:', error);
        listContainer.innerHTML = `<p style="color: red;">加载失败: ${error.message}</p>`;
    }
}

/**
 * 下载选定的在线词库并将其传递给主导入处理器。
 * @param {string} url - 词库文件的下载链接。
 * @param {string} fileName - 文件名。
 * @param {HTMLElement} itemElement - 用于显示加载状态的列表项元素。
 */
async function importOnlineLexicon(url, fileName, itemElement) {
    itemElement.textContent = '正在导入...';
    itemElement.style.pointerEvents = 'none'; // 防止重复点击

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`下载词库失败: ${response.statusText}`);
        }
        const data = await response.json();

        // 为了重用现有的导入逻辑，我们模拟一个 File 对象和文件输入事件。
        const fileContent = JSON.stringify(data);
        const file = new File([fileContent], fileName, { type: 'application/json' });
        const mockEvent = { target: { files: [file] } };

        // 调用核心的解析和导入函数。
        await handleFileImport(
            mockEvent,
            appState.vocabularyWords,
            appState.renderDeckSelection,
            appState.saveDecksToStorageCallback
        );

        setTimeout(() => {
            closeImportModal();
            ui.showImportMessage(`在线词库 "${fileName}" 导入成功！`, true);
        }, 500);

    } catch (error) {
        console.error(`导入在线词库 ${fileName} 失败:`, error);
        ui.showImportMessage(`导入 "${fileName}" 失败: ${error.message}`, false);
        itemElement.textContent = fileName.replace('.json', ''); // 失败时恢复原始文本
        itemElement.style.pointerEvents = 'auto';
    }
}
