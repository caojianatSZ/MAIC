// lib/validation/anti-hallucination.ts

import { createLogger } from '@/lib/logger';
import type { JudgmentValidationResult, AnswerValidation, ReviewReason } from './types';
import { REVIEW_REASONS } from './types';

const log = createLogger('AntiHallucination');

// 环境变量配置
const CONFIDENCE_THRESHOLD_LOW = parseFloat(process.env.CORRECTION_CONFIDENCE_THRESHOLD_LOW || '0.6');
const CONFIDENCE_THRESHOLD_HIGH = parseFloat(process.env.CORRECTION_CONFIDENCE_THRESHOLD_HIGH || '0.8');

/**
 * 校验 LLM 批改结果，防止幻觉
 */
export function validateJudgmentResult(params: {
  questionId: string;
  questionContent: string;
  studentAnswer?: string;
  llmIsCorrect: boolean;
  llmConfidence: number;
  questionType: 'choice' | 'fill_blank' | 'essay';
}): JudgmentValidationResult {
  const {
    questionId,
    questionContent,
    studentAnswer,
    llmIsCorrect,
    llmConfidence,
    questionType
  } = params;

  const warnings: string[] = [];
  let needsReview = false;
  let reviewReason: ReviewReason = REVIEW_REASONS.LOW_CONFIDENCE;
  let adjustedConfidence = llmConfidence;

  // 1. 检查学生答案是否为空
  if (!studentAnswer || studentAnswer.trim().length === 0) {
    warnings.push('未检测到学生答案');
    if (llmIsCorrect) {
      // LLM 说答对了但没检测到答案 - 可能是幻觉
      needsReview = true;
      reviewReason = REVIEW_REASONS.NO_ANSWER_DETECTED;
      adjustedConfidence = Math.min(llmConfidence * 0.5, 0.3);
    }
  }

  // 2. 检查答案长度是否合理
  if (studentAnswer) {
    const answerLength = studentAnswer.trim().length;

    if (questionType === 'choice') {
      // 选择题答案应该是单个字母
      if (answerLength > 2) {
        warnings.push(`选择题答案异常长 (${answerLength} 字符)`);
        adjustedConfidence *= 0.7;
        if (llmConfidence < CONFIDENCE_THRESHOLD_HIGH) {
          needsReview = true;
          reviewReason = REVIEW_REASONS.ANSWER_TOO_LONG;
        }
      }
    } else if (questionType === 'fill_blank') {
      // 填空题答案不应该过长
      if (answerLength > 100) {
        warnings.push(`填空题答案异常长 (${answerLength} 字符)`);
        adjustedConfidence *= 0.8;
      }
    }
  }

  // 3. 置信度阈值检查
  if (llmConfidence < CONFIDENCE_THRESHOLD_LOW) {
    needsReview = true;
    warnings.push(`LLM 置信度过低: ${(llmConfidence * 100).toFixed(1)}%`);
    reviewReason = REVIEW_REASONS.LOW_CONFIDENCE;
  } else if (llmConfidence < CONFIDENCE_THRESHOLD_HIGH) {
    warnings.push(`LLM 置信度中等: ${(llmConfidence * 100).toFixed(1)}%，建议家长确认`);
  }

  // 4. 检查题目和答案的匹配度（基本合理性检查）
  if (llmIsCorrect && studentAnswer) {
    const reasonableness = checkAnswerReasonableness(questionContent, studentAnswer, questionType);
    if (!reasonableness.isReasonable) {
      warnings.push(...reasonableness.issues);
      adjustedConfidence *= 0.6;
      needsReview = true;
      reviewReason = REVIEW_REASONS.ANSWER_MISMATCH;
    }
  }

  // 5. 选择题特殊检查：答案是否在选项范围内
  if (questionType === 'choice' && studentAnswer) {
    const optionMatch = extractOptions(questionContent);
    if (optionMatch.length > 0 && !isAnswerInOptions(studentAnswer, optionMatch)) {
      warnings.push(`学生答案 "${studentAnswer}" 不在选项范围内`);
      if (llmIsCorrect) {
        // LLM 说答对了但答案不在选项里 - 可能是幻觉
        needsReview = true;
        reviewReason = REVIEW_REASONS.ANSWER_MISMATCH;
        adjustedConfidence = Math.min(adjustedConfidence, 0.4);
      }
    }
  }

  const isValid = !needsReview || adjustedConfidence > CONFIDENCE_THRESHOLD_LOW;

  log.info('批改结果校验完成', {
    questionId,
    isValid,
    needsReview,
    reviewReason,
    originalConfidence: llmConfidence,
    adjustedConfidence
  });

  return {
    isValid,
    needsReview,
    reviewReason,
    adjustedConfidence,
    warnings
  };
}

/**
 * 检查答案是否合理
 */
function checkAnswerReasonableness(
  questionContent: string,
  studentAnswer: string,
  questionType: string
): AnswerValidation {
  const issues: string[] = [];
  let isReasonable = true;

  // 检查答案是否包含题目内容（可能是 LLM 幻觉复制题目）
  if (studentAnswer.length > 20 && questionContent.includes(studentAnswer.slice(0, 20))) {
    issues.push('答案可能包含题目内容');
    isReasonable = false;
  }

  // 检查答案是否全是数字（对于非计算题可能异常）
  if (questionType === 'essay' && /^\d+$/.test(studentAnswer) && studentAnswer.length > 5) {
    issues.push('解答题答案异常（纯数字且过长）');
    isReasonable = false;
  }

  // 检查答案是否包含特殊模式（可能是错误识别）
  const hallucinationPatterns = [
    /无法识别/i,
    /图片/i,
    /如图/i,
    /略/i,
    /不详/i
  ];

  for (const pattern of hallucinationPatterns) {
    if (pattern.test(studentAnswer)) {
      issues.push(`答案包含可疑模式: ${pattern.source}`);
      isReasonable = false;
      break;
    }
  }

  return { isReasonable, confidence: isReasonable ? 1 : 0.3, issues };
}

/**
 * 从题目中提取选项
 */
function extractOptions(questionContent: string): string[] {
  const optionRegex = /([A-Z])[.、]\s*([^\n]+)/g;
  const options: string[] = [];
  let match;

  while ((match = optionRegex.exec(questionContent)) !== null) {
    options.push(match[1]);  // 返回选项字母
  }

  return options;
}

/**
 * 检查答案是否在选项范围内
 */
function isAnswerInOptions(answer: string, options: string[]): boolean {
  const normalizedAnswer = answer.trim().toUpperCase();
  return options.some(opt => opt === normalizedAnswer);
}

/**
 * 计算整体复核需要程度
 */
export function calculateReviewNeed(params: {
  lowConfidenceCount: number;
  totalQuestions: number;
  hasValidationErrors: boolean;
}): {
  needsReview: boolean;
  reviewReason: string;
} {
  const { lowConfidenceCount, totalQuestions, hasValidationErrors } = params;

  // 有验证错误，必须复核
  if (hasValidationErrors) {
    return {
      needsReview: true,
      reviewReason: REVIEW_REASONS.OCR_VALIDATION_FAILED
    };
  }

  // 低置信度题目超过 30%，需要复核
  if (totalQuestions > 0 && lowConfidenceCount / totalQuestions > 0.3) {
    return {
      needsReview: true,
      reviewReason: REVIEW_REASONS.LOW_CONFIDENCE
    };
  }

  return {
    needsReview: false,
    reviewReason: ''
  };
}
