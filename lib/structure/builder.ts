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

// 题目编号正则：支持 1. 1、 1． (1) 等格式
const QUESTION_REGEX = /^(\d+)[\.\、\．\)\]]/;

/**
 * 判断是否是题目开始
 */
function isQuestionStart(text: string): boolean {
  const trimmed = text.trim();
  return QUESTION_REGEX.test(trimmed);
}

/**
 * 提取题目编号
 */
function extractQuestionId(text: string): string | null {
  const match = text.trim().match(QUESTION_REGEX);
  return match ? match[1] : null;
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

  // 识别题目并分组
  const questions: Question[] = [];
  let current: Question | null = null;
  let questionNumber = 0;

  for (const block of sorted) {
    const text = block.text.trim();

    // 检测新题目开始
    if (isQuestionStart(text)) {
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

      log.debug('新题目', { id: current.question_id, text: text.substring(0, 30) });
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

  // 合并文本
  for (const q of questions) {
    q.question = q.question_blocks.map(b => b.text).join(' ');
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
