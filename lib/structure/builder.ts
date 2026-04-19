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
const QUESTION_REGEX = /^(\d+)[\s\.\、\．\)\]\(]/;
const YEAR_QUESTION_REGEX = /^\((\d{4}).*?[\.,，]\s*\d+\s*[分分]/;

/**
 * 判断是否是题目开始
 */
function isQuestionStart(text: string): boolean {
  const trimmed = text.trim();
  return QUESTION_REGEX.test(trimmed) || YEAR_QUESTION_REGEX.test(trimmed);
}

/**
 * 提取题目编号
 */
function extractQuestionId(text: string): string | null {
  const trimmed = text.trim();

  // 先尝试数字编号
  const numMatch = trimmed.match(QUESTION_REGEX);
  if (numMatch) return numMatch[1];

  // 尝试年份编号（从年份中提取题号）
  const yearMatch = trimmed.match(/\((\d{4}).*?[\.,，]\s*(\d+)\s*[分分]/);
  if (yearMatch) return yearMatch[2]; // 返回题号

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

    // 获取位置信息
    const pos = item.pos || [];
    const bbox: BBox = [
      pos[0] || 0,
      pos[1] || 0,
      pos[2] || pos[0] || 0,
      pos[3] || pos[1] || 0
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

  // 按位置排序
  const sorted = sortBlocks(blocks);

  // 调试：记录前10个文本块
  log.info('文本块预览（前10个）', {
    blocks: sorted.slice(0, 10).map(b => ({
      text: b.text.substring(0, 50),
      y: b.bbox[1],
      isQuestionStart: isQuestionStart(b.text)
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

  // 题目之间的最小距离（像素），小于此距离可能是同一道题的选项
  const MIN_QUESTION_GAP = 50;

  for (const block of sorted) {
    const text = block.text.trim();
    const blockY = block.bbox[1];

    // 检测新题目开始
    if (isQuestionStart(text)) {
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

        log.debug('新题目', { id: current.question_id, text: text.substring(0, 30), y: blockY });
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

  log.info('结构重建完成', { questionCount: questions.length });

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
