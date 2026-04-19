// lib/graph/types.ts
/**
 * Layout Graph 类型定义
 *
 * 核心概念：
 * - 节点（Node）：OCR 文本块
 * - 边（Edge）：节点间的空间关系
 * - 图（Graph）：完整的有向图结构
 */

import type { BBox } from '../structure/spatial-cluster';

/**
 * 节点类型
 */
export type NodeType =
  | 'question'     // 题目节点
  | 'option'       // 选项节点
  | 'answer'       // 答案节点
  | 'handwriting'  // 手写内容节点
  | 'title'        // 标题节点
  | 'noise';       // 噪声/无关内容

/**
 * 边关系类型
 */
export type EdgeRelation =
  | 'above'        // nodeA 在 nodeB 上方
  | 'below'        // nodeA 在 nodeB 下方
  | 'left'         // nodeA 在 nodeB 左侧
  | 'right'        // nodeA 在 nodeB 右侧
  | 'contains'     // nodeA 包含 nodeB
  | 'overlaps'     // nodeA 与 nodeB 重叠
  | 'adjacent'     // nodeA 与 nodeB 相邻
  | 'same_line'    // nodeA 与 nodeB 在同一行
  | 'same_column'; // nodeA 与 nodeB 在同一列

/**
 * 节点特征
 */
export interface NodeFeatures {
  /** 是否有数字前缀（题号） */
  hasNumberPrefix: boolean;
  /** 是否有选项标记（A. B. C. D.） */
  hasOptionMarker: boolean;
  /** 提取的选项标记（如果有） */
  optionMarker?: string;
  /** 文本长度 */
  textLength: number;
  /** 行数（估算） */
  lineCount: number;
  /** 是否是手写 */
  isHandwriting: boolean;
  /** 字体大小（估算，px） */
  fontSize: number;
  /** OCR 置信度 */
  ocrConfidence?: number;
}

/**
 * 图节点
 */
export interface GraphNode {
  /** 节点唯一 ID */
  id: string;
  /** OCR 文本块引用 */
  block: {
    text: string;
    bbox: BBox;
    type: 'print' | 'handwriting';
    confidence?: number;
  };
  /** 节点类型 */
  nodeType: NodeType;
  /** 边界框 */
  bbox: BBox;
  /** 节点特征 */
  features: NodeFeatures;
  /** 连接的边（出边） */
  outgoingEdges: string[];
  /** 连接的边（入边） */
  incomingEdges: string[];
}

/**
 * 图边
 */
export interface GraphEdge {
  /** 边 ID */
  id: string;
  /** 起始节点 ID */
  from: string;
  /** 目标节点 ID */
  to: string;
  /** 关系类型 */
  relation: EdgeRelation;
  /** 权重（0-1，越高表示关系越强） */
  weight: number;
  /** 置信度（0-1） */
  confidence: number;
  /** 距离（像素） */
  distance: number;
}

/**
 * 布局信息
 */
export interface LayoutInfo {
  /** 布局类型 */
  type: 'single_column' | 'double_column' | 'unknown';
  /** 列中心点 X 坐标 */
  columnCenters: number[];
  /** 列宽度 */
  columnWidth: number;
  /** 页面宽度 */
  pageWidth: number;
  /** 页面高度 */
  pageHeight: number;
  /** 平均行高 */
  avgLineHeight: number;
  /** 平均字号 */
  avgFontSize: number;
}

/**
 * 图元数据
 */
export interface GraphMetadata {
  /** 构建时间（毫秒） */
  buildTime: number;
  /** 节点数量 */
  nodeCount: number;
  /** 边数量 */
  edgeCount: number;
  /** 平均置信度 */
  avgConfidence: number;
  /** 图密度（边数/节点数） */
  density: number;
}

/**
 * Layout Graph 完整结构
 */
export interface LayoutGraph {
  /** 所有节点 */
  nodes: Map<string, GraphNode>;
  /** 所有边 */
  edges: GraphEdge[];
  /** 布局信息 */
  layoutInfo: LayoutInfo;
  /** 元数据 */
  metadata: GraphMetadata;
}

/**
 * 图构建选项
 */
export interface GraphBuildOptions {
  /** 是否检测手写内容 */
  detectHandwriting?: boolean;
  /** 是否过滤噪声 */
  filterNoise?: boolean;
  /** 最小文本长度（小于此值的节点将被过滤） */
  minTextLength?: number;
  /** 调试模式 */
  debug?: boolean;
}

/**
 * 图查询选项
 */
export interface GraphQueryOptions {
  /** 最大搜索距离（像素） */
  maxDistance?: number;
  /** 限制结果数量 */
  limit?: number;
  /** 最小权重阈值 */
  minWeight?: number;
  /** 包含的关系类型 */
  allowedRelations?: EdgeRelation[];
}

/**
 * 题目-答案对
 */
export interface QuestionAnswerPair {
  /** 题目节点 */
  question: GraphNode;
  /** 答案节点 */
  answer: GraphNode | null;
  /** 匹配置信度 */
  confidence: number;
  /** 匹配特征 */
  features: {
    spatialScore: number;
    layoutScore: number;
    distance: number;
    relation: EdgeRelation | null;
  };
}

/**
 * 异常检测结果
 */
export interface AnomalyDetection {
  /** 异常类型 */
  type: 'isolated_node' | 'cross_column_match' | 'unusual_distance' | 'ambiguous_relation';
  /** 描述 */
  description: string;
  /** 置信度（异常程度的置信度） */
  confidence: number;
  /** 涉及的节点 ID */
  nodeIds: string[];
}
