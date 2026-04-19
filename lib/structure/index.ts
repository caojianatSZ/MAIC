// lib/structure/index.ts
/**
 * 结构重建层 - 统一导出
 *
 * 生产级试卷批改系统的核心模块
 * 用于从 OCR 结果重建题目结构，并匹配学生答案
 */

// 类型定义
export type { BBox, OCRBlock, Question } from './builder';
export type { TopKMatcherOptions } from './matcher';

// 核心功能 - 现有实现
export {
  rebuildStructure,
  fromTextInStructured
} from './builder';

export {
  matchAnswers,
  computeMatchConfidence,
  matchAnswersWithTopK
} from './matcher';

export {
  // OCR 容错
  detectLowConfidence,
  isSuspiciousText,
  // 匹配校验
  detectConflict,
  crossesNextQuestion,
  shouldFallback,
  // 置信度
  computeConfidence,
  computeQuestionConfidence,
  // 结果校验
  verifyLLMJudgment,
  verifyQuestionStructure,
  verifyQuestions
} from './validator';

// 智能分割器 - 新增
export type {
  SmartSplitOptions,
  SmartSplitResult
} from './smart-splitter';

export type { QuestionType } from './content-analyzer';

export type {
  SpatialCluster,
  LayoutInfo
} from './spatial-cluster';

export type {
  ContentFeatures
} from './content-analyzer';

export type {
  OptionGroup,
  QuestionWithOptions
} from './option-detector';

export {
  smartSplit,
  smartSplitCompat,
  rebuildStructureEnhanced
} from './smart-splitter';

export {
  clusterBlocksByY,
  detectColumnLayout
} from './spatial-cluster';

export {
  analyzeContentFeatures,
  detectQuestionType,
  hasQuestionPattern
} from './content-analyzer';

export {
  detectOptions,
  groupOptionsByQuestion,
  validateOptionGroup,
  isChoiceQuestion,
  extractOptionContent,
  formatOptions
} from './option-detector';

// 便捷函数
import { rebuildStructure, fromTextInStructured } from './builder';
import { matchAnswers } from './matcher';
import type { OCRBlock } from './builder';

/**
 * 完整处理流程（从 TextIn 结构化数据到题目列表）
 */
export async function processTextInResult(
  structuredData: any[],
  hasHandwritingSeparate: boolean = false
) {
  // 1. 转换为标准格式
  const blocks = fromTextInStructured(structuredData);

  if (blocks.length === 0) {
    return [];
  }

  // 2. 重建结构
  let questions = rebuildStructure(blocks);

  // 3. 如果没有手写分离，需要额外处理
  // TODO: 添加手写检测逻辑

  return questions;
}
