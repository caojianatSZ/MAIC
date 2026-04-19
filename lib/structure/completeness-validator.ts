// lib/structure/completeness-validator.ts
/**
 * 题目完整性校验器
 *
 * 功能：
 * 1. 验证题目完整性（题干、选项、答案区域）
 * 2. 检测可能的误分割
 * 3. 提供合并建议
 */

import { createLogger } from '@/lib/logger';
import type { SpatialCluster } from './spatial-cluster';
import type { ContentFeatures } from './content-analyzer';

const log = createLogger('CompletenessValidator');

/**
 * 题目完整性验证结果
 */
export interface CompletenessResult {
  isComplete: boolean;
  missingParts: string[];
  confidence: number;
  suggestions: string[];
}

/**
 * 验证选项配置
 */
export interface ValidationOptions {
  /** 最小题干长度 */
  minQuestionLength?: number;
  /** 最大题干长度 */
  maxQuestionLength?: number;
  /** 是否必须包含选项（对于选择题） */
  requireOptions?: boolean;
  /** 是否必须包含答案区域 */
  requireAnswerArea?: boolean;
}

/**
 * 验证聚类（题目）的完整性
 */
export function validateClusterCompleteness(
  cluster: SpatialCluster,
  features: ContentFeatures,
  options: ValidationOptions = {}
): CompletenessResult {
  const {
    minQuestionLength = 20,
    maxQuestionLength = 2000,
    requireOptions = false,
    requireAnswerArea = false
  } = options;

  const missingParts: string[] = [];
  const suggestions: string[] = [];
  let confidence = 1.0;

  // 1. 检查文本长度
  const text = cluster.blocks.map(b => b.text).join('');
  const textLength = text.length;

  if (textLength < minQuestionLength) {
    missingParts.push('text_too_short');
    confidence -= 0.3;
    suggestions.push(`文本过短（${textLength}字符），可能是碎片`);
  } else if (textLength > maxQuestionLength) {
    missingParts.push('text_too_long');
    confidence -= 0.2;
    suggestions.push(`文本过长（${textLength}字符），可能包含多个题目`);
  }

  // 2. 检查是否有题目编号
  if (!features.hasQuestionNumber) {
    missingParts.push('no_question_number');
    confidence -= 0.1;
  }

  // 3. 检查选项（对于选择题）
  if (features.questionType === 'choice') {
    if (!features.hasOptionMarkers) {
      missingParts.push('no_options');
      confidence -= 0.4;
      suggestions.push('选择题缺少选项标记（A/B/C/D）');
    }
  }

  // 4. 检查答案区域
  if (requireAnswerArea && !features.hasBlankMarkers) {
    missingParts.push('no_answer_area');
    confidence -= 0.1;
  }

  // 5. 检查高度（是否过小）
  const clusterHeight = cluster.endY - cluster.startY;
  if (clusterHeight < 30) {
    missingParts.push('height_too_small');
    confidence -= 0.3;
    suggestions.push(`聚类高度过小（${clusterHeight}px），可能不是完整题目`);
  }

  // 6. 特殊检查：如果只有年份题号，可能不完整
  if (/^\(\d{4}/.test(text) && textLength < 100) {
    missingParts.push('only_year_prefix');
    confidence -= 0.2;
    suggestions.push('只有年份题号，可能内容被截断');
  }

  // 7. 检查是否以选项字母开头（可能是误分割）
  if (/^[A-D][.．、)\]]/.test(text.trim())) {
    missingParts.push('starts_with_option');
    confidence -= 0.5;
    suggestions.push('以选项开头，可能是上一题的选项被错误分割');
  }

  const isComplete = missingParts.length === 0 && confidence >= 0.7;

  return {
    isComplete,
    missingParts,
    confidence: Math.max(0, confidence),
    suggestions
  };
}

/**
 * 检测相邻聚类是否应该合并
 */
export function detectShouldMerge(
  cluster1: SpatialCluster,
  cluster2: SpatialCluster,
  features1: ContentFeatures,
  features2: ContentFeatures
): { shouldMerge: boolean; reason: string } {
  // 1. 高度都很小
  const height1 = cluster1.endY - cluster1.startY;
  const height2 = cluster2.endY - cluster2.startY;

  if (height1 < 30 && height2 < 30) {
    return {
      shouldMerge: true,
      reason: 'both_clusters_too_small'
    };
  }

  // 2. 第一个聚类只有选项，第二个聚类是题干延续
  if (features1.hasOptionMarkers && !features1.hasQuestionNumber &&
      !features2.hasOptionMarkers && features2.questionType === 'choice') {
    return {
      shouldMerge: true,
      reason: 'options_separated_from_question'
    };
  }

  // 3. Y坐标距离很小（<20px）
  const gap = cluster2.startY - cluster1.endY;
  if (gap < 20 && gap >= 0) {
    return {
      shouldMerge: true,
      reason: 'very_small_gap'
    };
  }

  // 4. 第一个聚类以年份开头但很短
  const text1 = cluster1.blocks.map(b => b.text).join('');
  if (/^\(\d{4}/.test(text1) && text1.length < 50 && text1.length > 0) {
    return {
      shouldMerge: true,
      reason: 'year_prefix_too_short'
    };
  }

  return {
    shouldMerge: false,
    reason: 'no_merge_needed'
  };
}

/**
 * 合并不完整的聚类
 */
export function mergeIncompleteClusters(
  clusters: Array<SpatialCluster & { features: ContentFeatures }>
): Array<SpatialCluster & { features: ContentFeatures }> {
  const merged: Array<SpatialCluster & { features: ContentFeatures }> = [];
  let currentCluster = clusters[0];

  for (let i = 1; i < clusters.length; i++) {
    const nextCluster = clusters[i];

    const { shouldMerge, reason } = detectShouldMerge(
      currentCluster,
      nextCluster,
      currentCluster.features,
      nextCluster.features
    );

    if (shouldMerge) {
      // 合并聚类
      log.info('合并聚类', { reason });

      currentCluster = {
        ...currentCluster,
        blocks: [...currentCluster.blocks, ...nextCluster.blocks],
        bbox: [
          Math.min(currentCluster.bbox[0], nextCluster.bbox[0]),
          Math.min(currentCluster.bbox[1], nextCluster.bbox[1]),
          Math.max(currentCluster.bbox[2], nextCluster.bbox[2]),
          Math.max(currentCluster.bbox[3], nextCluster.bbox[3])
        ],
        endY: Math.max(currentCluster.endY, nextCluster.endY),
        endX: Math.max(currentCluster.endX, nextCluster.endX),
        features: currentCluster.features  // 保留特征
      };
    } else {
      // 不合并，保存当前聚类
      merged.push(currentCluster);
      currentCluster = nextCluster;
    }
  }

  // 保存最后一个聚类
  if (currentCluster) {
    merged.push(currentCluster);
  }

  return merged;
}

/**
 * 完整性验证流程（主函数）
 */
export function validateAndFixClusters(
  clusters: Array<SpatialCluster & { features: ContentFeatures }>
): {
  validClusters: SpatialCluster[];
  validationResults: CompletenessResult[];
} {
  const validationResults: CompletenessResult[] = [];
  const validClusters: SpatialCluster[] = [];

  // 1. 验证每个聚类
  for (const cluster of clusters) {
    const result = validateClusterCompleteness(
      cluster,
      cluster.features,
      {
        minQuestionLength: 20,
        maxQuestionLength: 1500,
        requireOptions: cluster.features.questionType === 'choice',
        requireAnswerArea: false
      }
    );

    validationResults.push(result);

    if (result.isComplete) {
      validClusters.push(cluster);
    } else if (result.confidence < 0.3) {
      // 置信度很低，可能需要合并
      log.warn('聚类置信度过低', {
        confidence: result.confidence,
        missingParts: result.missingParts,
        suggestions: result.suggestions
      });
    }
  }

  // 2. 如果有大量不完整的聚类，尝试合并
  if (validationResults.filter(r => !r.isComplete).length > clusters.length * 0.3) {
    log.info('大量聚类不完整，尝试合并', {
      incompleteCount: validationResults.filter(r => !r.isComplete).length,
      totalCount: clusters.length
    });

    const mergedClusters = mergeIncompleteClusters(clusters);

    // 重新验证合并后的聚类
    const finalClusters: SpatialCluster[] = [];
    const finalResults: CompletenessResult[] = [];

    for (const cluster of mergedClusters) {
      // 重新计算特征
      // 注意：这里简化处理，实际应该重新调用 analyzeContentFeatures
      const result = validateClusterCompleteness(
        cluster,
        cluster.features,
        {
          minQuestionLength: 20,
          maxQuestionLength: 1500
        }
      );

      finalResults.push(result);
      if (result.isComplete || result.confidence >= 0.5) {
        finalClusters.push(cluster);
      }
    }

    return {
      validClusters: finalClusters,
      validationResults: finalResults
    };
  }

  return {
    validClusters,
    validationResults
  };
}
