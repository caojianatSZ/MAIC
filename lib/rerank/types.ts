// lib/rerank/types.ts
/**
 * LLM Rerank 类型定义
 */

import type { BBox } from '../structure/spatial-cluster';
import type { MatchCandidate, TopKResult } from '../matching/types';

/**
 * Rerank 请求
 */
export interface RerankRequest {
  /** 题目 ID */
  questionId: string;
  /** 题目内容 */
  questionContent: string;
  /** 题目类型 */
  questionType?: 'choice' | 'fill_blank' | 'essay';
  /** 题目 bbox */
  questionBbox?: BBox;
  /** Top-K 候选答案 */
  candidates: Array<{
    answerText: string;
    answerBbox: BBox;
    confidence: number;
    features?: {
      spatialScore: number;
      layoutScore: number;
      semanticScore: number;
      horizontalDistance: number;
      verticalDistance: number;
      relation: string | null;
    };
  }>;
  /** 原始图像（base64）- 用于视觉 rerank */
  imageBase64?: string;
  /** Rerank 选项 */
  options?: RerankOptions;
}

/**
 * Rerank 选项
 */
export interface RerankOptions {
  /** 使用的模型 */
  model?: string;
  /** 最大候选数 */
  maxCandidates?: number;
  /** 温度参数 */
  temperature?: number;
  /** 是否使用视觉信息 */
  useVision?: boolean;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 是否启用调试模式 */
  debug?: boolean;
}

/**
 * Rerank 结果
 */
export interface RerankResult {
  /** 题目 ID */
  questionId: string;
  /** 重新排序后的候选 */
  rerankedCandidates: RerankedCandidate[];
  /** 最终选择的答案 */
  finalAnswer: RerankedCandidate | null;
  /** Rerank 置信度 */
  confidence: number;
  /** 是否成功 */
  success: boolean;
  /** 错误信息（如果失败） */
  error?: string;
  /** Rerank 方法 */
  method: 'semantic' | 'visual' | 'hybrid';
  /** 处理时间（毫秒） */
  processingTimeMs: number;
  /** 调试信息 */
  debugInfo?: {
    modelUsed: string;
    originalRanking: number[];
    newRanking: number[];
    reason?: string;
  };
}

/**
 * 重新排序后的候选
 */
export interface RerankedCandidate {
  /** 原始候选索引 */
  originalIndex: number;
  /** 答案文本 */
  answerText: string;
  /** 答案 bbox */
  answerBbox: BBox;
  /** 原始置信度 */
  originalConfidence: number;
  /** Rerank 后的置信度 */
  rerankedConfidence: number;
  /** 排名 */
  rank: number;
  /** Rerank 原因 */
  reason?: string;
}

/**
 * Rerank 触发决策
 */
export interface RerankTrigger {
  /** 是否需要 rerank */
  shouldRerank: boolean;
  /** 触发原因 */
  reason: string;
  /** Rerank 优先级 */
  priority: 'high' | 'medium' | 'low';
  /** 建议的 rerank 方法 */
  suggestedMethod: 'semantic' | 'visual' | 'hybrid';
}

/**
 * Rerank 统计信息
 */
export interface RerankStats {
  /** 总 rerank 次数 */
  totalReranks: number;
  /** 语义 rerank 次数 */
  semanticReranks: number;
  /** 视觉 rerank 次数 */
  visualReranks: number;
  /** 混合 rerank 次数 */
  hybridReranks: number;
  /** 平均处理时间（毫秒） */
  avgProcessingTimeMs: number;
  /** 成功率 */
  successRate: number;
  /** 排名变化次数 */
  rankingChanges: number;
}

/**
 * Rerank 配置
 */
export interface RerankConfig {
  /** 默认模型 */
  defaultModel: string;
  /** 视觉模型 */
  visionModel: string;
  /** 最大并发请求数 */
  maxConcurrentRequests: number;
  /** 请求超时（毫秒） */
  requestTimeout: number;
  /** 是否启用缓存 */
  enableCache: boolean;
  /** 缓存过期时间（秒） */
  cacheExpirationSeconds: number;
  /** 触发阈值 */
  triggerThresholds: {
    lowConfidence: number;
    closeScores: number;
    fewCandidates: number;
    highVariance: number;
  };
}

/**
 * Prompt 模板类型
 */
export type PromptTemplate =
  | 'question_answer_ranking'
  | 'visual_answer_verification'
  | 'hybrid_reranking'
  | 'confidence_calibration';

/**
 * Prompt 变量
 */
export interface PromptVariables {
  question: string;
  questionType?: string;
  candidates: Array<{
    index: number;
    answer: string;
    confidence: number;
    features?: string;
  }>;
  context?: {
    hasImage: boolean;
    examSubject?: string;
    examType?: string;
  };
}
