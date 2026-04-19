// lib/structure/spatial-cluster.ts
/**
 * 空间聚类模块 - 基于 bbox 坐标的题目分割
 *
 * 核心思想：
 * 1. 不依赖题号格式，而是基于 Y 坐标的跳跃检测题目边界
 * 2. 使用动态阈值（中位数的倍数）自适应不同试卷
 * 3. 支持单列和双列布局
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('SpatialCluster');

export type BBox = [number, number, number, number]; // [x1, y1, x2, y2]

export interface OCRBlock {
  text: string;
  bbox: BBox;
  type: 'print' | 'handwriting';
  confidence?: number;
}

/**
 * 空间聚类结果
 */
export interface SpatialCluster {
  /** 聚类包含的文本块 */
  blocks: OCRBlock[];
  /** 聚类的边界框 */
  bbox: BBox;
  /** 聚类的起始 Y 坐标 */
  startY: number;
  /** 聚类的结束 Y 坐标 */
  endY: number;
  /** 聚类的起始 X 坐标 */
  startX: number;
  /** 聚类的结束 X 坐标 */
  endX: number;
  /** 是否检测到题号 */
  hasQuestionNumber: boolean;
  /** 是否包含选项 */
  hasOptions: boolean;
  /** 检测到的题目类型 */
  detectedType: 'choice' | 'fill_blank' | 'essay' | 'unknown';
}

/**
 * 布局类型
 */
export interface LayoutInfo {
  type: 'single_column' | 'double_column' | 'unknown';
  /** 列的 X 坐标中心点 */
  columnCenters: number[];
  /** 列宽度 */
  columnWidth: number;
}

/**
 * 聚类选项
 */
export interface ClusterOptions {
  /** Y 坐标跳跃阈值倍数（默认 1.5） */
  yGapThresholdMultiplier?: number;
  /** 最小聚类高度（默认 50px） */
  minClusterHeight?: number;
  /** 合并小聚类的最大距离（默认 100px） */
  mergeDistance?: number;
  /** 调试模式 */
  debug?: boolean;
}

/**
 * 基于 Y 坐标跳跃检测进行聚类
 *
 * 算法：
 * 1. 按 Y 坐标排序所有块
 * 2. 计算相邻块的 Y 坐标差值
 * 3. 使用动态阈值检测跳跃点
 * 4. 在跳跃点处分割聚类
 */
export function clusterBlocksByY(
  blocks: OCRBlock[],
  options: ClusterOptions = {}
): SpatialCluster[] {
  const {
    yGapThresholdMultiplier = 1.5,
    minClusterHeight = 50,
    debug = false
  } = options;

  if (blocks.length === 0) {
    return [];
  }

  // 按 Y 坐标排序
  const sorted = [...blocks].sort((a, b) => a.bbox[1] - b.bbox[1]);

  // 计算相邻块的 Y 坐标差值
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prevBottom = sorted[i - 1].bbox[3];
    const currTop = sorted[i].bbox[1];
    gaps.push(Math.max(0, currTop - prevBottom));
  }

  // 计算动态阈值（中位数的倍数）
  const validGaps = gaps.filter(g => g > 0);
  const medianGap = validGaps.length > 0
    ? validGaps.sort((a, b) => a - b)[Math.floor(validGaps.length / 2)]
    : 30; // 默认值

  const threshold = medianGap * yGapThresholdMultiplier;

  if (debug) {
    log.info('Y 坐标跳跃检测', {
      totalBlocks: sorted.length,
      medianGap,
      threshold,
      gapStats: {
        min: Math.min(...gaps),
        max: Math.max(...gaps),
        avg: gaps.reduce((a, b) => a + b, 0) / gaps.length
      }
    });
  }

  // 在跳跃点处分割
  const clusters: SpatialCluster[] = [];
  let currentCluster: OCRBlock[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prevBottom = sorted[i - 1].bbox[3];
    const currTop = sorted[i].bbox[1];
    const gap = currTop - prevBottom;

    // 如果间隙大于阈值，开始新聚类
    if (gap > threshold) {
      // 保存当前聚类
      if (currentCluster.length > 0) {
        clusters.push(createClusterFromBlocks(currentCluster));
      }
      currentCluster = [sorted[i]];
    } else {
      currentCluster.push(sorted[i]);
    }
  }

  // 保存最后一个聚类
  if (currentCluster.length > 0) {
    clusters.push(createClusterFromBlocks(currentCluster));
  }

  // 过滤太小的聚类
  const filtered = clusters.filter(c => {
    const height = c.endY - c.startY;
    return height >= minClusterHeight || c.blocks.length > 1;
  });

  // 合并相邻的小聚类
  const merged = mergeSmallClusters(filtered, {
    maxDistance: options.mergeDistance || 100,
    minClusterHeight
  });

  if (debug) {
    log.info('聚类完成', {
      originalCount: blocks.length,
      clusterCount: merged.length,
      avgClusterSize: merged.length > 0
        ? blocks.length / merged.length
        : 0
    });
  }

  return merged;
}

/**
 * 检测页面布局（单列/双列）
 */
export function detectColumnLayout(blocks: OCRBlock[]): LayoutInfo {
  if (blocks.length === 0) {
    return { type: 'unknown', columnCenters: [], columnWidth: 0 };
  }

  // 收集所有块的 X 坐标中心点
  const xCenters = blocks.map(b => (b.bbox[0] + b.bbox[2]) / 2);

  // 使用简单的 K-means 聚类检测列
  // 先计算 X 坐标的范围
  const minX = Math.min(...blocks.map(b => b.bbox[0]));
  const maxX = Math.max(...blocks.map(b => b.bbox[2]));
  const pageWidth = maxX - minX;

  // 如果页面宽度大于某个阈值，可能是双列
  // 假设 A4 纸宽度约 800-1000px（取决于扫描分辨率）
  const isWidePage = pageWidth > 600;

  if (!isWidePage) {
    return {
      type: 'single_column',
      columnCenters: [(minX + maxX) / 2],
      columnWidth: pageWidth
    };
  }

  // 尝试将 X 坐标分成两组
  const sortedX = [...xCenters].sort((a, b) => a - b);
  const midPoint = sortedX[Math.floor(sortedX.length / 2)];

  // 计算每组的标准差
  const leftGroup = sortedX.filter(x => x < midPoint);
  const rightGroup = sortedX.filter(x => x >= midPoint);

  // 如果两组都足够大且分离明显，则是双列
  const leftCenter = leftGroup.length > 0
    ? leftGroup.reduce((a, b) => a + b, 0) / leftGroup.length
    : 0;
  const rightCenter = rightGroup.length > 0
    ? rightGroup.reduce((a, b) => a + b, 0) / rightGroup.length
    : 0;

  const groupSeparation = Math.abs(rightCenter - leftCenter);
  const avgColumnWidth = pageWidth / 2;

  // 如果两组中心距离大于列宽度的 60%，认为是双列
  const isDoubleColumn = groupSeparation > avgColumnWidth * 0.6 &&
    leftGroup.length > blocks.length * 0.2 &&
    rightGroup.length > blocks.length * 0.2;

  if (isDoubleColumn) {
    return {
      type: 'double_column',
      columnCenters: [leftCenter, rightCenter],
      columnWidth: avgColumnWidth
    };
  }

  return {
    type: 'single_column',
    columnCenters: [(minX + maxX) / 2],
    columnWidth: pageWidth
  };
}

/**
 * 合并相邻的小聚类
 */
function mergeSmallClusters(
  clusters: SpatialCluster[],
  options: { maxDistance: number; minClusterHeight: number }
): SpatialCluster[] {
  const { maxDistance, minClusterHeight } = options;

  if (clusters.length <= 1) {
    return clusters;
  }

  const merged: SpatialCluster[] = [];
  let current = clusters[0];

  for (let i = 1; i < clusters.length; i++) {
    const next = clusters[i];
    const distance = next.startY - current.endY;
    const currentHeight = current.endY - current.startY;
    const nextHeight = next.endY - next.startY;

    // 如果当前聚类很小，且与下一个聚类距离很近，合并它们
    if ((currentHeight < minClusterHeight || nextHeight < minClusterHeight) &&
      distance < maxDistance) {
      // 合并聚类
      current = {
        ...current,
        blocks: [...current.blocks, ...next.blocks],
        bbox: [
          Math.min(current.bbox[0], next.bbox[0]),
          Math.min(current.bbox[1], next.bbox[1]),
          Math.max(current.bbox[2], next.bbox[2]),
          Math.max(current.bbox[3], next.bbox[3])
        ],
        endY: Math.max(current.endY, next.endY),
        endX: Math.max(current.endX, next.endX)
      };
    } else {
      merged.push(current);
      current = next;
    }
  }

  merged.push(current);
  return merged;
}

/**
 * 从文本块创建聚类
 */
function createClusterFromBlocks(blocks: OCRBlock[]): SpatialCluster {
  if (blocks.length === 0) {
    throw new Error('Cannot create cluster from empty blocks');
  }

  // 计算 bbox
  const x1 = Math.min(...blocks.map(b => b.bbox[0]));
  const y1 = Math.min(...blocks.map(b => b.bbox[1]));
  const x2 = Math.max(...blocks.map(b => b.bbox[2]));
  const y2 = Math.max(...blocks.map(b => b.bbox[3]));

  // 检测特征
  const text = blocks.map(b => b.text).join('\n');
  const hasOptions = /^[A-D][.．、)\]]/m.test(text);

  return {
    blocks,
    bbox: [x1, y1, x2, y2],
    startY: y1,
    endY: y2,
    startX: x1,
    endX: x2,
    hasQuestionNumber: hasQuestionNumberPattern(text),
    hasOptions,
    detectedType: 'unknown' // 将由 content-analyzer 确定
  };
}

/**
 * 检测是否包含题号模式
 */
function hasQuestionNumberPattern(text: string): boolean {
  // 检查是否以数字开头（宽松匹配）
  const lines = text.trim().split('\n');
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    return /^(\d+)/.test(firstLine);
  }
  return false;
}
