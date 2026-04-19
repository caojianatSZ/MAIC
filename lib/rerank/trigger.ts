// lib/rerank/trigger.ts
/**
 * Rerank 触发逻辑 - 决定何时需要 LLM rerank
 *
 * 核心功能：
 * 1. 分析 Top-K 结果的质量
 * 2. 决定是否需要 rerank
 * 3. 推荐最合适的 rerank 方法
 */

import { createLogger } from '@/lib/logger';
import type { TopKResult } from '../matching/types';
import type { RerankTrigger } from './types';

const log = createLogger('RerankTrigger');

/**
 * 默认触发阈值
 */
const DEFAULT_THRESHOLDS = {
  lowConfidence: 0.75,
  closeScores: 0.15,
  fewCandidates: 2,
  highVariance: 0.3
};

/**
 * 判断是否需要触发 rerank
 */
export function shouldTriggerRerank(
  topKResult: TopKResult,
  options: {
    thresholds?: typeof DEFAULT_THRESHOLDS;
    hasImage?: boolean;
  } = {}
): RerankTrigger {
  const {
    thresholds = DEFAULT_THRESHOLDS,
    hasImage = true
  } = options;

  const { candidates, confidence, needsRerank, rerankReason } = topKResult;

  // 如果已经标记为需要 rerank，使用原有决策
  if (needsRerank && rerankReason) {
    return {
      shouldRerank: true,
      reason: rerankReason,
      priority: determinePriority(confidence, rerankReason),
      suggestedMethod: suggestMethod(confidence, hasImage, candidates.length)
    };
  }

  // 场景 1: 候选数量不足
  if (candidates.length === 0) {
    return {
      shouldRerank: false,
      reason: '没有候选答案，无法 rerank',
      priority: 'low',
      suggestedMethod: 'semantic'
    };
  }

  if (candidates.length === 1) {
    return {
      shouldRerank: confidence < thresholds.lowConfidence,
      reason: `只有1个候选，置信度 ${confidence.toFixed(2)}`,
      priority: confidence < 0.6 ? 'high' : 'medium',
      suggestedMethod: hasImage ? 'visual' : 'semantic'
    };
  }

  if (candidates.length < thresholds.fewCandidates) {
    return {
      shouldRerank: true,
      reason: `候选数量不足 (${candidates.length} < ${thresholds.fewCandidates})`,
      priority: 'medium',
      suggestedMethod: hasImage ? 'hybrid' : 'semantic'
    };
  }

  // 场景 2: 最高分和第二分太接近
  if (candidates.length >= 2) {
    const topScore = candidates[0].score;
    const secondScore = candidates[1].score;
    const scoreDiff = topScore - secondScore;

    if (scoreDiff < thresholds.closeScores) {
      return {
        shouldRerank: true,
        reason: `前两名得分太接近 (${topScore.toFixed(2)} vs ${secondScore.toFixed(2)}, 差距 ${scoreDiff.toFixed(2)})`,
        priority: scoreDiff < 0.1 ? 'high' : 'medium',
        suggestedMethod: hasImage ? 'hybrid' : 'semantic'
      };
    }
  }

  // 场景 3: 置信度低
  if (confidence < thresholds.lowConfidence) {
    return {
      shouldRerank: true,
      reason: `匹配置信度过低 (${confidence.toFixed(2)} < ${thresholds.lowConfidence})`,
      priority: confidence < 0.6 ? 'high' : 'medium',
      suggestedMethod: hasImage ? 'visual' : 'semantic'
    };
  }

  // 场景 4: 得分方差大（候选质量不均）
  const scores = candidates.map(c => c.score);
  const variance = computeVariance(scores);

  if (variance > thresholds.highVariance) {
    return {
      shouldRerank: true,
      reason: `候选得分方差过大 (${variance.toFixed(2)})，可能存在误匹配`,
      priority: 'medium',
      suggestedMethod: 'semantic'
    };
  }

  // 场景 5: 跨列匹配（空间位置可疑）
  const hasCrossColumn = candidates.some(c => c.features.isCrossColumn);
  if (hasCrossColumn) {
    return {
      shouldRerank: true,
      reason: '存在跨列匹配，需要语义确认',
      priority: 'medium',
      suggestedMethod: hasImage ? 'visual' : 'semantic'
    };
  }

  // 场景 6: 距离过远
  const hasFarDistance = candidates.some(c => {
    const distance = Math.sqrt(
      c.features.horizontalDistance ** 2 +
      c.features.verticalDistance ** 2
    );
    return distance > 400;
  });

  if (hasFarDistance) {
    return {
      shouldRerank: true,
      reason: '存在远距离匹配，需要确认',
      priority: 'low',
      suggestedMethod: hasImage ? 'visual' : 'semantic'
    };
  }

  // 不需要 rerank
  return {
    shouldRerank: false,
    reason: `匹配置信度良好 (${confidence.toFixed(2)})`,
    priority: 'low',
    suggestedMethod: 'semantic'
  };
}

/**
 * 批量判断是否需要 rerank
 */
export function batchShouldTriggerRerank(
  topKResults: TopKResult[],
  options: {
    thresholds?: typeof DEFAULT_THRESHOLDS;
    hasImage?: boolean;
  } = {}
): Map<string, RerankTrigger> {
  const triggers = new Map<string, RerankTrigger>();

  for (const result of topKResults) {
    const trigger = shouldTriggerRerank(result, options);
    triggers.set(result.questionId, trigger);
  }

  return triggers;
}

/**
 * 确定优先级
 */
function determinePriority(confidence: number, reason: string): 'high' | 'medium' | 'low' {
  // 高置信度但标记为 rerank → 低优先级
  if (confidence >= 0.8) {
    return 'low';
  }

  // 特定关键原因 → 高优先级
  const highPriorityReasons = [
    '候选得分接近',
    '没有候选答案',
    '候选数量不足'
  ];

  if (highPriorityReasons.some(r => reason.includes(r))) {
    return 'high';
  }

  // 中等置信度 → 中优先级
  if (confidence >= 0.6) {
    return 'medium';
  }

  // 低置信度 → 高优先级
  return 'high';
}

/**
 * 建议 rerank 方法
 */
function suggestMethod(
  confidence: number,
  hasImage: boolean,
  candidateCount: number
): 'semantic' | 'visual' | 'hybrid' {
  // 没有图像 → 只能用语义
  if (!hasImage) {
    return 'semantic';
  }

  // 低置信度 + 多候选 → 混合方法
  if (confidence < 0.7 && candidateCount >= 3) {
    return 'hybrid';
  }

  // 低置信度 → 视觉方法
  if (confidence < 0.7) {
    return 'visual';
  }

  // 默认语义方法
  return 'semantic';
}

/**
 * 计算方差
 */
function computeVariance(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map(v => (v - mean) ** 2);
  return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Rerank 优先级排序
 */
export function sortByPriority(triggers: Map<string, RerankTrigger>): Array<{ questionId: string; trigger: RerankTrigger }> {
  const priorityOrder = { high: 0, medium: 1, low: 2 };

  return Array.from(triggers.entries())
    .filter(([_, trigger]) => trigger.shouldRerank)
    .map(([questionId, trigger]) => ({ questionId, trigger }))
    .sort((a, b) => priorityOrder[a.trigger.priority] - priorityOrder[b.trigger.priority]);
}

/**
 * 估算 rerank 成本
 */
export function estimateRerankCost(
  triggers: Map<string, RerankTrigger>,
  costs: {
    semantic: number;
    visual: number;
    hybrid: number;
  } = {
    semantic: 0.01,
    visual: 0.02,
    hybrid: 0.03
  }
): {
  totalCost: number;
  breakdown: Record<string, number>;
  countByMethod: Record<string, number>;
} {
  let totalCost = 0;
  const breakdown: Record<string, number> = {};
  const countByMethod: Record<string, number> = {
    semantic: 0,
    visual: 0,
    hybrid: 0
  };

  for (const [questionId, trigger] of triggers.entries()) {
    if (!trigger.shouldRerank) continue;

    const method = trigger.suggestedMethod;
    const cost = costs[method];

    totalCost += cost;
    breakdown[questionId] = cost;
    countByMethod[method]++;
  }

  return {
    totalCost,
    breakdown,
    countByMethod
  };
}
