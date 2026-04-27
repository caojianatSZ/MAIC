/**
 * 知识点提取服务
 *
 * 使用 eduKG 知识链接接口从题目中自动提取知识点
 */

import { createLogger } from '@/lib/logger';
import { edukgAdapter } from '@/lib/edukg/adapter';

const log = createLogger('KnowledgeExtractor');

/**
 * eduKG 知识点信息
 */
export interface EduKGKnowledgePoint {
  uri: string;
  name: string;
  classList: Array<{ id: string; label: string }>;
  abstractMessage?: string;
  where?: number[][];
}

/**
 * 知识点提取结果
 */
export interface KnowledgeExtractionResult {
  knowledgePoints: EduKGKnowledgePoint[];
  primaryKnowledgePoint?: EduKGKnowledgePoint;  // 主知识点（第一个或最相关的）
  subject: string;  // 推断的科目
}

/**
 * 从题目中提取知识点
 *
 * @param questionContent 题目内容
 * @param subjectHint 科目提示（可选）
 * @returns 知识点提取结果
 */
export async function extractKnowledgePoints(
  questionContent: string,
  subjectHint?: string
): Promise<KnowledgeExtractionResult> {
  try {
    log.info('开始提取知识点', {
      contentLength: questionContent.length,
      subjectHint
    });

    // 调用 eduKG 知识链接接口
    const knowledgePoints = await edukgAdapter.extractKnowledgePointsFromText(questionContent);

    if (knowledgePoints.length === 0) {
      log.info('未识别到知识点');
      return {
        knowledgePoints: [],
        subject: subjectHint || 'unknown'
      };
    }

    log.info(`识别到 ${knowledgePoints.length} 个知识点`, {
      knowledgePoints: knowledgePoints.map(kp => ({
        uri: kp.uri,
        name: kp.name,
        classLabel: kp.classList[0]?.label
      }))
    });

    // 确定主知识点（选择第一个或最相关的）
    let primaryKnowledgePoint = knowledgePoints[0];

    // 如果有多个知识点，尝试选择最相关的一个
    if (knowledgePoints.length > 1) {
      // 优先选择 "概念" 类别的知识点
      const conceptPoint = knowledgePoints.find(kp =>
        kp.classList.some(cls => cls.label.includes('概念') || cls.label.includes('定理'))
      );
      if (conceptPoint) {
        primaryKnowledgePoint = conceptPoint;
      }
    }

    // 推断科目（从知识点的 classList 中提取）
    const subject = inferSubject(knowledgePoints, subjectHint);

    return {
      knowledgePoints,
      primaryKnowledgePoint,
      subject
    };
  } catch (error) {
    log.error('知识点提取失败', { error });
    return {
      knowledgePoints: [],
      subject: subjectHint || 'unknown'
    };
  }
}

/**
 * 推断科目
 */
function inferSubject(
  knowledgePoints: EduKGKnowledgePoint[],
  hint?: string
): string {
  // 如果有提示，优先使用
  if (hint) {
    return normalizeSubject(hint);
  }

  // 从知识点 URI 中推断
  for (const kp of knowledgePoints) {
    // eduKG URI 格式可能包含科目信息
    if (kp.uri.includes('数学') || kp.name.includes('函数') || kp.name.includes('方程')) {
      return 'math';
    }
    if (kp.uri.includes('英语') || kp.uri.includes('English')) {
      return 'english';
    }
    if (kp.uri.includes('语文') || kp.uri.includes('Chinese')) {
      return 'chinese';
    }
    if (kp.uri.includes('物理')) {
      return 'physics';
    }
    if (kp.uri.includes('化学')) {
      return 'chemistry';
    }
  }

  return 'unknown';
}

/**
 * 标准化科目名称
 */
function normalizeSubject(subject: string): string {
  const map: Record<string, string> = {
    '数学': 'math',
    'math': 'math',
    '英语': 'english',
    'english': 'english',
    '语文': 'chinese',
    'chinese': 'chinese',
    '物理': 'physics',
    'physics': 'physics',
    '化学': 'chemistry',
    'chemistry': 'chemistry',
    '生物': 'biology',
    'biology': 'biology',
  };

  return map[subject.toLowerCase()] || subject.toLowerCase();
}

/**
 * 从批量题目中提取知识点
 *
 * @param questions 题目列表
 * @returns 每道题的知识点提取结果
 */
export async function extractKnowledgePointsFromBatch(
  questions: Array<{ id: string; content: string; subject?: string }>
): Promise<Map<string, KnowledgeExtractionResult>> {
  const results = new Map<string, KnowledgeExtractionResult>();

  // 并行提取（限制并发数）
  const batchSize = 5;
  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize);
    const promises = batch.map(async (question) => {
      const result = await extractKnowledgePoints(question.content, question.subject);
      return { questionId: question.id, result };
    });

    const batchResults = await Promise.all(promises);
    for (const { questionId, result } of batchResults) {
      results.set(questionId, result);
    }
  }

  log.info(`批量提取完成: ${results.size} 道题`);
  return results;
}

/**
 * 汇总知识点统计
 *
 * @param extractionResults 多道题的知识点提取结果
 * @returns 知识点汇总统计
 */
export function summarizeKnowledgePoints(
  extractionResults: KnowledgeExtractionResult[]
): {
  weak: string[];      // 出现频率高的知识点（可能薄弱）
  all: string[];       // 所有涉及的知识点
  bySubject: Record<string, string[]>;  // 按科目分组
} {
  const kpCount = new Map<string, number>();
  const kpBySubject = new Map<string, Set<string>>();
  const allKps = new Set<string>();

  for (const result of extractionResults) {
    for (const kp of result.knowledgePoints) {
      const key = kp.uri;
      kpCount.set(key, (kpCount.get(key) || 0) + 1);
      allKps.add(key);

      if (!kpBySubject.has(result.subject)) {
        kpBySubject.set(result.subject, new Set());
      }
      kpBySubject.get(result.subject)!.add(key);
    }
  }

  // 按出现频率排序，出现多的可能是薄弱点
  const weak = Array.from(kpCount.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([uri]) => uri);

  const bySubject: Record<string, string[]> = {};
  for (const [subject, kps] of kpBySubject) {
    bySubject[subject] = Array.from(kps);
  }

  return {
    weak,
    all: Array.from(allKps),
    bySubject
  };
}
