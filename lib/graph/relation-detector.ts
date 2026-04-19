// lib/graph/relation-detector.ts
/**
 * 关系检测算法 - 检测节点间的空间关系
 *
 * 核心功能：
 * 1. 检测两个节点之间的空间关系（上下、左右、包含等）
 * 2. 计算关系权重和置信度
 * 3. 支持单列/双列布局的关系检测
 */

import { createLogger } from '@/lib/logger';
import type { BBox } from '../structure/spatial-cluster';
import type { EdgeRelation, GraphNode } from './types';

// 使用简化的 LayoutInfo 接口
interface LayoutInfo {
  columnCenters: number[];
  columnWidth: number;
  pageWidth: number;
  pageHeight: number;
  avgLineHeight: number;
  avgFontSize: number;
}

const log = createLogger('RelationDetector');

/**
 * 关系检测结果
 */
export interface RelationDetection {
  /** 关系类型 */
  relation: EdgeRelation | null;
  /** 权重（0-1） */
  weight: number;
  /** 置信度（0-1） */
  confidence: number;
  /** 距离（像素） */
  distance: number;
}

/**
 * 检测两个节点之间的关系
 */
export function detectRelations(
  nodeA: GraphNode,
  nodeB: GraphNode,
  layoutInfo: LayoutInfo
): RelationDetection {
  // 检测包含关系
  const containsRelation = detectContains(nodeA, nodeB);
  if (containsRelation) {
    return containsRelation;
  }

  // 检测重叠关系
  const overlapsRelation = detectOverlaps(nodeA, nodeB);
  if (overlapsRelation) {
    return overlapsRelation;
  }

  // 检测同行关系
  const sameLineRelation = detectSameLine(nodeA, nodeB, layoutInfo);
  if (sameLineRelation) {
    return sameLineRelation;
  }

  // 检测同列关系
  const sameColRelation = detectSameColumn(nodeA, nodeB, layoutInfo);
  if (sameColRelation) {
    return sameColRelation;
  }

  // 检测上下左右关系
  const spatialRelation = detectSpatialRelation(nodeA, nodeB, layoutInfo);
  return spatialRelation;
}

/**
 * 检测包含关系
 */
function detectContains(nodeA: GraphNode, nodeB: GraphNode): RelationDetection | null {
  const [aX1, aY1, aX2, aY2] = nodeA.bbox;
  const [bX1, bY1, bX2, bY2] = nodeB.bbox;

  // 检查 nodeA 是否包含 nodeB
  const aContainsB = aX1 <= bX1 && aY1 <= bY1 && aX2 >= bX2 && aY2 >= bY2;
  // 检查 nodeB 是否包含 nodeA
  const bContainsA = bX1 <= aX1 && bY1 <= aY1 && bX2 >= aX2 && bY2 >= aY2;

  if (aContainsB) {
    return {
      relation: 'contains',
      weight: 0.9,
      confidence: 0.95,
      distance: 0
    };
  }

  if (bContainsA) {
    return {
      relation: 'contains',
      weight: 0.9,
      confidence: 0.95,
      distance: 0
    };
  }

  return null;
}

/**
 * 检测重叠关系
 */
function detectOverlaps(nodeA: GraphNode, nodeB: GraphNode): RelationDetection | null {
  const [aX1, aY1, aX2, aY2] = nodeA.bbox;
  const [bX1, bY1, bX2, bY2] = nodeB.bbox;

  // 计算重叠区域
  const overlapX = Math.max(0, Math.min(aX2, bX2) - Math.max(aX1, bX1));
  const overlapY = Math.max(0, Math.min(aY2, bY2) - Math.max(aY1, bY1));

  if (overlapX > 0 && overlapY > 0) {
    const overlapArea = overlapX * overlapY;
    const aArea = (aX2 - aX1) * (aY2 - aY1);
    const bArea = (bX2 - bX1) * (bY2 - bY1);
    const overlapRatio = overlapArea / Math.min(aArea, bArea);

    // 重叠超过 10% 才认为有意义
    if (overlapRatio > 0.1) {
      return {
        relation: 'overlaps',
        weight: Math.min(0.8, overlapRatio),
        confidence: 0.8,
        distance: 0
      };
    }
  }

  return null;
}

/**
 * 检测同行关系
 */
function detectSameLine(
  nodeA: GraphNode,
  nodeB: GraphNode,
  layoutInfo: LayoutInfo
): RelationDetection | null {
  const [, aY1, , aY2] = nodeA.bbox;
  const [, bY1, , bY2] = nodeB.bbox;

  // 计算垂直中心点
  const aCenterY = (aY1 + aY2) / 2;
  const bCenterY = (bY1 + bY2) / 2;

  // 垂直距离小于平均行高的一半，认为是同一行
  const verticalDistance = Math.abs(aCenterY - bCenterY);
  const lineHeightThreshold = layoutInfo.avgLineHeight * 0.6;

  if (verticalDistance < lineHeightThreshold) {
    return {
      relation: 'same_line',
      weight: 0.85,
      confidence: 0.9,
      distance: verticalDistance
    };
  }

  return null;
}

/**
 * 检测同列关系
 */
function detectSameColumn(
  nodeA: GraphNode,
  nodeB: GraphNode,
  layoutInfo: LayoutInfo
): RelationDetection | null {
  const [aX1, , aX2] = nodeA.bbox;
  const [bX1, , bX2] = nodeB.bbox;

  // 计算水平中心点
  const aCenterX = (aX1 + aX2) / 2;
  const bCenterX = (bX1 + bX2) / 2;

  // 检查是否在同一个列中心附近
  for (const colCenter of layoutInfo.columnCenters) {
    const aInColumn = Math.abs(aCenterX - colCenter) < layoutInfo.columnWidth * 0.4;
    const bInColumn = Math.abs(bCenterX - colCenter) < layoutInfo.columnWidth * 0.4;

    if (aInColumn && bInColumn) {
      return {
        relation: 'same_column',
        weight: 0.8,
        confidence: 0.85,
        distance: Math.abs(aCenterX - bCenterX)
      };
    }
  }

  return null;
}

/**
 * 检测空间关系（上下左右）
 */
function detectSpatialRelation(
  nodeA: GraphNode,
  nodeB: GraphNode,
  layoutInfo: LayoutInfo
): RelationDetection {
  const [aX1, aY1, aX2, aY2] = nodeA.bbox;
  const [bX1, bY1, bX2, bY2] = nodeB.bbox;

  // 计算中心点
  const aCenter = [(aX1 + aX2) / 2, (aY1 + aY2) / 2] as [number, number];
  const bCenter = [(bX1 + bX2) / 2, (bY1 + bY2) / 2] as [number, number];

  // 计算水平和垂直距离
  const dx = bCenter[0] - aCenter[0];
  const dy = bCenter[1] - aCenter[1];

  // 判断主要方向
  const horizontalDist = Math.abs(dx);
  const verticalDist = Math.abs(dy);

  // Y 方向距离大于 X 方向，认为是上下关系
  if (dy < 0 && verticalDist > horizontalDist) {
    // nodeB 在 nodeA 上方
    return {
      relation: 'above',
      weight: computeWeight(verticalDist, layoutInfo.avgLineHeight),
      confidence: 0.8,
      distance: verticalDist
    };
  }

  if (dy > 0 && verticalDist > horizontalDist) {
    // nodeB 在 nodeA 下方
    return {
      relation: 'below',
      weight: computeWeight(verticalDist, layoutInfo.avgLineHeight),
      confidence: 0.8,
      distance: verticalDist
    };
  }

  // X 方向距离大于 Y 方向，认为是左右关系
  if (dx < 0 && horizontalDist > verticalDist) {
    // nodeB 在 nodeA 左侧
    return {
      relation: 'left',
      weight: computeWeight(horizontalDist, layoutInfo.columnWidth),
      confidence: 0.7,
      distance: horizontalDist
    };
  }

  if (dx > 0 && horizontalDist > verticalDist) {
    // nodeB 在 nodeA 右侧
    return {
      relation: 'right',
      weight: computeWeight(horizontalDist, layoutInfo.columnWidth),
      confidence: 0.7,
      distance: horizontalDist
    };
  }

  // 对角线位置，使用综合权重
  return {
    relation: 'adjacent',
    weight: 0.5,
    confidence: 0.5,
    distance: Math.sqrt(dx * dx + dy * dy)
  };
}

/**
 * 计算权重（距离越近权重越高）
 */
function computeWeight(distance: number, scale: number): number {
  // 使用高斯函数：exp(-distance^2 / (2 * scale^2))
  const sigma = scale * 0.5;
  return Math.exp(-(distance * distance) / (2 * sigma * sigma));
}

/**
 * 批量检测关系
 */
export function detectAllRelations(
  nodes: GraphNode[],
  layoutInfo: LayoutInfo
): Array<{ from: string; to: string; relation: EdgeRelation; weight: number; confidence: number; distance: number }> {
  const relations: Array<{
    from: string;
    to: string;
    relation: EdgeRelation;
    weight: number;
    confidence: number;
    distance: number;
  }> = [];

  // O(n^2) 检测所有节点对
  for (let i = 0; i < nodes.length; i++) {
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;

      const nodeA = nodes[i];
      const nodeB = nodes[j];
      const detection = detectRelations(nodeA, nodeB, layoutInfo);

      if (detection.relation && detection.weight > 0.3) {
        relations.push({
          from: nodeA.id,
          to: nodeB.id,
          relation: detection.relation,
          weight: detection.weight,
          confidence: detection.confidence,
          distance: detection.distance
        });
      }
    }
  }

  return relations;
}

/**
 * 计算两个 bbox 之间的中心距离
 */
export function computeCenterDistance(bbox1: BBox, bbox2: BBox): number {
  const center1 = [(bbox1[0] + bbox1[2]) / 2, (bbox1[1] + bbox1[3]) / 2] as [number, number];
  const center2 = [(bbox2[0] + bbox2[2]) / 2, (bbox2[1] + bbox2[3]) / 2] as [number, number];

  const dx = center2[0] - center1[0];
  const dy = center2[1] - center1[1];

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 检测是否跨列匹配（异常情况）
 */
export function detectCrossColumnMatch(
  questionNode: GraphNode,
  answerNode: GraphNode,
  layoutInfo: LayoutInfo
): boolean {
  const qCenterX = (questionNode.bbox[0] + questionNode.bbox[2]) / 2;
  const aCenterX = (answerNode.bbox[0] + answerNode.bbox[2]) / 2;

  // 检查是否在不同的列
  for (let i = 0; i < layoutInfo.columnCenters.length; i++) {
    const colCenter = layoutInfo.columnCenters[i];
    const qInColumn = Math.abs(qCenterX - colCenter) < layoutInfo.columnWidth * 0.4;
    const aInColumn = Math.abs(aCenterX - colCenter) < layoutInfo.columnWidth * 0.4;

    if (qInColumn && !aInColumn || !qInColumn && aInColumn) {
      // 找到下一列
      if (i + 1 < layoutInfo.columnCenters.length) {
        const nextColCenter = layoutInfo.columnCenters[i + 1];
        const qInNext = Math.abs(qCenterX - nextColCenter) < layoutInfo.columnWidth * 0.4;
        const aInNext = Math.abs(aCenterX - nextColCenter) < layoutInfo.columnWidth * 0.4;
        if ((qInColumn && aInNext) || (qInNext && aInColumn)) {
          return true; // 合理的跨列
        }
      }
      return false; // 不合理的跨列
    }
  }

  return false;
}
