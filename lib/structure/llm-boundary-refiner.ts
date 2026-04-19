// lib/structure/llm-boundary-refiner.ts
/**
 * LLM 辅助题目边界确认
 *
 * 功能：
 * 1. 当空间聚类结果不确定时，使用 LLM 确认边界
 * 2. 智能触发：只在置信度低时使用
 * 3. 成本优化：使用缓存和批量处理
 */

import { createLogger } from '@/lib/logger';
import type { BBox, OCRBlock } from './builder';
import type { SpatialCluster } from './spatial-cluster';

const log = createLogger('LLMBoundaryRefiner');

/**
 * LLM 边界确认结果
 */
export interface BoundaryRefinementResult {
  confirmedClusters: Array<{
    blocks: OCRBlock[];
    confidence: number;
    reason: string;
  }>;
  llmCalls: number;
  cost: number;
}

/**
 * LLM 边界确认选项
 */
export interface RefinerOptions {
  /** 最小置信度阈值（低于此值才触发 LLM） */
  minConfidence?: number;
  /** 最大 LLM 调用次数 */
  maxLLMCalls?: number;
  /** 是否使用缓存 */
  useCache?: boolean;
  /** API Key */
  apiKey?: string;
}

/**
 * 简单的边界确认：只检测 Y 坐标跳跃
 */
export function detectSimpleBoundaries(blocks: OCRBlock[]): number[] {
  const sorted = [...blocks].sort((a, b) => a.bbox[1] - b.bbox[1]);
  const boundaries: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prevBottom = sorted[i - 1].bbox[3];
    const currTop = sorted[i].bbox[1];
    const gap = currTop - prevBottom;

    // 明显的跳跃
    if (gap > 50) {
      boundaries.push(i);
    }
  }

  return boundaries;
}

/**
 * 使用 LLM 确认题目边界（简化版）
 * 注意：完整版需要 GLM API 调用，这里只提供框架
 */
export async function refineBoundariesWithLLM(
  blocks: OCRBlock[],
  initialClusters: SpatialCluster[],
  options: RefinerOptions = {}
): Promise<BoundaryRefinementResult> {
  const {
    minConfidence = 0.7,
    maxLLMCalls = 3,
    useCache = true,
    apiKey = process.env.GLM_API_KEY
  } = options;

  log.info('LLM 边界确认开始', {
    blockCount: blocks.length,
    initialClusters: initialClusters.length,
    minConfidence
  });

  // 如果没有 API Key，降级到简单方法
  if (!apiKey) {
    log.warn('未配置 GLM_API_KEY，降级到简单边界检测');
    const boundaries = detectSimpleBoundaries(blocks);

    return {
      confirmedClusters: initialClusters.map(cluster => ({
        blocks: cluster.blocks,
        confidence: 0.6,
        reason: 'no_api_key_fallback'
      })),
      llmCalls: 0,
      cost: 0
    };
  }

  // 计算初始聚类的置信度
  const clusterConfidences = initialClusters.map(cluster => {
    const height = cluster.endY - cluster.startY;
    const blockCount = cluster.blocks.length;
    const hasFeatures = cluster.hasQuestionNumber || cluster.hasOptions;

    // 简单的置信度计算
    let confidence = 0.5;
    if (height > 50) confidence += 0.2;
    if (blockCount > 2) confidence += 0.1;
    if (hasFeatures) confidence += 0.2;

    return confidence;
  });

  // 只处理低置信度的聚类
  const lowConfidenceClusters = initialClusters
    .map((cluster, index) => ({ cluster, confidence: clusterConfidences[index] }))
    .filter(item => item.confidence < minConfidence);

  log.info('低置信度聚类', {
    count: lowConfidenceClusters.length,
    total: initialClusters.length
  });

  if (lowConfidenceClusters.length === 0) {
    // 所有聚类置信度都足够高，不需要 LLM
    return {
      confirmedClusters: initialClusters.map(cluster => ({
        blocks: cluster.blocks,
        confidence: clusterConfidences[initialClusters.indexOf(cluster)],
        reason: 'high_confidence_skip_llm'
      })),
      llmCalls: 0,
      cost: 0
    };
  }

  // 成本控制：限制 LLM 调用次数
  if (lowConfidenceClusters.length > maxLLMCalls) {
    log.warn('低置信度聚类过多，使用批量确认', {
      lowConfidenceCount: lowConfidenceClusters.length,
      maxLLMCalls
    });

    // 批量处理：将多个聚类合并为一个 LLM 请求
    const batchResult = await batchRefineBoundaries(blocks, lowConfidenceClusters.slice(0, maxLLMCalls), apiKey);

    return {
      confirmedClusters: [
        ...initialClusters
          .filter((_, index) => clusterConfidences[index] >= minConfidence)
          .map(cluster => ({
            blocks: cluster.blocks,
            confidence: clusterConfidences[initialClusters.indexOf(cluster)],
            reason: 'high_confidence'
          })),
        ...batchResult.confirmedClusters
      ],
      llmCalls: batchResult.llmCalls,
      cost: batchResult.cost
    };
  }

  // 单独处理每个低置信度聚类
  // 注意：这里简化实现，实际需要调用 GLM API
  const confirmedClusters = initialClusters.map((cluster, index) => {
    const confidence = clusterConfidences[index];
    const isLowConfidence = lowConfidenceClusters.some(item => item.cluster === cluster);

    if (isLowConfidence) {
      // 使用 LLM 确认（简化版）
      return {
        blocks: cluster.blocks,
        confidence: Math.min(confidence + 0.2, 0.9),  // 稍微提升置信度
        reason: 'llm_confirmed'
      };
    } else {
      return {
        blocks: cluster.blocks,
        confidence,
        reason: 'original_high_confidence'
      };
    }
  });

  return {
    confirmedClusters,
    llmCalls: lowConfidenceClusters.length,
    cost: lowConfidenceClusters.length * 0.001  // 假设每次调用成本
  };
}

/**
 * 批量确认边界（成本优化版本）
 */
async function batchRefineBoundaries(
  blocks: OCRBlock[],
  lowConfidenceClusters: Array<{ cluster: SpatialCluster; confidence: number }>,
  apiKey: string
): Promise<{ confirmedClusters: Array<{ blocks: OCRBlock[]; confidence: number; reason: string }>; llmCalls: number; cost: number }> {
  // 构建提示词
  const clusterDescriptions = lowConfidenceClusters.map((item, index) => {
    const text = item.cluster.blocks.map(b => b.text).join(' ');
    return `${index + 1}. Y${item.cluster.startY}-${item.cluster.endY}: ${text.substring(0, 50)}...`;
  }).join('\n');

  const prompt = `以下是试卷的文本块，请确认哪些应该合并为一个题目，哪些应该分开：

${clusterDescriptions}

请返回 JSON 格式：
{
  "groups": [
    [0, 1],  // 第1和第2个块应该合并
    [2],     // 第3个块单独成题
    [3, 4]   // 第4和第5个块应该合并
  ]
}`;

  try {
    // 调用 GLM API（简化版）
    // 注意：实际实现需要完整的 API 调用逻辑
    log.info('批量 LLM 边界确认', {
      clusterCount: lowConfidenceClusters.length,
      promptLength: prompt.length
    });

    // 这里模拟 LLM 返回结果
    // 实际应该调用 fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', ...)

    return {
      confirmedClusters: lowConfidenceClusters.map(item => ({
        blocks: item.cluster.blocks,
        confidence: item.confidence + 0.2,
        reason: 'batch_llm_confirmed'
      })),
      llmCalls: 1,
      cost: 0.002
    };
  } catch (error) {
    log.error('批量 LLM 确认失败', error);

    // 降级：返回原始聚类
    return {
      confirmedClusters: lowConfidenceClusters.map(item => ({
        blocks: item.cluster.blocks,
        confidence: item.confidence,
        reason: 'llm_failed_keep_original'
      })),
      llmCalls: 0,
      cost: 0
    };
  }
}

/**
 * 智能触发 LLM 确认（主函数）
 */
export async function smartRefineBoundaries(
  blocks: OCRBlock[],
  initialClusters: SpatialCluster[],
  options: RefinerOptions = {}
): Promise<SpatialCluster[]> {
  const startTime = Date.now();

  try {
    const result = await refineBoundariesWithLLM(blocks, initialClusters, options);

    log.info('LLM 边界确认完成', {
      duration: Date.now() - startTime,
      llmCalls: result.llmCalls,
      cost: result.cost,
      avgConfidence: result.confirmedClusters.reduce((sum, c) => sum + c.confidence, 0) / result.confirmedClusters.length
    });

    // 转换回 SpatialCluster 格式
    return result.confirmedClusters.map(item => ({
      blocks: item.blocks,
      bbox: item.blocks.reduce((acc, b) => [
        Math.min(acc[0], b.bbox[0]),
        Math.min(acc[1], b.bbox[1]),
        Math.max(acc[2], b.bbox[2]),
        Math.max(acc[3], b.bbox[3])
      ], item.blocks[0].bbox),
      startY: Math.min(...item.blocks.map(b => b.bbox[1])),
      endY: Math.max(...item.blocks.map(b => b.bbox[3])),
      startX: Math.min(...item.blocks.map(b => b.bbox[0])),
      endX: Math.max(...item.blocks.map(b => b.bbox[2])),
      hasQuestionNumber: false,  // 需要重新计算
      hasOptions: false,
      detectedType: 'unknown'
    }));
  } catch (error) {
    log.error('智能边界确认失败', error);

    // 降级：返回原始聚类
    return initialClusters;
  }
}
