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
import {
  validateAndFixClusters,
  type CompletenessResult
} from './completeness-validator';

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

  // ===== 改进2：多栏试卷处理 =====
  // 预处理：根据布局信息过滤或分割 blocks
  let processedBlocks = blocks;
  let skipClustering = false;
  let clusters: SpatialCluster[] = [];  // 初始化为空数组

  // 1. 检测并排除侧边栏（通常是答案区域）
  if (layoutInfo.hasSidebar && layoutInfo.sidebarRegion) {
    const sidebarRegion = layoutInfo.sidebarRegion;
    const sidebarWidth = sidebarRegion[2] - sidebarRegion[0];
    const pageWidth = Math.max(...blocks.map(b => b.bbox[2])) - Math.min(...blocks.map(b => b.bbox[0]));

    if (sidebarWidth < pageWidth * 0.25) {
      // 侧边栏宽度小于页面25%，认为是答案区域，排除
      processedBlocks = blocks.filter(b => {
        const blockCenter = (b.bbox[0] + b.bbox[2]) / 2;
        const sidebarLeft = sidebarRegion[0];
        const sidebarRight = sidebarRegion[2];
        // 排除在侧边栏范围内的块
        return !(blockCenter >= sidebarLeft && blockCenter <= sidebarRight);
      });

      if (debug) {
        log.info('排除侧边栏', {
          originalCount: blocks.length,
          filteredCount: processedBlocks.length,
          sidebarWidth: Math.round(sidebarWidth),
          sidebarRegion: layoutInfo.sidebarRegion?.map(v => Math.round(v))
        });
      }
    }
  }

  // 2. 双栏试卷分别处理
  if (layoutInfo.type === 'double_column' && layoutInfo.columnCenters.length === 2) {
    const column1Blocks = processedBlocks.filter(b => {
      const blockCenter = (b.bbox[0] + b.bbox[2]) / 2;
      return blockCenter < layoutInfo.columnCenters[1];
    });

    const column2Blocks = processedBlocks.filter(b => {
      const blockCenter = (b.bbox[0] + b.bbox[2]) / 2;
      return blockCenter >= layoutInfo.columnCenters[1];
    });

    if (debug) {
      log.info('双栏试卷分割', {
        column1Blocks: column1Blocks.length,
        column2Blocks: column2Blocks.length,
        columnCenters: layoutInfo.columnCenters.map(v => Math.round(v))
      });
    }

    // 分别对每一栏进行聚类，然后合并结果
    const clusterOptions: ClusterOptions = {
      yGapThresholdMultiplier,
      minClusterHeight,
      debug
    };

    const clusters1 = useSpatialClustering
      ? clusterBlocksByY(column1Blocks, clusterOptions)
      : column1Blocks.map(b => createSimpleCluster(b));

    const clusters2 = useSpatialClustering
      ? clusterBlocksByY(column2Blocks, clusterOptions)
      : column2Blocks.map(b => createSimpleCluster(b));

    // 合并两栏的聚类结果
    clusters = [...clusters1, ...clusters2];

    // 跳过后续的统一聚类处理
    skipClustering = true;
  }

  // 空间聚类（单栏或未检测到双栏）
  const clusterOptions: ClusterOptions = {
    yGapThresholdMultiplier,
    minClusterHeight,
    debug
  };

  if (!skipClustering) {
    if (useSpatialClustering) {
      clusters = clusterBlocksByY(processedBlocks, clusterOptions);
    } else {
      // 简单分割：每个块一个聚类
      clusters = processedBlocks.map(b => createSimpleCluster(b));
    }
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

  // ===== 改进3：完整性校验 =====
  // 验证聚类完整性并合并不完整的聚类
  const completenessValidation = validateAndFixClusters(enrichedClusters as any);

  if (debug && completenessValidation.validationResults.length > 0) {
    const incompleteCount = completenessValidation.validationResults.filter(r => !r.isComplete).length;
    log.info('完整性校验', {
      totalClusters: enrichedClusters.length,
      incompleteCount,
      validAfterMerge: completenessValidation.validClusters.length
    });
  }

  // 将完整性校验的结果与原始特征合并
  const questionClusters = enrichedClusters
    .filter((_, index) => completenessValidation.validationResults[index]?.isComplete !== false)
    .map((cluster, index) => ({
      ...cluster,
      validity: completenessValidation.validationResults[index]
    }));

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

/**
 * 创建简单的单个块聚类（辅助函数）
 */
function createSimpleCluster(block: OCRBlock): SpatialCluster {
  return {
    blocks: [block],
    bbox: block.bbox,
    startY: block.bbox[1],
    endY: block.bbox[3],
    startX: block.bbox[0],
    endX: block.bbox[2],
    hasQuestionNumber: false,
    hasOptions: false,
    detectedType: 'unknown'
  };
}
