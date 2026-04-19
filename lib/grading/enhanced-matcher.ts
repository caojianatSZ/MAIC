// lib/grading/enhanced-matcher.ts
/**
 * 增强的答案匹配和批改流程
 *
 * 核心功能：
 * 1. Top-K 匹配生成候选
 * 2. 智能触发 LLM rerank
 * 3. 综合置信度评估
 * 4. 向后兼容现有批改流程
 */

import { createLogger } from '@/lib/logger';
import type { Question, OCRBlock } from '@/lib/structure/builder';
import type { TopKResult } from '@/lib/matching/types';
import { matchAnswersTopK } from '@/lib/matching/top-k-matcher';
import { shouldTriggerRerank, sortByPriority } from '@/lib/rerank/trigger';
import { getReranker } from '@/lib/rerank/llm-reranker';
import type { RerankRequest, RerankResult } from '@/lib/rerank/types';

const log = createLogger('EnhancedMatcher');

/**
 * 增强的匹配选项
 */
export interface EnhancedMatchingOptions {
  /** Top-K 候选数量（默认 3） */
  k?: number;
  /** 是否启用 LLM rerank（默认 true） */
  enableRerank?: boolean;
  /** 图像数据（用于视觉 rerank） */
  imageBase64?: string;
  /** 最大 rerank 数量（成本控制） */
  maxReranks?: number;
  /** 是否使用调试模式 */
  debug?: boolean;
}

/**
 * 增强的匹配结果
 */
export interface EnhancedMatchingResult {
  /** 题目列表（带答案） */
  questions: Question[];
  /** Top-K 结果详情 */
  topKResults: TopKResult[];
  /** Rerank 结果详情 */
  rerankResults: Map<string, RerankResult>;
  /** 统计信息 */
  stats: {
    totalQuestions: number;
    matchedQuestions: number;
    rerankedQuestions: number;
    avgConfidence: number;
    lowConfidenceCount: number;
    processingTimeMs: number;
  };
}

/**
 * 增强的答案匹配函数（集成 Top-K + Rerank）
 *
 * @param questions 题目列表
 * @param handwritingBlocks 手写答案块
 * @param options 匹配选项
 * @returns 增强的匹配结果
 */
export async function matchAnswersEnhanced(
  questions: Question[],
  handwritingBlocks: OCRBlock[],
  options: EnhancedMatchingOptions = {}
): Promise<EnhancedMatchingResult> {
  const startTime = Date.now();
  const {
    k = 3,
    enableRerank = true,
    imageBase64,
    maxReranks = 10,
    debug = false
  } = options;

  log.info('开始增强匹配', {
    questionCount: questions.length,
    answerCount: handwritingBlocks.length,
    k,
    enableRerank
  });

  // 步骤 1: Top-K 匹配
  const topKResults = await matchAnswersTopK(questions, handwritingBlocks, {
    k,
    debug
  });

  // 步骤 2: 决定哪些题目需要 rerank
  const rerankMap = new Map<string, RerankResult>();
  let rerankCount = 0;

  if (enableRerank && imageBase64) {
    // 批量判断是否需要 rerank
    const triggers = new Map<string, ReturnType<typeof shouldTriggerRerank>>();

    for (const result of topKResults) {
      const trigger = shouldTriggerRerank(result, { hasImage: true });
      triggers.set(result.questionId, trigger);
    }

    // 按优先级排序
    const sortedTriggers = sortByPriority(triggers);

    // 只 rerank 高优先级和中优先级的题目（受 maxReranks 限制）
    const reranker = getReranker();

    for (const { questionId, trigger } of sortedTriggers) {
      if (rerankCount >= maxReranks) {
        log.info('达到最大 rerank 数量', { maxReranks });
        break;
      }

      if (trigger.priority === 'low') {
        continue; // 跳过低优先级
      }

      // 找到对应的题目和 Top-K 结果
      const question = questions.find(q => q.question_id === questionId);
      const topKResult = topKResults.find(r => r.questionId === questionId);

      if (!question || !topKResult || topKResult.candidates.length === 0) {
        continue;
      }

      // 构建 rerank 请求
      const request: RerankRequest = {
        questionId,
        questionContent: question.question || '',
        questionType: detectQuestionType(question),
        questionBbox: question.question_bbox,
        candidates: topKResult.candidates.map(c => ({
          answerText: c.answerBlock.text,
          answerBbox: c.answerBlock.bbox,
          confidence: c.answerBlock.confidence || 0.8,
          features: {
            spatialScore: c.features.spatialScore,
            layoutScore: c.features.layoutScore,
            semanticScore: c.features.semanticScore,
            horizontalDistance: c.features.horizontalDistance,
            verticalDistance: c.features.verticalDistance,
            relation: c.features.relation
          }
        })),
        imageBase64,
        options: {
          debug
        }
      };

      try {
        // 执行 rerank
        let rerankResult: RerankResult;

        if (trigger.suggestedMethod === 'semantic') {
          rerankResult = await reranker.semanticRerank(request);
        } else if (trigger.suggestedMethod === 'visual') {
          rerankResult = await reranker.visualRerank(request);
        } else {
          rerankResult = await reranker.hybridRerank(request);
        }

        if (rerankResult.success && rerankResult.finalAnswer) {
          rerankMap.set(questionId, rerankResult);
          rerankCount++;

          if (debug) {
            log.debug(`Rerank 成功: ${questionId}`, {
              method: rerankResult.method,
              confidence: rerankResult.confidence,
              processingTimeMs: rerankResult.processingTimeMs
            });
          }
        }
      } catch (error) {
        log.error(`Rerank 失败: ${questionId}`, { error });
      }
    }
  }

  // 步骤 3: 融合 Top-K 和 Rerank 结果
  const finalQuestions: Question[] = [];

  for (const question of questions) {
    const topKResult = topKResults.find(r => r.questionId === question.question_id);
    const rerankResult = rerankMap.get(question.question_id);

    let finalAnswer: {
      text: string;
      bbox: number[];
      confidence: number;
      type: 'print' | 'handwriting';
    } | undefined;

    if (rerankResult && rerankResult.finalAnswer) {
      // 使用 rerank 结果
      finalAnswer = {
        text: rerankResult.finalAnswer.answerText,
        bbox: rerankResult.finalAnswer.answerBbox,
        confidence: rerankResult.finalAnswer.rerankedConfidence,
        type: 'handwriting'
      };
    } else if (topKResult && topKResult.finalMatch) {
      // 使用 Top-K 结果
      finalAnswer = {
        text: topKResult.finalMatch.answerBlock.text,
        bbox: topKResult.finalMatch.answerBlock.bbox,
        confidence: topKResult.finalMatch.answerBlock.confidence || 0.8,
        type: topKResult.finalMatch.answerBlock.type || 'handwriting'
      };
    }

    const finalQuestion: Question = {
      ...question,
      student_answer: finalAnswer?.text,
      answer_bbox: finalAnswer?.bbox as [number, number, number, number] | undefined,
      answer_blocks: finalAnswer ? [{
        text: finalAnswer.text,
        bbox: finalAnswer.bbox as [number, number, number, number],
        confidence: finalAnswer.confidence,
        type: finalAnswer.type
      }] : []
    };

    finalQuestions.push(finalQuestion);
  }

  // 计算统计信息
  const matchedQuestions = finalQuestions.filter(q => q.answer_blocks.length > 0).length;
  const avgConfidence = topKResults.reduce((sum, r) => sum + r.confidence, 0) / topKResults.length;
  const lowConfidenceCount = topKResults.filter(r => r.confidence < 0.75).length;

  const stats = {
    totalQuestions: questions.length,
    matchedQuestions,
    rerankedQuestions: rerankCount,
    avgConfidence,
    lowConfidenceCount,
    processingTimeMs: Date.now() - startTime
  };

  log.info('增强匹配完成', stats);

  return {
    questions: finalQuestions,
    topKResults,
    rerankResults: rerankMap,
    stats
  };
}

/**
 * 检测题目类型
 */
function detectQuestionType(question: Question): 'choice' | 'fill_blank' | 'essay' | undefined {
  const text = (question.question || '').toLowerCase();

  if (text.includes('选择题') || text.includes('选择')) {
    return 'choice';
  }

  if (text.includes('填空') || text.includes('____') || text.includes('__')) {
    return 'fill_blank';
  }

  if (text.includes('解答') || text.includes('计算') || text.includes('证明') || text.includes('求')) {
    return 'essay';
  }

  return undefined;
}

/**
 * 向后兼容：将增强结果转换为简单的 Question[]
 */
export function convertEnhancedToQuestions(result: EnhancedMatchingResult): Question[] {
  return result.questions;
}
