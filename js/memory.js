/**
 * @fileoverview 实现 FSRS (Free Spaced Repetition Scheduler) 算法。
 * 该文件包含用于安排单词复习、计算间隔、
 * 和更新单词记忆状态（难度、稳定性）的核心逻辑。
 */

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
 * 实现 FSRS 算法的核心数学公式。
 */
class FSRSAlgorithm {
  constructor(params = FSRS_PARAMS) {
    this.params = params;
  }

  /**
   * 为一个新单词创建一个带有默认 FSRS 值的新进度对象。
   * @returns {object} 一个新的进度对象。
   */
  initCard() {
    return {
      difficulty: 0,
      stability: 0,
      reviews: [],
      lastReview: null,
      dueDate: null,
      stage: 0,
    };
  }

  /**
   * 计算下一次复习的间隔、新的难度和新的稳定性。
   * @param {object} progress - 单词的当前进度对象。
   * @param {number} rating - 用户对复习的评分。
   * @returns {object} 一个包含下一次间隔、新难度和新稳定性的对象。
   */
  nextInterval(progress, rating) {
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
    }

    return {
        interval: Math.min(interval, 365), // 将最大间隔限制在1年。
        difficulty: Math.max(0.1, Math.min(newDifficulty, 10)),
        stability: Math.max(0.1, newStability),
    };
  }

  /** 为单词的首次复习提供基于 FSRS 参数的初始间隔和难度。 */
  _handleFirstReview(rating) {
    const w = this.params.w;
    let stability;

    // 根据评分从 FSRS 权重中获取初始稳定性
    if (rating === RATING.FORGOT) {
        stability = w[0];
    } else if (rating === RATING.HARD) {
        stability = w[1];
    } else { // RATING.EASY
        stability = w[2];
    }

    // 根据 FSRS 公式计算初始难度: D_0(g) = w_4 - w_5 * (g - 3)
    const difficulty = w[4] - w[5] * (rating - 3);

    // 将稳定性作为初始间隔，并确保最小为1天
    const interval = Math.max(1, Math.round(stability));

    return { 
        interval, 
        difficulty: Math.max(1, Math.min(difficulty, 10)), 
        stability: Math.max(0.1, stability)
    };
  }

  /** 根据先前的难度和用户评分计算新的难度。 */
  _calcNewDifficulty(d, rating) {
    const w = this.params.w;
    let new_d = d - w[6] * (rating - 3);
    return new_d * Math.exp(w[7] * (1 - new_d));
  }

  /** 根据先前的状态和用户评分计算新的稳定性。 */
  _calcNewStability(s, d, rating) {
    const w = this.params.w;
    if (rating === RATING.FORGOT) {
        return w[8] * Math.pow(d, w[9]) * Math.pow(s, w[10]) * Math.exp((1 - s) * w[11]);
    }
    const ratingFactor = rating === RATING.HARD ? 0.8 : 1.2;
    return s * (1 + Math.exp(w[12]) * (11 - d) * Math.pow(s, w[13]) * (Math.exp((1 - s) * w[14]) - 1) * ratingFactor);
  }

  /**
   * 在一次复习后更新整个单词的进度对象。
   * @param {object} word - 包含 progress 属性的单词对象。
   * @param {number} rating - 用户的评分。
   * @returns {object} 更新后的、包含新进度的单词对象。
   */
  updateCard(word, rating) {
    // 通过与默认对象合并来确保进度对象的完整性。
    // 这可以处理从存储中加载旧的、不完整的进度数据的情况。
    const progress = { ...this.initCard(), ...(word.progress || {}) };
    const result = this.nextInterval(progress, rating);
    const currentTime = Date.now();

    progress.difficulty = result.difficulty;
    progress.stability = result.stability;
    progress.reviews.push({ timestamp: currentTime, rating, interval: result.interval });
    progress.lastReview = currentTime;
    progress.dueDate = currentTime + result.interval * 24 * 60 * 60 * 1000;
    progress.stage = this._calculateStage(progress);
    
    word.progress = progress;
    return word;
  }

  /** 为了 UI 显示，将稳定性简化映射到一个 0-4 的阶段数字。 */
  _calculateStage(progress) {
    if (progress.stability >= 30) return 4; // 已掌握
    if (progress.stability >= 7) return 3;  // 长期
    if (progress.stability >= 3) return 2;  // 中期
    if (progress.stability >= 1) return 1;  // 短期
    return 0;                           // 学习中
  }

  /** 检查一个卡片是否到期需要复习。 */
  isCardDue(card, currentTime = Date.now()) {
    const progress = card.progress || {};
    return !progress.dueDate || currentTime >= progress.dueDate;
  }
}

/**
 * 一个使用 FSRSAlgorithm 来管理复习的高级调度器。
 * 这个类是应用其余部分的主要接口。
 */
export class ReviewScheduler {
  constructor(params = FSRS_PARAMS) {
    this.fsrs = new FSRSAlgorithm(params);
    this.rating = RATING;
  }

  /**
   * 确保一个单词拥有一个有效的进度对象，如果不存在则创建一个。
   * @param {object} word - 单词对象。
   * @returns {object} 保证拥有 `progress` 属性的单词对象。
   */
  initializeWord(word) {
    if (!word.progress) {
        word.progress = this.fsrs.initCard();
    }
    return word;
  }

  /**
   * 处理用户对一个单词复习的主要入口点。
   * @param {object} word - 被复习的单词。
   * @param {number} rating - 用户的评分。
   * @returns {{card: object, isNewCard: boolean}} 更新后的单词和一个指示它是否为新单词的标志。
   */
  processReview(word, rating) {
    if (!word || !word.arabic || !word.definitions || word.definitions.length === 0) {
        throw new Error('为复习提供了无效的单词对象。');
    }
    
    const isNewCard = !word.progress || !word.progress.lastReview;
    const updatedCard = this.fsrs.updateCard(word, rating);
    
    return { card: updatedCard, isNewCard };
  }

  /**
   * 筛选一个单词列表，找出所有当前到期需要复习的单词。
   * @param {Array<object>} words - 一个单词对象列表。
   * @returns {Array<object>} 一个到期单词的列表。
   */
  getDueWords(words, currentTime = Date.now()) {
    return words.filter(word => this.fsrs.isCardDue(word, currentTime));
  }
}

export default ReviewScheduler;
