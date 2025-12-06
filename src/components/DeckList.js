/**
 * @fileoverview DeckList 组件，封装了主屏幕上词库列表的 UI 和交互。
 */

export class DeckList {
    /**
     * @param {HTMLElement} container - 词库列表组件的根 DOM 元素。
    import { EventBus } from '../infrastructure/EventBus.js';
     */
    constructor(container, eventBus) {
        if (!container) {
            throw new Error('DeckList 组件需要一个有效的容器元素。');
        }
        this.container = container;
        this.eventBus = eventBus;

        // 将事件监听器绑定到容器上，使用事件委托来处理点击
        this.container.addEventListener('click', this._handleContainerClick.bind(this));
    }

    /**
     * 渲染词库和集合的列表。
     * @param {object} collections - 一个包含集合和其下子词库信息的对象。
     *   格式: { collectionName: { wordCount: number, subDecks: { deckName: { wordCount: number } } } }
     * @param {object} [mistakeNotebookData=null] - 错题本数据 { count: number }
     */
    render(collections, mistakeNotebookData = null) {
        this.container.innerHTML = ''; // 清空现有内容

        // Render Mistake Notebook at the top if it exists
        if (mistakeNotebookData) {
            const mistakeDiv = document.createElement('div');
            mistakeDiv.className = 'collection-container mistake-notebook-container';
            mistakeDiv.style.border = '2px solid #ff6b6b'; // Distinct styling
            mistakeDiv.style.marginBottom = '15px';

            const header = document.createElement('div');
            header.className = 'collection-header';
            header.style.justifyContent = 'space-between';
            header.style.display = 'flex';
            header.style.alignItems = 'center';

            const title = document.createElement('span');
            title.textContent = `📕 错题本 (${mistakeNotebookData.count}词)`;
            title.style.fontWeight = 'bold';
            title.style.color = '#d63031';
            header.appendChild(title);

            const btnGroup = document.createElement('div');

            const studyButton = document.createElement('button');
            studyButton.textContent = '强化复习';
            studyButton.className = 'btn btn-small study-mistake-btn';
            studyButton.disabled = mistakeNotebookData.count === 0;

            // Manage Button for Mistake Notebook
            const manageBtn = document.createElement('button');
            manageBtn.textContent = '📖';
            manageBtn.className = 'btn btn-small manage-deck-btn';
            manageBtn.style.marginLeft = '5px';
            manageBtn.title = '管理错题本';
            manageBtn.dataset.deckName = 'mistake-notebook'; // Special ID

            btnGroup.appendChild(studyButton);
            btnGroup.appendChild(manageBtn);

            header.appendChild(btnGroup);
            mistakeDiv.appendChild(header);
            this.container.appendChild(mistakeDiv);
        }

        if (!collections || Object.keys(collections).length === 0) {
            const msg = document.createElement('p');
            msg.textContent = '没有可用的词库。请先导入一个词库文件。';
            this.container.appendChild(msg);
            return;
        }

        Object.keys(collections).forEach(collectionName => {
            const collection = collections[collectionName];
            const details = this._createCollectionElement(collectionName, collection);
            this.container.appendChild(details);
        });
    }

    /**
     * 创建单个集合的 DOM 结构。
     * @private
     */
    _createCollectionElement(collectionName, collection) {
        const details = document.createElement('details');
        details.className = 'collection-container';
        details.open = true; // 默认展开

        const summary = document.createElement('summary');
        summary.className = 'collection-header';

        const title = document.createElement('span');
        title.textContent = `${collectionName} (${collection.wordCount}词)`;
        summary.appendChild(title);

        const studyButton = document.createElement('button');
        studyButton.textContent = '学习此集合';
        studyButton.className = 'btn btn-small study-collection-btn';
        studyButton.dataset.deckName = collectionName;
        summary.appendChild(studyButton);

        details.appendChild(summary);

        const subDecksContainer = document.createElement('div');
        subDecksContainer.className = 'sub-decks-container';

        for (const deckName in collection.subDecks) {
            const subDeck = collection.subDecks[deckName];

            const deckWrapper = document.createElement('div');
            deckWrapper.style.display = 'flex';
            deckWrapper.style.alignItems = 'center';
            deckWrapper.style.marginBottom = '5px';

            const button = document.createElement('button');
            button.textContent = `${deckName} (${subDeck.wordCount}词)`;
            button.className = 'btn deck-btn';
            button.style.flexGrow = '1';
            button.disabled = subDeck.wordCount === 0;
            button.dataset.deckName = `${collectionName}//${deckName}`;

            // Browse/Manage Button (📖)
            const manageBtn = document.createElement('button');
            manageBtn.textContent = '📖';
            manageBtn.className = 'btn btn-small manage-deck-btn';
            manageBtn.style.marginLeft = '5px';
            manageBtn.title = '浏览单词 / 管理错题';
            manageBtn.dataset.deckName = `${collectionName}//${deckName}`;

            deckWrapper.appendChild(button);
            deckWrapper.appendChild(manageBtn);
            subDecksContainer.appendChild(deckWrapper);
        }

        details.appendChild(subDecksContainer);
        return details;
    }

    /**
     * 使用事件委托处理容器内的所有点击事件。
     * @private
     */
    _handleContainerClick(event) {
        const target = event.target;

        if (target.matches('.study-collection-btn')) {
            event.preventDefault(); // 阻止 <details> 折叠/展开
            const deckName = target.dataset.deckName;
            if (deckName && this.eventBus) {
                this.eventBus.emit('deckSelected', deckName);
            }
        } else if (target.matches('.deck-btn')) {
            const deckName = target.dataset.deckName;
            if (deckName && this.eventBus) {
                this.eventBus.emit('deckSelected', deckName);
            }
        } else if (target.matches('.study-mistake-btn')) {
             if (this.eventBus) {
                this.eventBus.emit('mistakeSessionStart');
             }
        } else if (target.matches('.manage-deck-btn')) {
            const deckName = target.dataset.deckName;
             if (this.eventBus) {
                this.eventBus.emit('manageDeck', deckName);
             }
        }
    }
}
