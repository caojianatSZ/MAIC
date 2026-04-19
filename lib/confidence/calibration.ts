// lib/confidence/calibration.ts
/**
 * 置信度校准 - 将原始置信度映射到真实准确率
 *
 * 核心功能：
 * 1. Platt Scaling（逻辑回归校准）
 * 2. 温度缩放
 * 3. 分箱校准
 * 4. 期望校准误差（ECE）计算
 */

import { createLogger } from '@/lib/logger';
import type {
  CalibrationModel,
  ConfidenceStats,
  ConfidenceMetadata
} from './types';

const log = createLogger('ConfidenceCalibration');

/**
 * 校准样本
 */
interface CalibrationSample {
  confidence: number;
  correct: boolean;
}

/**
 * Platt Scaling 校准
 *
 * 使用逻辑回归将原始置信度映射到校准后的置信度
 * P(correct | confidence) = 1 / (1 + exp(a * confidence + b))
 */
export function plattScaling(
  samples: CalibrationSample[]
): { model: CalibrationModel; calibrate: (confidence: number) => number } {
  if (samples.length === 0) {
    throw new Error('没有校准样本');
  }

  // 简化版 Platt Scaling（实际应该用优化算法求解）
  // 这里使用统计方法估算参数

  // 计算正负样本的平均置信度
  const positiveSamples = samples.filter(s => s.correct);
  const negativeSamples = samples.filter(s => !s.correct);

  const avgPositive = positiveSamples.length > 0
    ? positiveSamples.reduce((sum, s) => sum + s.confidence, 0) / positiveSamples.length
    : 0.5;

  const avgNegative = negativeSamples.length > 0
    ? negativeSamples.reduce((sum, s) => sum + s.confidence, 0) / negativeSamples.length
    : 0.5;

  // 简化的参数估算
  const a = 2 / (avgPositive - avgNegative + 1e-6);
  const b = -a * (avgPositive + avgNegative) / 2;

  // 校准函数
  const calibrate = (confidence: number): number => {
    const logit = a * confidence + b;
    const probability = 1 / (1 + Math.exp(-logit));
    return Math.min(1, Math.max(0, probability));
  };

  // 计算校准效果
  const calibratedSamples = samples.map(s => ({
    ...s,
    calibratedConfidence: calibrate(s.confidence)
  }));

  const preCalibrationAccuracy = samples.filter(s => s.correct).length / samples.length;
  const postCalibrationAccuracy = computeCalibrationAccuracy(calibratedSamples);
  const ece = computeECE(calibratedSamples);

  const model: CalibrationModel = {
    params: {
      plattA: a,
      plattB: b
    },
    sampleSize: samples.length,
    preCalibrationAccuracy,
    postCalibrationAccuracy,
    expectedCalibrationError: ece
  };

  return { model, calibrate };
}

/**
 * 温度缩放校准
 *
 * 使用单个温度参数缩放 logits
 */
export function temperatureScaling(
  samples: CalibrationSample[]
): { model: CalibrationModel; calibrate: (confidence: number) => number } {
  if (samples.length === 0) {
    throw new Error('没有校准样本');
  }

  // 将置信度转换为 logits
  const toLogit = (p: number): number => {
    p = Math.min(0.999, Math.max(0.001, p));
    return Math.log(p / (1 - p));
  };

  const fromLogit = (logit: number): number => {
    return 1 / (1 + Math.exp(-logit));
  };

  // 计算最佳温度（简化版）
  const logits = samples.map(s => toLogit(s.confidence));
  const avgLogitPositive = samples
    .filter(s => s.correct)
    .reduce((sum, s, _, arr) => sum + toLogit(s.confidence) / arr.length, 0);
  const avgLogitNegative = samples
    .filter(s => !s.correct)
    .reduce((sum, s, _, arr) => sum + toLogit(s.confidence) / arr.length, 0);

  // 温度参数
  const T = Math.max(0.1, Math.abs(avgLogitPositive - avgLogitNegative));

  // 校准函数
  const calibrate = (confidence: number): number => {
    const logit = toLogit(confidence);
    const scaledLogit = logit / T;
    return fromLogit(scaledLogit);
  };

  // 计算校准效果
  const calibratedSamples = samples.map(s => ({
    ...s,
    calibratedConfidence: calibrate(s.confidence)
  }));

  const preCalibrationAccuracy = samples.filter(s => s.correct).length / samples.length;
  const postCalibrationAccuracy = computeCalibrationAccuracy(calibratedSamples);
  const ece = computeECE(calibratedSamples);

  const model: CalibrationModel = {
    params: {
      temperature: T
    },
    sampleSize: samples.length,
    preCalibrationAccuracy,
    postCalibrationAccuracy,
    expectedCalibrationError: ece
  };

  return { model, calibrate };
}

/**
 * 分箱校准
 *
 * 将置信度区间分组，每个组独立校准
 */
export function binningCalibration(
  samples: CalibrationSample[],
  numBins: number = 10
): { model: CalibrationModel; calibrate: (confidence: number) => number } {
  if (samples.length === 0) {
    throw new Error('没有校准样本');
  }

  // 创建 bins
  const binBoundaries = Array.from({ length: numBins + 1 }, (_, i) => i / numBins);

  // 计算 bins 的校准值
  const binCalibrations: number[] = [];

  for (let i = 0; i < numBins; i++) {
    const binSamples = samples.filter(
      s => s.confidence >= binBoundaries[i] && s.confidence < binBoundaries[i + 1]
    );

    if (binSamples.length > 0) {
      const accuracy = binSamples.filter(s => s.correct).length / binSamples.length;
      binCalibrations.push(accuracy);
    } else {
      // 没有样本，使用线性插值
      binCalibrations.push((i + 0.5) / numBins);
    }
  }

  // 校准函数
  const calibrate = (confidence: number): number => {
    // 找到对应的 bin
    const binIndex = Math.min(
      Math.floor(confidence * numBins),
      numBins - 1
    );
    return binCalibrations[binIndex];
  };

  // 计算校准效果
  const calibratedSamples = samples.map(s => ({
    ...s,
    calibratedConfidence: calibrate(s.confidence)
  }));

  const preCalibrationAccuracy = samples.filter(s => s.correct).length / samples.length;
  const postCalibrationAccuracy = computeCalibrationAccuracy(calibratedSamples);
  const ece = computeECE(calibratedSamples);

  const model: CalibrationModel = {
    params: {
      binBoundaries
    },
    sampleSize: samples.length,
    preCalibrationAccuracy,
    postCalibrationAccuracy,
    expectedCalibrationError: ece
  };

  return { model, calibrate };
}

/**
 * 计算期望校准误差（ECE）
 *
 * ECE = Σ |confidence - accuracy| * (n_i / N)
 */
export function computeECE(
  samples: Array<{ confidence: number; correct: boolean; calibratedConfidence?: number }>
): number {
  const numBins = 10;
  const bins = Array.from({ length: numBins }, () => ({
    confidences: [] as number[],
    accuracies: [] as number[]
  }));

  // 分箱
  for (const sample of samples) {
    const conf = sample.calibratedConfidence ?? sample.confidence;
    const binIndex = Math.min(Math.floor(conf * numBins), numBins - 1);

    bins[binIndex].confidences.push(conf);
    bins[binIndex].accuracies.push(sample.correct ? 1 : 0);
  }

  // 计算 ECE
  let ece = 0;
  let totalSamples = 0;

  for (const bin of bins) {
    if (bin.confidences.length === 0) continue;

    const avgConfidence =
      bin.confidences.reduce((sum, c) => sum + c, 0) / bin.confidences.length;
    const avgAccuracy =
      bin.accuracies.reduce((sum, a) => sum + a, 0) / bin.accuracies.length;
    const weight = bin.confidences.length;

    ece += Math.abs(avgConfidence - avgAccuracy) * weight;
    totalSamples += weight;
  }

  return totalSamples > 0 ? ece / totalSamples : 0;
}

/**
 * 计算校准后的准确率
 */
function computeCalibrationAccuracy(
  samples: Array<{ confidence: number; correct: boolean; calibratedConfidence: number }>
): number {
  // 使用 Brier score 的反向
  const brierScore = samples.reduce(
    (sum, s) => sum + (s.calibratedConfidence - (s.correct ? 1 : 0)) ** 2,
    0
  ) / samples.length;

  return 1 - brierScore;
}

/**
 * 收集校准数据
 */
export function collectCalibrationData(
  metadataList: Array<{
    confidence: number;
    actualCorrect: boolean;
  }>
): CalibrationSample[] {
  return metadataList.map(m => ({
    confidence: m.confidence,
    correct: m.actualCorrect
  }));
}

/**
 * 分析置信度统计
 */
export function analyzeConfidenceStats(
  samples: CalibrationSample[],
  numBins: number = 10
): ConfidenceStats {
  const totalSamples = samples.length;
  const avgConfidence =
    samples.reduce((sum, s) => sum + s.confidence, 0) / totalSamples;
  const accuracy = samples.filter(s => s.correct).length / totalSamples;

  // 分箱统计
  const accuracyByBin: Array<{
    bin: string;
    count: number;
    avgConfidence: number;
    actualAccuracy: number;
  }> = [];

  for (let i = 0; i < numBins; i++) {
    const binSamples = samples.filter(
      s => s.confidence >= i / numBins && s.confidence < (i + 1) / numBins
    );

    if (binSamples.length > 0) {
      const binAvgConfidence =
        binSamples.reduce((sum, s) => sum + s.confidence, 0) / binSamples.length;
      const binAccuracy = binSamples.filter(s => s.correct).length / binSamples.length;

      accuracyByBin.push({
        bin: `[${(i / numBins).toFixed(1)}, ${((i + 1) / numBins).toFixed(1)})`,
        count: binSamples.length,
        avgConfidence: binAvgConfidence,
        actualAccuracy: binAccuracy
      });
    }
  }

  // 校准误差（简化版 ECE）
  const calibrationError = Math.abs(avgConfidence - accuracy);

  return {
    totalSamples,
    avgConfidence,
    accuracy,
    calibrationError,
    accuracyByBin
  };
}

/**
 * 选择最佳校准方法
 */
export function selectBestCalibration(
  samples: CalibrationSample[]
): { model: CalibrationModel; calibrate: (confidence: number) => number } {
  // 尝试所有方法
  const plattResult = plattScaling(samples);
  const tempResult = temperatureScaling(samples);
  const binningResult = binningCalibration(samples);

  // 选择 ECE 最低的
  const methods = [
    { name: 'platt', ...plattResult },
    { name: 'temperature', ...tempResult },
    { name: 'binning', ...binningResult }
  ];

  methods.sort((a, b) =>
    a.model.expectedCalibrationError - b.model.expectedCalibrationError
  );

  log.info('选择最佳校准方法', {
    selected: methods[0].name,
    ece: methods[0].model.expectedCalibrationError
  });

  return methods[0];
}
