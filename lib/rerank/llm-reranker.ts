// lib/rerank/llm-reranker.ts
/**
 * LLM Reranker - 使用 LLM 进行候选答案重排序
 *
 * 核心功能：
 * 1. 语义 rerank：基于文本理解
 * 2. 视觉 rerank：基于图像分析
 * 3. 混合 rerank：综合语义和视觉
 */

import { createLogger } from '@/lib/logger';
import {
  createQuestionAnswerRankingPrompt,
  createVisualVerificationPrompt,
  createHybridRerankPrompt
} from './prompts';
import type {
  RerankRequest,
  RerankResult,
  RerankedCandidate,
  RerankConfig,
  RerankStats
} from './types';

const log = createLogger('LLMReranker');

/**
 * 默认配置
 */
const DEFAULT_CONFIG: RerankConfig = {
  defaultModel: 'glm-4-flash',
  visionModel: 'glm-4v-plus',
  maxConcurrentRequests: 3,
  requestTimeout: 10000,
  enableCache: true,
  cacheExpirationSeconds: 300,
  triggerThresholds: {
    lowConfidence: 0.75,
    closeScores: 0.15,
    fewCandidates: 2,
    highVariance: 0.3
  }
};

/**
 * 全局统计
 */
const stats: RerankStats = {
  totalReranks: 0,
  semanticReranks: 0,
  visualReranks: 0,
  hybridReranks: 0,
  avgProcessingTimeMs: 0,
  successRate: 0,
  rankingChanges: 0
};

/**
 * LLM Reranker 类
 */
export class LLMReranker {
  private config: RerankConfig;
  private cache: Map<string, { result: RerankResult; timestamp: number }>;

  constructor(config: Partial<RerankConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
  }

  /**
   * 执行语义 rerank
   */
  async semanticRerank(request: RerankRequest): Promise<RerankResult> {
    const startTime = Date.now();

    try {
      // 检查缓存
      const cacheKey = this.getCacheKey('semantic', request);
      if (this.config.enableCache && this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey)!;
        if (Date.now() - cached.timestamp < this.config.cacheExpirationSeconds * 1000) {
          log.debug('使用缓存的语义 rerank 结果', { questionId: request.questionId });
          return cached.result;
        }
      }

      // 构建 prompt
      const prompt = createQuestionAnswerRankingPrompt(
        request.questionContent,
        request.questionType || '未知',
        request.candidates.map((c, i) => ({
          index: i,
          answer: c.answerText,
          confidence: c.confidence,
          features: c.features ? JSON.stringify(c.features) : undefined
        }))
      );

      // 调用 GLM API
      const response = await this.callGLMText(prompt, this.config.defaultModel);

      // 解析响应
      const parsed = this.parseRerankResponse(response);

      // 构建 reranked candidates
      const rerankedCandidates: RerankedCandidate[] = parsed.ranking.map((idx, rank) => ({
        originalIndex: idx,
        answerText: request.candidates[idx].answerText,
        answerBbox: request.candidates[idx].answerBbox,
        originalConfidence: request.candidates[idx].confidence,
        rerankedConfidence: request.candidates[idx].confidence * 0.5 + 0.5 * (1 - rank * 0.1),
        rank: rank + 1,
        reason: parsed.reasoning || '语义重排序'
      }));

      // 构建结果
      const result: RerankResult = {
        questionId: request.questionId,
        rerankedCandidates,
        finalAnswer: rerankedCandidates[0] || null,
        confidence: rerankedCandidates[0]?.rerankedConfidence || 0,
        success: true,
        method: 'semantic',
        processingTimeMs: Date.now() - startTime,
        debugInfo: {
          modelUsed: this.config.defaultModel,
          originalRanking: request.candidates.map((_, i) => i),
          newRanking: parsed.ranking,
          reason: parsed.reasoning
        }
      };

      // 更新统计
      this.updateStats('semantic', result.processingTimeMs, this.hasRankingChanged(result));

      // 缓存结果
      if (this.config.enableCache) {
        this.cache.set(cacheKey, { result, timestamp: Date.now() });
      }

      return result;
    } catch (error) {
      log.error('语义 rerank 失败', { questionId: request.questionId, error });
      return {
        questionId: request.questionId,
        rerankedCandidates: [],
        finalAnswer: null,
        confidence: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        method: 'semantic',
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * 执行视觉 rerank
   */
  async visualRerank(request: RerankRequest): Promise<RerankResult> {
    const startTime = Date.now();

    if (!request.imageBase64) {
      return {
        questionId: request.questionId,
        rerankedCandidates: [],
        finalAnswer: null,
        confidence: 0,
        success: false,
        error: '缺少图像数据，无法执行视觉 rerank',
        method: 'visual',
        processingTimeMs: Date.now() - startTime
      };
    }

    try {
      // 构建 prompt
      const prompt = createVisualVerificationPrompt(
        request.questionContent,
        request.questionType || '未知',
        request.candidates.map((c, i) => ({
          index: i,
          answer: c.answerText,
          confidence: c.confidence,
          features: c.features ? `距离: (${c.features.horizontalDistance}, ${c.features.verticalDistance})` : undefined
        })),
        true
      );

      // 调用 GLM 视觉 API
      const response = await this.callGLMVision(
        prompt,
        request.imageBase64,
        this.config.visionModel
      );

      // 解析响应
      const parsed = this.parseVisualRerankResponse(response);

      // 构建 reranked candidates
      const rerankedCandidates: RerankedCandidate[] = parsed.ranking.map((idx, rank) => ({
        originalIndex: idx,
        answerText: request.candidates[idx].answerText,
        answerBbox: request.candidates[idx].answerBbox,
        originalConfidence: request.candidates[idx].confidence,
        rerankedConfidence: request.candidates[idx].confidence * 0.4 + 0.6 * (1 - rank * 0.1),
        rank: rank + 1,
        reason: parsed.visual_analysis || '视觉验证'
      }));

      // 构建结果
      const result: RerankResult = {
        questionId: request.questionId,
        rerankedCandidates,
        finalAnswer: rerankedCandidates[0] || null,
        confidence: rerankedCandidates[0]?.rerankedConfidence || 0,
        success: true,
        method: 'visual',
        processingTimeMs: Date.now() - startTime,
        debugInfo: {
          modelUsed: this.config.visionModel,
          originalRanking: request.candidates.map((_, i) => i),
          newRanking: parsed.ranking,
          reason: parsed.visual_analysis
        }
      };

      // 更新统计
      this.updateStats('visual', result.processingTimeMs, this.hasRankingChanged(result));

      return result;
    } catch (error) {
      log.error('视觉 rerank 失败', { questionId: request.questionId, error });
      return {
        questionId: request.questionId,
        rerankedCandidates: [],
        finalAnswer: null,
        confidence: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        method: 'visual',
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * 执行混合 rerank
   */
  async hybridRerank(request: RerankRequest): Promise<RerankResult> {
    const startTime = Date.now();

    if (!request.imageBase64) {
      // 降级到语义 rerank
      log.warn('混合 rerank 降级到语义 rerank（缺少图像）', { questionId: request.questionId });
      return this.semanticRerank(request);
    }

    try {
      // 构建 prompt
      const prompt = createHybridRerankPrompt(
        request.questionContent,
        request.questionType || '未知',
        request.candidates.map((c, i) => ({
          index: i,
          answer: c.answerText,
          confidence: c.confidence,
          features: c.features ? `距离: (${c.features.horizontalDistance.toFixed(0)}, ${c.features.verticalDistance.toFixed(0)}), 关系: ${c.features.relation}` : undefined
        }))
      );

      // 调用 GLM 视觉 API（混合需要视觉能力）
      const response = await this.callGLMVision(
        prompt,
        request.imageBase64,
        this.config.visionModel
      );

      // 解析响应
      const parsed = this.parseHybridRerankResponse(response);

      // 构建 reranked candidates
      const rerankedCandidates: RerankedCandidate[] = parsed.ranking.map((idx, rank) => ({
        originalIndex: idx,
        answerText: request.candidates[idx].answerText,
        answerBbox: request.candidates[idx].answerBbox,
        originalConfidence: request.candidates[idx].confidence,
        rerankedConfidence: request.candidates[idx].confidence * 0.3 + 0.7 * (1 - rank * 0.1),
        rank: rank + 1,
        reason: parsed.fusion_reasoning || '混合重排序'
      }));

      // 构建结果
      const result: RerankResult = {
        questionId: request.questionId,
        rerankedCandidates,
        finalAnswer: rerankedCandidates[0] || null,
        confidence: rerankedCandidates[0]?.rerankedConfidence || 0,
        success: true,
        method: 'hybrid',
        processingTimeMs: Date.now() - startTime,
        debugInfo: {
          modelUsed: this.config.visionModel,
          originalRanking: request.candidates.map((_, i) => i),
          newRanking: parsed.ranking,
          reason: `${parsed.semantic_analysis}\n${parsed.visual_analysis}\n${parsed.fusion_reasoning}`
        }
      };

      // 更新统计
      this.updateStats('hybrid', result.processingTimeMs, this.hasRankingChanged(result));

      return result;
    } catch (error) {
      log.error('混合 rerank 失败', { questionId: request.questionId, error });
      return {
        questionId: request.questionId,
        rerankedCandidates: [],
        finalAnswer: null,
        confidence: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        method: 'hybrid',
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * 调用 GLM 文本 API
   */
  private async callGLMText(prompt: string, model: string): Promise<string> {
    // 这里需要集成实际的 GLM API 调用
    // 暂时返回模拟响应
    log.debug('调用 GLM 文本 API', { model, promptLength: prompt.length });

    // TODO: 集成实际的 GLM API
    // 模拟响应
    return JSON.stringify({
      ranking: [0, 1, 2],
      reasoning: '基于语义理解，第一个答案最相关'
    });
  }

  /**
   * 调用 GLM 视觉 API
   */
  private async callGLMVision(
    prompt: string,
    imageBase64: string,
    model: string
  ): Promise<string> {
    // 这里需要集成实际的 GLM 视觉 API 调用
    log.debug('调用 GLM 视觉 API', { model, promptLength: prompt.length, hasImage: true });

    // TODO: 集成实际的 GLM 视觉 API
    // 模拟响应
    if (prompt.includes('visual_analysis')) {
      return JSON.stringify({
        ranking: [0, 1, 2],
        visual_analysis: '答案位于题目右侧，位置合理'
      });
    } else {
      return JSON.stringify({
        ranking: [0, 1, 2],
        semantic_analysis: '答案内容相关',
        visual_analysis: '位置合理',
        fusion_reasoning: '综合判断，第一个答案最佳'
      });
    }
  }

  /**
   * 解析 rerank 响应
   */
  private parseRerankResponse(response: string): { ranking: number[]; reasoning: string } {
    try {
      const parsed = JSON.parse(response);
      return {
        ranking: parsed.ranking || [],
        reasoning: parsed.reasoning || ''
      };
    } catch (error) {
      log.warn('解析 rerank 响应失败，使用默认值', { error });
      return { ranking: [0, 1, 2], reasoning: '解析失败' };
    }
  }

  /**
   * 解析视觉 rerank 响应
   */
  private parseVisualRerankResponse(response: string): { ranking: number[]; visual_analysis: string } {
    try {
      const parsed = JSON.parse(response);
      return {
        ranking: parsed.ranking || [],
        visual_analysis: parsed.visual_analysis || ''
      };
    } catch (error) {
      log.warn('解析视觉 rerank 响应失败', { error });
      return { ranking: [0, 1, 2], visual_analysis: '解析失败' };
    }
  }

  /**
   * 解析混合 rerank 响应
   */
  private parseHybridRerankResponse(response: string): {
    ranking: number[];
    semantic_analysis: string;
    visual_analysis: string;
    fusion_reasoning: string;
  } {
    try {
      const parsed = JSON.parse(response);
      return {
        ranking: parsed.ranking || [],
        semantic_analysis: parsed.semantic_analysis || '',
        visual_analysis: parsed.visual_analysis || '',
        fusion_reasoning: parsed.fusion_reasoning || ''
      };
    } catch (error) {
      log.warn('解析混合 rerank 响应失败', { error });
      return {
        ranking: [0, 1, 2],
        semantic_analysis: '解析失败',
        visual_analysis: '解析失败',
        fusion_reasoning: '解析失败'
      };
    }
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(method: string, request: RerankRequest): string {
    const content = `${method}-${request.questionId}-${request.candidates.map(c => c.answerText).join(',')}`;
    // 简单哈希（实际应该用更好的哈希函数）
    return content.substring(0, 100);
  }

  /**
   * 更新统计信息
   */
  private updateStats(method: 'semantic' | 'visual' | 'hybrid', processingTime: number, rankingChanged: boolean): void {
    stats.totalReranks++;

    if (method === 'semantic') stats.semanticReranks++;
    else if (method === 'visual') stats.visualReranks++;
    else if (method === 'hybrid') stats.hybridReranks++;

    // 更新平均处理时间
    stats.avgProcessingTimeMs =
      (stats.avgProcessingTimeMs * (stats.totalReranks - 1) + processingTime) / stats.totalReranks;

    // 更新成功率
    stats.successRate = ((stats.successRate * (stats.totalReranks - 1)) + 1) / stats.totalReranks;

    // 更新排名变化次数
    if (rankingChanged) {
      stats.rankingChanges++;
    }
  }

  /**
   * 检查排名是否改变
   */
  private hasRankingChanged(result: RerankResult): boolean {
    if (!result.debugInfo) return false;

    const original = result.debugInfo.originalRanking;
    const newRanking = result.debugInfo.newRanking;

    if (original.length !== newRanking.length) return true;

    for (let i = 0; i < original.length; i++) {
      if (original[i] !== newRanking[i]) return true;
    }

    return false;
  }

  /**
   * 获取统计信息
   */
  getStats(): RerankStats {
    return { ...stats };
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.cache.clear();
    log.debug('Rerank 缓存已清理');
  }
}

/**
 * 单例 reranker 实例
 */
let globalReranker: LLMReranker | null = null;

/**
 * 获取全局 reranker 实例
 */
export function getReranker(config?: Partial<RerankConfig>): LLMReranker {
  if (!globalReranker) {
    globalReranker = new LLMReranker(config);
  }
  return globalReranker;
}
