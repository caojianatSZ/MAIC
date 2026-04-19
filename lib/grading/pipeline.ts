// lib/grading/pipeline.ts
/**
 * 端到端批改流程
 *
 * 核心功能：
 * 1. 完整的批改流程编排
 * 2. 模块间协调和数据流转
 * 3. 错误处理和监控
 * 4. 性能和成本追踪
 */

import { createLogger } from '@/lib/logger';
import { matchAnswersEnhanced } from './enhanced-matcher';
import { getFallbackManager } from '@/lib/fallback/manager';
import { getConfidenceCollector } from '@/lib/confidence/collectors';
import { fuseConfidence } from '@/lib/confidence/fusion';
import { getFallbackMonitor } from '@/lib/fallback/monitor';
import type { Question, OCRBlock } from '@/lib/structure/builder';
import type { GradingSystemConfig } from './config';
import type { TopKResult } from '@/lib/matching/types';
import type { RerankResult } from '@/lib/rerank/types';
import type { FallbackResult } from '@/lib/fallback/types';

const log = createLogger('GradingPipeline');

/**
 * 批改结果
 */
export interface GradingResult {
  /** 题目列表（带答案和置信度） */
  questions: Question[];
  /** Top-K 匹配结果 */
  topKResults: TopKResult[];
  /** Rerank 结果 */
  rerankResults: Map<string, RerankResult>;
  /** 融合后的置信度 */
  fusedConfidences: Map<string, number>;
  /** Fallback 使用情况 */
  fallbackUsed: Map<string, FallbackResult>;
  /** 性能指标 */
  performance: {
    totalTimeMs: number;
    matchingTimeMs: number;
    rerankingTimeMs: number;
    fusionTimeMs: number;
    fallbackTimeMs: number;
  };
  /** 成本指标 */
  cost: {
    llmCalls: number;
    estimatedCost: number;
  };
  /** 统计信息 */
  stats: {
    totalQuestions: number;
    matchedQuestions: number;
    rerankedQuestions: number;
    fallbackQuestions: number;
    avgConfidence: number;
    lowConfidenceCount: number;
  };
}

/**
 * 执行端到端批改流程
 */
export async function executeGradingPipeline(
  questions: Question[],
  handwritingBlocks: OCRBlock[],
  imageBase64: string,
  config?: Partial<GradingSystemConfig>
): Promise<GradingResult> {
  const startTime = Date.now();
  const performance = {
    totalTimeMs: 0,
    matchingTimeMs: 0,
    rerankingTimeMs: 0,
    fusionTimeMs: 0,
    fallbackTimeMs: 0
  };

  const cost = {
    llmCalls: 0,
    estimatedCost: 0
  };

  log.info('开始端到端批改流程', {
    questionCount: questions.length,
    answerCount: handwritingBlocks.length,
    hasImage: !!imageBase64
  });

  // 步骤 1: Top-K 匹配（增强版，包含 rerank）
  const matchStartTime = Date.now();

  let matchingResult;
  try {
    matchingResult = await matchAnswersEnhanced(questions, handwritingBlocks, {
      k: config?.topK?.k,
      enableRerank: config?.topK?.enabled,
      imageBase64,
      maxReranks: 10,
      debug: config?.system?.debug
    });
  } catch (error) {
    log.error('Top-K 匹配失败，触发 Fallback', { error });

    // 使用 Fallback
    const fallbackManager = getFallbackManager();
    const fallbackStartTime = Date.now();

    const fallbackResult = await fallbackManager.executeWithFallback(
      {
        questionId: 'all',
        questionContent: questions.map(q => q.question).join('\n'),
        handwritingBlocks,
        imageBase64,
        attemptedMethods: ['top_k_matching']
      },
      async () => {
        // 重试匹配
        return await matchAnswersEnhanced(questions, handwritingBlocks, {
          k: config?.topK?.k,
          enableRerank: false, // 降级：不使用 rerank
          imageBase64,
          debug: config?.system?.debug
        });
      }
    );

    performance.fallbackTimeMs = Date.now() - fallbackStartTime;

    if (!fallbackResult.success) {
      throw new Error(`批改失败且 Fallback 也失败: ${fallbackResult.error}`);
    }

    matchingResult = fallbackResult.result;
  }

  performance.matchingTimeMs = Date.now() - matchStartTime;

  const {
    questions: matchedQuestions,
    topKResults,
    rerankResults,
    stats: matchingStats
  } = matchingResult;

  // 步骤 2: 置信度融合
  const fusionStartTime = Date.now();

  const collector = getConfidenceCollector();
  const fusedConfidences = new Map<string, number>();

  for (const question of matchedQuestions) {
    // 收集置信度
    const collected = collector.collectConfidence(question.question_id, {
      question,
      topKResult: topKResults.find((r: TopKResult) => r.questionId === question.question_id),
      rerankResult: rerankResults.get(question.question_id),
      historicalAccuracy: 0.85, // TODO: 从历史数据获取
      antiHallucinationScore: 0.8 // TODO: 从防幻觉模块获取
    });

    // 融合置信度
    const fusionResult = fuseConfidence(collected.sources, 'adaptive', config?.fusion);

    fusedConfidences.set(question.question_id, fusionResult.confidence);

    // 更新题目置信度
    if (question.answer_blocks && question.answer_blocks.length > 0) {
      question.answer_blocks[0].confidence = fusionResult.confidence;
    }
  }

  performance.fusionTimeMs = Date.now() - fusionStartTime;

  // 步骤 3: 统计和成本计算
  const avgConfidence = Array.from(fusedConfidences.values()).reduce((sum, c) => sum + c, 0) / fusedConfidences.size;
  const lowConfidenceCount = Array.from(fusedConfidences.values()).filter(c => c < 0.75).length;

  // 计算 LLM 调用次数（rerank + fallback）
  cost.llmCalls = rerankResults.size;
  if (performance.fallbackTimeMs > 0) {
    cost.llmCalls += 1;
  }

  // 估算成本（假设每次调用 0.01 元）
  cost.estimatedCost = cost.llmCalls * 0.01;

  // 记录性能指标
  const monitor = getFallbackMonitor();
  if (config?.system?.enablePerformanceMonitoring) {
    monitor.recordExecution(
      'simplified_pipeline',
      true,
      performance.totalTimeMs,
      { pipeline: 'grading' }
    );
  }

  performance.totalTimeMs = Date.now() - startTime;

  const stats = {
    totalQuestions: questions.length,
    matchedQuestions: matchingStats.matchedQuestions,
    rerankedQuestions: matchingStats.rerankedQuestions,
    fallbackQuestions: performance.fallbackTimeMs > 0 ? 1 : 0,
    avgConfidence,
    lowConfidenceCount
  };

  log.info('端到端批改流程完成', {
    ...performance,
    ...stats,
    cost: cost.estimatedCost
  });

  return {
    questions: matchedQuestions,
    topKResults,
    rerankResults,
    fusedConfidences,
    fallbackUsed: performance.fallbackTimeMs > 0 ? new Map([['all', {
      success: true,
      strategy: 'use_legacy_method',
      processingTimeMs: performance.fallbackTimeMs,
      confidence: 0.7,
      needsReview: false
    }]]) : new Map(),
    performance,
    cost,
    stats
  };
}

/**
 * 批量批改多张试卷
 */
export async function batchGradeExams(
  exams: Array<{
    questions: Question[];
    handwritingBlocks: OCRBlock[];
    imageBase64: string;
  }>,
  config?: Partial<GradingSystemConfig>
): Promise<GradingResult[]> {
  const maxConcurrency = config?.system?.maxConcurrency || 5;
  const results: GradingResult[] = [];

  // 分批处理
  for (let i = 0; i < exams.length; i += maxConcurrency) {
    const batch = exams.slice(i, i + maxConcurrency);

    const batchResults = await Promise.all(
      batch.map(exam =>
        executeGradingPipeline(
          exam.questions,
          exam.handwritingBlocks,
          exam.imageBase64,
          config
        )
      )
    );

    results.push(...batchResults);

    log.info(`批改进度: ${Math.min(i + maxConcurrency, exams.length)}/${exams.length}`);
  }

  return results;
}

/**
 * 快速批改（简化流程，用于预览）
 */
export async function quickGrade(
  questions: Question[],
  handwritingBlocks: OCRBlock[]
): Promise<Question[]> {
  log.info('快速批改', {
    questionCount: questions.length,
    answerCount: handwritingBlocks.length
  });

  // 使用最基础的匹配，不使用 Top-K 和 Rerank
  const { matchAnswers } = await import('@/lib/structure/matcher');

  const matchedQuestions = matchAnswers(questions, handwritingBlocks);

  log.info('快速批改完成', {
    matchedCount: matchedQuestions.filter(q => q.answer_blocks.length > 0).length
  });

  return matchedQuestions;
}
