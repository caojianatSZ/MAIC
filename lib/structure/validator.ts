// lib/structure/validator.ts
/**
 * 容错设计 - 校验和异常检测
 *
 * 核心功能：
 * 1. OCR 置信度检测
 * 2. 匹配冲突检测
 * 3. 跨题检测
 * 4. 置信度融合
 * 5. Fallback 机制
 */

import { createLogger } from '@/lib/logger';
import type { Question, BBox } from './builder';

const log = createLogger('StructureValidator');

// ============== OCR 容错 ==============

/**
 * 检测低置信度块
 */
export function detectLowConfidence(blocks: any[], threshold = 0.75) {
  return blocks.filter(b => (b.confidence ?? 1) < threshold);
}

/**
 * 检测可疑文本
 */
export function isSuspiciousText(text: string): boolean {
  if (!text || text.trim().length === 0) return true;
  if (text.includes('??')) return true;
  if (text.includes('///')) return true;
  if (text.length < 2) return true;
  return false;
}

// ============== 匹配校验 ==============

/**
 * 检测匹配冲突
 * 当两个题目的匹配分数非常接近时，可能存在冲突
 */
export function detectConflict(scores: number[]): boolean {
  if (scores.length < 2) return false;

  const sorted = [...scores].sort((a, b) => a - b);
  return Math.abs(sorted[0] - sorted[1]) < 20;
}

/**
 * 检测跨题
 */
export function crossesNextQuestion(
  answerBox: BBox,
  nextQuestionBox: BBox
): boolean {
  return answerBox[1] > nextQuestionBox[1];
}

// ============== 置信度融合 ==============

/**
 * 融合多个来源的置信度
 *
 * @param ocrConfidence OCR 平均置信度
 * @param matchConfidence 匹配置信度
 * @param llmConfidence LLM 判题置信度
 * @returns 融合后的置信度 (0-1)
 */
export function computeConfidence(
  ocrConfidence: number,
  matchConfidence: number,
  llmConfidence: number
): number {
  return ocrConfidence * 0.3 + matchConfidence * 0.3 + llmConfidence * 0.4;
}

/**
 * 计算题目的整体置信度
 */
export function computeQuestionConfidence(
  question: Question,
  ocrConfidence: number,
  llmConfidence: number
): number {
  // 匹配置信度：基于答案数量和位置
  let matchConfidence = 0.9;

  if (question.answer_blocks.length === 0) {
    matchConfidence = 0.3; // 没有答案
  } else if (question.answer_blocks.length > 5) {
    matchConfidence = 0.6; // 答案太多，可能匹配错误
  }

  return computeConfidence(ocrConfidence, matchConfidence, llmConfidence);
}

// ============== Fallback 机制 ==============

/**
 * 判断是否需要 fallback 到多模态模型
 */
export interface FallbackCheck {
  ocrConfidence: number;
  matchConfidence: number;
  llmConfidence: number;
  hasAnswer?: boolean;
  answerCount?: number;
}

export function shouldFallback(check: FallbackCheck): boolean {
  const { ocrConfidence, matchConfidence, llmConfidence } = check;

  // 任一维度置信度过低都需要 fallback
  if (ocrConfidence < 0.7) return true;
  if (matchConfidence < 0.7) return true;
  if (llmConfidence < 0.7) return true;

  // 特殊情况检查
  if (check.hasAnswer === false) return true;
  if (check.answerCount !== undefined && check.answerCount > 5) return true;

  return false;
}

// ============== 结果校验 ==============

/**
 * 校验 LLM 返回的判题结果
 */
export function verifyLLMJudgment(result: {
  is_correct?: boolean;
  confidence?: number;
}): boolean {
  // 基本校验
  if (result.is_correct === undefined) return false;
  if (result.confidence === undefined) return false;

  // 置信度范围检查
  if (result.confidence < 0 || result.confidence > 1) return false;

  return true;
}

/**
 * 校验题目结构的完整性
 */
export function verifyQuestionStructure(question: Question): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // 检查题目 ID
  if (!question.question_id) {
    issues.push('缺少题目编号');
  }

  // 检查题干
  if (!question.question || question.question.trim().length < 5) {
    issues.push('题干过短');
  }

  // 检查答案
  if (!question.student_answer || question.student_answer.trim().length === 0) {
    issues.push('没有答案');
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

/**
 * 批量校验题目列表
 */
export function verifyQuestions(questions: Question[]): {
  valid: Question[];
  invalid: Question[];
  issues: Map<string, string[]>;
} {
  const valid: Question[] = [];
  const invalid: Question[] = [];
  const issues = new Map<string, string[]>();

  for (const q of questions) {
    const check = verifyQuestionStructure(q);

    if (check.isValid) {
      valid.push(q);
    } else {
      invalid.push(q);
      issues.set(q.question_id, check.issues);
    }
  }

  log.info('题目结构校验', {
    total: questions.length,
    valid: valid.length,
    invalid: invalid.length
  });

  return { valid, invalid, issues };
}
