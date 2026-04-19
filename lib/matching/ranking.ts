// lib/matching/ranking.ts
/**
 * 候选排序算法 - 多特征加权排序
 *
 * 核心功能：
 * 1. 计算综合得分
 * 2. 多特征加权融合
 * 3. 候选排序
 */

import { createLogger } from '@/lib/logger';
import type { BBox } from '../structure/spatial-cluster';
import type { GraphNode, LayoutInfo, EdgeRelation } from '../graph/types';
import type {
  MatchCandidate,
  MatchFeatures,
  RankingWeights,
  TopKMatcherOptions
} from './types';

const log = createLogger('CandidateRanking');

/**
 * 默认排序权重
 */
const DEFAULT_WEIGHTS: RankingWeights = {
  spatial: 0.4,
  layout: 0.3,
  confidence: 0.2,
  semantic: 0.1
};

/**
 * 计算候选的综合得分
 */
export function computeCandidateScore(
  candidate: MatchCandidate,
  weights: RankingWeights = DEFAULT_WEIGHTS
): number {
  const { features } = candidate;

  // 归一化各特征得分（假设输入已经是 0-1 范围）
  const spatialScore = features.spatialScore || 0;
  const layoutScore = features.layoutScore || 0;
  const confidenceScore = features.confidenceScore || 0;
  const semanticScore = features.semanticScore || 0;

  // 加权求和
  const score =
    weights.spatial * spatialScore +
    weights.layout * layoutScore +
    weights.confidence * confidenceScore +
    weights.semantic * semanticScore;

  return Math.min(1, Math.max(0, score));
}

/**
 * 排序候选答案
 */
export function rankCandidates(
  candidates: MatchCandidate[],
  options: TopKMatcherOptions & {
    weights?: RankingWeights;
  } = {}
): MatchCandidate[] {
  const { weights = DEFAULT_WEIGHTS, debug = false } = options;

  // 计算综合得分
  const scoredCandidates = candidates.map(candidate => ({
    ...candidate,
    score: computeCandidateScore(candidate, weights)
  }));

  // 按得分降序排序
  scoredCandidates.sort((a, b) => b.score - a.score);

  // 更新排名
  scoredCandidates.forEach((c, index) => {
    c.rank = index + 1;
  });

  if (debug) {
    log.info('候选排序完成', {
      totalCandidates: candidates.length,
      weights,
      top3: scoredCandidates.slice(0, 3).map(c => ({
        id: c.questionId,
        score: c.score.toFixed(3),
        rank: c.rank
      }))
    });
  }

  return scoredCandidates;
}

/**
 * 计算匹配置信度
 */
export function computeMatchConfidence(
  candidate: MatchCandidate,
  topK: number = 3,
  avgScoreVariance?: number
): number {
  const { score, rank, features } = candidate;

  // 基础置信度：综合得分
  let confidence = score;

  // 排名惩罚：排名越靠后，置信度越低
  const rankPenalty = (rank - 1) * 0.1;
  confidence -= rankPenalty;

  // 距离惩罚：距离越远，置信度越低
  const distance = Math.sqrt(
    features.horizontalDistance ** 2 +
    features.verticalDistance ** 2
  );
  const distancePenalty = Math.min(0.3, distance / 1000);
  confidence -= distancePenalty;

  // 跨列惩罚
  if (features.isCrossColumn) {
    confidence *= 0.7;
  }

  return Math.max(0, Math.min(1, confidence));
}

/**
 * 计算匹配特征
 */
export function computeMatchFeatures(
  questionBbox: BBox,
  answerBbox: BBox,
  layoutInfo?: LayoutInfo
): MatchFeatures {
  // 计算距离
  const qCenterX = (questionBbox[0] + questionBbox[2]) / 2;
  const qCenterY = (questionBbox[1] + questionBbox[3]) / 2;
  const aCenterX = (answerBbox[0] + answerBbox[2]) / 2;
  const aCenterY = (answerBbox[1] + answerBbox[3]) / 2;

  const horizontalDistance = Math.abs(aCenterX - qCenterX);
  const verticalDistance = Math.abs(aCenterY - qCenterY);

  // 空间得分：距离越近得分越高
  const maxDistance = 300;
  const spatialScore = Math.max(0, 1 - Math.sqrt(horizontalDistance ** 2 + verticalDistance ** 2) / maxDistance);

  // 布局得分
  let layoutScore = 0.5;
  let isCrossColumn = false;

  if (layoutInfo) {
    // 检查是否在同一列
    const qInCol = layoutInfo.columnCenters.some(colCenter =>
      Math.abs(qCenterX - colCenter) < layoutInfo.columnWidth * 0.4
    );
    const aInCol = layoutInfo.columnCenters.some(colCenter =>
      Math.abs(aCenterX - colCenter) < layoutInfo.columnWidth * 0.4
    );

    if (qInCol && aInCol) {
      layoutScore = 1.0;
    } else if (qInCol || aInCol) {
      layoutScore = 0.3;
      isCrossColumn = true;
    }
  }

  // 语义得分：基于位置关系推断
  let semanticScore = 0.5;
  const relation = inferRelation(questionBbox, answerBbox);
  if (relation === 'right') {
    semanticScore = 0.9; // 右侧是答案最可能的位置
  } else if (relation === 'below') {
    semanticScore = 0.7; // 下方次之
  } else if (relation === 'above') {
    semanticScore = 0.1; // 上方不太可能
  }

  // 置信度得分（暂无语义信息，使用默认值）
  const confidenceScore = 0.8;

  return {
    spatialScore,
    layoutScore,
    semanticScore,
    confidenceScore,
    horizontalDistance,
    verticalDistance,
    relation: relation || null,
    isCrossColumn
  };
}

/**
 * 推断两个 bbox 的关系
 */
function inferRelation(questionBbox: BBox, answerBbox: BBox): EdgeRelation | null {
  const [qX1, qY1, qX2, qY2] = questionBbox;
  const [aX1, aY1, aX2, aY2] = answerBbox;

  const qCenterX = (qX1 + qX2) / 2;
  const qCenterY = (qY1 + qY2) / 2;
  const aCenterX = (aX1 + aX2) / 2;
  const aCenterY = (aY1 + aY2) / 2;

  const dx = aCenterX - qCenterX;
  const dy = aCenterY - qCenterY;

  // 判断主要方向
  const horizontalDist = Math.abs(dx);
  const verticalDist = Math.abs(dy);

  // 检查是否在同一行（垂直距离很小）
  if (verticalDist < 30) {
    return 'same_line';
  }

  // 检查是否在同一列（水平距离很小）
  if (horizontalDist < 30) {
    return 'same_column';
  }

  // 根据 dx 和 dy 判断方向
  if (Math.abs(dx) > Math.abs(dy) * 2) {
    return dx > 0 ? 'right' : 'left';
  } else {
    return dy > 0 ? 'below' : 'above';
  }
}

/**
 * 计算 Top-K 候选的置信度
 */
export function computeTopKConfidence(
  topKResult: {
    candidates: MatchCandidate[];
  },
  options: {
    k?: number;
    avgScoreVariance?: number;
  } = {}
): {
  confidence: number;
  needsRerank: boolean;
  reason: string;
} {
  const { candidates } = topKResult;
  const { k = 3, avgScoreVariance } = options;

  if (candidates.length === 0) {
    return {
      confidence: 0,
      needsRerank: true,
      reason: '没有候选答案'
    };
  }

  const bestCandidate = candidates[0];
  const bestScore = bestCandidate.score;
  const secondScore = candidates.length > 1 ? candidates[1].score : 0;

  // 计算置信度
  let confidence = bestScore;

  // 最高分和第二分接近 → 低置信度
  if (candidates.length > 1 && Math.abs(bestScore - secondScore) < 0.1) {
    confidence *= 0.8;

    if (confidence < 0.6) {
      return {
        confidence,
        needsRerank: true,
        reason: `候选得分接近 (${bestScore.toFixed(2)} vs ${secondScore.toFixed(2)})`
      };
    }
  }

  // 候选数量太少 → 低置信度
  if (candidates.length < k) {
    confidence *= 0.7;
  }

  // 得分方差大 → 低置信度
  if (avgScoreVariance && avgScoreVariance > 0.3) {
    confidence *= 0.8;
  }

  // 判断是否需要 rerank
  const needsRerank =
    confidence < 0.75 ||
    candidates.length === 1 && confidence < 0.8 ||
    (candidates.length > 1 && Math.abs(bestScore - secondScore) < 0.15);

  return {
    confidence: Math.max(0, Math.min(1, confidence)),
    needsRerank,
    reason: needsRerank ? '低置信度，需要 LLM rerank' : '置信度足够'
  };
}
