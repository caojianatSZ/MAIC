// lib/graph/layout-graph.ts
/**
 * Layout Graph - 核心图结构
 *
 * 核心功能：
 * 1. 从 OCR 块构建图结构
 * 2. 检测节点关系
 * 3. 提供图查询接口
 */

import { createLogger } from '@/lib/logger';
import type { BBox, OCRBlock } from '../structure/spatial-cluster';
import {
  detectColumnLayout
} from '../structure/spatial-cluster';
import type {
  GraphNode,
  GraphEdge,
  LayoutGraph,
  GraphBuildOptions,
  GraphMetadata,
  NodeType,
  NodeFeatures,
  EdgeRelation,
  QuestionAnswerPair,
  AnomalyDetection
} from './types';
import {
  detectRelations,
  detectAllRelations,
  computeCenterDistance,
  detectCrossColumnMatch
} from './relation-detector';

const log = createLogger('LayoutGraph');

// 扩展的布局信息（Graph 模块专用）
interface ExtendedLayoutInfo {
  type: 'single_column' | 'double_column' | 'unknown';
  columnCenters: number[];
  columnWidth: number;
  pageWidth: number;
  pageHeight: number;
  avgLineHeight: number;
  avgFontSize: number;
}

/**
 * 构建 Layout Graph
 */
export async function buildLayoutGraph(
  blocks: OCRBlock[],
  options: GraphBuildOptions = {}
): Promise<LayoutGraph> {
  const startTime = Date.now();
  const {
    detectHandwriting = true,
    filterNoise = true,
    minTextLength = 2,
    debug = false
  } = options;

  if (blocks.length === 0) {
    return createEmptyGraph();
  }

  // 步骤 1: 计算布局信息
  const layoutInfo = computeLayoutInfo(blocks);

  if (debug) {
    log.info('布局信息', layoutInfo);
  }

  // 步骤 2: 创建节点
  const nodes = createNodes(blocks, {
    detectHandwriting,
    filterNoise,
    minTextLength,
    layoutInfo
  });

  if (debug) {
    log.info('节点创建完成', { count: nodes.size });
  }

  // 步骤 3: 检测关系并创建边
  const nodeArray = Array.from(nodes.values());
  const edges = createEdges(nodeArray, layoutInfo);

  if (debug) {
    log.info('边创建完成', { count: edges.length });
  }

  // 步骤 4: 构建图索引
  indexGraph(nodes, edges);

  // 步骤 5: 计算元数据
  const metadata = computeMetadata(nodes, edges, startTime);

  return {
    nodes,
    edges,
    layoutInfo,
    metadata
  };
}

/**
 * 创建空图
 */
function createEmptyGraph(): LayoutGraph {
  return {
    nodes: new Map(),
    edges: [],
    layoutInfo: {
      type: 'unknown',
      columnCenters: [],
      columnWidth: 0,
      pageWidth: 0,
      pageHeight: 0,
      avgLineHeight: 30,
      avgFontSize: 14
    },
    metadata: {
      buildTime: 0,
      nodeCount: 0,
      edgeCount: 0,
      avgConfidence: 0,
      density: 0
    }
  };
}

/**
 * 计算布局信息
 */
function computeLayoutInfo(blocks: OCRBlock[]): ExtendedLayoutInfo {
  // 复用 spatial-cluster 的布局检测
  const spatialLayout = detectColumnLayout(blocks);

  // 计算页面尺寸
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const block of blocks) {
    const [x1, y1, x2, y2] = block.bbox;
    minX = Math.min(minX, x1);
    minY = Math.min(minY, y1);
    maxX = Math.max(maxX, x2);
    maxY = Math.max(maxY, y2);
  }

  const pageWidth = maxX - minX;
  const pageHeight = maxY - minY;

  // 计算平均行高
  const sortedByY = [...blocks].sort((a, b) => a.bbox[1] - b.bbox[1]);
  let totalLineHeight = 0;
  let lineCount = 0;

  for (let i = 1; i < sortedByY.length; i++) {
    const gap = sortedByY[i].bbox[1] - sortedByY[i - 1].bbox[3];
    if (gap > 0 && gap < 100) {
      totalLineHeight += gap;
      lineCount++;
    }
  }

  const avgLineHeight = lineCount > 0 ? totalLineHeight / lineCount : 30;

  // 估算平均字号
  const avgFontSize = avgLineHeight * 0.6;

  return {
    type: spatialLayout.type,
    columnCenters: spatialLayout.columnCenters,
    columnWidth: spatialLayout.columnWidth,
    pageWidth,
    pageHeight,
    avgLineHeight,
    avgFontSize
  };
}

/**
 * 创建节点
 */
function createNodes(
  blocks: OCRBlock[],
  options: {
    detectHandwriting: boolean;
    filterNoise: boolean;
    minTextLength: number;
    layoutInfo: ExtendedLayoutInfo;
  }
): Map<string, GraphNode> {
  const nodes = new Map<string, GraphNode>();
  let nodeId = 0;

  for (const block of blocks) {
    const text = block.text.trim();

    // 过滤噪声
    if (options.filterNoise && text.length < options.minTextLength) {
      continue;
    }

    // 检测节点类型
    const nodeType = detectNodeType(block, text);

    // 计算特征
    const features = computeFeatures(block, text, options.layoutInfo);

    // 创建节点
    const node: GraphNode = {
      id: `node_${nodeId++}`,
      block: {
        text: block.text,
        bbox: block.bbox,
        type: block.type,
        confidence: block.confidence
      },
      nodeType,
      bbox: block.bbox,
      features,
      outgoingEdges: [],
      incomingEdges: []
    };

    nodes.set(node.id, node);
  }

  return nodes;
}

/**
 * 检测节点类型
 */
function detectNodeType(block: OCRBlock, text: string): NodeType {
  // 手写内容
  if (block.type === 'handwriting') {
    return 'handwriting';
  }

  // 选项标记（A. B. C. D.）
  if (/^[A-D][.．、)\]]/.test(text.trim())) {
    return 'option';
  }

  // 题号
  if (/^(\d+)[\.\、\．\)\(\s]/.test(text.trim())) {
    return 'question';
  }

  // 标题（短文本且位置靠上）
  const [y1] = block.bbox;
  if (text.length < 50 && y1 < 200) {
    return 'title';
  }

  // 噪声（太短且无明显特征）
  if (text.length < 5) {
    return 'noise';
  }

  // 默认为题目
  return 'question';
}

/**
 * 计算节点特征
 */
function computeFeatures(
  block: OCRBlock,
  text: string,
  layoutInfo: ExtendedLayoutInfo
): NodeFeatures {
  const hasNumberPrefix = /^(\d+)/.test(text.trim());
  const optionMatch = text.trim().match(/^([A-D])[.．、)\]]/);
  const hasOptionMarker = !!optionMatch;

  // 估算行数
  const height = block.bbox[3] - block.bbox[1];
  const lineCount = Math.round(height / layoutInfo.avgLineHeight);

  // 估算字号
  const fontSize = layoutInfo.avgFontSize;

  return {
    hasNumberPrefix,
    hasOptionMarker,
    optionMarker: optionMatch ? optionMatch[1] : undefined,
    textLength: text.length,
    lineCount,
    isHandwriting: block.type === 'handwriting',
    fontSize,
    ocrConfidence: block.confidence
  };
}

/**
 * 创建边
 */
function createEdges(
  nodes: GraphNode[],
  layoutInfo: ExtendedLayoutInfo
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  let edgeId = 0;

  // 检测所有节点对的关系
  const relations = detectAllRelations(nodes, layoutInfo);

  for (const rel of relations) {
    // 只保留权重较高的边
    if (rel.weight > 0.3) {
      edges.push({
        id: `edge_${edgeId++}`,
        from: rel.from,
        to: rel.to,
        relation: rel.relation,
        weight: rel.weight,
        confidence: rel.confidence,
        distance: rel.distance
      });
    }
  }

  return edges;
}

/**
 * 索引图（建立节点与边的关系）
 */
function indexGraph(
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[]
): void {
  // 清空现有的边引用
  for (const node of nodes.values()) {
    node.outgoingEdges = [];
    node.incomingEdges = [];
  }

  // 建立边引用
  for (const edge of edges) {
    const fromNode = nodes.get(edge.from);
    const toNode = nodes.get(edge.to);

    if (fromNode && toNode) {
      fromNode.outgoingEdges.push(edge.id);
      toNode.incomingEdges.push(edge.id);
    }
  }
}

/**
 * 计算图元数据
 */
function computeMetadata(
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[],
  startTime: number
): GraphMetadata {
  const buildTime = Date.now() - startTime;
  const nodeCount = nodes.size;
  const edgeCount = edges.length;

  // 计算平均置信度
  let totalConfidence = 0;
  let confidenceCount = 0;

  for (const node of nodes.values()) {
    if (node.features.ocrConfidence !== undefined) {
      totalConfidence += node.features.ocrConfidence;
      confidenceCount++;
    }
  }

  const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0.8;

  // 计算图密度
  const density = nodeCount > 0 ? edgeCount / nodeCount : 0;

  return {
    buildTime,
    nodeCount,
    edgeCount,
    avgConfidence,
    density
  };
}

/**
 * 查找最相关的节点（用于答案匹配）
 */
export function findMostRelevantNode(
  graph: LayoutGraph,
  targetNode: GraphNode,
  nodeType: NodeType,
  options: {
    maxDistance?: number;
    minWeight?: number;
    allowedRelations?: EdgeRelation[];
  } = {}
): GraphNode | null {
  const {
    maxDistance = 500,
    minWeight = 0.3,
    allowedRelations = ['right', 'below', 'adjacent']
  } = options;

  let bestNode: GraphNode | null = null;
  let bestScore = -Infinity;

  // 遍历所有出边
  for (const edgeId of targetNode.outgoingEdges) {
    const edge = graph.edges.find(e => e.id === edgeId);
    if (!edge) continue;

    // 检查距离
    if (edge.distance > maxDistance) continue;

    // 检查权重
    if (edge.weight < minWeight) continue;

    // 检查关系类型
    if (!allowedRelations.includes(edge.relation)) continue;

    // 获取目标节点
    const target = graph.nodes.get(edge.to);
    if (!target || target.nodeType !== nodeType) continue;

    // 计算综合得分
    const score = edge.weight * edge.confidence;
    if (score > bestScore) {
      bestScore = score;
      bestNode = target;
    }
  }

  return bestNode;
}

/**
 * 提取题目-答案对
 */
export function extractQuestionAnswerPairs(
  graph: LayoutGraph,
  options: {
    maxDistance?: number;
  } = {}
): QuestionAnswerPair[] {
  const { maxDistance = 300 } = options;
  const pairs: QuestionAnswerPair[] = [];

  // 找到所有题目节点
  const questionNodes = Array.from(graph.nodes.values()).filter(
    n => n.nodeType === 'question'
  );

  // 找到所有手写节点（潜在答案）
  const handwritingNodes = Array.from(graph.nodes.values()).filter(
    n => n.nodeType === 'handwriting'
  );

  // 为每个题目查找最佳匹配的答案
  for (const questionNode of questionNodes) {
    let bestMatch: { node: GraphNode; score: number; distance: number } | null = null;

    for (const answerNode of handwritingNodes) {
      const distance = computeCenterDistance(questionNode.bbox, answerNode.bbox);

      if (distance > maxDistance) continue;

      // 计算匹配得分（考虑位置关系）
      const score = computeMatchScore(questionNode, answerNode, graph);

      if (score > (bestMatch?.score ?? 0)) {
        bestMatch = { node: answerNode, score, distance };
      }
    }

    if (bestMatch) {
      pairs.push({
        question: questionNode,
        answer: bestMatch.node,
        confidence: bestMatch.score,
        features: {
          spatialScore: bestMatch.score,
          layoutScore: computeLayoutScore(questionNode, bestMatch.node, graph.layoutInfo),
          distance: bestMatch.distance,
          relation: getRelationType(questionNode, bestMatch.node, graph)
        }
      });
    } else {
      // 没有找到答案
      pairs.push({
        question: questionNode,
        answer: null,
        confidence: 0,
        features: {
          spatialScore: 0,
          layoutScore: 0,
          distance: Infinity,
          relation: null
        }
      });
    }
  }

  return pairs;
}

/**
 * 计算匹配得分
 */
function computeMatchScore(
  questionNode: GraphNode,
  answerNode: GraphNode,
  graph: LayoutGraph
): number {
  // 基础得分基于距离
  const distance = computeCenterDistance(questionNode.bbox, answerNode.bbox);
  const maxDistance = 300;
  const distanceScore = Math.max(0, 1 - distance / maxDistance);

  // 位置偏好：右侧 > 下方 > 其他
  const [qCenterX, qCenterY] = [
    (questionNode.bbox[0] + questionNode.bbox[2]) / 2,
    (questionNode.bbox[1] + questionNode.bbox[3]) / 2
  ];
  const [aCenterX, aCenterY] = [
    (answerNode.bbox[0] + answerNode.bbox[2]) / 2,
    (answerNode.bbox[1] + answerNode.bbox[3]) / 2
  ];

  const dx = aCenterX - qCenterX;
  const dy = aCenterY - qCenterY;

  let positionBonus = 0;
  if (dx > 0 && Math.abs(dx) > Math.abs(dy)) {
    positionBonus = 0.3; // 右侧优先
  } else if (dy > 0 && dy > Math.abs(dx)) {
    positionBonus = 0.1; // 下方次之
  }

  return distanceScore + positionBonus;
}

/**
 * 计算布局一致性得分
 */
function computeLayoutScore(
  questionNode: GraphNode,
  answerNode: GraphNode,
  layoutInfo: ExtendedLayoutInfo
): number {
  // 检查是否在同一列
  const qCenterX = (questionNode.bbox[0] + questionNode.bbox[2]) / 2;
  const aCenterX = (answerNode.bbox[0] + answerNode.bbox[2]) / 2;

  for (const colCenter of layoutInfo.columnCenters) {
    const qInCol = Math.abs(qCenterX - colCenter) < layoutInfo.columnWidth * 0.4;
    const aInCol = Math.abs(aCenterX - colCenter) < layoutInfo.columnWidth * 0.4;

    if (qInCol && aInCol) {
      return 1.0; // 同列，高置信度
    }
  }

  return 0.5; // 不同列，低置信度
}

/**
 * 获取两个节点间的关系类型
 */
function getRelationType(
  nodeA: GraphNode,
  nodeB: GraphNode,
  graph: LayoutGraph
): EdgeRelation | null {
  // 查找从 A 到 B 的边
  for (const edgeId of nodeA.outgoingEdges) {
    const edge = graph.edges.find(e => e.id === edgeId);
    if (edge && edge.to === nodeB.id) {
      return edge.relation;
    }
  }
  return null;
}

/**
 * 检测图中的异常结构
 */
export function detectAnomalousStructures(
  graph: LayoutGraph
): AnomalyDetection[] {
  const anomalies: AnomalyDetection[] = [];

  // 检测孤立节点
  for (const node of graph.nodes.values()) {
    if (node.outgoingEdges.length === 0 && node.incomingEdges.length === 0) {
      anomalies.push({
        type: 'isolated_node',
        description: `节点 ${node.id} 没有任何连接`,
        confidence: 0.7,
        nodeIds: [node.id]
      });
    }
  }

  // 检测跨列异常匹配
  const pairs = extractQuestionAnswerPairs(graph);
  for (const pair of pairs) {
    if (pair.answer) {
      const isCrossColumn = detectCrossColumnMatch(
        pair.question,
        pair.answer,
        graph.layoutInfo
      );

      if (isCrossColumn) {
        anomalies.push({
          type: 'cross_column_match',
          description: `题目 ${pair.question.id} 与答案 ${pair.answer.id} 跨列匹配`,
          confidence: 0.6,
          nodeIds: [pair.question.id, pair.answer.id]
        });
      }
    }
  }

  return anomalies;
}

/**
 * 获取图的统计信息
 */
export function getGraphStats(graph: LayoutGraph): {
  nodeCount: number;
  edgeCount: number;
  avgDegree: number;
  density: number;
  nodesByType: Record<NodeType, number>;
} {
  const nodeCount = graph.nodes.size;
  const edgeCount = graph.edges.length;
  const avgDegree = nodeCount > 0 ? (2 * edgeCount) / nodeCount : 0;
  const density = graph.metadata.density;

  const nodesByType: Record<NodeType, number> = {
    question: 0,
    option: 0,
    answer: 0,
    handwriting: 0,
    title: 0,
    noise: 0
  };

  for (const node of graph.nodes.values()) {
    nodesByType[node.nodeType]++;
  }

  return {
    nodeCount,
    edgeCount,
    avgDegree,
    density,
    nodesByType
  };
}
