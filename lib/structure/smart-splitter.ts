// lib/structure/smart-splitter.ts
/**
 * 智能题目分割器
 *
 * 核心功能：
 * 1. 不依赖题号格式，基于空间布局和内容特征分割题目
 * 2. 自动重新分配题号
 * 3. 整合空间聚类、内容分析、选项检测
 */

import { createLogger } from '@/lib/logger';
import type { BBox, OCRBlock, Question as BaseQuestion } from './builder';
import type { QuestionType } from './content-analyzer';
import {
  clusterBlocksByY,
  detectColumnLayout,
  type SpatialCluster,
  type ClusterOptions
} from './spatial-cluster';
import {
  analyzeContentFeatures,
  detectQuestionType,
  type ContentFeatures
} from './content-analyzer';
import {
  detectOptions,
  groupOptionsByQuestion,
  formatOptions,
  type OptionGroup
} from './option-detector';

const log = createLogger('SmartSplitter');

/**
 * 题目结构（扩展自 builder.ts 的 Question）
 */
export interface Question extends BaseQuestion {
  type?: QuestionType;
  options?: string[];
}

/**
 * 智能分割选项
 */
export interface SmartSplitOptions {
  /** 是否重新分配题号（默认 true） */
  reassignNumbers?: boolean;
  /** 是否使用空间聚类（默认 true） */
  useSpatialClustering?: boolean;
  /** Y 坐标跳跃阈值倍数（默认 1.5） */
  yGapThresholdMultiplier?: number;
  /** 最小题目高度（默认 50px） */
  minClusterHeight?: number;
  /** 调试模式 */
  debug?: boolean;
}

/**
 * 智能分割结果
 */
export interface SmartSplitResult {
  questions: Question[];
  metadata: {
    method: 'smart' | 'fallback';
    clusterCount: number;
    averageConfidence: number;
    detectedLayout: 'single_column' | 'double_column' | 'unknown';
    processingTimeMs: number;
  };
  debug?: {
    clusters: SpatialCluster[];
    yGaps: number[];
    threshold: number;
  };
}

/**
 * 智能题目分割（主函数）
 *
 * 不依赖题号格式，基于空间布局和内容特征
 */
export function smartSplit(
  blocks: OCRBlock[],
  options: SmartSplitOptions = {}
): SmartSplitResult {
  const startTime = Date.now();
  const {
    reassignNumbers = true,
    useSpatialClustering = true,
    yGapThresholdMultiplier = 1.5,
    minClusterHeight = 50,
    debug = false
  } = options;

  if (blocks.length === 0) {
    return {
      questions: [],
      metadata: {
        method: 'smart',
        clusterCount: 0,
        averageConfidence: 0,
        detectedLayout: 'unknown',
        processingTimeMs: 0
      }
    };
  }

  // 检测页面布局
  const layoutInfo = detectColumnLayout(blocks);

  if (debug) {
    log.info('页面布局检测', layoutInfo);
  }

  // 空间聚类
  const clusterOptions: ClusterOptions = {
    yGapThresholdMultiplier,
    minClusterHeight,
    debug
  };

  let clusters: SpatialCluster[];

  if (useSpatialClustering) {
    clusters = clusterBlocksByY(blocks, clusterOptions);
  } else {
    // 简单分割：每个块一个聚类
    clusters = blocks.map(b => ({
      blocks: [b],
      bbox: b.bbox,
      startY: b.bbox[1],
      endY: b.bbox[3],
      startX: b.bbox[0],
      endX: b.bbox[2],
      hasQuestionNumber: false,
      hasOptions: false,
      detectedType: 'unknown'
    }));
  }

  if (debug) {
    log.info('空间聚类完成', { clusterCount: clusters.length });
  }

  // 内容特征分析
  const clustersWithFeatures = clusters.map(cluster => {
    const features = analyzeContentFeatures(cluster);
    return {
      ...cluster,
      features,
      detectedType: features.questionType
    };
  });

  // 选项检测和归属
  const clustersWithOptions = groupOptionsByQuestion(
    clustersWithFeatures.map(c => ({
      blocks: c.blocks,
      bbox: c.bbox,
      startY: c.startY,
      endY: c.endY
    })),
    blocks,
    { debug }
  );

  // 合并特征和选项
  const enrichedClusters = clustersWithFeatures.map((cluster, index) => ({
    ...cluster,
    options: clustersWithOptions[index]?.options || []
  }));

  // 过滤：只保留可能是题目的聚类
  const questionClusters = enrichedClusters.filter(c => {
    // 有明确的题目特征
    if (c.features.hasOptionMarkers || c.features.hasBlankMarkers || c.features.hasQuestionNumber) {
      return true;
    }

    // 内容长度适中（可能是题干）
    const textLength = c.blocks.map(b => b.text).join('').length;
    if (textLength >= 20 && textLength <= 1000) {
      return true;
    }

    return false;
  });

  // 转换为 Question 格式
  let questions = questionClusters.map((cluster, index) => ({
    question_id: reassignNumbers ? String(index + 1) : (cluster.features.questionNumber || String(index + 1)),
    question_blocks: cluster.blocks,
    answer_blocks: [],
    question: cluster.blocks.map(b => b.text).join('\n'),
    student_answer: undefined,
    question_bbox: cluster.bbox,
    answer_bbox: undefined,
    type: cluster.features.questionType,
    options: cluster.options.length > 0 ? cluster.options.map(o => `${o.label}. ${o.content}`) : undefined
  }));

  const processingTimeMs = Date.now() - startTime;
  const avgConfidence = questionClusters.length > 0
    ? questionClusters.reduce((sum, c) => sum + c.features.confidence, 0) / questionClusters.length
    : 0;

  const result: SmartSplitResult = {
    questions,
    metadata: {
      method: 'smart',
      clusterCount: clusters.length,
      averageConfidence: avgConfidence,
      detectedLayout: layoutInfo.type,
      processingTimeMs
    }
  };

  if (debug) {
    result.debug = {
      clusters: enrichedClusters,
      yGaps: [],
      threshold: yGapThresholdMultiplier
    };
  }

  if (debug) {
    log.info('智能分割完成', {
      questionCount: questions.length,
      processingTimeMs,
      avgConfidence
    });
  }

  return result;
}

/**
 * 与现有 rebuildStructure 兼容的接口
 */
export function smartSplitCompat(
  blocks: OCRBlock[],
  options?: SmartSplitOptions
): Question[] {
  const result = smartSplit(blocks, options);
  return result.questions;
}

/**
 * 增强版结构重建（智能优先，降级到现有方案）
 */
export function rebuildStructureEnhanced(
  blocks: OCRBlock[],
  options: {
    preferSmart?: boolean;
    fallbackFn?: (blocks: OCRBlock[]) => Question[];
  } = {}
): Question[] {
  const { preferSmart = true, fallbackFn } = options;

  if (preferSmart) {
    try {
      const result = smartSplit(blocks, { reassignNumbers: true });
      if (result.questions.length > 0) {
        log.info('智能分割成功', { count: result.questions.length });
        return result.questions;
      }
    } catch (error) {
      log.warn('智能分割失败', error);
    }
  }

  // 降级到现有方案
  if (fallbackFn) {
    log.info('使用降级方案');
    return fallbackFn(blocks);
  }

  // 返回空结果
  return [];
}
