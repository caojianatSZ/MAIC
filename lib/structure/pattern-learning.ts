// lib/structure/pattern-learning.ts
/**
 * 历史学习与模式优化
 *
 * 功能：
 * 1. 从历史批改数据中学习试卷格式模式
 * 2. 根据用户/学科/年级自适应调整参数
 * 3. 持续优化分割精度
 */

import { createLogger } from '@/lib/logger';
import type { SmartSplitOptions } from './smart-splitter';

const log = createLogger('PatternLearning');

/**
 * 试卷格式模式
 */
export interface PaperPattern {
  /** 模式ID */
  id: string;
  /** 用户ID */
  userId?: string;
  /** 学科 */
  subject: string;
  /** 年级 */
  grade: string;
  /** 样本数量 */
  sampleCount: number;
  /** 最后更新时间 */
  lastUpdated: Date;
  /** 优化的参数 */
  optimizedOptions: {
    /** Y坐标跳跃阈值倍数 */
    yGapThresholdMultiplier: number;
    /** 最小聚类高度 */
    minClusterHeight: number;
    /** 是否使用空间聚类 */
    useSpatialClustering: boolean;
  };
  /** 统计信息 */
  stats: {
    /** 平均题目数量 */
    avgQuestionCount: number;
    /** 平均准确率 */
    avgAccuracy: number;
    /** 常见布局 */
    commonLayouts: string[];
  };
}

/**
 * 模式学习服务
 */
export class PatternLearningService {
  private patterns: Map<string, PaperPattern> = new Map();
  private readonly storageKey = 'grading_patterns';

  constructor() {
    this.loadPatterns();
  }

  /**
   * 加载保存的模式
   */
  private loadPatterns(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const data = localStorage.getItem(this.storageKey);
        if (data) {
          const patternsArray = JSON.parse(data) as PaperPattern[];
          patternsArray.forEach(pattern => {
            this.patterns.set(pattern.id, pattern);
          });
          log.info('加载历史模式', { count: patternsArray.length });
        }
      }
    } catch (error) {
      log.warn('加载历史模式失败', error);
    }
  }

  /**
   * 保存模式到本地存储
   */
  private savePatterns(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const patternsArray = Array.from(this.patterns.values());
        localStorage.setItem(this.storageKey, JSON.stringify(patternsArray));
      }
    } catch (error) {
      log.warn('保存历史模式失败', error);
    }
  }

  /**
   * 记录批改结果（用于学习）
   */
  recordGradingResult(
    userId: string,
    subject: string,
    grade: string,
    options: SmartSplitOptions,
    result: {
      questionCount: number;
      accuracy: number;
      userFeedback?: 'correct' | 'incorrect' | 'ambiguous';
    }
  ): void {
    const patternId = this.generatePatternId(userId, subject, grade);
    const existing = this.patterns.get(patternId);

    if (existing) {
      // 更新现有模式
      existing.sampleCount += 1;
      existing.lastUpdated = new Date();

      // 指数移动平均更新参数
      const alpha = 0.1;  // 学习率
      existing.optimizedOptions.yGapThresholdMultiplier =
        existing.optimizedOptions.yGapThresholdMultiplier * (1 - alpha) +
        options.yGapThresholdMultiplier! * alpha;

      // 更新统计信息
      existing.stats.avgQuestionCount =
        existing.stats.avgQuestionCount * (1 - alpha) +
        result.questionCount * alpha;

      if (result.userFeedback) {
        const feedbackScore = result.userFeedback === 'correct' ? 1 : -0.5;
        existing.stats.avgAccuracy =
          existing.stats.avgAccuracy * (1 - alpha) + feedbackScore * alpha;
      }

      this.patterns.set(patternId, existing);
    } else {
      // 创建新模式
      const newPattern: PaperPattern = {
        id: patternId,
        userId,
        subject,
        grade,
        sampleCount: 1,
        lastUpdated: new Date(),
        optimizedOptions: {
          yGapThresholdMultiplier: options.yGapThresholdMultiplier || 1.5,
          minClusterHeight: options.minClusterHeight || 50,
          useSpatialClustering: options.useSpatialClustering !== false
        },
        stats: {
          avgQuestionCount: result.questionCount,
          avgAccuracy: result.accuracy || 0.8,
          commonLayouts: []
        }
      };

      this.patterns.set(patternId, newPattern);
    }

    this.savePatterns();
  }

  /**
   * 获取优化的选项
   */
  getOptimizedOptions(
    userId: string,
    subject: string,
    grade: string,
    defaultOptions: SmartSplitOptions
  ): SmartSplitOptions {
    const patternId = this.generatePatternId(userId, subject, grade);
    const pattern = this.patterns.get(patternId);

    if (pattern && pattern.sampleCount >= 5) {
      // 样本数量足够，使用学习到的参数
      log.info('使用历史优化参数', {
        patternId,
        sampleCount: pattern.sampleCount,
        avgAccuracy: pattern.stats.avgAccuracy
      });

      return {
        ...defaultOptions,
        ...pattern.optimizedOptions
      };
    } else if (pattern && pattern.sampleCount >= 2) {
      // 有少量样本，部分使用学习到的参数
      log.info('使用部分优化参数', {
        patternId,
        sampleCount: pattern.sampleCount
      });

      return {
        ...defaultOptions,
        yGapThresholdMultiplier: pattern.optimizedOptions.yGapThresholdMultiplier
      };
    } else {
      // 没有足够样本，使用默认参数
      return defaultOptions;
    }
  }

  /**
   * 生成模式ID
   */
  private generatePatternId(userId: string, subject: string, grade: string): string {
    return `${userId}_${subject}_${grade}`;
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalPatterns: number;
    totalSamples: number;
    bySubject: Record<string, number>;
    byGrade: Record<string, number>;
  } {
    const patterns = Array.from(this.patterns.values());

    return {
      totalPatterns: patterns.length,
      totalSamples: patterns.reduce((sum, p) => sum + p.sampleCount, 0),
      bySubject: patterns.reduce((acc, p) => {
        acc[p.subject] = (acc[p.subject] || 0) + p.sampleCount;
        return acc;
      }, {} as Record<string, number>),
      byGrade: patterns.reduce((acc, p) => {
        acc[p.grade] = (acc[p.grade] || 0) + p.sampleCount;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  /**
   * 清理过期模式（30天未更新）
   */
  cleanupExpiredPatterns(): void {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let cleanedCount = 0;

    for (const [id, pattern] of this.patterns.entries()) {
      if (pattern.lastUpdated < thirtyDaysAgo) {
        this.patterns.delete(id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      log.info('清理过期模式', { count: cleanedCount });
      this.savePatterns();
    }
  }
}

// 全局单例
let globalService: PatternLearningService | null = null;

export function getPatternLearningService(): PatternLearningService {
  if (!globalService) {
    globalService = new PatternLearningService();
  }
  return globalService;
}

/**
 * 集成辅助函数：在 smartSplit 中使用历史学习
 */
export function applyLearningIfNeeded(
  userId: string,
  subject: string,
  grade: string,
  defaultOptions: SmartSplitOptions
): SmartSplitOptions {
  try {
    const service = getPatternLearningService();
    return service.getOptimizedOptions(userId, subject, grade, defaultOptions);
  } catch (error) {
    log.warn('应用历史学习失败，使用默认参数', error);
    return defaultOptions;
  }
}

/**
 * 记录批改结果（供外部调用）
 */
export function recordGradingResult(
  userId: string,
  subject: string,
  grade: string,
  options: SmartSplitOptions,
  result: {
    questionCount: number;
    accuracy: number;
    userFeedback?: 'correct' | 'incorrect' | 'ambiguous';
  }
): void {
  try {
    const service = getPatternLearningService();
    service.recordGradingResult(userId, subject, grade, options, result);
  } catch (error) {
    log.warn('记录批改结果失败', error);
  }
}
