// lib/graph/index.ts
/**
 * Layout Graph 模块 - 统一导出
 *
 * 核心功能：
 * 1. 从 OCR 块构建 Layout Graph
 * 2. 检测节点间的空间关系
 * 3. 提供图查询接口
 * 4. 提取题目-答案对
 */

// 类型定义
export type {
  BBox,
  OCRBlock,
  SpatialCluster,
  LayoutInfo
} from '../structure/spatial-cluster';

export type {
  NodeType,
  EdgeRelation,
  NodeFeatures,
  GraphNode,
  GraphEdge,
  GraphMetadata,
  LayoutGraph,
  GraphBuildOptions,
  GraphQueryOptions,
  QuestionAnswerPair,
  AnomalyDetection
} from './types';

// 核心图构建
export {
  buildLayoutGraph,
  extractQuestionAnswerPairs,
  detectAnomalousStructures,
  getGraphStats
} from './layout-graph';

// 关系检测
export {
  detectRelations,
  detectAllRelations,
  computeCenterDistance,
  detectCrossColumnMatch
} from './relation-detector';

// 图查询
export {
  findBestAnswerNode,
  findTopKAnswerNodes,
  findNeighbors,
  findNodesByType,
  extractSubgraph
} from './query';
