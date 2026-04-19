// lib/confidence/types.ts
/**
 * 置信度融合类型定义
 *
 * 核心概念：
 * - 多源置信度：OCR、Graph、LLM、Top-K 等
 * - 融合方法：加权平均、贝叶斯、Dempster-Shafer、学习模型
 * - 校准：将原始置信度映射到真实准确率
 */

/**
 * 置信度源
 */
export interface ConfidenceSources {
  /** OCR 置信度 */
  ocr?: number;
  /** Graph 置信度（空间+布局） */
  graph?: number;
  /** LLM 置信度 */
  llm?: number;
  /** Top-K 匹配置信度 */
  topK?: number;
  /** Rerank 置信度 */
  rerank?: number;
  /** 历史准确率 */
  historical?: number;
  /** 防幻觉置信度 */
  antiHallucination?: number;
}

/**
 * 融合权重
 */
export interface FusionWeights {
  /** OCR 权重 */
  ocr: number;
  /** Graph 权重 */
  graph: number;
  /** LLM 权重 */
  llm: number;
  /** Top-K 权重 */
  topK: number;
  /** Rerank 权重 */
  rerank: number;
  /** 历史权重 */
  historical: number;
  /** 防幻觉权重 */
  antiHallucination: number;
}

/**
 * 融合方法
 */
export type FusionMethod =
  | 'weighted_average'      // 加权平均
  | 'bayesian'              // 贝叶斯融合
  | 'dempster_shafer'       // Dempster-Shafer 证据理论
  | 'neural'                // 神经网络融合
  | 'adaptive';             // 自适应融合

/**
 * 融合结果
 */
export interface FusionResult {
  /** 融合后的置信度 */
  confidence: number;
  /** 使用的融合方法 */
  method: FusionMethod;
  /** 使用的权重 */
  weights: FusionWeights;
  /** 原始置信度 */
  sources: ConfidenceSources;
  /** 一致性分数（0-1，越高越一致） */
  consistency: number;
  /** 不确定性分数（0-1，越高越不确定） */
  uncertainty: number;
  /** 融合原因 */
  reasoning?: string;
}

/**
 * 一致性验证结果
 */
export interface ConsistencyCheck {
  /** 是否一致 */
  isConsistent: boolean;
  /** 一致性分数（0-1） */
  score: number;
  /** 冲突源 */
  conflicts: Array<{
    source1: string;
    source2: string;
    diff: number;
  }>;
  /** 建议 */
  suggestion: string;
}

/**
 * 校准模型
 */
export interface CalibrationModel {
  /** 校准参数 */
  params: {
    /** Platt Scaling 参数（a, b） */
    plattA?: number;
    plattB?: number;
    /** 温度缩放参数 */
    temperature?: number;
    /** 分箱校准边界 */
    binBoundaries?: number[];
  };
  /** 校准数据集大小 */
  sampleSize: number;
  /** 校准前的准确率 */
  preCalibrationAccuracy: number;
  /** 校准后的准确率 */
  postCalibrationAccuracy: number;
  /** 期望校准误差（ECE） */
  expectedCalibrationError: number;
}

/**
 * 置信度统计
 */
export interface ConfidenceStats {
  /** 总样本数 */
  totalSamples: number;
  /** 平均置信度 */
  avgConfidence: number;
  /** 实际准确率 */
  accuracy: number;
  /** 校准误差 */
  calibrationError: number;
  /** 各置信度区间的准确率 */
  accuracyByBin: Array<{
    bin: string;
    count: number;
    avgConfidence: number;
    actualAccuracy: number;
  }>;
}

/**
 * 融合配置
 */
export interface FusionConfig {
  /** 默认融合方法 */
  defaultMethod: FusionMethod;
  /** 默认权重 */
  defaultWeights: FusionWeights;
  /** 最小置信度阈值 */
  minConfidenceThreshold: number;
  /** 一致性阈值 */
  consistencyThreshold: number;
  /** 是否启用自适应权重 */
  enableAdaptiveWeights: boolean;
  /** 是否启用校准 */
  enableCalibration: boolean;
}

/**
 * 置信度收集器结果
 */
export interface CollectedConfidence {
  /** 题目 ID */
  questionId: string;
  /** 收集的置信度源 */
  sources: ConfidenceSources;
  /** 可用源列表 */
  availableSources: string[];
  /** 缺失源列表 */
  missingSources: string[];
  /** 收集时间戳 */
  timestamp: number;
}

/**
 * 置信度元数据
 */
export interface ConfidenceMetadata {
  /** 来源名称 */
  source: string;
  /** 原始值 */
  rawValue: number;
  /** 归一化值（0-1） */
  normalizedValue: number;
  /** 可靠性评分（0-1） */
  reliability: number;
  /** 获取时间 */
  timestamp: number;
  /** 元数据 */
  metadata?: Record<string, any>;
}
