// lib/graph/query.ts
/**
 * 图查询接口 - 提供图结构的高级查询功能
 *
 * 核心功能：
 * 1. 查找最相关节点
 * 2. 邻居查询
 * 3. 路径查询
 * 4. 子图提取
 */

import type { GraphNode, LayoutGraph, EdgeRelation, GraphQueryOptions, QuestionAnswerPair } from './types';
import { computeCenterDistance } from './relation-detector';

const log = console; // 简化日志

/**
 * 查找最相关的答案节点
 */
export function findBestAnswerNode(
  graph: LayoutGraph,
  questionNode: GraphNode,
  options: GraphQueryOptions = {}
): GraphNode | null {
  const {
    maxDistance = 300,
    minWeight = 0.3,
    allowedRelations = ['right', 'below', 'adjacent'],
    limit = 1
  } = options;

  const candidates: Array<{ node: GraphNode; score: number }> = [];

  // 遍历所有手写节点（潜在答案）
  for (const node of graph.nodes.values()) {
    if (node.nodeType !== 'handwriting' && node.nodeType !== 'answer') {
      continue;
    }

    const distance = computeCenterDistance(questionNode.bbox, node.bbox);
    if (distance > maxDistance) continue;

    // 检查关系类型
    const relation = getDirectRelation(questionNode, node, graph);
    if (relation && !allowedRelations.includes(relation)) {
      continue;
    }

    // 计算得分
    const score = computeAnswerMatchScore(questionNode, node, distance, graph);
    if (score >= minWeight) {
      candidates.push({ node, score });
    }
  }

  // 按得分排序
  candidates.sort((a, b) => b.score - a.score);

  return candidates.length > 0 ? candidates[0].node : null;
}

/**
 * 查找 Top-K 候选答案节点
 */
export function findTopKAnswerNodes(
  graph: LayoutGraph,
  questionNode: GraphNode,
  k: number = 3,
  options: Omit<GraphQueryOptions, 'limit'> = {}
): Array<{ node: GraphNode; score: number; rank: number }> {
  const {
    maxDistance = 500,
    minWeight = 0.1,
    allowedRelations = ['right', 'below', 'adjacent']
  } = options;

  const candidates: Array<{ node: GraphNode; score: number }> = [];

  for (const node of graph.nodes.values()) {
    if (node.nodeType !== 'handwriting' && node.nodeType !== 'answer') {
      continue;
    }

    const distance = computeCenterDistance(questionNode.bbox, node.bbox);
    if (distance > maxDistance) continue;

    const relation = getDirectRelation(questionNode, node, graph);
    if (relation && !allowedRelations.includes(relation)) {
      continue;
    }

    const score = computeAnswerMatchScore(questionNode, node, distance, graph);
    if (score >= minWeight) {
      candidates.push({ node, score });
    }
  }

  // 排序并返回 Top-K
  candidates.sort((a, b) => b.score - a.score);

  return candidates.slice(0, k).map((c, index) => ({
    ...c,
    rank: index + 1
  }));
}

/**
 * 查找邻居节点
 */
export function findNeighbors(
  graph: LayoutGraph,
  node: GraphNode,
  options: {
    direction?: 'incoming' | 'outgoing' | 'both';
    relationTypes?: EdgeRelation[];
    maxDistance?: number;
  } = {}
): GraphNode[] {
  const {
    direction = 'both',
    relationTypes,
    maxDistance = Infinity
  } = options;

  const neighbors: GraphNode[] = [];
  const edgeIds = [
    ...(direction === 'incoming' || direction === 'both' ? node.incomingEdges : []),
    ...(direction === 'outgoing' || direction === 'both' ? node.outgoingEdges : [])
  ];

  for (const edgeId of edgeIds) {
    const edge = graph.edges.find(e => e.id === edgeId);
    if (!edge) continue;

    if (relationTypes && !relationTypes.includes(edge.relation)) {
      continue;
    }

    if (edge.distance > maxDistance) {
      continue;
    }

    const otherNodeId = edgeId === node.incomingEdges.find(id => id === edgeId)
      ? edge.from
      : edge.to;

    const otherNode = graph.nodes.get(otherNodeId);
    if (otherNode) {
      neighbors.push(otherNode);
    }
  }

  return neighbors;
}

/**
 * 查找特定类型的所有节点
 */
export function findNodesByType(
  graph: LayoutGraph,
  nodeType: string
): GraphNode[] {
  return Array.from(graph.nodes.values()).filter(n => n.nodeType === nodeType);
}

/**
 * 提取子图（包含指定节点及其邻居）
 */
export function extractSubgraph(
  graph: LayoutGraph,
  seedNodes: GraphNode[],
  options: {
    maxDepth?: number;
    maxDistance?: number;
  } = {}
): LayoutGraph {
  const { maxDepth = 2, maxDistance = 500 } = options;

  const includedNodeIds = new Set<string>();
  const includedEdgeIds = new Set<string>();
  const queue: Array<{ nodeId: string; depth: number }> = [];

  // 初始化队列
  for (const node of seedNodes) {
    includedNodeIds.add(node.id);
    queue.push({ nodeId: node.id, depth: 0 });
  }

  // BFS 遍历
  while (queue.length > 0) {
    const { nodeId, depth } = queue.shift()!;

    if (depth >= maxDepth) continue;

    const node = graph.nodes.get(nodeId);
    if (!node) continue;

    // 检查出边
    for (const edgeId of node.outgoingEdges) {
      const edge = graph.edges.find(e => e.id === edgeId);
      if (!edge || edge.distance > maxDistance) continue;

      if (!includedNodeIds.has(edge.to)) {
        includedNodeIds.add(edge.to);
        includedEdgeIds.add(edge.id);
        queue.push({ nodeId: edge.to, depth: depth + 1 });
      }
    }

    // 检查入边
    for (const edgeId of node.incomingEdges) {
      const edge = graph.edges.find(e => e.id === edgeId);
      if (!edge || edge.distance > maxDistance) continue;

      if (!includedNodeIds.has(edge.from)) {
        includedNodeIds.add(edge.from);
        includedEdgeIds.add(edge.id);
        queue.push({ nodeId: edge.from, depth: depth + 1 });
      }
    }
  }

  // 构建子图
  const subNodes = new Map<string, typeof graph.nodes extends Map<string, infer V> ? V : never>();
  const subEdges: typeof graph.edges = [];

  for (const nodeId of includedNodeIds) {
    const node = graph.nodes.get(nodeId);
    if (node) {
      subNodes.set(nodeId, { ...node, outgoingEdges: [], incomingEdges: [] });
    }
  }

  for (const edgeId of includedEdgeIds) {
    const edge = graph.edges.find(e => e.id === edgeId);
    if (edge && subNodes.has(edge.from) && subNodes.has(edge.to)) {
      subEdges.push(edge);
      subNodes.get(edge.from)!.outgoingEdges.push(edgeId);
      subNodes.get(edge.to)!.incomingEdges.push(edgeId);
    }
  }

  return {
    nodes: subNodes as any,
    edges: subEdges,
    layoutInfo: graph.layoutInfo,
    metadata: {
      buildTime: 0,
      nodeCount: subNodes.size,
      edgeCount: subEdges.length,
      avgConfidence: graph.metadata.avgConfidence,
      density: subNodes.size > 0 ? subEdges.length / subNodes.size : 0
    }
  };
}

/**
 * 计算答案匹配得分
 */
function computeAnswerMatchScore(
  questionNode: GraphNode,
  answerNode: GraphNode,
  distance: number,
  graph: LayoutGraph
): number {
  // 距离得分（0-1）
  const maxDistance = 300;
  const distanceScore = Math.max(0, 1 - distance / maxDistance);

  // 位置偏好得分
  const [qX1, qY1, qX2, qY2] = questionNode.bbox;
  const [aX1, aY1, aX2, aY2] = answerNode.bbox;

  const qRight = qX2;
  const aLeft = aX1;
  const qBottom = qY2;
  const aTop = aY1;

  let positionBonus = 0;

  // 右侧优先
  if (aLeft >= qX2 && aTop >= qY1 && aTop <= qY2) {
    positionBonus = 0.3;
  }
  // 下方次之
  else if (aTop >= qY2 && aX1 >= qX1 && aX1 <= qX2) {
    positionBonus = 0.15;
  }

  // 布局一致性
  const qCenterX = (qX1 + qX2) / 2;
  const aCenterX = (aX1 + aX2) / 2;

  let layoutScore = 0.5;
  for (const colCenter of graph.layoutInfo.columnCenters) {
    const qInCol = Math.abs(qCenterX - colCenter) < graph.layoutInfo.columnWidth * 0.4;
    const aInCol = Math.abs(aCenterX - colCenter) < graph.layoutInfo.columnWidth * 0.4;
    if (qInCol && aInCol) {
      layoutScore = 1.0;
      break;
    }
  }

  return distanceScore * 0.5 + positionBonus + layoutScore * 0.2;
}

/**
 * 获取两个节点间的直接关系
 */
function getDirectRelation(
  nodeA: GraphNode,
  nodeB: GraphNode,
  graph: LayoutGraph
): EdgeRelation | null {
  // 检查 A -> B
  for (const edgeId of nodeA.outgoingEdges) {
    const edge = graph.edges.find(e => e.id === edgeId);
    if (edge && edge.to === nodeB.id) {
      return edge.relation;
    }
  }

  // 检查 B -> A
  for (const edgeId of nodeB.outgoingEdges) {
    const edge = graph.edges.find(e => e.id === edgeId);
    if (edge && edge.to === nodeA.id) {
      return getInverseRelation(edge.relation);
    }
  }

  return null;
}

/**
 * 获取反向关系
 */
function getInverseRelation(relation: EdgeRelation): EdgeRelation | null {
  const inverses: Partial<Record<EdgeRelation, EdgeRelation>> = {
    'above': 'below',
    'below': 'above',
    'left': 'right',
    'right': 'left'
  };

  return inverses[relation] || null;
}
