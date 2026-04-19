// lib/grading/orchestrator.ts
/**
 * 统一编排器 - 顶层 API
 *
 * 核心功能：
 * 1. 提供简单易用的批改 API
 * 2. 自动选择最佳策略
 * 3. 处理各种输入格式
 * 4. 生成友好的输出格式
 */

import { createLogger } from '@/lib/logger';
import { executeGradingPipeline, quickGrade } from './pipeline';
import { getGradingConfig, loadGradingPreset } from './config';
import type { Question, OCRBlock } from '@/lib/structure/builder';
import type { GradingSystemConfig } from './config';
import type { GradingResult } from './pipeline';

const log = createLogger('GradingOrchestrator');

/**
 * 批改选项
 */
export interface GradeExamOptions {
  /** 配置预设或自定义配置 */
  config?: string | Partial<GradingSystemConfig>;
  /** 是否使用快速模式 */
  fast?: boolean;
  /** 回调函数（进度更新） */
  onProgress?: (progress: number, message: string) => void;
}

/**
 * 批改试卷（主入口）
 *
 * @param imageBase64 试卷图像（base64）
 * @param ocrResult OCR 识别结果
 * @param options 批改选项
 * @returns 批改结果
 */
export async function gradeExamPaper(
  imageBase64: string,
  ocrResult: {
    questions: Question[];
    handwritingBlocks: OCRBlock[];
  },
  options: GradeExamOptions = {}
): Promise<GradingResult> {
  const startTime = Date.now();

  log.info('开始批改试卷', {
    questionCount: ocrResult.questions.length,
    answerCount: ocrResult.handwritingBlocks.length,
    options
  });

  try {
    // 加载配置
    if (typeof options.config === 'string') {
      loadGradingPreset(options.config);
    }

    // 快速模式
    if (options.fast) {
      log.info('使用快速批改模式');

      const matchedQuestions = await quickGrade(
        ocrResult.questions,
        ocrResult.handwritingBlocks
      );

      return {
        questions: matchedQuestions,
        topKResults: [],
        rerankResults: new Map(),
        fusedConfidences: new Map(),
        fallbackUsed: new Map(),
        performance: {
          totalTimeMs: Date.now() - startTime,
          matchingTimeMs: Date.now() - startTime,
          rerankingTimeMs: 0,
          fusionTimeMs: 0,
          fallbackTimeMs: 0
        },
        cost: {
          llmCalls: 0,
          estimatedCost: 0
        },
        stats: {
          totalQuestions: ocrResult.questions.length,
          matchedQuestions: matchedQuestions.filter(q => q.answer_blocks.length > 0).length,
          rerankedQuestions: 0,
          fallbackQuestions: 0,
          avgConfidence: 0.8,
          lowConfidenceCount: 0
        }
      };
    }

    // 完整模式：端到端流程
    if (options.onProgress) {
      options.onProgress(0.1, '开始 Top-K 匹配...');
    }

    const result = await executeGradingPipeline(
      ocrResult.questions,
      ocrResult.handwritingBlocks,
      imageBase64,
      typeof options.config === 'object' ? options.config : undefined
    );

    if (options.onProgress) {
      options.onProgress(1.0, '批改完成');
    }

    log.info('批改成功', {
      totalTimeMs: result.performance.totalTimeMs,
      matchedQuestions: result.stats.matchedQuestions,
      avgConfidence: result.stats.avgConfidence,
      cost: result.cost.estimatedCost
    });

    return result;
  } catch (error) {
    log.error('批改失败', { error });
    throw error;
  }
}

/**
 * 批量批改多张试卷
 */
export async function gradeExamPapers(
  papers: Array<{
    imageBase64: string;
    ocrResult: {
      questions: Question[];
      handwritingBlocks: OCRBlock[];
    };
  }>,
  options: GradeExamOptions = {}
): Promise<GradingResult[]> {
  log.info('开始批量批改', {
    paperCount: papers.length,
    options
  });

  const results: GradingResult[] = [];

  for (let i = 0; i < papers.length; i++) {
    const paper = papers[i];

    if (options.onProgress) {
      options.onProgress(
        (i + 1) / papers.length,
        `正在批改第 ${i + 1}/${papers.length} 张试卷...`
      );
    }

    try {
      const result = await gradeExamPaper(
        paper.imageBase64,
        paper.ocrResult,
        {
          ...options,
          onProgress: undefined // 批量模式不显示单张进度
        }
      );

      results.push(result);
    } catch (error) {
      log.error(`批改第 ${i + 1} 张试卷失败`, { error });

      // 失败的试卷添加空结果
      results.push({
        questions: paper.ocrResult.questions,
        topKResults: [],
        rerankResults: new Map(),
        fusedConfidences: new Map(),
        fallbackUsed: new Map(),
        performance: {
          totalTimeMs: 0,
          matchingTimeMs: 0,
          rerankingTimeMs: 0,
          fusionTimeMs: 0,
          fallbackTimeMs: 0
        },
        cost: {
          llmCalls: 0,
          estimatedCost: 0
        },
        stats: {
          totalQuestions: paper.ocrResult.questions.length,
          matchedQuestions: 0,
          rerankedQuestions: 0,
          fallbackQuestions: 0,
          avgConfidence: 0,
          lowConfidenceCount: 0
        }
      });
    }
  }

  log.info('批量批改完成', {
    totalPapers: papers.length,
    successfulPapers: results.filter(r => r.stats.matchedQuestions > 0).length,
    avgTimeMs: results.reduce((sum, r) => sum + r.performance.totalTimeMs, 0) / results.length,
    totalCost: results.reduce((sum, r) => sum + r.cost.estimatedCost, 0)
  });

  return results;
}

/**
 * 获取批改报告
 */
export function generateGradingReport(result: GradingResult): string {
  const {
    questions,
    stats,
    performance,
    cost
  } = result;

  const report = `
试卷批改报告
========================================

【统计信息】
总题目数：${stats.totalQuestions}
已匹配：${stats.matchedQuestions}
Rerank：${stats.rerankedQuestions}
Fallback：${stats.fallbackQuestions}
平均置信度：${(stats.avgConfidence * 100).toFixed(1)}%
低置信度题目：${stats.lowConfidenceCount}

【性能指标】
总耗时：${performance.totalTimeMs}ms
  - Top-K 匹配：${performance.matchingTimeMs}ms
  - Rerank：${performance.rerankingTimeMs}ms
  - 置信度融合：${performance.fusionTimeMs}ms
  - Fallback：${performance.fallbackTimeMs}ms

【成本估算】
LLM 调用次数：${cost.llmCalls}
估算成本：¥${cost.estimatedCost.toFixed(2)}

【题目详情】
${questions.map((q, i) => {
  const confidence = result.fusedConfidences.get(q.question_id) || 0;
  const needsReview = confidence < 0.75;

  return `
${i + 1}. 题目 ${q.question_id}
   答案：${q.student_answer || '未匹配'}
   置信度：${(confidence * 100).toFixed(1)}%${needsReview ? '（需复核）' : ''}
`;
}).join('\n')}

========================================
生成时间：${new Date().toLocaleString('zh-CN')}
  `.trim();

  return report;
}

/**
 * 获取批改配置
 */
export function getCurrentConfig(): GradingSystemConfig {
  return getGradingConfig();
}

/**
 * 更新批改配置
 */
export async function updateGradingConfig(config: Partial<GradingSystemConfig>): Promise<void> {
  const configManager = (await import('./config')).getGradingConfigManager();
  configManager.updateConfig(config);
  log.info('批改配置已更新');
}

/**
 * 验证批改配置
 */
export async function validateGradingConfig(): Promise<{ valid: boolean; errors: string[] }> {
  const configManager = (await import('./config')).getGradingConfigManager();
  return configManager.validateConfig();
}

/**
 * 导出批改配置
 */
export async function exportGradingConfig(): Promise<string> {
  const configManager = (await import('./config')).getGradingConfigManager();
  return configManager.exportConfig();
}

/**
 * 导入批改配置
 */
export async function importGradingConfig(jsonConfig: string): Promise<void> {
  const configManager = (await import('./config')).getGradingConfigManager();
  configManager.importConfig(jsonConfig);
  log.info('批改配置已导入');
}
