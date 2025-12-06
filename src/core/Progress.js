/**
 * @fileoverview 定义了“Progress”实体，代表一个单词的学习状态。
 *
 * 这个类作为一个不可变的数据结构。任何对单词进度的更新
 * 都不应修改现有实例，而应创建一个新实例。这种做法
 * 可以防止副作用，使状态变化更可预测。
 */

/**
 * 代表一个单词的学习进度。
 * 这是一个不可变的数据对象。
 */
export class Progress {
    /**
     * 创建一个新的 Progress 实例。
     * @param {object} [initialState={}] - 用于覆盖默认进度状态的对象。
     * @param {number} [initialState.difficulty=0] - 记忆难度 (D)。
     * @param {number} [initialState.stability=0] - 记忆稳定性 (S)。
     * @param {Array<object>} [initialState.reviews=[]] - 复习事件的历史记录。
     * @param {number|null} [initialState.lastReview=null] - 上次复习的时间戳。
     * @param {number|null} [initialState.dueDate=null] - 单词下次到期的时间戳。
     * @param {number} [initialState.stage=0] - 从稳定性派生的简化阶段 (0-4)。
     */
    constructor(initialState = {}) {
        const defaults = {
            difficulty: 0,
            stability: 0,
            reviews: [],
            lastReview: null,
            dueDate: null,
            stage: 0,
            firstLearnedDate: null,
        };
        
        const state = { ...defaults, ...initialState };

        /** @type {number} */
        this.difficulty = state.difficulty;
        /** @type {number} */
        this.stability = state.stability;
        /** @type {Array<object>} */
        this.reviews = [...state.reviews]; // 创建浅拷贝以确保不可变性
        /** @type {number|null} */
        this.lastReview = state.lastReview;
        /** @type {number|null} */
        this.dueDate = state.dueDate;
        /** @type {number} */
        this.stage = state.stage;
        /** @type {string|null} */
        this.firstLearnedDate = state.firstLearnedDate;

        // 通过冻结对象来强制实现不可变性。
        Object.freeze(this);
        Object.freeze(this.reviews);
    }
}
