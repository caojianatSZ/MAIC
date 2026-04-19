// lib/structure/builder.ts
/**
 * 结构重建层 - 题目切分和结构重建
 *
 * 核心功能：
 * 1. 按 bbox 坐标排序 OCR 结果
 * 2. 识别题目边界（数字编号）
 * 3. 分离题干和答案（基于 type: handwriting）
 * 4. 构建标准化的 Question 结构
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('StructureBuilder');

export type BBox = [number, number, number, number]; // [x1, y1, x2, y2]

export interface OCRBlock {
  text: string;
  bbox: BBox;
  type: 'print' | 'handwriting';
  confidence?: number;
}

export interface Question {
  question_id: string;
  question_blocks: OCRBlock[];
  answer_blocks: OCRBlock[];
  question?: string;
  student_answer?: string;
  question_bbox?: BBox;
  answer_bbox?: BBox;
}

// 题目编号正则：支持多种格式
// 1. 数字开头：1. 1、 1． (1) 1(  (物理试卷常见：2(2012·江苏...))
// 2. 年份开头：(2011·江苏·4, 3分) 物理试卷常见
// 3. 括号编号：（1）（2）【1】[1]
const QUESTION_REGEX = /^(\d+)[\s\.\、\．\)\]\(\[]/;
const YEAR_QUESTION_REGEX = /^\((\d{4})/; // 简化：只要以年份开头就是题目
const PAREN_QUESTION_REGEX = /^[【\(]([1-9])[】\)]/;

/**
 * 判断是否是题目开始
 * 增强版本：检查多种题目编号格式
 */
function isQuestionStart(text: string, bbox?: BBox): boolean {
  const trimmed = text.trim();

  // 特殊情况：单独的数字（可能是题号）
  if (/^\d$/.test(trimmed)) return true;

  // 1. 数字编号格式
  if (QUESTION_REGEX.test(trimmed)) return true;

  // 2. 年份格式 - 只要以(4位数字开头就是题目
  if (YEAR_QUESTION_REGEX.test(trimmed)) return true;

  // 3. 括号编号格式：（1）（2）【1】[1]
  if (PAREN_QUESTION_REGEX.test(trimmed)) return true;

  // 4. 罗马数字：I. II. III. IV. V.（物理、数学常见）
  if (/^[IVX]+[\.\s\、\．]/.test(trimmed)) return true;

  // 5. 单个字母 + (如 B( - 物理试卷常见)
  if (/^[A-Z]\(/.test(trimmed)) return true;

  return false;
}

/**
 * 提取题目编号
 * 增强版本：支持多种格式
 */
function extractQuestionId(text: string): string | null {
  const trimmed = text.trim();

  // 1. 数字编号：1. 1、 1． (1) 1(
  const numMatch = trimmed.match(QUESTION_REGEX);
  if (numMatch) return numMatch[1];

  // 2. 括号编号：（1）（2）【1】[1]
  const parenMatch = trimmed.match(PAREN_QUESTION_REGEX);
  if (parenMatch) return parenMatch[1];

  // 3. 罗马数字：I. II. III.
  const romanMatch = trimmed.match(/^([IVX]+)/);
  if (romanMatch) {
    // 罗马数字转阿拉伯数字
    const roman = romanMatch[1];
    const romanMap: Record<string, number> = {
      'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
      'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10
    };
    return romanMap[roman] ? String(romanMap[roman]) : null;
  }

  // 4. 年份编号：不提取分值，返回null让系统自动编号

  return null;
}

/**
 * 计算 bbox 中心点
 */
function center(bbox: BBox): [number, number] {
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
}

/**
 * 按 y → x 排序（从上到下，从左到右）
 */
function sortBlocks(blocks: OCRBlock[]): OCRBlock[] {
  return [...blocks].sort((a, b) => {
    if (a.bbox[1] !== b.bbox[1]) return a.bbox[1] - b.bbox[1];
    return a.bbox[0] - b.bbox[0];
  });
}

/**
 * 从 TextIn 结构化数据转换为 OCRBlock 格式
 */
export function fromTextInStructured(structuredData: any[]): OCRBlock[] {
  if (!structuredData || structuredData.length === 0) {
    return [];
  }

  log.info('从 TextIn 结构化数据转换', { count: structuredData.length });

  const blocks: OCRBlock[] = [];

  // 页眉页脚过滤模式
  const headerFooterPatterns = [
    /^第\s*\d+\s*页/,  // 第X页
    /^\d+\s*\/\s*\d+/, // X/Y 页码
    /^试卷.*?标题/,    // 试卷标题
    /^姓名.*?班级/,    // 学生信息
    /^学校.*?年级/,    // 学校信息
    /^得分.*?评卷人/,  // 分数栏
    /^\d{4}.*?试卷/,   // 年份+试卷
    /^注意事项/,       // 说明文字
    /^说明：/
  ];

  // 检查是否是页眉页脚内容
  function isHeaderFooter(text: string): boolean {
    const trimmed = text.trim();
    if (trimmed.length < 2) return false;
    return headerFooterPatterns.some(pattern => pattern.test(trimmed));
  }

  for (const item of structuredData) {
    // 获取文本内容
    let text = '';
    if (item.text && typeof item.text === 'string') {
      text = item.text;
    } else if (item.content) {
      if (typeof item.content === 'string') {
        text = item.content;
      } else if (Array.isArray(item.content)) {
        text = item.content.map((c: any) => typeof c === 'string' ? c : '').join('');
      }
    }

    if (!text || text.trim().length === 0) continue;

    // 过滤页眉页脚
    if (isHeaderFooter(text)) {
      log.debug('过滤页眉页脚', { text: text.substring(0, 30) });
      continue;
    }

    // 获取位置信息（TextIn 返回四边形4个角点：[x1,y1, x2,y2, x3,y3, x4,y4]）
    const pos = item.pos || [];

    // 正确计算 bbox：取所有点的 minX, minY, maxX, maxY
    // TextIn 的 pos 是四边形的四个角点，需要计算出包围盒
    const xs = [pos[0], pos[2], pos[4], pos[6]].filter(x => x !== undefined && x !== null);
    const ys = [pos[1], pos[3], pos[5], pos[7]].filter(y => y !== undefined && y !== null);

    const bbox: BBox = [
      xs.length > 0 ? Math.min(...xs) : 0,      // minX
      ys.length > 0 ? Math.min(...ys) : 0,      // minY
      xs.length > 0 ? Math.max(...xs) : 0,      // maxX
      ys.length > 0 ? Math.max(...ys) : 0       // maxY ← 修复：取最大Y而不是pos[3]
    ];

    // 判断类型：默认是 print，如果有特殊标记可能是 handwriting
    // TextIn 可能不直接区分手写，这里简化处理
    const type: 'print' | 'handwriting' = 'print';

    blocks.push({
      text: text.trim(),
      bbox,
      type,
      confidence: 0.9 // TextIn 的置信度在 content 数组中
    });
  }

  log.info('转换完成', { blockCount: blocks.length });
  return blocks;
}

/**
 * 重建题目结构（核心函数）
 *
 * @param blocks OCR 识别的文本块
 * @returns 重建后的题目列表
 */
export function rebuildStructure(blocks: OCRBlock[]): Question[] {
  if (!blocks || blocks.length === 0) {
    log.warn('rebuildStructure: 空 blocks');
    return [];
  }

  log.info('开始重建结构', { blockCount: blocks.length });

  // 按位置排序（先过滤异常blocks）
  const filteredBlocks = blocks.filter(b => {
    const text = b.text.trim();
    const y = b.bbox[1];

    // 放宽过滤条件，避免过滤掉有效题目

    // 1. Y坐标太小（可能是页眉页脚）- 放宽阈值
    if (y < 200) return false;

    // 2. 空文本
    if (text.length === 0) return false;

    // 3. 单个标点符号
    if (/^[，。、；：,.;:]$/.test(text)) return false;

    // 4. 明显的页码格式（保留边距）
    if (/^\d+\s*\/\s*\d+$/.test(text)) return false;  // X/Y格式
    if (/^第\s*\d+\s*页$/.test(text)) return false;    // 第X页

    return true;
  });

  log.info('过滤blocks', { before: blocks.length, after: filteredBlocks.length });

  let sorted = sortBlocks(filteredBlocks);

  // 预处理：合并单独的题号和题目内容
  // 例如："3" 和 "（2011·江苏·4,3分）..." 应该是同一个题目
  const merged: OCRBlock[] = [];
  const skipIndices = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    if (skipIndices.has(i)) continue;

    const current = sorted[i];
    const currentText = current.text.trim();

    // 检查是否是单独的数字题号
    if (/^\d$/.test(currentText) && i + 1 < sorted.length) {
      const next = sorted[i + 1];
      const nextY = next.bbox[1];
      const currentBottom = current.bbox[3];
      const yDistance = nextY - currentBottom;

      // 如果下一个block在很近的Y坐标（<15像素），合并它们
      if (yDistance >= 0 && yDistance < 15) {
        const mergedText = `${currentText} ${next.text}`;
        merged.push({
          ...current,
          text: mergedText,
          bbox: [
            current.bbox[0],
            current.bbox[1],
            next.bbox[2],
            next.bbox[3]
          ]
        });
        skipIndices.add(i + 1); // 跳过下一个block
        log.debug('合并题号和内容', {
          number: currentText,
          content: next.text.substring(0, 30),
          yDistance
        });
        continue;
      }
    }

    merged.push(current);
  }

  sorted = merged;
  log.info('预处理完成', { beforeCount: filteredBlocks.length, afterCount: sorted.length });

  // 调试：记录前15个文本块
  log.info('文本块预览（前15个）', {
    totalBlocks: sorted.length,
    blocks: sorted.slice(0, 15).map(b => ({
      text: b.text.substring(0, 50),
      y: b.bbox[1],
      bottom: b.bbox[3],
      isQuestionStart: isQuestionStart(b.text, b.bbox)
    }))
  });

  // 保存完整blocks数据用于调试
  try {
    const fs = require('fs');
    const path = require('path');
    const debugDir = path.join(process.cwd(), 'logs', 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    const debugFile = path.join(debugDir, `structure_${Date.now()}.json`);
    fs.writeFileSync(debugFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      blockCount: blocks.length,
      blocks: blocks.map(b => ({
        text: b.text,
        bbox: b.bbox,
        type: b.type
      }))
    }, null, 2), 'utf8');
    log.info('结构重建blocks已保存', { debugFile });
  } catch (fsError) {
    // 忽略文件系统错误
  }

  // 识别题目并分组
  const questions: Question[] = [];
  let current: Question | null = null;
  let questionNumber = 0;
  let lastQuestionY = 0; // 上一道题的 Y 坐标
  let lastBlockY = 0; // 上一个块的 Y 坐标

  // 题目之间的最小距离（像素），小于此距离可能是同一道题的选项
  const MIN_QUESTION_GAP = 50;

  // 计算 Y 坐标跳跃阈值（自适应）
  const yGaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].bbox[1] - sorted[i - 1].bbox[3];
    if (gap > 0) yGaps.push(gap);
  }

  if (yGaps.length > 0) {
    yGaps.sort((a, b) => a - b);
    const medianGap = yGaps[Math.floor(yGaps.length / 2)];
    // 使用中位数的2倍作为跳跃阈值
    var Y_GAP_THRESHOLD = medianGap * 2;
    // 最小阈值保护
    Y_GAP_THRESHOLD = Math.max(Y_GAP_THRESHOLD, 60);
    // 最大阈值保护
    Y_GAP_THRESHOLD = Math.min(Y_GAP_THRESHOLD, 200);
  } else {
    var Y_GAP_THRESHOLD = 80; // 默认阈值
  }

  log.info('Y坐标跳跃阈值', {
    Y_GAP_THRESHOLD,
    gapCount: yGaps.length,
    medianGap: yGaps.length > 0 ? Math.round(yGaps[Math.floor(yGaps.length / 2)]) : 0,
    sampleGaps: yGaps.slice(0, 10).map(g => Math.round(g))
  });

  for (const block of sorted) {
    const text = block.text.trim();
    const blockY = block.bbox[1];
    const blockBottom = block.bbox[3];

    // 计算与上一个块的Y间隙
    const yGap = lastBlockY > 0 ? blockY - lastBlockY : 0;

    // 检测新题目开始（改进：优先使用题号特征）
    // 1. 有明确的题号格式 -> 无论如何都开始新题目
    // 2. Y坐标有显著跳跃 && 当前有题目 -> 可能是无题号的题目
    const hasQuestionNumber = isQuestionStart(text, block.bbox);
    const hasBigYGap = yGap > Y_GAP_THRESHOLD;

    if (hasQuestionNumber) {
      // 有明确题号，立即开始新题目（不管Y间隙大小）
      // 检查是否与上一题太近（可能是选项被误识别）
      const isTooClose = lastQuestionY > 0 && (blockY - lastQuestionY) < MIN_QUESTION_GAP;

      if (!isTooClose) {
        // 保存上一题
        if (current) {
          questions.push(current);
        }

        const qId = extractQuestionId(text);
        questionNumber = qId ? parseInt(qId, 10) : questionNumber + 1;

        current = {
          question_id: String(questionNumber),
          question_blocks: [block],
          answer_blocks: [],
          question_bbox: block.bbox
        };

        lastQuestionY = blockY;

        log.debug('新题目（题号）', {
          id: current.question_id,
          text: text.substring(0, 30),
          y: blockY,
          extractedId: qId
        });
      } else {
        // 太近了，可能是选项，添加到当前题目
        if (current) {
          current.question_blocks.push(block);
          log.debug('跳过太近的题号', { text: text.substring(0, 30), y: blockY });
        }
      }
    } else if (hasBigYGap && current) {
      // 检查是否与上一题太近（可能是选项被误识别）
      const isTooClose = lastQuestionY > 0 && (blockY - lastQuestionY) < MIN_QUESTION_GAP;

      if (!isTooClose) {
        // 保存上一题
        if (current) {
          questions.push(current);
        }

        const qId = extractQuestionId(text);
        questionNumber = qId ? parseInt(qId, 10) : questionNumber + 1;

        current = {
          question_id: String(questionNumber),
          question_blocks: [block],
          answer_blocks: [],
          question_bbox: block.bbox
        };

        lastQuestionY = blockY;

        log.debug('新题目', {
          id: current.question_id,
          text: text.substring(0, 30),
          y: blockY,
          hasQuestionNumber,
          hasBigYGap,
          yGap
        });
      } else {
        // 太近了，可能是选项，添加到当前题目
        if (current) {
          current.question_blocks.push(block);
          log.debug('跳过太近的"题目编号"', { text: text.substring(0, 30), y: blockY });
        }
      }
    } else if (current) {
      // 添加到当前题目
      if (block.type === 'handwriting') {
        current.answer_blocks.push(block);
      } else {
        current.question_blocks.push(block);
      }
    } else {
      // 还没有开始第一题，跳过
      log.debug('跳过题目前的文本', { text: text.substring(0, 30) });
    }

    // 更新上一个块的Y坐标（使用bottom而不是top，因为我们要计算间隙）
    lastBlockY = blockBottom;
  }

  // 保存最后一题
  if (current) {
    questions.push(current);
  }

  // 合并文本（智能处理公式）
  for (const q of questions) {
    q.question = smartJoinBlocks(q.question_blocks);
    q.student_answer = q.answer_blocks.map(b => b.text).join(' ');

    // 计算答案的 bbox（合并所有答案块）
    if (q.answer_blocks.length > 0) {
      const bboxes = q.answer_blocks.map(b => b.bbox);
      const x1 = Math.min(...bboxes.map(b => b[0]));
      const y1 = Math.min(...bboxes.map(b => b[1]));
      const x2 = Math.max(...bboxes.map(b => b[2]));
      const y2 = Math.max(...bboxes.map(b => b[3]));
      q.answer_bbox = [x1, y1, x2, y2];
    }
  }

  // 详细日志：显示所有识别到的题目
  log.info('结构重建完成', {
    questionCount: questions.length,
    questions: questions.map(q => ({
      id: q.question_id,
      preview: q.question?.substring(0, 80) || '',
      blockCount: q.question_blocks.length,
      hasAnswer: q.answer_blocks.length > 0,
      y: q.question_bbox?.[1]
    }))
  });

  return questions;
}

/**
 * 智能合并文本块，保留公式完整性
 */
function smartJoinBlocks(blocks: OCRBlock[]): string {
  if (blocks.length === 0) return '';

  const result: string[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const current = blocks[i].text;
    const prev = i > 0 ? blocks[i - 1].text : '';
    const next = i < blocks.length - 1 ? blocks[i + 1].text : '';

    // 检查是否需要添加空格
    let needSpace = false;

    // 当前文本以 $ 开头（公式开始），且前一个文本不是公式结束
    if (current.startsWith('$') && !prev.endsWith('$')) {
      needSpace = true;
    }
    // 前一个文本以 $ 结束（公式结束），且当前文本不是标点符号
    else if (prev.endsWith('$') && !/^[,.，。、:：;；）\)]/.test(current)) {
      needSpace = true;
    }
    // 普通文本之间的连接
    else if (i > 0 && !prev.endsWith('$') && !current.startsWith('$')) {
      // 检查是否需要在中文和数字/字母之间加空格
      const hasChineseEnd = /[\u4e00-\u9fa5]$/.test(prev);
      const hasAlphaNumStart = /^[a-zA-Z0-9]/.test(current);
      if (hasChineseEnd && hasAlphaNumStart) {
        needSpace = true;
      }
    }

    if (i > 0 && needSpace) {
      result.push(' ');
    }
    result.push(current);
  }

  return result.join('');
}
