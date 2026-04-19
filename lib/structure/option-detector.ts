// lib/structure/option-detector.ts
/**
 * 选项检测与归属模块
 *
 * 核心功能：
 * 1. 检测选项块（A. B. C. D.）
 * 2. 将选项归属到正确的题目
 * 3. 验证选项组的完整性
 */

import { createLogger } from '@/lib/logger';
import type { BBox, OCRBlock } from './spatial-cluster';

const log = createLogger('OptionDetector');

/**
 * 选项组
 */
export interface OptionGroup {
  /** 选项标记（A, B, C, D） */
  label: string;
  /** 选项内容 */
  content: string;
  /** 选项块的 bbox */
  bbox: BBox;
  /** Y 坐标 */
  y: number;
}

/**
 * 带选项的题目
 */
export interface QuestionWithOptions {
  /** 题目 ID */
  questionId: string;
  /** 题干块 */
  questionBlocks: OCRBlock[];
  /** 题干的 bbox */
  questionBbox: BBox;
  /** 选项组 */
  options: OptionGroup[];
  /** 完整的 bbox（包含选项） */
  fullBbox: BBox;
}

/**
 * 选项检测选项
 */
export interface OptionDetectorOptions {
  /** 选项与题干的最大 Y 距离（默认 300px） */
  maxYDistance?: number;
  /** 选项的最小数量（默认 2） */
  minOptions?: number;
  /** 选项的最大数量（默认 6） */
  maxOptions?: number;
  /** 调试模式 */
  debug?: boolean;
}

/**
 * 检测选项块
 */
export function detectOptions(blocks: OCRBlock[]): OptionGroup[] {
  const options: OptionGroup[] = [];

  for (const block of blocks) {
    const trimmed = block.text.trim();
    const optionMatch = trimmed.match(/^([A-D])[.．、)\]\s]+(.*)/);

    if (optionMatch) {
      const [, label, content] = optionMatch;
      options.push({
        label,
        content: content.trim(),
        bbox: block.bbox,
        y: block.bbox[1]
      });
    }
  }

  return options.sort((a, b) => a.y - b.y);
}

/**
 * 将选项归属到题目
 */
export function groupOptionsByQuestion(
  clusters: Array<{
    blocks: OCRBlock[];
    bbox: BBox;
    startY: number;
    endY: number;
  }>,
  allBlocks: OCRBlock[],
  options: OptionDetectorOptions = {}
): Array<{
  blocks: OCRBlock[];
  bbox: BBox;
  startY: number;
  endY: number;
  options: OptionGroup[];
}> {
  const {
    maxYDistance = 300,
    minOptions = 2,
    debug = false
  } = options;

  // 检测所有选项
  const allOptions = detectOptions(allBlocks);

  if (allOptions.length === 0) {
    if (debug) {
      log.info('未检测到选项');
    }
    return clusters.map(c => ({ ...c, options: [] }));
  }

  if (debug) {
    log.info('检测到选项', { count: allOptions.length });
  }

  // 为每个聚类分配选项
  const result: Array<{
    blocks: OCRBlock[];
    bbox: BBox;
    startY: number;
    endY: number;
    options: OptionGroup[];
  }> = [];

  for (const cluster of clusters) {
    const clusterOptions: OptionGroup[] = [];
    const clusterBottom = cluster.endY;

    // 找到在聚类下方附近的选项
    for (const option of allOptions) {
      const distance = option.y - clusterBottom;

      // 选项必须在聚类下方一定距离内
      if (distance >= -50 && distance <= maxYDistance) {
        clusterOptions.push(option);
      }
    }

    // 验证选项组
    const validOptions = validateOptionGroup(clusterOptions, { minOptions });

    result.push({
      ...cluster,
      options: validOptions
    });
  }

  return result;
}

/**
 * 验证选项组
 */
export function validateOptionGroup(
  options: OptionGroup[],
  config: { minOptions?: number; maxOptions?: number } = {}
): OptionGroup[] {
  const { minOptions = 2, maxOptions = 6 } = config;

  // 检查数量
  if (options.length < minOptions || options.length > maxOptions) {
    return []; // 无效的选项组
  }

  // 检查标签是否连续（A, B, C, D）
  const labels = options.map(o => o.label);
  const expectedLabels = generateOptionLabels(options.length);

  // 至少有一半的标签符合预期
  const matchCount = labels.filter(l => expectedLabels.includes(l)).length;
  if (matchCount < Math.ceil(options.length / 2)) {
    return []; // 标签不符合预期
  }

  return options;
}

/**
 * 生成选项标签
 */
function generateOptionLabels(count: number): string[] {
  const labels: string[] = [];
  for (let i = 0; i < count && i < 26; i++) {
    labels.push(String.fromCharCode(65 + i)); // A, B, C, D, ...
  }
  return labels;
}

/**
 * 检测是否是选择题
 */
export function isChoiceQuestion(blocks: OCRBlock[]): boolean {
  const options = detectOptions(blocks);
  return options.length >= 2;
}

/**
 * 提取选项内容（去除标记）
 */
export function extractOptionContent(optionText: string): string {
  const match = optionText.match(/^[A-D][.．、)\]\s]+(.*)/);
  return match ? match[1].trim() : optionText.trim();
}

/**
 * 格式化选项为字符串
 */
export function formatOptions(options: OptionGroup[]): string {
  return options
    .sort((a, b) => a.label.localeCompare(b.label))
    .map(o => `${o.label}. ${o.content}`)
    .join('\n');
}
