// lib/fallback/manager.ts
/**
 * Fallback 管理器 - 统一管理 fallback 流程
 *
 * 核心功能：
 * 1. 决策何时使用 fallback
 * 2. 选择最佳 fallback 策略
 * 3. 执行并跟踪 fallback
 * 4. 收集数据优化决策
 */

import { createLogger } from '@/lib/logger';
import { getFallbackStrategyExecutor } from './strategies';
import { ErrorType } from './types';
import type {
  GradingContext,
  FallbackResult,
  FallbackTrigger,
  FallbackConfig,
  FallbackHistory
} from './types';

const log = createLogger('FallbackManager');

/**
 * 默认配置
 */
const DEFAULT_CONFIG: FallbackConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 30000,
  enableCache: true,
  cacheExpirationSeconds: 300,
  enableMonitoring: true,
  enableLearning: true
};

/**
 * Fallback 管理器
 */
export class FallbackManager {
  private config: FallbackConfig;
  private history: FallbackHistory[] = [];
  private metrics = {
    totalTriggers: 0,
    byStrategy: {} as Record<string, number>,
    byErrorType: {} as Record<string, number>,
    successCount: 0,
    totalTimeMs: 0,
    manualReviewCount: 0
  };

  constructor(config: Partial<FallbackConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 执行带 fallback 的批改
   */
  async executeWithFallback(
    context: GradingContext,
    primaryFunction: () => Promise<any>
  ): Promise<FallbackResult> {
    const startTime = Date.now();

    try {
      // 尝试主要函数
      const result = await this.executeWithTimeout(primaryFunction(), this.config.timeout);

      return {
        success: true,
        strategy: 'simplified_pipeline', // 实际没有使用 fallback
        result,
        processingTimeMs: Date.now() - startTime,
        confidence: 0.9,
        needsReview: false
      };
    } catch (error) {
      // 主要函数失败，触发 fallback
      return this.handleFallback(context, error as Error, startTime);
    }
  }

  /**
   * 处理 fallback
   */
  private async handleFallback(
    context: GradingContext,
    error: Error,
    startTime: number
  ): Promise<FallbackResult> {
    // 创建触发条件
    const trigger: FallbackTrigger = {
      errorType: this.classifyError(error),
      errorMessage: error.message,
      errorDetails: error,
      context,
      timestamp: Date.now(),
      priority: this.determinePriority(error)
    };

    log.info('触发 Fallback', {
      questionId: context.questionId,
      errorType: trigger.errorType,
      priority: trigger.priority
    });

    // 更新指标
    this.metrics.totalTriggers++;
    this.metrics.byErrorType[trigger.errorType] =
      (this.metrics.byErrorType[trigger.errorType] || 0) + 1;

    // 选择并执行策略
    let currentStrategy = this.selectStrategy(trigger);
    const executor = getFallbackStrategyExecutor();

    let attempts = 0;
    let finalResult: FallbackResult | undefined;
    const attemptHistory: any[] = [];

    // 尝试多个策略（最多 maxRetries 次）
    for (let i = 0; i < this.config.maxRetries; i++) {
      attempts++;

      const result = await executor.executeStrategy(currentStrategy, context, error);

      attemptHistory.push({
        strategy: currentStrategy,
        success: result.success,
        error: result.error
      });

      if (result.success) {
        finalResult = result;
        this.metrics.successCount++;
        break;
      }

      // 如果失败了，尝试下一个策略
      const nextStrategy = this.getNextStrategy(currentStrategy);
      if (!nextStrategy) {
        // 没有更多策略了
        finalResult = result;
        break;
      }

      // 延迟后重试
      await this.delay(this.config.retryDelay);
      currentStrategy = nextStrategy;
    }

    // 如果所有策略都失败，使用最后的策略
    if (!finalResult) {
      finalResult = {
        success: false,
        strategy: 'manual_review',
        error: '所有 fallback 策略都失败',
        processingTimeMs: Date.now() - startTime,
        confidence: 0,
        needsReview: true,
        reviewReason: '所有策略失败'
      };
    }

    // 确保有结果
    const result: FallbackResult = finalResult;

    // 更新处理时间
    finalResult.processingTimeMs = Date.now() - startTime;

    // 更新指标
    this.metrics.byStrategy[finalResult.strategy] =
      (this.metrics.byStrategy[finalResult.strategy] || 0) + 1;
    this.metrics.totalTimeMs += finalResult.processingTimeMs;

    if (finalResult.needsReview) {
      this.metrics.manualReviewCount++;
    }

    // 记录历史
    const historyEntry: FallbackHistory = {
      questionId: context.questionId,
      trigger,
      attempts: attemptHistory,
      finalResult,
      totalTimeMs: finalResult.processingTimeMs,
      timestamp: Date.now()
    };

    this.history.push(historyEntry);

    return finalResult;
  }

  /**
   * 分类错误类型
   */
  private classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch')) {
      return ErrorType.NETWORK;
    }

    if (message.includes('timeout') || message.includes('aborted')) {
      return ErrorType.TIMEOUT;
    }

    if (message.includes('parse') || message.includes('json')) {
      return ErrorType.PARSE;
    }

    if (message.includes('api') || message.includes('rate limit')) {
      return ErrorType.API;
    }

    if (message.includes('insufficient') || message.includes('not found')) {
      return ErrorType.INSUFFICIENT_DATA;
    }

    if (message.includes('model')) {
      return ErrorType.MODEL;
    }

    return ErrorType.UNKNOWN;
  }

  /**
   * 确定优先级
   */
  private determinePriority(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    const type = this.classifyError(error);

    switch (type) {
      case 'network':
      case 'timeout':
        return 'high';

      case 'parse':
      case 'api':
        return 'medium';

      case 'insufficient_data':
        return 'low';

      case 'model':
        return 'critical';

      default:
        return 'medium';
    }
  }

  /**
   * 选择 fallback 策略
   */
  private selectStrategy(trigger: FallbackTrigger): any {
    const { errorType, priority, context } = trigger;

    // 根据错误类型和优先级选择策略
    switch (errorType) {
      case 'network':
      case 'timeout':
        // 网络/超时错误：先重试，再切换模型
        return priority === 'high' ? 'switch_model' : 'retry_same_model';

      case 'api':
        // API 错误：切换模型
        return 'switch_model';

      case 'parse':
        // 解析错误：使用简化流程
        return 'simplified_pipeline';

      case 'insufficient_data':
        // 数据不足：使用传统方法
        return 'use_legacy_method';

      case 'model':
        // 模型错误：切换到完全不同的方法
        return 'use_legacy_method';

      default:
        // 未知错误：人工复核
        return 'manual_review';
    }
  }

  /**
   * 获取下一个策略
   */
  private getNextStrategy(currentStrategy: any): any {
    const strategyOrder: any[] = [
      'retry_same_model',
      'switch_model',
      'use_legacy_method',
      'simplified_pipeline',
      'reduce_scope',
      'use_cache',
      'skip_question',
      'manual_review'
    ];

    const currentIndex = strategyOrder.indexOf(currentStrategy);
    if (currentIndex === -1 || currentIndex === strategyOrder.length - 1) {
      return null;
    }

    return strategyOrder[currentIndex + 1];
  }

  /**
   * 执行带超时的函数
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取指标
   */
  getMetrics() {
    return {
      totalTriggers: this.metrics.totalTriggers,
      byStrategy: this.metrics.byStrategy,
      byErrorType: this.metrics.byErrorType,
      successRate: this.metrics.totalTriggers > 0
        ? this.metrics.successCount / this.metrics.totalTriggers
        : 0,
      avgProcessingTimeMs: this.metrics.totalTriggers > 0
        ? this.metrics.totalTimeMs / this.metrics.totalTriggers
        : 0,
      mostUsedStrategy: this.getMostUsed(),
      mostCommonError: this.getMostCommonError(),
      manualReviewCount: this.metrics.manualReviewCount
    };
  }

  /**
   * 获取最常用的策略
   */
  private getMostUsed(): string {
    const strategies = Object.entries(this.metrics.byStrategy);
    if (strategies.length === 0) return 'none';

    strategies.sort((a, b) => b[1] - a[1]);
    return strategies[0][0];
  }

  /**
   * 获取最常见的错误
   */
  private getMostCommonError(): string {
    const errors = Object.entries(this.metrics.byErrorType);
    if (errors.length === 0) return 'none';

    errors.sort((a, b) => b[1] - a[1]);
    return errors[0][0];
  }

  /**
   * 获取历史记录
   */
  getHistory(limit?: number): FallbackHistory[] {
    if (limit) {
      return this.history.slice(-limit);
    }
    return this.history;
  }

  /**
   * 清除历史记录
   */
  clearHistory(): void {
    this.history = [];
    log.info('Fallback 历史已清除');
  }

  /**
   * 重置指标
   */
  resetMetrics(): void {
    this.metrics = {
      totalTriggers: 0,
      byStrategy: {},
      byErrorType: {},
      successCount: 0,
      totalTimeMs: 0,
      manualReviewCount: 0
    };
    log.info('Fallback 指标已重置');
  }
}

/**
 * 全局管理器实例
 */
let globalManager: FallbackManager | null = null;

/**
 * 获取全局管理器实例
 */
export function getFallbackManager(config?: Partial<FallbackConfig>): FallbackManager {
  if (!globalManager) {
    globalManager = new FallbackManager(config);
  }
  return globalManager;
}
