// lib/matching/filters.ts
/**
 * 匹配过滤器 - 各种业务规则和约束
 *
 * 核心功能：
 * 1. 空间过滤：检查候选答案的空间位置是否合理
 * 2. 布局过滤：检查布局一致性（列对齐）
 * 3. 规则过滤：业务逻辑约束（题型特定）
 */

import { createLogger } from '@/lib/logger';
import type { BBox } from '../structure/spatial-cluster';
import type { GraphNode, LayoutInfo, NodeType } from '../graph/types';
import type {
  MatchCandidate,
  FilterResult
} from './types';

const log = createLogger('MatchFilters');

/**
 * 空间过滤器：检查候选答案的空间位置是否合理
 */
export function spatialFilter(
  candidate: MatchCandidate,
  options: {
    maxHorizontalDistance?: number;
    maxVerticalDistance?: number;
    preferRight?: boolean;
    preferBelow?: boolean;
  } = {}
): FilterResult {
  const {
    maxHorizontalDistance = 300,
    maxVerticalDistance = 500,
    preferRight = true,
    preferBelow = false
  } = options;

  const { horizontalDistance, verticalDistance } = candidate.features;

  // 检查距离是否在合理范围内
  const horizontalOk = horizontalDistance <= maxHorizontalDistance;
  const verticalOk = verticalDistance <= maxVerticalDistance;

  if (!horizontalOk && !verticalOk) {
    return {
      filterName: 'spatial',
      passed: false,
      reason: `距离过远 (水平: ${horizontalDistance}px > ${maxHorizontalDistance}px, 垂直: ${verticalDistance}px > ${maxVerticalDistance}px)`,
      adjustedScore: 0
    };
  }

  // 计算位置得分
  let positionBonus = 0;

  // 右侧优先
  if (preferRight && horizontalDistance < 200 && verticalDistance < 100) {
    positionBonus = 0.2;
  }

  // 下方次之
  if (preferBelow && verticalDistance > 0 && verticalDistance < 300) {
    positionBonus += 0.1;
  }

  return {
    filterName: 'spatial',
    passed: true,
    adjustedScore: candidate.score + positionBonus
  };
}

/**
 * 布局过滤器：检查布局一致性
 */
export function layoutFilter(
  candidate: MatchCandidate,
  layoutInfo: {
    columnCenters: number[];
    columnWidth: number;
  }
): FilterResult {
  const { columnWidth } = layoutInfo;

  const questionCenterX = candidate.features.horizontalDistance === 0
    ? (candidate.questionNode?.bbox ? (candidate.questionNode.bbox[0] + candidate.questionNode.bbox[2]) / 2 : 0)
    : 0;

  const answerCenterX = candidate.features.horizontalDistance === 0
    ? (candidate.answerBlock.bbox[0] + candidate.answerBlock.bbox[2]) / 2
    : 0;

  // 检查是否在同一列
  let inSameColumn = false;
  for (const colCenter of layoutInfo.columnCenters) {
    const qInCol = Math.abs(questionCenterX - colCenter) < columnWidth * 0.4;
    const aInCol = Math.abs(answerCenterX - colCenter) < columnWidth * 0.4;

    if (qInCol && aInCol) {
      inSameColumn = true;
      break;
    }
  }

  // 跨列惩罚
  if (!inSameColumn && candidate.features.isCrossColumn) {
    return {
      filterName: 'layout',
      passed: false,
      reason: '跨列匹配（不同列）',
      adjustedScore: candidate.score * 0.5
    };
  }

  // 同列奖励
  if (inSameColumn) {
    return {
      filterName: 'layout',
      passed: true,
      adjustedScore: candidate.score + 0.2
    };
  }

  return {
    filterName: 'layout',
    passed: true,
    adjustedScore: candidate.score
  };
}

/**
 * 规则过滤器：业务逻辑约束
 */
export function ruleFilter(
  candidate: MatchCandidate,
  questionType?: 'choice' | 'fill_blank' | 'essay'
): FilterResult {
  const { answerBlock } = candidate;
  const answerText = answerBlock.text.trim();

  // 规则 1: 答案不能为空
  if (answerText.length === 0) {
    return {
      filterName: 'rule',
      passed: false,
      reason: '答案为空',
      adjustedScore: 0
    };
  }

  // 规则 2: 答案不能太长（可能是题干）
  if (answerText.length > 200) {
    return {
      filterName: 'rule',
      passed: false,
      reason: `答案过长 (${answerText.length} > 200 字符)`,
      adjustedScore: candidate.score * 0.3
    };
  }

  // 规则 3: 选择题答案应该是单个字符或短语
  if (questionType === 'choice') {
    // 选择题答案通常是单个字符或短选项
    const isLongAnswer = answerText.length > 20;
    const hasMultipleWords = answerText.split(/\s+/).length > 5;

    if (isLongAnswer || hasMultipleWords) {
      return {
        filterName: 'rule',
        passed: false,
        reason: '选择题答案过长',
        adjustedScore: candidate.score * 0.4
      };
    }
  }

  // 规则 4: 答案置信度检查
  if (answerBlock.confidence !== undefined && answerBlock.confidence < 0.5) {
    return {
      filterName: 'rule',
      passed: true, // 不直接拒绝，但降低得分
      reason: `低置信度答案 (${answerBlock.confidence.toFixed(2)})`,
      adjustedScore: candidate.score * 0.7
    };
  }

  return {
    filterName: 'rule',
    passed: true,
    adjustedScore: candidate.score
  };
}

/**
 * 题型特定过滤器
 */
export function questionTypeFilter(
  candidate: MatchCandidate,
  questionType: 'choice' | 'fill_blank' | 'essay'
): FilterResult {
  switch (questionType) {
    case 'choice':
      return choiceQuestionFilter(candidate);

    case 'fill_blank':
      return fillBlankFilter(candidate);

    case 'essay':
      return essayQuestionFilter(candidate);

    default:
      return {
        filterName: 'question_type',
        passed: true,
        adjustedScore: candidate.score
      };
  }
}

/**
 * 选择题专用过滤器
 */
function choiceQuestionFilter(candidate: MatchCandidate): FilterResult {
  const { answerBlock } = candidate;
  const answerText = answerBlock.text.trim();

  // 选择题答案通常很短
  if (answerText.length > 50) {
    return {
      filterName: 'choice_question',
      passed: false,
      reason: `选择题答案过长 (${answerText.length} 字符)`,
      adjustedScore: candidate.score * 0.2
    };
  }

  // 检查是否包含选择题选项标记
  const hasOptionMarker = /^[A-D][\.\)\]]/.test(answerText);
  if (hasOptionMarker) {
    return {
      filterName: 'choice_question',
      passed: false,
      reason: '答案包含选项标记（可能是题干）',
      adjustedScore: candidate.score * 0.1
    };
  }

  return {
    filterName: 'choice_question',
    passed: true,
    adjustedScore: candidate.score
  };
}

/**
 * 填空题专用过滤器
 */
function fillBlankFilter(candidate: MatchCandidate): FilterResult {
  const { answerBlock } = candidate;
  const answerText = answerBlock.text.trim();

  // 填空题答案通常比较短
  if (answerText.length > 100) {
    return {
      filterName: 'fill_blank',
      passed: false,
      reason: `填空题答案过长 (${answerText.length} 字符)`,
      adjustedScore: candidate.score * 0.3
    };
  }

  return {
    filterName: 'fill_blank',
    passed: true,
    adjustedScore: candidate.score
  };
}

/**
 * 解答题专用过滤器
 */
function essayQuestionFilter(candidate: MatchCandidate): FilterResult {
  const { answerBlock } = candidate;
  const answerText = answerBlock.text.trim();

  // 解答题答案可以很长，但不能太长
  if (answerText.length > 1000) {
    return {
      filterName: 'essay_question',
      passed: false,
      reason: `解答题答案过长 (${answerText.length} 字符)`,
      adjustedScore: candidate.score * 0.5
    };
  }

  return {
    filterName: 'essay_question',
    passed: true,
    adjustedScore: candidate.score
  };
}

/**
 * 交叉验证过滤器：检查多个候选的一致性
 */
export function crossValidationFilter(
  candidates: MatchCandidate[],
  options: {
    maxScoreVariance?: number;
    minConfidence?: number;
  } = {}
): {
  filtered: MatchCandidate[];
  reason: string;
} {
  const {
    maxScoreVariance = 0.3,
    minConfidence = 0.5
  } = options;

  if (candidates.length === 0) {
    return { filtered: [], reason: '没有候选' };
  }

  // 检查最高分和最低分的差异
  const scores = candidates.map(c => c.score);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  const scoreVariance = maxScore - minScore;

  if (scoreVariance > maxScoreVariance) {
    return {
      filtered: [],
      reason: `候选差异太大 (最高 ${maxScore.toFixed(2)}, 最低 ${minScore.toFixed(2)}, 差异 ${scoreVariance.toFixed(2)})`
    };
  }

  // 检查是否有足够高置信度的候选
  const highConfidenceCount = candidates.filter(c =>
    (c.confidenceScore ?? 0) >= minConfidence
  ).length;

  if (highConfidenceCount === 0) {
    return {
      filtered: [],
      reason: `没有高置信度候选 (最低要求 ${minConfidence})`
    };
  }

  // 返回通过验证的候选
  return {
    filtered: candidates,
    reason: '通过交叉验证'
  };
}

/**
 * 应用所有过滤器
 */
export function applyFilters(
  candidate: MatchCandidate,
  filters: Array<(candidate: MatchCandidate) => FilterResult>,
  options?: {
    stopOnFirstFail?: boolean;
  }
): {
  passed: boolean;
  results: FilterResult[];
  finalScore: number;
} {
  const { stopOnFirstFail = false } = options || {};
  const results: FilterResult[] = [];
  let finalScore = candidate.score;

  for (const filter of filters) {
    const result = filter(candidate);
    results.push(result);

    if (!result.passed) {
      finalScore = Math.min(finalScore, result.adjustedScore);

      if (stopOnFirstFail) {
        return {
          passed: false,
          results,
          finalScore
        };
      }
    } else {
      finalScore = result.adjustedScore;
    }
  }

  const allPassed = results.every(r => r.passed);

  return {
    passed: allPassed,
    results,
    finalScore
  };
}
