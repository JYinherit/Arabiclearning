/**
 * @fileoverview 定义了应用中的核心“单词”实体。
 *
 * 这个类封装了一个单词的所有属性，包括其阿拉伯语形式、多个定义以及学习进度。
 * 它是一个纯粹的数据模型，不包含任何与UI（DOM）或数据持久化（localStorage、IndexedDB）相关的逻辑。
 * 这种分离使得核心业务规则（如“什么是新词？”或“如何添加新释义？”）能够被独立测试和复用。
 */

/**
 * 代表一个词汇单词，包含其所有定义和学习进度。
 */
export class Word {
    /**
     * @param {string} arabic 阿拉伯语单词。
     * @param {Array<object>} [definitions=[]] 一个定义对象的数组。
     * @param {object|null} [progress=null] 该单词的学习进度对象。
     */
    constructor(arabic, definitions = [], progress = null) {
        /** @type {string} */
        this.arabic = arabic;
        /** @type {Array<object>} */
        this.definitions = definitions;
        /** @type {object|null} */
        this.progress = progress; // 之后会成为 Progress 类的实例
    }

    /**
     * 向单词中添加一个新定义，同时避免重复。
     * 重复的定义是指具有相同中文含义和来源词库的定义。
     * @param {object} newDefinition 要添加的定义对象。
     * @returns {boolean} 如果定义被成功添加则返回 true，如果是重复的则返回 false。
     */
    addDefinition(newDefinition) {
        const defExists = this.definitions.some(
            def => def.chinese === newDefinition.chinese && def.sourceDeck === newDefinition.sourceDeck
        );

        if (!defExists) {
            this.definitions.push(newDefinition);
            return true;
        }
        return false;
    }

    /**
     * 从学习的角度检查这个单词是否被认为是“新”的。
     * 如果一个单词没有进度记录，或者其学习阶段为0，则被视为新词。
     * @returns {boolean}
     */
    isNew() {
        // 'progress' 的结构将由 Progress.js 和 FSRS.js 定义
        return !this.progress || this.progress.stage === 0;
    }

    /**
     * 从原始对象（通常来自导入文件）创建一个 Word 实例。
     * @param {object} importedWord 从已解析文件得到的原始单词对象。
     * @param {string} fileName 导入来源的文件名。
     * @param {string} deckName 文件内的词库名。
     * @returns {Word} 一个新的 Word 实例。
     */
    static fromImport(importedWord, fileName, deckName) {
        const newDefinition = {
            id: `def_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            chinese: importedWord.chinese,
            explanation: importedWord.explanation || '暂无解释',
            sourceDeck: `${fileName}//${deckName}`
        };
        
        return new Word(importedWord.arabic, [newDefinition], null);
    }
}
