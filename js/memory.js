// memory.js - 基于FSRS算法的科学记忆系统
import { STORAGE_KEYS } from './constants.js';

// FSRS评分等级
export const RATING = {
  FORGOT: 1,     // 忘记
  HARD: 2,       // 模糊/困难
  EASY: 3,       // 记得/简单
  AGAIN: 1       // 别名，与FORGOT相同
};

// Anka优化的FSRS默认参数 (基于论文和社区优化)
export const FSRS_PARAMS = {
  // 核心参数 - 基于Anka优化的权重
  w: [
    0.5701, 1.4436, 4.1386, 10.9355, 5.1443, 1.2006, 0.8627, 0.0782, 
    1.4202, 0.2116, 1.9889, 0.0029, 0.8719, 0.5249, 0.1278, 0.3561, 2.5016
  ],
  
  // 难度调整参数
  difficulty_decay: -0.7,
  stability_decay: -0.2,
  increase_factor: 0.2
};

// FSRS算法核心类
export class FSRSAlgorithm {
  constructor(params = FSRS_PARAMS) {
    this.params = params;
  }

  /**
   * 初始化新卡片
   */
  initCard() {
    return {
      // FSRS核心状态
      difficulty: 0,        // 初始难度
      stability: 0,         // 初始稳定性
      retrievability: 1,    // 初始可提取性
      
      // 学习历史
      reviews: [],          // 复习记录 [{timestamp, rating, interval}]
      lastReview: null,     // 上次复习时间戳
      dueDate: null,        // 下次到期时间
      
      // 统计信息
      consecutiveCorrect: 0, // 连续正确次数
      totalReviews: 0,       // 总复习次数
      easeFactor: 2.5,       // 简易因子
      
      // 兼容现有系统
      stage: 0,              // 记忆阶段 (0-4)
      rememberedCount: 0,     // 记住次数
      cooldown: 0,           // 冷却时间
      mistakeCount: 0,       // 错误次数
      
      // 元数据
      firstSeen: Date.now(), // 首次学习时间
      lastUpdated: Date.now() // 最后更新时间
    };
  }

  /**
   * 计算下次复习间隔 (核心算法)
   */
  nextInterval(card, rating, currentTime = Date.now()) {
    const { difficulty, stability } = card;
    const w = this.params.w;

    // 如果是第一次学习或忘记
    if (rating === RATING.FORGOT || stability === 0) {
      return this._handleFirstReview(card, rating);
    }

    // 计算新的难度和稳定性
    const newDifficulty = this._calcNewDifficulty(difficulty, rating);
    const newStability = this._calcNewStability(stability, difficulty, rating);
    
    // 计算间隔
    let interval;
    switch (rating) {
      case RATING.FORGOT:
        interval = 1; // 1天后复习
        break;
      case RATING.HARD:
        interval = Math.max(1, Math.round(stability * 0.8)); // 稍短间隔
        break;
      case RATING.EASY:
        interval = Math.max(1, Math.round(stability * 1.5)); // 更长间隔
        break;
      default:
        interval = Math.max(1, Math.round(stability)); // 标准间隔
    }

    // 应用约束
    interval = Math.max(1, Math.min(interval, 365)); // 限制在1-365天之间

    return {
      interval,
      difficulty: Math.max(0.1, Math.min(newDifficulty, 10)),
      stability: Math.max(0.1, Math.min(newStability, 365))
    };
  }

  /**
   * 处理第一次复习
   */
  _handleFirstReview(card, rating) {
    let interval, difficulty, stability;

    switch (rating) {
      case RATING.FORGOT:
        interval = 1;
        difficulty = 6;
        stability = 1;
        break;
      case RATING.HARD:
        interval = 3;
        difficulty = 4.5;
        stability = 2;
        break;
      case RATING.EASY:
        interval = 7;
        difficulty = 2.5;
        stability = 4;
        break;
    }

    return { interval, difficulty, stability };
  }

  /**
   * 计算新的难度
   */
  _calcNewDifficulty(currentDifficulty, rating) {
    const w = this.params.w;
    let newDifficulty = currentDifficulty - w[6] * (rating - 2.5);
    
    // 应用难度衰减和约束
    newDifficulty = newDifficulty * Math.exp(w[7] * (1 - currentDifficulty));
    return Math.max(0.1, Math.min(newDifficulty, 10));
  }

  /**
   * 计算新的稳定性
   */
  _calcNewStability(currentStability, difficulty, rating) {
    const w = this.params.w;
    let newStability;
    
    if (rating === RATING.FORGOT) {
      newStability = w[8] * Math.pow(difficulty, w[9]) * 
                    Math.pow(currentStability, w[10]) * 
                    Math.exp(w[11] * (1 - currentStability));
    } else {
      newStability = currentStability * (1 + Math.exp(w[12]) * 
                    (11 - difficulty) * Math.pow(currentStability, w[13]) * 
                    (Math.exp(w[14] * (1 - currentStability)) - 1));
    }
    
    return Math.max(0.1, Math.min(newStability, 365));
  }

  /**
   * 更新卡片状态
   */
  updateCard(card, rating, currentTime = Date.now()) {
    const result = this.nextInterval(card, rating, currentTime);
    
    // 更新卡片状态
    card.difficulty = result.difficulty;
    card.stability = result.stability;
    card.retrievability = this.getRetrievability(card, currentTime);
    
    // 更新复习历史
    const reviewRecord = {
      timestamp: currentTime,
      rating: rating,
      interval: result.interval,
      difficulty: card.difficulty,
      stability: card.stability
    };
    
    card.reviews.push(reviewRecord);
    card.lastReview = currentTime;
    card.dueDate = currentTime + result.interval * 24 * 60 * 60 * 1000; // 转换为毫秒
    card.totalReviews++;
    card.lastUpdated = currentTime;

    // 更新连续正确次数
    if (rating === RATING.FORGOT) {
      card.consecutiveCorrect = 0;
      card.mistakeCount++;
    } else {
      card.consecutiveCorrect++;
      if (rating === RATING.EASY) {
        card.rememberedCount++;
      }
    }

    // 更新记忆阶段 (兼容现有系统)
    card.stage = this._calculateStage(card);
    
    return card;
  }

  /**
   * 计算可提取性 (记忆强度)
   */
  getRetrievability(card, currentTime = Date.now()) {
    if (!card.lastReview || !card.stability) return 1;
    
    const elapsedDays = (currentTime - card.lastReview) / (24 * 60 * 60 * 1000);
    const retrievability = Math.exp(Math.log(0.9) * elapsedDays / card.stability);
    
    return Math.max(0, Math.min(1, retrievability));
  }

  /**
   * 计算记忆阶段 (兼容现有系统)
   */
  _calculateStage(card) {
    if (card.stability >= 30) return 4; // 已掌握
    if (card.stability >= 7) return 3;  // 长期记忆
    if (card.stability >= 3) return 2;  // 中期记忆
    if (card.stability >= 1) return 1;  // 短期记忆
    return 0;                           // 学习阶段
  }

  /**
   * 检查卡片是否到期
   */
  isCardDue(card, currentTime = Date.now()) {
    if (!card.dueDate) return true; // 新卡片
    return currentTime >= card.dueDate;
  }

  /**
   * 获取可复习的卡片
   */
  getDueCards(cards, currentTime = Date.now()) {
    return cards.filter(card => this.isCardDue(card, currentTime));
  }

  /**
   * 估算记忆强度 (0-100%)
   */
  getMemoryStrength(card, currentTime = Date.now()) {
    const retrievability = this.getRetrievability(card, currentTime);
    return Math.round(retrievability * 100);
  }
}

// 复习调度器 - 主要接口类
export class ReviewScheduler {
  constructor(params = FSRS_PARAMS) {
    this.fsrs = new FSRSAlgorithm(params);
    this.rating = RATING;
  }

  /**
   * 初始化或迁移现有单词数据
   */
  initializeWord(word) {
    if (!word.difficulty && !word.stability) {
      // 新单词，初始化FSRS状态
      const fsrsState = this.fsrs.initCard();
      return { ...word, ...fsrsState };
    }
    // 已有FSRS状态的单词，保持不变
    return word;
  }

  /**
   * 批量初始化
   */
  initializeWords(words) {
    return words.map(word => this.initializeWord(word));
  }

  /**
   * 处理复习结果
   */
  processReview(word, rating) {
    // Bug 8 修复：添加对 word 参数的验证
    if (!word || typeof word !== 'object' || !word.arabic || !word.chinese) {
        console.error('无效的单词对象:', word);
        return word; // 或者抛出错误
    }
    
    if (!this.rating[rating] && ![1,2,3].includes(rating)) {
      throw new Error(`无效的评分: ${rating}. 请使用 RATING.FORGOT(1), RATING.HARD(2), RATING.EASY(3)`);
    }
    
    return this.fsrs.updateCard(word, rating);
  }

  /**
   * 获取需要复习的单词
   */
  getDueWords(words, currentTime = Date.now()) {
    return this.fsrs.getDueCards(words, currentTime);
  }

  /**
   * 获取学习进度统计
   */
  getProgressStats(words) {
    const dueWords = this.getDueWords(words);
    const totalWords = words.length;
    const dueCount = dueWords.length;
    // 修复：将已学习定义为记得三次或以上
    const learnedCount = words.filter(w => w.rememberedCount >= 3).length;
    const masteredCount = words.filter(w => w.stage >= 4).length;
    
    const avgDifficulty = words.reduce((sum, w) => sum + (w.difficulty || 0), 0) / totalWords;
    const avgStability = words.reduce((sum, w) => sum + (w.stability || 0), 0) / totalWords;
    
    return {
      totalWords,
      dueCount,
      learnedCount,
      masteredCount,
      duePercentage: Math.round((dueCount / totalWords) * 100),
      masteredPercentage: Math.round((masteredCount / totalWords) * 100),
      avgDifficulty: Math.round(avgDifficulty * 10) / 10,
      avgStability: Math.round(avgStability * 10) / 10
    };
  }

  /**
   * 迁移现有进度到FSRS系统
   */
  migrateExistingProgress(existingWords) {
    return existingWords.map(word => {
      // 如果已经有FSRS状态，保持不变
      if (word.difficulty !== undefined) {
        return word;
      }
      
      // 基于现有进度估算FSRS参数
      const newCard = this.fsrs.initCard();
      
      // 根据现有记忆阶段估算稳定性
      if (word.stage > 0) {
        newCard.stability = word.stage * 7; // 简单映射
        newCard.difficulty = 5 - (word.rememberedCount || 0) * 0.5; // 根据记住次数调整难度
        newCard.rememberedCount = word.rememberedCount || 0;
        newCard.mistakeCount = word.mistakeCount || 0;
        newCard.stage = word.stage;
        
        // 估算复习历史
        if (word.stage > 1) {
          const daysAgo = word.stage * 3;
          newCard.lastReview = Date.now() - daysAgo * 24 * 60 * 60 * 1000;
          newCard.dueDate = Date.now() + (word.stage * 7) * 24 * 60 * 60 * 1000;
        }
      }
      
      return { ...word, ...newCard };
    });
  }
}

// 默认导出
export default ReviewScheduler;
