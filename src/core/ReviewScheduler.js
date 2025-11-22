/**
 * @fileoverview 提供一个高级调度器(ReviewScheduler)，作为应用与核心FSRS算法之间的接口。
 *
 * 这个文件不再包含 FSRS 的核心数学实现，而是从 `/src/core/` 导入。
 * ReviewScheduler 的职责是：
 * - 管理一个 FSRS 实例。
 * - 确保单词在被处理前拥有一个有效的 Progress 对象。
 * - 调用核心算法来处理复习和获取到期单词。
 * - 将核心模块返回的不可变数据结构（如 Progress）应用到应用的可变状态（Word 对象）上。
 */

import { FSRS, RATING, FSRS_PARAMS } from './FSRS.js';
import { Progress } from './Progress.js';

// 重新导出 RATING 以便其他模块可以继续从这里导入。
export { RATING };

/**
 * 一个使用 FSRS 来管理复习的高级调度器。
 * 这个类是应用其余部分与 FSRS 核心算法交互的主要接口。
 */
export class ReviewScheduler {
  constructor(params = FSRS_PARAMS) {
    this.fsrs = new FSRS(params);
  }

  /**
   * 确保一个单词拥有一个有效的进度对象，如果不存在则创建一个。
   * @param {import('./Word.js').Word} word - 单词对象。
   * @returns {import('./Word.js').Word} 保证拥有 `progress` 属性的单词对象。
   */
  initializeWord(word) {
    // 如果单词没有进度，或者进度是一个普通对象而不是 Progress 的实例，
    // 则创建一个新的 Progress 实例。
    if (!word.progress || !(word.progress instanceof Progress)) {
        word.progress = new Progress(word.progress || {});
    }
    return word;
  }

  /**
   * 处理用户对一个单词复习的主要入口点。
   * @param {import('./Word.js').Word} word - 被复习的单词。
   * @param {number} rating - 用户的评分。
   * @returns {{card: import('./Word.js').Word, isNewCard: boolean}} 更新后的单词和一个指示它是否为新单词的标志。
   */
  processReview(word, rating) {
    if (!word || !word.arabic || !word.definitions || word.definitions.length === 0) {
        throw new Error('为复习提供了无效的单词对象。');
    }
    
    // 确保我们正在处理一个 Progress 实例
    const currentProgress = (word.progress instanceof Progress) 
        ? word.progress 
        : new Progress(word.progress || {});

    const isNewCard = !currentProgress.lastReview;
    
    // FSRS.rate 返回一个全新的、不可变的 Progress 对象
    word.progress = this.fsrs.rate(currentProgress, rating);
    
    return { card: word, isNewCard };
  }

  /**
   * 筛选一个单词列表，找出所有当前到期需要复习的单词。
   * @param {Array<import('./Word.js').Word>} words - 一个单词对象列表。
   * @param {number} [currentTime=Date.now()] - 当前时间戳。
   * @returns {Array<import('./Word.js').Word>} 一个到期单词的列表。
   */
  getDueWords(words, currentTime = Date.now()) {
    return words.filter(word => {
        // 确保在检查到期状态前，单词已被初始化
        const progress = (word.progress instanceof Progress) ? word.progress : new Progress(word.progress || {});
        return FSRS.isDue(progress, currentTime);
    });
  }
}