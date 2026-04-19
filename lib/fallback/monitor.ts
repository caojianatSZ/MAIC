// lib/fallback/monitor.ts
/**
 * Fallback 监控和优化
 *
 * 核心功能：
 * 1. 实时监控 fallback 使用情况
 * 2. 分析策略性能
 * 3. 学习和优化
 * 4. 报告和告警
 */

import { createLogger } from '@/lib/logger';
import type {
  FallbackMetrics,
  StrategyPerformance,
  LearningData,
  FallbackStrategy,
  ErrorType
} from './types';

const log = createLogger('FallbackMonitor');

/**
 * Fallback 监控器
 */
export class FallbackMonitor {
  private performanceData: Map<FallbackStrategy, StrategyPerformance> = new Map();
  private learningData: LearningData = {
    errorToStrategy: new Map(),
    strategyHistory: new Map(),
    contextFeatures: []
  };
  private alerts: Array<{
    timestamp: number;
    severity: 'info' | 'warning' | 'error';
    message: string;
    details?: any;
  }> = [];

  constructor() {
    this.initializePerformanceData();
  }

  /**
   * 初始化性能数据
   */
  private initializePerformanceData(): void {
    const strategies: FallbackStrategy[] = [
      'retry_same_model',
      'switch_model',
      'use_legacy_method',
      'reduce_scope',
      'use_cache',
      'manual_review',
      'skip_question',
      'simplified_pipeline'
    ];

    for (const strategy of strategies) {
      this.performanceData.set(strategy, {
        strategy,
        usageCount: 0,
        successCount: 0,
        successRate: 0,
        avgProcessingTimeMs: 0,
        lastUsedAt: 0
      });
    }
  }

  /**
   * 记录策略执行
   */
  recordExecution(
    strategy: FallbackStrategy,
    success: boolean,
    processingTimeMs: number,
    context?: any
  ): void {
    const perf = this.performanceData.get(strategy);
    if (!perf) return;

    // 更新使用次数
    perf.usageCount++;

    // 更新成功次数和成功率
    if (success) {
      perf.successCount++;
    }
    perf.successRate = perf.successCount / perf.usageCount;

    // 更新平均处理时间
    perf.avgProcessingTimeMs =
      (perf.avgProcessingTimeMs * (perf.usageCount - 1) + processingTimeMs) /
      perf.usageCount;

    // 更新最后使用时间
    perf.lastUsedAt = Date.now();

    // 记录到学习数据
    if (context) {
      this.learningData.contextFeatures.push({
        context,
        strategy,
        success,
        timestamp: Date.now()
      });
    }

    // 检查告警条件
    this.checkAlerts(strategy, perf);
  }

  /**
   * 检查告警
   */
  private checkAlerts(strategy: FallbackStrategy, perf: StrategyPerformance): void {
    // 成功率过低告警
    if (perf.usageCount >= 10 && perf.successRate < 0.5) {
      this.addAlert('warning', `策略 ${strategy} 成功率过低`, {
        strategy,
        successRate: perf.successRate,
        usageCount: perf.usageCount
      });
    }

    // 处理时间过长告警
    if (perf.usageCount >= 5 && perf.avgProcessingTimeMs > 5000) {
      this.addAlert('warning', `策略 ${strategy} 处理时间过长`, {
        strategy,
        avgProcessingTimeMs: perf.avgProcessingTimeMs
      });
    }

    // 人工复核过多告警
    if (strategy === 'manual_review' && perf.usageCount >= 20) {
      this.addAlert('error', '人工复核次数过多', {
        usageCount: perf.usageCount
      });
    }
  }

  /**
   * 添加告警
   */
  private addAlert(
    severity: 'info' | 'warning' | 'error',
    message: string,
    details?: any
  ): void {
    this.alerts.push({
      timestamp: Date.now(),
      severity,
      message,
      details
    });

    log.warn(`Fallback 告警: ${message}`, details);
  }

  /**
   * 计算综合指标
   */
  computeMetrics(): FallbackMetrics {
    const strategies = Array.from(this.performanceData.values());

    const totalTriggers = strategies.reduce((sum, s) => sum + s.usageCount, 0);
    const byStrategy: any = {};
    const byErrorType: any = {};

    for (const perf of strategies) {
      byStrategy[perf.strategy] = perf.usageCount;
    }

    // 从学习数据中统计错误类型
    for (const feature of this.learningData.contextFeatures) {
      if (feature.context && (feature.context as any).trigger) {
        const errorType = (feature.context as any).trigger.errorType;
        byErrorType[errorType] = (byErrorType[errorType] || 0) + 1;
      }
    }

    const successCount = strategies.reduce((sum, s) => sum + s.successCount, 0);
    const successRate = totalTriggers > 0 ? successCount / totalTriggers : 0;

    const totalTimeMs = strategies.reduce(
      (sum, s) => sum + s.avgProcessingTimeMs * s.usageCount,
      0
    );
    const avgProcessingTimeMs = totalTriggers > 0 ? totalTimeMs / totalTriggers : 0;

    const mostUsedStrategy = strategies.reduce((max, s) =>
      s.usageCount > max.usageCount ? s : max
    , strategies[0])?.strategy || 'none';

    const mostCommonError = (Object.entries(byErrorType).sort(
      (a, b) => (b[1] as number) - (a[1] as number)
    )[0]?.[0] as string) || 'none';

    const manualReviewCount =
      this.performanceData.get('manual_review')?.usageCount || 0;

    return {
      totalTriggers,
      byStrategy,
      byErrorType,
      successRate,
      avgProcessingTimeMs,
      mostUsedStrategy,
      mostCommonError: mostCommonError as any,
      manualReviewCount
    };
  }

  /**
   * 获取策略性能排名
   */
  getStrategyRanking(): Array<{
    strategy: FallbackStrategy;
    rank: number;
    score: number;
    details: StrategyPerformance;
  }> {
    const strategies = Array.from(this.performanceData.values());

    // 计算综合得分：成功率 * 0.6 - (处理时间 / 10000) * 0.4
    const ranked = strategies.map(perf => {
      const score = perf.successRate * 0.6 - (perf.avgProcessingTimeMs / 10000) * 0.4;
      return {
        strategy: perf.strategy,
        score,
        details: perf
      };
    });

    // 按得分排序
    ranked.sort((a, b) => b.score - a.score);

    // 添加排名
    return ranked.map((item, index) => ({
      ...item,
      rank: index + 1
    }));
  }

  /**
   * 获取优化建议
   */
  getRecommendations(): Array<{
    priority: 'high' | 'medium' | 'low';
    category: string;
    recommendation: string;
    details?: any;
  }> {
    const recommendations: Array<{
      priority: 'high' | 'medium' | 'low';
      category: string;
      recommendation: string;
      details?: any;
    }> = [];

    const metrics = this.computeMetrics();
    const ranking = this.getStrategyRanking();

    // 建议 1: 人工复核过多
    if (metrics.manualReviewCount > 50) {
      recommendations.push({
        priority: 'high',
        category: 'efficiency',
        recommendation: '人工复核次数过多，建议优化自动批改流程',
        details: { manualReviewCount: metrics.manualReviewCount }
      });
    }

    // 建议 2: 成功率过低
    if (metrics.successRate < 0.7) {
      recommendations.push({
        priority: 'high',
        category: 'quality',
        recommendation: 'Fallback 成功率过低，建议检查策略配置',
        details: { successRate: metrics.successRate }
      });
    }

    // 建议 3: 处理时间过长
    if (metrics.avgProcessingTimeMs > 3000) {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        recommendation: '平均处理时间过长，建议优化算法',
        details: { avgProcessingTimeMs: metrics.avgProcessingTimeMs }
      });
    }

    // 建议 4: 最佳策略使用不足
    const bestStrategy = ranking[0];
    if (bestStrategy && bestStrategy.details.usageCount < 5) {
      recommendations.push({
        priority: 'low',
        category: 'optimization',
        recommendation: `最佳策略 ${bestStrategy.strategy} 使用不足，考虑优先使用`,
        details: {
          strategy: bestStrategy.strategy,
          successRate: bestStrategy.details.successRate
        }
      });
    }

    // 建议 5: 最差策略仍在使用
    const worstStrategy = ranking[ranking.length - 1];
    if (worstStrategy && worstStrategy.details.usageCount > 10) {
      recommendations.push({
        priority: 'medium',
        category: 'optimization',
        recommendation: `策略 ${worstStrategy.strategy} 性能较差，考虑调整或移除`,
        details: {
          strategy: worstStrategy.strategy,
          successRate: worstStrategy.details.successRate,
          usageCount: worstStrategy.details.usageCount
        }
      });
    }

    return recommendations;
  }

  /**
   * 生成报告
   */
  generateReport(): {
    summary: string;
    metrics: FallbackMetrics;
    ranking: Array<any>;
    recommendations: Array<any>;
    alerts: Array<any>;
    timestamp: number;
  } {
    const metrics = this.computeMetrics();
    const ranking = this.getStrategyRanking();
    const recommendations = this.getRecommendations();

    const summary = `
Fallback 监控报告
================

总触发次数: ${metrics.totalTriggers}
成功率: ${(metrics.successRate * 100).toFixed(1)}%
平均处理时间: ${metrics.avgProcessingTimeMs.toFixed(0)}ms
最常用策略: ${metrics.mostUsedStrategy}
最常见错误: ${metrics.mostCommonError}
人工复核: ${metrics.manualReviewCount} 次

策略排名:
${ranking.slice(0, 5).map(r =>
  `${r.rank}. ${r.strategy}: 成功率 ${(r.details.successRate * 100).toFixed(1)}%, 处理时间 ${r.details.avgProcessingTimeMs.toFixed(0)}ms`
).join('\n')}

优化建议: ${recommendations.length} 条
告警: ${this.alerts.length} 条
    `.trim();

    return {
      summary,
      metrics,
      ranking: ranking.slice(0, 10),
      recommendations,
      alerts: this.alerts.slice(-20),
      timestamp: Date.now()
    };
  }

  /**
   * 获取告警
   */
  getAlerts(severity?: 'info' | 'warning' | 'error'): Array<any> {
    if (severity) {
      return this.alerts.filter(a => a.severity === severity);
    }
    return this.alerts;
  }

  /**
   * 清除告警
   */
  clearAlerts(): void {
    this.alerts = [];
    log.info('告警已清除');
  }

  /**
   * 导出数据
   */
  exportData(): {
    performanceData: Array<StrategyPerformance>;
    learningData: {
      errorToStrategy: Array<any>;
      strategyHistory: Array<any>;
      contextFeatures: Array<any>;
    };
    alerts: Array<any>;
  } {
    return {
      performanceData: Array.from(this.performanceData.values()),
      learningData: {
        errorToStrategy: Array.from(this.learningData.errorToStrategy.entries()),
        strategyHistory: Array.from(this.learningData.strategyHistory.entries()),
        contextFeatures: this.learningData.contextFeatures
      },
      alerts: this.alerts
    };
  }
}

/**
 * 全局监控器实例
 */
let globalMonitor: FallbackMonitor | null = null;

/**
 * 获取全局监控器实例
 */
export function getFallbackMonitor(): FallbackMonitor {
  if (!globalMonitor) {
    globalMonitor = new FallbackMonitor();
  }
  return globalMonitor;
}
