// lib/confidence/collectors.ts
/**
 * 置信度收集器 - 从各个模块收集置信度信息
 *
 * 核心功能：
 * 1. 收集 OCR 置信度
 * 2. 收集 Graph 置信度
 * 3. 收集 LLM 置信度
 * 4. 收集 Top-K/Rerank 置信度
 * 5. 统一接口
 */

import { createLogger } from '@/lib/logger';
import type { Question } from '@/lib/structure/builder';
import type { TopKResult } from '@/lib/matching/types';
import type { RerankResult } from '@/lib/rerank/types';
import type {
  CollectedConfidence,
  ConfidenceSources,
  ConfidenceMetadata
} from './types';

const log = createLogger('ConfidenceCollectors');

/**
 * 置信度收集器类
 */
export class ConfidenceCollector {
  private metadata: Map<string, ConfidenceMetadata[]> = new Map();

  /**
   * 收集单个题目的所有置信度源
   */
  collectConfidence(
    questionId: string,
    sources: {
      question?: Question;
      topKResult?: TopKResult;
      rerankResult?: RerankResult;
      ocrConfidence?: number;
      historicalAccuracy?: number;
      antiHallucinationScore?: number;
    }
  ): CollectedConfidence {
    const confidenceSources: ConfidenceSources = {};
    const availableSources: string[] = [];
    const missingSources: string[] = [];

    // 1. OCR 置信度
    if (sources.ocrConfidence !== undefined) {
      confidenceSources.ocr = sources.ocrConfidence;
      availableSources.push('ocr');
      this.addMetadata(questionId, {
        source: 'ocr',
        rawValue: sources.ocrConfidence,
        normalizedValue: sources.ocrConfidence,
        reliability: 0.9,
        timestamp: Date.now()
      });
    } else {
      missingSources.push('ocr');
    }

    // 2. Graph 置信度（从 Top-K 结果中提取）
    if (sources.topKResult && sources.topKResult.finalMatch) {
      const graphScore = this.computeGraphConfidence(sources.topKResult);
      if (graphScore !== null) {
        confidenceSources.graph = graphScore;
        availableSources.push('graph');
        this.addMetadata(questionId, {
          source: 'graph',
          rawValue: graphScore,
          normalizedValue: graphScore,
          reliability: 0.8,
          timestamp: Date.now(),
          metadata: {
            spatialScore: sources.topKResult.finalMatch.features.spatialScore,
            layoutScore: sources.topKResult.finalMatch.features.layoutScore
          }
        });
      }
    } else {
      missingSources.push('graph');
    }

    // 3. Top-K 置信度
    if (sources.topKResult) {
      confidenceSources.topK = sources.topKResult.confidence;
      availableSources.push('topK');
      this.addMetadata(questionId, {
        source: 'topK',
        rawValue: sources.topKResult.confidence,
        normalizedValue: sources.topKResult.confidence,
        reliability: 0.85,
        timestamp: Date.now(),
        metadata: {
          candidateCount: sources.topKResult.candidates.length,
          needsRerank: sources.topKResult.needsRerank
        }
      });
    } else {
      missingSources.push('topK');
    }

    // 4. Rerank 置信度
    if (sources.rerankResult && sources.rerankResult.success) {
      confidenceSources.rerank = sources.rerankResult.confidence;
      availableSources.push('rerank');
      this.addMetadata(questionId, {
        source: 'rerank',
        rawValue: sources.rerankResult.confidence,
        normalizedValue: sources.rerankResult.confidence,
        reliability: 0.95,
        timestamp: Date.now(),
        metadata: {
          method: sources.rerankResult.method,
          processingTimeMs: sources.rerankResult.processingTimeMs
        }
      });
    } else {
      missingSources.push('rerank');
    }

    // 5. LLM 置信度（从 Question 中提取）
    if (sources.question) {
      const llmConfidence = this.extractLLMConfidence(sources.question);
      if (llmConfidence !== null) {
        confidenceSources.llm = llmConfidence;
        availableSources.push('llm');
        this.addMetadata(questionId, {
          source: 'llm',
          rawValue: llmConfidence,
          normalizedValue: llmConfidence,
          reliability: 0.9,
          timestamp: Date.now()
        });
      }
    } else {
      missingSources.push('llm');
    }

    // 6. 历史准确率
    if (sources.historicalAccuracy !== undefined) {
      confidenceSources.historical = sources.historicalAccuracy;
      availableSources.push('historical');
      this.addMetadata(questionId, {
        source: 'historical',
        rawValue: sources.historicalAccuracy,
        normalizedValue: sources.historicalAccuracy,
        reliability: 0.7,
        timestamp: Date.now()
      });
    } else {
      missingSources.push('historical');
    }

    // 7. 防幻觉置信度
    if (sources.antiHallucinationScore !== undefined) {
      confidenceSources.antiHallucination = sources.antiHallucinationScore;
      availableSources.push('antiHallucination');
      this.addMetadata(questionId, {
        source: 'antiHallucination',
        rawValue: sources.antiHallucinationScore,
        normalizedValue: sources.antiHallucinationScore,
        reliability: 0.8,
        timestamp: Date.now()
      });
    } else {
      missingSources.push('antiHallucination');
    }

    return {
      questionId,
      sources: confidenceSources,
      availableSources,
      missingSources,
      timestamp: Date.now()
    };
  }

  /**
   * 批量收集置信度
   */
  batchCollect(
    items: Array<{
      questionId: string;
      sources: Parameters<ConfidenceCollector['collectConfidence']>['1'];
    }>
  ): Map<string, CollectedConfidence> {
    const results = new Map<string, CollectedConfidence>();

    for (const item of items) {
      const collected = this.collectConfidence(item.questionId, item.sources);
      results.set(item.questionId, collected);
    }

    return results;
  }

  /**
   * 计算 Graph 置信度
   */
  private computeGraphConfidence(topKResult: TopKResult): number | null {
    if (!topKResult.finalMatch) {
      return null;
    }

    const { features } = topKResult.finalMatch;

    // Graph 置信度 = 空间得分 * 0.6 + 布局得分 * 0.4
    const graphConfidence =
      features.spatialScore * 0.6 +
      features.layoutScore * 0.4;

    return Math.min(1, Math.max(0, graphConfidence));
  }

  /**
   * 从 Question 中提取 LLM 置信度
   */
  private extractLLMConfidence(question: Question): number | null {
    // LLM 置信度可能存储在不同位置
    // 这里假设从某个字段提取，实际需要根据数据结构调整

    // 方案 1: 从 answer_blocks 的 confidence 字段
    if (question.answer_blocks && question.answer_blocks.length > 0) {
      const confidences = question.answer_blocks
        .map(b => b.confidence)
        .filter((c): c is number => c !== undefined);

      if (confidences.length > 0) {
        // 取平均
        return confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
      }
    }

    // 方案 2: 从自定义字段（需要扩展 Question 类型）
    // if (question.llm_confidence !== undefined) {
    //   return question.llm_confidence;
    // }

    return null;
  }

  /**
   * 添加元数据
   */
  private addMetadata(questionId: string, metadata: ConfidenceMetadata): void {
    if (!this.metadata.has(questionId)) {
      this.metadata.set(questionId, []);
    }
    this.metadata.get(questionId)!.push(metadata);
  }

  /**
   * 获取元数据
   */
  getMetadata(questionId: string): ConfidenceMetadata[] | undefined {
    return this.metadata.get(questionId);
  }

  /**
   * 清除元数据
   */
  clearMetadata(questionId?: string): void {
    if (questionId) {
      this.metadata.delete(questionId);
    } else {
      this.metadata.clear();
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalQuestions: number;
    avgSourcesPerQuestion: number;
    sourceAvailability: Record<string, number>;
  } {
    const totalQuestions = this.metadata.size;

    let totalSources = 0;
    const sourceAvailability: Record<string, number> = {};

    for (const [, metadatas] of this.metadata.entries()) {
      totalSources += metadatas.length;

      for (const meta of metadatas) {
        sourceAvailability[meta.source] = (sourceAvailability[meta.source] || 0) + 1;
      }
    }

    return {
      totalQuestions,
      avgSourcesPerQuestion: totalQuestions > 0 ? totalSources / totalQuestions : 0,
      sourceAvailability
    };
  }
}

/**
 * 全局收集器实例
 */
let globalCollector: ConfidenceCollector | null = null;

/**
 * 获取全局收集器实例
 */
export function getConfidenceCollector(): ConfidenceCollector {
  if (!globalCollector) {
    globalCollector = new ConfidenceCollector();
  }
  return globalCollector;
}
