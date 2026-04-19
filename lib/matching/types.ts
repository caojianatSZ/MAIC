// lib/matching/types.ts
/**
 * Top-K 匹配类型定义
 */

import type { BBox } from '../structure/spatial-cluster';
import type { GraphNode, LayoutGraph } from '../graph/types';

/**
 * 匹配候选
 */
export interface MatchCandidate {
  /** 题目 ID */
  questionId: string;
  /** 题目节点 */
  questionNode?: GraphNode;
  /** 答案块/节点 */
  answerBlock: {
    text: string;
    bbox: BBox;
    confidence?: number;
    type?: 'print' | 'handwriting';
  };
  /** 答案节点 */
  answerNode?: GraphNode;
  /** 匹配得分（0-1） */
  score: number;
  /** 排名 */
  rank: number;
  /** 匹配特征 */
  features: MatchFeatures;
  /** 匹配置信度（0-1） */
  confidenceScore?: number;
}

/**
 * 匹配特征
 */
export interface MatchFeatures {
  /** 空间距离得分（0-1） */
  spatialScore: number;
  /** 布局一致性得分（0-1） */
  layoutScore: number;
  /** 语义相关性得分（0-1） */
  semanticScore: number;
  /** 置信度得分（0-1） */
  confidenceScore: number;
  /** 水平距离 */
  horizontalDistance: number;
  /** 垂直距离 */
  verticalDistance: number;
  /** 关系类型 */
  relation: string | null;
  /** 是否跨列 */
  isCrossColumn: boolean;
}

/**
 * Top-K 匹配结果
 */
export interface TopKResult {
  /** 题目 ID */
  questionId: string;
  /** 候选答案列表 */
  candidates: MatchCandidate[];
  /** 最终选择的答案 */
  finalMatch: MatchCandidate | null;
  /** 匹配置信度（0-1） */
  confidence: number;
  /** 是否需要 rerank */
  needsRerank: boolean;
  /** Rerank 原因 */
  rerankReason?: string;
  /** 应用的过滤器结果 */
  filters: FilterResult[];
}

/**
 * 过滤器结果
 */
export interface FilterResult {
  /** 过滤器名称 */
  filterName: string;
  /** 是否通过 */
  passed: boolean;
  /** 原因说明 */
  reason?: string;
  /** 调整后的得分 */
  adjustedScore: number;
}

/**
 * 排序权重
 */
export interface RankingWeights {
  /** 空间权重 */
  spatial: number;
  /** 布局权重 */
  layout: number;
  /** 置信度权重 */
  confidence: number;
  /** 语义权重 */
  semantic: number;
}

/**
 * Top-K 匹配选项
 */
export interface TopKMatcherOptions {
  /** 候选数量（默认 3） */
  k?: number;
  /** 最大搜索距离（像素，默认 500） */
  maxDistance?: number;
  /** 最小权重阈值（默认 0.1） */
  minWeight?: number;
  /** 是否使用布局检测（默认 true） */
  useLayoutDetection?: boolean;
  /** 是否启用调试模式 */
  debug?: boolean;
}

/**
 * 批量 Top-K 匹配结果
 */
export interface BatchTopKResult {
  /** 题目列表 */
  results: TopKResult[];
  /** 元数据 */
  metadata: {
    totalQuestions: number;
    totalCandidates: number;
    avgCandidatesPerQuestion: number;
    needsRerankCount: number;
    processingTimeMs: number;
  };
}

/**
 * 增强的答案匹配结果
 */
export interface EnhancedMatchResult {
  /** 题目 ID */
  questionId: string;
  /** 匹配的答案 */
  matchedAnswer: {
    text: string;
    bbox: BBox;
    confidence: number;
  } | null;
  /** 匹配置信度 */
  confidence: number;
  /** 匹配方法 */
  method: 'top_k' | 'legacy' | 'fallback';
  /** 候选排名（如果是 top-k） */
  rank?: number;
  /** 是否需要人工复核 */
  needsReview: boolean;
  /** 复核原因 */
  reviewReason?: string;
}
