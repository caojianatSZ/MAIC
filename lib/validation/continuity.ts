/**
 * 题目连续性验证模块
 *
 * 功能：
 * 1. 验证题号是否连续
 * 2. 检查题目类型是否合理
 * 3. 验证文本长度
 * 4. 检查选项完整性
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('ContinuityValidation');

export interface Question {
  id: string;
  content: string;
  type: 'choice' | 'fill_blank' | 'essay';
  options?: string[];
  bbox_2d?: number[];
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  score: number;  // 0-100
  suggestions: string[];
}

export interface ValidationIssue {
  type: 'missing_questions' | 'unusual_type' | 'short_content' | 'missing_options' | 'gap_in_numbering';
  severity: 'error' | 'warning' | 'info';
  message: string;
  questionId?: string;
}

/**
 * 连续性验证主函数
 */
export function validateQuestionContinuity(
  questions: Question[]
): ValidationResult {
  const issues: ValidationIssue[] = [];

  log.info('开始连续性验证', { questionCount: questions.length });

  // 1. 检查题号连续性
  const numberingIssues = checkNumberingContinuity(questions);
  issues.push(...numberingIssues);

  // 2. 检查题目类型合理性
  const typeIssues = checkQuestionTypes(questions);
  issues.push(...typeIssues);

  // 3. 检查文本长度
  const contentIssues = checkContentLength(questions);
  issues.push(...contentIssues);

  // 4. 检查选项完整性（选择题）
  const optionIssues = checkOptionsCompleteness(questions);
  issues.push(...optionIssues);

  // 5. 生成建议
  const suggestions = generateSuggestions(questions, issues);

  // 6. 计算得分
  const score = calculateScore(issues);

  log.info('连续性验证完成', {
    isValid: issues.filter(i => i.severity === 'error').length === 0,
    issueCount: issues.length,
    score
  });

  return {
    isValid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    score,
    suggestions
  };
}

/**
 * 检查题号连续性
 */
function checkNumberingContinuity(questions: Question[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (questions.length === 0) {
    return [{
      type: 'missing_questions',
      severity: 'error',
      message: '没有识别到任何题目'
    }];
  }

  // 提取题号
  const numbers = questions
    .map(q => {
      const match = q.id.match(/\d+/);
      return match ? parseInt(match[0]) : null;
    })
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);

  if (numbers.length === 0) {
    return [{
      type: 'gap_in_numbering',
      severity: 'warning',
      message: '无法解析题号'
    }];
  }

  // 检查是否有跳跃
  for (let i = 1; i < numbers.length; i++) {
    const gap = numbers[i] - numbers[i - 1];

    if (gap > 1) {
      const missingCount = gap - 1;

      issues.push({
        type: 'gap_in_numbering',
        severity: missingCount <= 2 ? 'warning' : 'error',
        message: `题号从${numbers[i-1]}跳到${numbers[i]}，可能遗漏${missingCount}道题`
      });
    }
  }

  // 特殊情况：只有1道题
  if (numbers.length === 1) {
    issues.push({
      type: 'missing_questions',
      severity: 'warning',
      message: '只识别到1道题，可能不完整'
    });
  }

  return issues;
}

/**
 * 检查题目类型合理性
 */
function checkQuestionTypes(questions: Question[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const typeCount = {
    choice: questions.filter(q => q.type === 'choice').length,
    fill_blank: questions.filter(q => q.type === 'fill_blank').length,
    essay: questions.filter(q => q.type === 'essay').length
  };

  // 如果有多道题但没有选择题，可能不正常
  if (questions.length >= 3 && typeCount.choice === 0) {
    issues.push({
      type: 'unusual_type',
      severity: 'info',
      message: `识别到${questions.length}道题但没有选择题，可能识别不完整`
    });
  }

  // 如果全部是问答题，可能OCR把选择题拆错了
  if (questions.length >= 5 && typeCount.essay === questions.length) {
    issues.push({
      type: 'unusual_type',
      severity: 'warning',
      message: '所有题目都被识别为问答题，选择题可能被错误识别'
    });
  }

  return issues;
}

/**
 * 检查内容长度
 */
function checkContentLength(questions: Question[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  questions.forEach((q, index) => {
    const contentLength = q.content?.length || 0;

    // 题干太短
    if (contentLength < 10) {
      issues.push({
        type: 'short_content',
        severity: 'error',
        message: `题目${q.id}题干太短（${contentLength}字符），可能识别不完整`,
        questionId: q.id
      });
    }
    // 题干偏短
    else if (contentLength < 30) {
      issues.push({
        type: 'short_content',
        severity: 'warning',
        message: `题目${q.id}题干较短（${contentLength}字符），可能有遗漏`,
        questionId: q.id
      });
    }
  });

  return issues;
}

/**
 * 检查选项完整性（选择题）
 */
function checkOptionsCompleteness(questions: Question[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  questions.forEach(q => {
    if (q.type === 'choice') {
      const optionCount = q.options?.length || 0;

      // 选择题应该有2-6个选项
      if (optionCount === 0) {
        issues.push({
          type: 'missing_options',
          severity: 'error',
          message: `题目${q.id}是选择题但没有识别到选项`,
          questionId: q.id
        });
      } else if (optionCount < 2) {
        issues.push({
          type: 'missing_options',
          severity: 'error',
          message: `题目${q.id}选项太少（${optionCount}个），可能不完整`,
          questionId: q.id
        });
      } else if (optionCount < 4) {
        issues.push({
          type: 'missing_options',
          severity: 'warning',
          message: `题目${q.id}选项数量较少（${optionCount}个），可能有遗漏`,
          questionId: q.id
        });
      }
    }
  });

  return issues;
}

/**
 * 生成建议
 */
function generateSuggestions(
  questions: Question[],
  issues: ValidationIssue[]
): string[] {
  const suggestions: string[] = [];

  // 基于问题类型生成建议
  const hasGapIssue = issues.some(i => i.type === 'gap_in_numbering' && i.severity === 'error');
  const hasShortContent = issues.some(i => i.type === 'short_content' && i.severity === 'error');
  const hasMissingOptions = issues.some(i => i.type === 'missing_options');

  if (hasGapIssue) {
    suggestions.push('建议重新拍摄或使用"更精确识别"模式');
  }

  if (hasShortContent) {
    suggestions.push('部分题目内容不完整，建议检查图片质量');
  }

  if (hasMissingOptions) {
    suggestions.push('选择题选项不完整，建议确保选项清晰可见');
  }

  // 如果只有1道题
  if (questions.length === 1) {
    suggestions.push('只识别到1道题，如果实际有更多，建议重试');
  }

  // 如果没有问题
  if (issues.length === 0) {
    suggestions.push('识别结果良好，可以继续');
  }

  return suggestions;
}

/**
 * 计算得分
 */
function calculateScore(issues: ValidationIssue[]): number {
  let score = 100;

  issues.forEach(issue => {
    switch (issue.severity) {
      case 'error':
        score -= 20;
        break;
      case 'warning':
        score -= 10;
        break;
      case 'info':
        score -= 5;
        break;
    }
  });

  return Math.max(0, score);
}

/**
 * 快速检查（只检查关键问题）
 */
export function quickValidate(questions: Question[]): {
  isValid: boolean;
  reason: string;
} {
  if (questions.length === 0) {
    return { isValid: false, reason: '未识别到题目' };
  }

  if (questions.length === 1) {
    return { isValid: false, reason: '只识别到1道题，可能不完整' };
  }

  const hasShortContent = questions.some(q => (q.content?.length || 0) < 10);
  if (hasShortContent) {
    return { isValid: false, reason: '部分题目内容太短' };
  }

  return { isValid: true, reason: '识别正常' };
}
