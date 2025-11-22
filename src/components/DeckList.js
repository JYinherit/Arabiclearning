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
     */
    render(collections) {
        this.container.innerHTML = ''; // 清空现有内容

        if (!collections || Object.keys(collections).length === 0) {
            this.container.innerHTML = '<p>没有可用的词库。请先导入一个词库文件。</p>';
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
            const button = document.createElement('button');
            button.textContent = `${deckName} (${subDeck.wordCount}词)`;
            button.className = 'btn deck-btn';
            button.disabled = subDeck.wordCount === 0;
            button.dataset.deckName = `${collectionName}//${deckName}`;
            subDecksContainer.appendChild(button);
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
        }
    }
}
