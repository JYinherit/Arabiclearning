/**
 * @fileoverview 实现了 FSRS (Free Spaced Repetition Scheduler) 算法的核心。
 *
 * 这个文件包含了用于计算下一次复习间隔、更新单词记忆状态（难度、稳定性）的纯数学逻辑。
 * 它被设计为无状态的，接收当前进度和用户评分，然后返回一个新的进度状态，
 * 完全遵循不可变性的原则。
 */

import { Progress } from './Progress.js';

/**
 * 用户对卡片复习的评分。
 */
export const RATING = {
  FORGOT: 1, // 用户不记得这个单词。
  HARD: 2,   // 用户记得这个单词，但感觉很困难。
  EASY: 3,   // 用户轻松地记住了这个单词。
};

/**
 * FSRS 算法的默认参数。
 * 这些权重是为语言学习而优化的。
 */
export const FSRS_PARAMS = {
  w: [
    0.5701, 1.4436, 4.1386, 10.9355, 5.1443, 1.2006, 0.8627, 0.0782, 
    1.4202, 0.2116, 1.9889, 0.0029, 0.8719, 0.5249, 0.1278, 0.3561, 2.5016
  ],
};

/**
 * 实现 FSRS 算法的核心计算逻辑。
 */
export class FSRS {
  /**
   * @param {object} [params=FSRS_PARAMS] FSRS 算法的权重参数。
   */
  constructor(params = FSRS_PARAMS) {
    this.params = params;
  }

  /**
   * 根据用户评分计算单词的下一个进度状态。
   * @param {Progress | null} currentProgress - 单词的当前进度。如果是新词，则为 null。
   * @param {number} rating - 用户评分，来自 RATING 常量。
   * @returns {Progress} - 代表新状态的、全新的 Progress 对象。
   */
  rate(currentProgress, rating) {
    const progress = currentProgress || new Progress();
    const isFirstReview = !progress.lastReview;
    const result = this._nextInterval(progress, rating);
    const currentTime = Date.now();

    const newReviews = [...progress.reviews, { timestamp: currentTime, rating, interval: result.interval }];

    const newState = {
      difficulty: result.difficulty,
      stability: result.stability,
      reviews: newReviews,
      lastReview: currentTime,
      dueDate: currentTime + result.interval * 24 * 60 * 60 * 1000,
      firstLearnedDate: progress.firstLearnedDate // Carry over existing date
    };

    // If it's the first time and the user didn't fail, set the date.
    if (isFirstReview && rating !== RATING.FORGOT) {
        newState.firstLearnedDate = new Date(currentTime).toISOString();
    }
    
    newState.stage = this._calculateStage(newState);

    return new Progress(newState);
  }

  /**
   * 检查一个单词是否到期需要复习。
   * @param {Progress | null} progress - 单词的进度。
   * @param {number} [currentTime=Date.now()] - 当前时间戳。
   * @returns {boolean} - 如果单词到期或为新词，则返回 true。
   */
  static isDue(progress, currentTime = Date.now()) {
    if (!progress || !progress.dueDate) {
      return true; // 新卡片或没有到期日的卡片总是到期的。
    }
    return currentTime >= progress.dueDate;
  }

  /**
   * 计算下一次复习的间隔、新的难度和新的稳定性。
   * @private
   */
  _nextInterval(progress, rating) {
    if (progress.stability === 0 || !progress.lastReview) {
      return this._handleFirstReview(rating);
    }

    const newDifficulty = this._calcNewDifficulty(progress.difficulty, rating);
    const newStability = this._calcNewStability(progress.stability, progress.difficulty, rating);
    
    let interval;
    switch (rating) {
        case RATING.FORGOT:
            interval = 1;
            break;
        case RATING.HARD:
            interval = Math.max(1, Math.round(newStability * 0.8));
            break;
        case RATING.EASY:
            interval = Math.max(1, Math.round(newStability * 1.2));
            break;
        default:
            interval = 1;
            break;
    }

    return {
        interval: Math.min(interval, 365), // 将最大间隔限制在1年。
        difficulty: Math.max(0.1, Math.min(newDifficulty, 10)),
        stability: Math.max(0.1, newStability),
    };
  }

  /** 
   * 为单词的首次复习提供基于 FSRS 参数的初始间隔和难度。
   * @private
   */
  _handleFirstReview(rating) {
    const w = this.params.w;
    let stability;

    if (rating === RATING.FORGOT) {
        stability = w[0];
    } else if (rating === RATING.HARD) {
        stability = w[1];
    } else { // RATING.EASY
        stability = w[2];
    }

    const difficulty = w[4] - w[5] * (rating - 3);
    const interval = Math.max(1, Math.round(stability));

    return { 
        interval, 
        difficulty: Math.max(1, Math.min(difficulty, 10)), 
        stability: Math.max(0.1, stability)
    };
  }

  /** 
   * 根据先前的难度和用户评分计算新的难度。
   * @private
   */
  _calcNewDifficulty(d, rating) {
    const w = this.params.w;
    let new_d = d - w[6] * (rating - 3);
    return new_d * Math.exp(w[7] * (1 - new_d));
  }

  /** 
   * 根据先前的状态和用户评分计算新的稳定性。
   * @private
   */
  _calcNewStability(s, d, rating) {
    const w = this.params.w;
    if (rating === RATING.FORGOT) {
        return w[8] * Math.pow(d, w[9]) * Math.pow(s, w[10]) * Math.exp((1 - s) * w[11]);
    }
    const ratingFactor = rating === RATING.HARD ? 0.8 : 1.2;
    return s * (1 + Math.exp(w[12]) * (11 - d) * Math.pow(s, w[13]) * (Math.exp((1 - s) * w[14]) - 1) * ratingFactor);
  }

  /** 
   * 为了 UI 显示，将稳定性简化映射到一个 0-4 的阶段数字。
   * @private
   */
  _calculateStage(progress) {
    if (progress.stability >= 30) return 4; // 已掌握
    if (progress.stability >= 7) return 3;  // 长期
    if (progress.stability >= 3) return 2;  // 中期
    if (progress.stability >= 1) return 1;  // 短期
    return 0;                           // 学习中
  }
}
