// lib/confidence/fusion.ts
/**
 * 置信度融合算法 - 多源置信度融合
 *
 * 核心功能：
 * 1. 加权平均融合
 * 2. 贝叶斯融合
 * 3. Dempster-Shafer 证据理论
 * 4. 自适应融合
 * 5. 一致性验证
 */

import { createLogger } from '@/lib/logger';
import type {
  ConfidenceSources,
  FusionWeights,
  FusionMethod,
  FusionResult,
  ConsistencyCheck,
  FusionConfig
} from './types';

const log = createLogger('ConfidenceFusion');

/**
 * 默认融合权重
 */
const DEFAULT_WEIGHTS: FusionWeights = {
  ocr: 0.15,
  graph: 0.20,
  llm: 0.25,
  topK: 0.15,
  rerank: 0.15,
  historical: 0.05,
  antiHallucination: 0.05
};

/**
 * 默认配置
 */
const DEFAULT_CONFIG: FusionConfig = {
  defaultMethod: 'adaptive',
  defaultWeights: DEFAULT_WEIGHTS,
  minConfidenceThreshold: 0.5,
  consistencyThreshold: 0.7,
  enableAdaptiveWeights: true,
  enableCalibration: false
};

/**
 * 融合置信度
 */
export function fuseConfidence(
  sources: ConfidenceSources,
  method: FusionMethod = 'weighted_average',
  config: Partial<FusionConfig> = {}
): FusionResult {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // 检查是否有可用的置信度源
  const availableSources = getAvailableSources(sources);
  if (availableSources.length === 0) {
    return {
      confidence: 0,
      method,
      weights: fullConfig.defaultWeights,
      sources,
      consistency: 0,
      uncertainty: 1,
      reasoning: '没有可用的置信度源'
    };
  }

  // 根据方法选择融合算法
  let confidence: number;
  let weights = fullConfig.defaultWeights;

  switch (method) {
    case 'weighted_average':
      confidence = weightedAverageFusion(sources, weights);
      break;

    case 'bayesian':
      confidence = bayesianFusion(sources);
      break;

    case 'dempster_shafer':
      confidence = dempsterShaferFusion(sources);
      break;

    case 'adaptive':
      // 自适应方法：根据可用源和一致性选择最佳方法
      const adaptiveResult = adaptiveFusion(sources, fullConfig);
      confidence = adaptiveResult.confidence;
      weights = adaptiveResult.weights;
      break;

    default:
      confidence = weightedAverageFusion(sources, weights);
  }

  // 计算一致性
  const consistency = computeConsistency(sources);

  // 计算不确定性
  const uncertainty = computeUncertainty(sources);

  // 生成推理
  const reasoning = generateReasoning(sources, method, consistency);

  return {
    confidence: Math.min(1, Math.max(0, confidence)),
    method,
    weights,
    sources,
    consistency,
    uncertainty,
    reasoning
  };
}

/**
 * 加权平均融合
 */
function weightedAverageFusion(
  sources: ConfidenceSources,
  weights: FusionWeights
): number {
  let totalWeight = 0;
  let weightedSum = 0;

  if (sources.ocr !== undefined) {
    weightedSum += sources.ocr * weights.ocr;
    totalWeight += weights.ocr;
  }

  if (sources.graph !== undefined) {
    weightedSum += sources.graph * weights.graph;
    totalWeight += weights.graph;
  }

  if (sources.llm !== undefined) {
    weightedSum += sources.llm * weights.llm;
    totalWeight += weights.llm;
  }

  if (sources.topK !== undefined) {
    weightedSum += sources.topK * weights.topK;
    totalWeight += weights.topK;
  }

  if (sources.rerank !== undefined) {
    weightedSum += sources.rerank * weights.rerank;
    totalWeight += weights.rerank;
  }

  if (sources.historical !== undefined) {
    weightedSum += sources.historical * weights.historical;
    totalWeight += weights.historical;
  }

  if (sources.antiHallucination !== undefined) {
    weightedSum += sources.antiHallucination * weights.antiHallucination;
    totalWeight += weights.antiHallucination;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * 贝叶斯融合
 *
 * 将每个置信度源视为证据，使用贝叶斯更新
 */
function bayesianFusion(sources: ConfidenceSources): number {
  // 初始先验（均匀分布）
  let priorLogOdds = 0; // log(0.5/0.5) = 0

  // 可用源数量
  const availableCount = getAvailableSources(sources).length;

  // 每个源提供证据
  if (sources.ocr !== undefined) {
    priorLogOdds += Math.log(sources.ocr / (1 - sources.ocr + 1e-6));
  }

  if (sources.graph !== undefined) {
    priorLogOdds += Math.log(sources.graph / (1 - sources.graph + 1e-6));
  }

  if (sources.llm !== undefined) {
    priorLogOdds += Math.log(sources.llm / (1 - sources.llm + 1e-6));
  }

  if (sources.topK !== undefined) {
    priorLogOdds += Math.log(sources.topK / (1 - sources.topK + 1e-6));
  }

  if (sources.rerank !== undefined) {
    priorLogOdds += Math.log(sources.rerank / (1 - sources.rerank + 1e-6));
  }

  // 转换回概率
  const probability = 1 / (1 + Math.exp(-priorLogOdds / availableCount));

  return probability;
}

/**
 * Dempster-Shafer 证据理论融合
 *
 * 处理不确定性和冲突
 */
function dempsterShaferFusion(sources: ConfidenceSources): number {
  // 简化版本：将每个源视为对"正确"的支持度
  let belief = 0;  // 对"正确"的信念
  let plausibility = 1;  // 对"正确"的似然性
  let mass = 0;  // 质量函数

  const availableSources = getAvailableSources(sources);

  // 组合证据
  for (const source of availableSources) {
    const confidence = sources[source as keyof ConfidenceSources]!;

    // 质量函数：直接分配给"正确"或"错误"
    // 这里简化处理，使用置信度作为质量
    mass = confidence;

    // 信念 = 下概率
    belief = belief + mass - belief * mass;

    // 似然性 = 上概率
    plausibility = plausibility * (1 - mass * 0.5);
  }

  // 使用区间 [belief, plausibility] 的中点
  return (belief + plausibility) / 2;
}

/**
 * 自适应融合
 *
 * 根据可用源和一致性动态选择方法和权重
 */
function adaptiveFusion(
  sources: ConfidenceSources,
  config: FusionConfig
): { confidence: number; weights: FusionWeights } {
  const consistency = computeConsistency(sources);
  const availableSources = getAvailableSources(sources);

  // 自适应权重
  let weights = { ...config.defaultWeights };

  if (config.enableAdaptiveWeights) {
    weights = computeAdaptiveWeights(sources, consistency);
  }

  // 如果一致性低，使用更保守的方法
  let method: FusionMethod;
  let confidence: number;

  if (consistency < config.consistencyThreshold) {
    // 低一致性：使用贝叶斯融合（更保守）
    method = 'bayesian';
    confidence = bayesianFusion(sources);

    // 降低权重以反映不确定性
    confidence *= 0.9;
  } else {
    // 高一致性：使用加权平均
    method = 'weighted_average';
    confidence = weightedAverageFusion(sources, weights);
  }

  // 如果有 rerank 结果，给它更高权重
  if (sources.rerank !== undefined && sources.rerank > 0.8) {
    confidence = confidence * 0.3 + sources.rerank * 0.7;
  }

  return { confidence, weights };
}

/**
 * 计算自适应权重
 */
function computeAdaptiveWeights(
  sources: ConfidenceSources,
  consistency: number
): FusionWeights {
  let weights = { ...DEFAULT_WEIGHTS };

  // 根据可用源调整权重
  const availableSources = getAvailableSources(sources);
  const totalAvailable = availableSources.length;

  // 重新归一化权重
  let totalWeight = 0;
  const tempWeights: Partial<FusionWeights> = {};

  for (const source of availableSources) {
    const baseWeight = DEFAULT_WEIGHTS[source as keyof FusionWeights];
    tempWeights[source as keyof FusionWeights] = baseWeight;
    totalWeight += baseWeight;
  }

  // 归一化
  for (const source of availableSources) {
    if (tempWeights[source as keyof FusionWeights] !== undefined) {
      weights[source as keyof FusionWeights] =
        (tempWeights[source as keyof FusionWeights]! / totalWeight) * (totalAvailable / 7);
    }
  }

  // 根据一致性调整
  if (consistency < 0.5) {
    // 低一致性：降低所有权重，增加不确定性
    const factor = 0.8;
    for (const key in weights) {
      weights[key as keyof FusionWeights] *= factor;
    }
  }

  return weights;
}

/**
 * 验证一致性
 */
export function verifyConsistency(sources: ConfidenceSources): ConsistencyCheck {
  const availableSources = getAvailableSources(sources);

  if (availableSources.length < 2) {
    return {
      isConsistent: true,
      score: 1,
      conflicts: [],
      suggestion: '只有一个置信度源，无法验证一致性'
    };
  }

  // 计算两两差异
  const conflicts: Array<{ source1: string; source2: string; diff: number }> = [];

  for (let i = 0; i < availableSources.length; i++) {
    for (let j = i + 1; j < availableSources.length; j++) {
      const source1 = availableSources[i];
      const source2 = availableSources[j];
      const value1 = sources[source1 as keyof ConfidenceSources]!;
      const value2 = sources[source2 as keyof ConfidenceSources]!;

      const diff = Math.abs(value1 - value2);

      if (diff > 0.3) {
        conflicts.push({ source1, source2, diff });
      }
    }
  }

  // 计算一致性分数
  const score = 1 - (conflicts.length / (availableSources.length * (availableSources.length - 1) / 2));

  const isConsistent = score >= 0.7 && conflicts.length === 0;

  let suggestion = '';
  if (!isConsistent) {
    suggestion = conflicts.length > 0
      ? `检测到 ${conflicts.length} 个冲突，最大差异为 ${Math.max(...conflicts.map(c => c.diff)).toFixed(2)}`
      : '置信度源一致性不足';
  } else {
    suggestion = '置信度源一致性良好';
  }

  return {
    isConsistent,
    score,
    conflicts,
    suggestion
  };
}

/**
 * 计算一致性分数
 */
function computeConsistency(sources: ConfidenceSources): number {
  const result = verifyConsistency(sources);
  return result.score;
}

/**
 * 计算不确定性
 */
function computeUncertainty(sources: ConfidenceSources): number {
  const availableSources = getAvailableSources(sources);

  if (availableSources.length === 0) {
    return 1; // 完全不确定
  }

  const values = availableSources.map(s => sources[s as keyof ConfidenceSources]!);

  // 使用标准差作为不确定性的度量
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // 归一化到 [0, 1]
  return Math.min(1, stdDev * 2);
}

/**
 * 生成推理说明
 */
function generateReasoning(
  sources: ConfidenceSources,
  method: FusionMethod,
  consistency: number
): string {
  const availableSources = getAvailableSources(sources);

  let reasoning = `使用 ${method} 方法融合 ${availableSources.length} 个置信度源`;

  if (consistency < 0.7) {
    reasoning += '，但一致性较低';
  } else if (consistency > 0.9) {
    reasoning += '，一致性良好';
  }

  if (sources.rerank !== undefined) {
    reasoning += '，Rerank 结果权重较高';
  }

  return reasoning;
}

/**
 * 获取可用的置信度源
 */
function getAvailableSources(sources: ConfidenceSources): string[] {
  return Object.keys(sources).filter(
    key => sources[key as keyof ConfidenceSources] !== undefined
  );
}

/**
 * 批量融合置信度
 */
export function batchFuseConfidence(
  sourcesArray: ConfidenceSources[],
  method: FusionMethod = 'weighted_average',
  config: Partial<FusionConfig> = {}
): FusionResult[] {
  return sourcesArray.map(sources => fuseConfidence(sources, method, config));
}
