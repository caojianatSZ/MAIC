// lib/structure/matcher.ts
/**
 * 答案匹配算法 - 基于 bbox + 空间关系
 *
 * 核心逻辑：
 * 1. 优先右侧（答案通常在题目右侧）
 * 2. 次选下方
 * 3. 距离最小
 * 4. 避免跨题（不能匹配到下一题的区域）
 */

import { createLogger } from '@/lib/logger';
import type { Question, OCRBlock, BBox } from './builder';

const log = createLogger('StructureMatcher');

/**
 * 计算 bbox 中心点
 */
function center(bbox: BBox): [number, number] {
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
}

/**
 * 计算两个 bbox 之间的距离分数
 *
 * 规则：
 * - 右侧优先（dx > 0）：分数 *= 0.8
 * - 左上直接丢弃（dx < -50 或 dy < -30）：返回 Infinity
 * - 使用欧几里得距离
 */
function distanceScore(qBox: BBox, aBox: BBox): number {
  const [qx, qy] = center(qBox);
  const [ax, ay] = center(aBox);

  const dx = ax - qx;
  const dy = ay - qy;

  // 左上直接丢弃（答案不可能在题目左边或上边）
  if (dx < -50 || dy < -30) return Infinity;

  let dist = Math.sqrt(dx * dx + dy * dy);

  // 右侧优先（答案通常在右侧）
  if (dx > 0) dist *= 0.8;

  return dist;
}

/**
 * 检测答案块是否跨越到下一题
 */
function crossesNextQuestion(
  answerBox: BBox,
  nextQuestionBox: BBox
): boolean {
  // 如果答案块的顶部超过下一题的顶部，说明可能跨题
  return answerBox[1] > nextQuestionBox[1];
}

/**
 * 匹配答案到题目
 *
 * @param questions 题目列表
 * @param handwritingBlocks 手写答案块
 * @returns 匹配后的题目列表
 */
export function matchAnswers(
  questions: Question[],
  handwritingBlocks: OCRBlock[]
): Question[] {
  if (questions.length === 0) {
    log.warn('matchAnswers: 没有题目');
    return questions;
  }

  if (handwritingBlocks.length === 0) {
    log.info('matchAnswers: 没有手写答案');
    return questions;
  }

  log.info('开始匹配答案', {
    questionCount: questions.length,
    answerCount: handwritingBlocks.length
  });

  // 为每个答案找到最合适的题目
  for (const ans of handwritingBlocks) {
    let bestQ: Question | null = null;
    let bestScore = Infinity;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];

      // 获取题目的 bbox（使用最后一个题干块）
      const qBox = q.question_bbox || q.question_blocks[q.question_blocks.length - 1]?.bbox;

      if (!qBox) continue;

      // 检查是否跨到下一题
      if (i < questions.length - 1) {
        const nextQ = questions[i + 1];
        const nextQBox = nextQ.question_bbox || nextQ.question_blocks[0]?.bbox;
        if (nextQBox && crossesNextQuestion(ans.bbox, nextQBox)) {
          log.debug('跳过跨题答案', { answer: ans.text.substring(0, 20) });
          continue;
        }
      }

      const score = distanceScore(qBox, ans.bbox);

      if (score < bestScore) {
        bestScore = score;
        bestQ = q;
      }
    }

    if (bestQ && bestScore < Infinity) {
      bestQ.answer_blocks.push(ans);
      log.debug('匹配答案', {
        questionId: bestQ.question_id,
        answer: ans.text.substring(0, 20),
        score: bestScore
      });
    } else {
      log.debug('未匹配的答案', { answer: ans.text.substring(0, 20) });
    }
  }

  // 重新合并答案文本
  for (const q of questions) {
    if (q.answer_blocks.length > 0) {
      q.student_answer = q.answer_blocks.map(b => b.text).join(' ');

      // 更新答案 bbox
      const bboxes = q.answer_blocks.map(b => b.bbox);
      const x1 = Math.min(...bboxes.map(b => b[0]));
      const y1 = Math.min(...bboxes.map(b => b[1]));
      const x2 = Math.max(...bboxes.map(b => b[2]));
      const y2 = Math.max(...bboxes.map(b => b[3]));
      q.answer_bbox = [x1, y1, x2, y2];
    }
  }

  log.info('答案匹配完成', {
    matchedCount: questions.filter(q => q.answer_blocks.length > 0).length
  });

  return questions;
}

/**
 * 计算匹配置信度
 */
export function computeMatchConfidence(question: Question): number {
  if (question.answer_blocks.length === 0) {
    return 0;
  }

  // 简单的置信度计算：
  // - 答案数量适中（1-3 个）→ 高置信度
  // - 答案太多（>5 个）→ 低置信度（可能匹配错误）
  const count = question.answer_blocks.length;

  if (count === 1) return 0.95;
  if (count === 2) return 0.90;
  if (count === 3) return 0.85;
  if (count <= 5) return 0.70;
  return 0.50;
}
