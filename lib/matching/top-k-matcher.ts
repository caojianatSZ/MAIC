// lib/matching/top-k-matcher.ts
/**
 * Top-K 答案匹配算法
 *
 * 核心功能：
 * 1. 为每个题目生成 Top-K 候选答案
 * 2. 应用多层过滤器（空间、布局、规则）
 * 3. 多特征加权排序
 * 4. 计算匹配置信度
 * 5. 触发 LLM rerank 决策
 */

import { createLogger } from '@/lib/logger';
import { buildLayoutGraph } from '@/lib/graph/layout-graph';
import type { LayoutGraph, GraphNode } from '@/lib/graph/types';
import type { Question, OCRBlock } from '@/lib/structure/builder';
import type {
  MatchCandidate,
  TopKResult,
  TopKMatcherOptions,
  FilterResult
} from './types';
import {
  computeMatchFeatures,
  rankCandidates,
  computeMatchConfidence,
  computeTopKConfidence
} from './ranking';
import {
  spatialFilter,
  layoutFilter,
  ruleFilter,
  questionTypeFilter,
  applyFilters
} from './filters';

const log = createLogger('TopKMatcher');

/**
 * 主匹配函数：为每个题目生成 Top-K 候选答案
 */
export async function matchAnswersTopK(
  questions: Question[],
  handwritingBlocks: OCRBlock[],
  options: TopKMatcherOptions & {
    useGraph?: boolean;
  } = {}
): Promise<TopKResult[]> {
  const {
    k = 3,
    maxDistance = 500,
    useLayoutDetection = true,
    debug = false,
    useGraph = true
  } = options;

  if (questions.length === 0) {
    log.warn('matchAnswersTopK: 没有题目');
    return [];
  }

  if (handwritingBlocks.length === 0) {
    log.info('matchAnswersTopK: 没有手写答案');
    return questions.map(q => ({
      questionId: q.question_id,
      candidates: [],
      finalMatch: null,
      confidence: 0,
      needsRerank: true,
      rerankReason: '没有候选答案',
      filters: []
    }));
  }

  log.info('开始 Top-K 匹配', {
    questionCount: questions.length,
    answerCount: handwritingBlocks.length,
    k
  });

  // 步骤 1: 构建 Layout Graph（可选）
  let layoutGraph: LayoutGraph | null = null;
  if (useGraph) {
    try {
      // 合并题目块和手写块
      const allBlocks = [
        ...questions.flatMap(q => q.question_blocks),
        ...handwritingBlocks
      ];

      layoutGraph = await buildLayoutGraph(allBlocks, {
        detectHandwriting: true,
        filterNoise: true,
        debug
      });

      if (debug) {
        log.info('Layout Graph 构建完成', {
          nodeCount: layoutGraph.metadata.nodeCount,
          edgeCount: layoutGraph.metadata.edgeCount
        });
      }
    } catch (error) {
      log.warn('Layout Graph 构建失败，降级到基础匹配', { error });
      layoutGraph = null;
    }
  }

  // 步骤 2: 为每个题目生成候选
  const results: TopKResult[] = [];

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];

    // 生成候选
    const candidates = generateCandidates(
      question,
      handwritingBlocks,
      layoutGraph,
      {
        maxDistance,
        questionIndex: i,
        totalQuestions: questions.length
      }
    );

    if (debug) {
      log.debug(`题目 ${question.question_id} 生成候选`, {
        candidateCount: candidates.length
      });
    }

    // 应用过滤器
    const filteredCandidates = await filterAndRankCandidates(
      candidates,
      question,
      layoutGraph?.layoutInfo,
      {
        debug
      }
    );

    // 取 Top-K
    const topKCandidates = filteredCandidates.slice(0, k);

    // 计算置信度
    const topKResult = computeTopKConfidence(
      { candidates: topKCandidates },
      { k }
    );

    // 收集过滤器结果
    const allFilters: FilterResult[] = [];
    for (const c of filteredCandidates) {
      // 这里简化处理，实际应该从过滤过程中收集
    }

    results.push({
      questionId: question.question_id,
      candidates: topKCandidates,
      finalMatch: topKCandidates.length > 0 ? topKCandidates[0] : null,
      confidence: topKResult.confidence,
      needsRerank: topKResult.needsRerank,
      rerankReason: topKResult.reason,
      filters: allFilters
    });
  }

  if (debug) {
    log.info('Top-K 匹配完成', {
      totalResults: results.length,
      needsRerankCount: results.filter(r => r.needsRerank).length,
      avgConfidence: results.reduce((sum, r) => sum + r.confidence, 0) / results.length
    });
  }

  return results;
}

/**
 * 为单个题目生成候选答案
 */
function generateCandidates(
  question: Question,
  handwritingBlocks: OCRBlock[],
  layoutGraph: LayoutGraph | null,
  options: {
    maxDistance: number;
    questionIndex: number;
    totalQuestions: number;
  }
): MatchCandidate[] {
  const { maxDistance, questionIndex, totalQuestions } = options;
  const candidates: MatchCandidate[] = [];

  // 获取题目 bbox
  const questionBbox = question.question_bbox ||
    question.question_blocks[question.question_blocks.length - 1]?.bbox;

  if (!questionBbox) {
    log.warn(`题目 ${question.question_id} 缺少 bbox`);
    return candidates;
  }

  // 找到题目节点（如果使用 Graph）
  let questionNode: GraphNode | undefined;
  if (layoutGraph) {
    for (const node of layoutGraph.nodes.values()) {
      if (node.block.text === question.question ||
          question.question_blocks.some(b => b.text === node.block.text)) {
        questionNode = node;
        break;
      }
    }
  }

  // 为每个手写块创建候选
  for (const block of handwritingBlocks) {
    // 距离检查
    const distance = Math.sqrt(
      Math.pow(block.bbox[0] - questionBbox[0], 2) +
      Math.pow(block.bbox[1] - questionBbox[1], 2)
    );

    if (distance > maxDistance) {
      continue; // 距离太远，跳过
    }

    // 跨题检查
    if (questionIndex < totalQuestions - 1) {
      // 检查是否跨越到下一题（简化检查）
      // TODO: 更精确的跨题检测
    }

    // 计算匹配特征
    const features = computeMatchFeatures(
      questionBbox,
      block.bbox,
      layoutGraph?.layoutInfo
    );

    // 找到手写节点（如果使用 Graph）
    let answerNode: GraphNode | undefined;
    if (layoutGraph) {
      for (const node of layoutGraph.nodes.values()) {
        if (node.block.text === block.text &&
            node.block.type === 'handwriting') {
          answerNode = node;
          break;
        }
      }
    }

    // 创建候选
    const candidate: MatchCandidate = {
      questionId: question.question_id,
      questionNode,
      answerBlock: {
        text: block.text,
        bbox: block.bbox,
        confidence: block.confidence
      },
      answerNode,
      score: 0, // 稍后计算
      rank: 0,  // 稍后计算
      features
    };

    candidates.push(candidate);
  }

  return candidates;
}

/**
 * 过滤和排序候选
 */
async function filterAndRankCandidates(
  candidates: MatchCandidate[],
  question: Question,
  layoutInfo: any,
  options: { debug?: boolean } = {}
): Promise<MatchCandidate[]> {
  const { debug } = options;

  // 步骤 1: 应用基础过滤器
  const filteredCandidates: MatchCandidate[] = [];

  for (const candidate of candidates) {
    // 空间过滤器
    const spatialResult = spatialFilter(candidate, {
      maxHorizontalDistance: 300,
      maxVerticalDistance: 500,
      preferRight: true,
      preferBelow: false
    });

    if (!spatialResult.passed) {
      if (debug) {
        log.debug('空间过滤失败', {
          questionId: candidate.questionId,
          reason: spatialResult.reason
        });
      }
      continue;
    }

    // 规则过滤器
    const ruleResult = ruleFilter(candidate);

    if (!ruleResult.passed) {
      if (debug) {
        log.debug('规则过滤失败', {
          questionId: candidate.questionId,
          reason: ruleResult.reason
        });
      }
      continue;
    }

    // 布局过滤器（如果有布局信息）
    if (layoutInfo) {
      const layoutResult = layoutFilter(candidate, layoutInfo);

      if (!layoutResult.passed) {
        if (debug) {
          log.debug('布局过滤失败', {
            questionId: candidate.questionId,
            reason: layoutResult.reason
          });
        }
        continue;
      }
    }

    // 题型特定过滤器
    const questionType = detectQuestionType(question);
    if (questionType) {
      const typeResult = questionTypeFilter(candidate, questionType);

      if (!typeResult.passed) {
        if (debug) {
          log.debug('题型过滤失败', {
            questionId: candidate.questionId,
            questionType,
            reason: typeResult.reason
          });
        }
        continue;
      }
    }

    // 更新分数
    candidate.score = spatialResult.adjustedScore;

    filteredCandidates.push(candidate);
  }

  // 步骤 2: 排序
  const rankedCandidates = rankCandidates(filteredCandidates, {
    debug
  });

  return rankedCandidates;
}

/**
 * 检测题目类型
 */
function detectQuestionType(question: Question): 'choice' | 'fill_blank' | 'essay' | undefined {
  const text = (question.question || '').toLowerCase();

  // 选择题特征
  if (text.includes('选择题') ||
      text.includes('选择')) {
    return 'choice';
  }

  // 填空题特征
  if (text.includes('填空') ||
      text.includes('____') ||
      text.includes('__')) {
    return 'fill_blank';
  }

  // 解答题特征
  if (text.includes('解答') ||
      text.includes('计算') ||
      text.includes('证明') ||
      text.includes('求')) {
    return 'essay';
  }

  return undefined;
}

/**
 * 向后兼容：将 Top-K 结果转换为 Question[]
 */
export function convertTopKToQuestions(
  questions: Question[],
  topKResults: TopKResult[]
): Question[] {
  const result: Question[] = [];

  for (let i = 0; i < questions.length; i++) {
    const question = { ...questions[i] };
    const topKResult = topKResults.find(r => r.questionId === question.question_id);

    if (topKResult && topKResult.finalMatch) {
      // 使用 Top-K 结果
      question.answer_blocks = [{
        text: topKResult.finalMatch.answerBlock.text,
        bbox: topKResult.finalMatch.answerBlock.bbox,
        confidence: topKResult.finalMatch.answerBlock.confidence,
        type: topKResult.finalMatch.answerBlock.type || 'handwriting'
      }];
      question.student_answer = topKResult.finalMatch.answerBlock.text;
      question.answer_bbox = topKResult.finalMatch.answerBlock.bbox;
    }

    result.push(question);
  }

  return result;
}
