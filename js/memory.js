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

    // 修复：正确处理第一次学习的情况
    if (stability === 0 || card.totalReviews === 0) {
        return this._handleFirstReview(card, rating);
    }

    // 计算新的难度和稳定性
    const newDifficulty = this._calcNewDifficulty(difficulty, rating);
    const newStability = this._calcNewStability(stability, difficulty, rating, currentTime);
    
    // 计算间隔
    let interval;
    switch (rating) {
        case RATING.FORGOT:
            interval = 1; // 1分钟后重新学习（测试用，实际应为1天）
            break;
        case RATING.HARD:
            interval = Math.max(1, Math.round(newStability * 0.8));
            break;
        case RATING.EASY:
            interval = Math.max(1, Math.round(newStability * 1.5));
            break;
        default:
            interval = Math.max(1, Math.round(newStability));
    }

    // 应用约束
    interval = Math.max(1, Math.min(interval, 365));

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
  _calcNewStability(currentStability, difficulty, rating, currentTime) {
    const w = this.params.w;
    let newStability;
    
    if (rating === RATING.FORGOT) {
        newStability = w[8] * Math.pow(difficulty, w[9]) * 
                      Math.pow(currentStability, w[10]) * 
                      Math.exp(w[11] * (1 - currentStability));
    } else {
        // 修复：正确的稳定性增长公式
        const ratingFactor = rating === RATING.HARD ? 0.8 : 1.2;
        newStability = currentStability * (1 + Math.exp(w[12]) * 
                      (11 - difficulty) * Math.pow(currentStability, w[13]) * 
                      (Math.exp(w[14] * (1 - currentStability)) - 1) * ratingFactor);
    }
    
    return Math.max(0.1, Math.min(newStability, 365));
  }

  /**
   * 更新卡片状态
   */
  updateCard(card, rating, currentTime = Date.now()) {
    console.log('更新卡片:', card.chinese, '评分:', rating);
    
    // 深度确保卡片结构完整
    this.ensureCardStructure(card);
    
    const result = this.nextInterval(card, rating, currentTime);
    
    // 更新卡片状态
    card.difficulty = result.difficulty;
    card.stability = result.stability;
    card.retrievability = this.getRetrievability(card, currentTime);
    
    // 创建复习记录
    const reviewRecord = {
        timestamp: currentTime,
        rating: rating,
        interval: result.interval,
        difficulty: card.difficulty,
        stability: card.stability
    };
    
    console.log('添加复习记录到:', card.reviews);
    card.reviews.push(reviewRecord);
    card.lastReview = currentTime;
    card.dueDate = currentTime + result.interval * 24 * 60 * 60 * 1000;
    card.totalReviews = (card.totalReviews || 0) + 1;
    card.lastUpdated = currentTime;

    // 更新连续正确次数
    if (rating === RATING.FORGOT) {
        card.consecutiveCorrect = 0;
        card.mistakeCount = (card.mistakeCount || 0) + 1;
    } else {
        card.consecutiveCorrect = (card.consecutiveCorrect || 0) + 1;
        if (rating === RATING.EASY) {
            card.rememberedCount = (card.rememberedCount || 0) + 1;
        }
    }

    // 更新记忆阶段
    card.stage = this._calculateStage(card);
    
    console.log('卡片更新完成:', card.chinese, '阶段:', card.stage);
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
   * 添加确保卡片结构完整的方法
   */
  ensureCardStructure(card) {
    const requiredFields = {
        reviews: [],
        rememberedCount: 0,
        stage: 0,
        difficulty: 0,
        stability: 0,
        retrievability: 1,
        lastReview: null,
        dueDate: null,
        consecutiveCorrect: 0,
        totalReviews: 0,
        easeFactor: 2.5,
        mistakeCount: 0,
        cooldown: 0
    };
    
    for (const [field, defaultValue] of Object.entries(requiredFields)) {
        if (card[field] === undefined || card[field] === null) {
            console.log(`修复卡片字段: ${field} = ${defaultValue}`);
            card[field] = defaultValue;
        }
    }
    
    // 特别确保 reviews 是数组
    if (!Array.isArray(card.reviews)) {
        console.warn('reviews 不是数组，重置为数组');
        card.reviews = [];
    }
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
    console.log('初始化单词:', word.chinese);
    
    // 深度克隆单词对象，避免引用问题
    const clonedWord = JSON.parse(JSON.stringify(word));
    
    // 获取FSRS默认状态
    const fsrsState = this.fsrs.initCard();
    
    // 创建最终单词对象，确保所有字段都存在
    const initializedWord = { ...fsrsState, ...clonedWord };
    
    // 使用深度确保方法
    this.fsrs.ensureCardStructure(initializedWord);
    
    // 特别确保关键学习字段不被覆盖
    initializedWord.chinese = word.chinese || '';
    initializedWord.arabic = word.arabic || '';
    initializedWord.explanation = word.explanation || '暂无解释';
    
    console.log('单词初始化完成:', initializedWord.chinese, '阶段:', initializedWord.stage);
    return initializedWord;
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
    console.log('处理复习:', word?.chinese, '评分:', rating);
    
    // 增强参数验证
    if (!word || typeof word !== 'object') {
        console.error('无效的单词对象:', word);
        throw new Error('无效的单词对象');
    }
    
    if (!word.arabic || !word.chinese) {
        console.error('单词缺少必要字段:', { arabic: word.arabic, chinese: word.chinese });
        throw new Error('单词缺少必要字段（arabic 或 chinese）');
    }
    
    if (!this.rating[rating] && ![1,2,3].includes(rating)) {
        throw new Error(`无效的评分: ${rating}. 请使用 RATING.FORGOT(1), RATING.HARD(2), RATING.EASY(3)`);
    }
    
    try {
        // 在处理前确保单词结构完整
        this.fsrs.ensureCardStructure(word);
        
        const result = this.fsrs.updateCard(word, rating);
        console.log('FSRS处理成功:', result.chinese);
        return result;
    } catch (error) {
        console.error('FSRS处理失败，单词:', word.chinese, '错误:', error);
        console.log('单词当前状态:', word);
        
        // 紧急恢复：使用简单算法
        return this.fallbackReview(word, rating);
    }
  }

  /**
   * 添加备用复习算法
   */
  fallbackReview(word, rating) {
    console.log('使用备用算法处理:', word.chinese);
    
    // 确保基本结构
    this.fsrs.ensureCardStructure(word);
    
    // 简单记忆算法
    if (rating === RATING.EASY) {
        word.rememberedCount = (word.rememberedCount || 0) + 1;
        word.consecutiveCorrect = (word.consecutiveCorrect || 0) + 1;
        
        if (word.rememberedCount >= 3) {
            word.stage = 4; // 已掌握
            word.difficulty = 1;
            word.stability = 365; // 一年
        } else if (word.rememberedCount >= 2) {
            word.stage = 3; // 长期记忆
            word.difficulty = 2;
            word.stability = 30; // 一个月
        } else {
            word.stage = 2; // 中期记忆
            word.difficulty = 3;
            word.stability = 7; // 一周
        }
    } else if (rating === RATING.HARD) {
        word.rememberedCount = Math.max(0, (word.rememberedCount || 0) - 0.5);
        word.consecutiveCorrect = 0;
        word.stage = Math.max(1, (word.stage || 1) - 1);
        word.difficulty = Math.min(10, (word.difficulty || 5) + 1);
        word.stability = Math.max(1, (word.stability || 1) * 0.7);
    } else if (rating === RATING.FORGOT) {
        word.rememberedCount = 0;
        word.consecutiveCorrect = 0;
        word.mistakeCount = (word.mistakeCount || 0) + 1;
        word.stage = 1; // 重新学习
        word.difficulty = Math.min(10, (word.difficulty || 5) + 2);
        word.stability = 1; // 一天
    }
    
    // 添加复习记录
    const reviewRecord = {
        timestamp: Date.now(),
        rating: rating,
        interval: word.stability,
        difficulty: word.difficulty,
        stability: word.stability
    };
    
    word.reviews.push(reviewRecord);
    word.lastReview = Date.now();
    word.dueDate = Date.now() + word.stability * 24 * 60 * 60 * 1000;
    word.totalReviews = (word.totalReviews || 0) + 1;
    word.lastUpdated = Date.now();
    
    console.log('备用算法处理完成:', word.chinese, '阶段:', word.stage);
    return word;
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
    console.log('迁移现有进度，单词数量:', existingWords.length);
    
    return existingWords.map((word, index) => {
        console.log(`迁移单词 ${index}: ${word.chinese}`);
        
        // 深度克隆
        const clonedWord = JSON.parse(JSON.stringify(word));
        
        // 使用初始化方法确保结构完整
        const migratedWord = this.initializeWord(clonedWord);
        
        // 保留原有的学习进度
        if (word.rememberedCount !== undefined) {
            migratedWord.rememberedCount = word.rememberedCount;
        }
        if (word.mistakeCount !== undefined) {
            migratedWord.mistakeCount = word.mistakeCount;
        }
        if (word.stage !== undefined) {
            migratedWord.stage = word.stage;
        }
        
        // 如果有复习历史，尝试迁移
        if (word.reviews && Array.isArray(word.reviews) && word.reviews.length > 0) {
            migratedWord.reviews = [...word.reviews];
        }
        
        console.log(`迁移完成: ${migratedWord.chinese}, 阶段: ${migratedWord.stage}`);
        return migratedWord;
    });
  }
}

// 默认导出
export default ReviewScheduler;
