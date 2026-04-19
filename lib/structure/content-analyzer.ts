// lib/structure/content-analyzer.ts
/**
 * 内容特征分析模块 - 识别题目类型和特征
 *
 * 核心功能：
 * 1. 检测题目类型（选择题、填空题、解答题）
 * 2. 检测填空标记
 * 3. 检测题目模式
 */

import { createLogger } from '@/lib/logger';
import type { SpatialCluster } from './spatial-cluster';

const log = createLogger('ContentAnalyzer');

/**
 * 题目类型
 */
export type QuestionType = 'choice' | 'fill_blank' | 'essay' | 'unknown';

/**
 * 内容特征
 */
export interface ContentFeatures {
  /** 是否有选项标记（A. B. C. D.） */
  hasOptionMarkers: boolean;
  /** 检测到的选项数量 */
  optionCount: number;
  /** 是否有填空标记 */
  hasBlankMarkers: boolean;
  /** 填空标记类型 */
  blankMarkerTypes: string[];
  /** 是否有题号 */
  hasQuestionNumber: boolean;
  /** 提取的题号 */
  questionNumber: string | null;
  /** 题目类型 */
  questionType: QuestionType;
  /** 置信度（0-1） */
  confidence: number;
}

/**
 * 选项标记模式
 */
const OPTION_PATTERNS = [
  /^[A-D][.．、)\]]\s*/m,      // A. B. C. D.
  /^\([A-D]\)\s*/m,              // (A) (B) (C) (D)
  /^[A-D]、\s*/m                  // A、 B、 C、 D、
];

/**
 * 填空标记模式
 */
const BLANK_PATTERNS = [
  /___+/,                         // 下划线
  /（）/,                          // 中文括号
  /\(\s*\)/,                      // 空括号
  /【\s*】/,                      // 方括号
  /<\s*>/,                        // 尖括号
];

/**
 * 分析聚类的内容特征
 */
export function analyzeContentFeatures(cluster: SpatialCluster): ContentFeatures {
  const text = cluster.blocks.map(b => b.text).join('\n');

  // 检测选项
  const optionMarkers = detectOptionMarkers(text);
  const hasOptionMarkers = optionMarkers.length > 0;

  // 检测填空标记
  const blankMarkers = detectBlankMarkers(text);
  const hasBlankMarkers = blankMarkers.length > 0;

  // 检测题号
  const questionNumber = extractQuestionNumber(text);

  // 确定题目类型
  const questionType = determineQuestionType({
    hasOptionMarkers,
    optionCount: optionMarkers.length,
    hasBlankMarkers,
    textLength: text.length,
    cluster
  });

  // 计算置信度
  const confidence = calculateConfidence({
    hasOptionMarkers,
    hasBlankMarkers,
    hasQuestionNumber: !!questionNumber,
    questionType
  });

  return {
    hasOptionMarkers,
    optionCount: optionMarkers.length,
    hasBlankMarkers,
    blankMarkerTypes: blankMarkers.map(m => m.type),
    hasQuestionNumber: !!questionNumber,
    questionNumber,
    questionType,
    confidence
  };
}

/**
 * 检测题目类型
 */
export function detectQuestionType(cluster: SpatialCluster): QuestionType {
  const features = analyzeContentFeatures(cluster);
  return features.questionType;
}

/**
 * 检测是否包含题目模式
 */
export function hasQuestionPattern(cluster: SpatialCluster): boolean {
  const features = analyzeContentFeatures(cluster);

  // 有明确的题目特征
  if (features.hasQuestionNumber || features.hasOptionMarkers || features.hasBlankMarkers) {
    return true;
  }

  // 内容长度适中（可能是题干）
  const textLength = cluster.blocks.map(b => b.text).join('').length;
  if (textLength > 20 && textLength < 500) {
    return true;
  }

  return false;
}

/**
 * 检测选项标记
 */
function detectOptionMarkers(text: string): Array<{ marker: string; position: number }> {
  const markers: Array<{ marker: string; position: number }> = [];

  for (const pattern of OPTION_PATTERNS) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      markers.push({
        marker: match[0],
        position: match.index
      });
    }
  }

  // 去重并排序
  const unique = markers.filter((m, i, arr) =>
    i === 0 || m.position !== arr[i - 1].position
  );

  return unique.sort((a, b) => a.position - b.position);
}

/**
 * 检测填空标记
 */
function detectBlankMarkers(text: string): Array<{ type: string; match: string }> {
  const markers: Array<{ type: string; match: string }> = [];

  // 为每个模式定义一个类型标识符
  const patternTypes = [
    { pattern: /___+/, type: 'underline' },
    { pattern: /（）/, type: 'chinese_parens' },
    { pattern: /\(\s*\)/, type: 'parens' },
    { pattern: /【\s*】/, type: 'brackets' },
    { pattern: /<\s*>/, type: 'angle' }
  ];

  for (const { pattern, type: patternType } of patternTypes) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      markers.push({ type: patternType, match: match[0] });
    }
  }

  return markers;
}

/**
 * 提取题号
 */
function extractQuestionNumber(text: string): string | null {
  const lines = text.trim().split('\n');
  if (lines.length === 0) return null;

  const firstLine = lines[0].trim();

  // 尝试多种格式
  // 1. 纯数字开头：1. 2、 3． 等
  const numMatch = firstLine.match(/^(\d+)/);
  if (numMatch) {
    return numMatch[1];
  }

  // 2. 年份题：(2011·江苏·4,3分) 提取题号
  const yearMatch = firstLine.match(/\((\d{4}).*?(\d+)\s*[分分]/);
  if (yearMatch) {
    return yearMatch[2];
  }

  // 3. 括号编号：(1) (2) 等
  const parenMatch = firstLine.match(/^\((\d+)\)/);
  if (parenMatch) {
    return parenMatch[1];
  }

  return null;
}

/**
 * 确定题目类型
 */
function determineQuestionType(params: {
  hasOptionMarkers: boolean;
  optionCount: number;
  hasBlankMarkers: boolean;
  textLength: number;
  cluster: SpatialCluster;
}): QuestionType {
  const { hasOptionMarkers, optionCount, hasBlankMarkers } = params;

  // 有明确选项 → 选择题
  if (hasOptionMarkers && optionCount >= 2) {
    return 'choice';
  }

  // 有填空标记 → 填空题
  if (hasBlankMarkers) {
    return 'fill_blank';
  }

  // 内容较短，可能是不完整的选择题
  if (hasOptionMarkers && optionCount === 1) {
    return 'choice';
  }

  // 默认为解答题
  return 'essay';
}

/**
 * 计算置信度
 */
function calculateConfidence(params: {
  hasOptionMarkers: boolean;
  hasBlankMarkers: boolean;
  hasQuestionNumber: boolean;
  questionType: QuestionType;
}): number {
  let confidence = 0.5; // 基础置信度

  // 有题号 +0.2
  if (params.hasQuestionNumber) {
    confidence += 0.2;
  }

  // 有明确特征 +0.3
  if (params.hasOptionMarkers || params.hasBlankMarkers) {
    confidence += 0.3;
  }

  // 题目类型明确 +0.1
  if (params.questionType !== 'unknown') {
    confidence += 0.1;
  }

  return Math.min(1, confidence);
}
