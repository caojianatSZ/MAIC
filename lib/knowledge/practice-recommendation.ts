/**
 * 练习题推荐服务
 *
 * 基于 eduKG findQuestion API 为弱项知识点推荐练习题
 */

import { edukgAdapter } from '@/lib/edukg/adapter';
import { createLogger } from '@/lib/logger';

const log = createLogger('PracticeRecommendation');

/**
 * 推荐练习题
 */
export interface PracticeQuestion {
  id: string;
  question: string;
  type: string;
  options: string[];
  answer: string;
  analysis: string;
  subject: string;
  grade: string;
  difficulty: number;
  source?: string;
}

/**
 * 推荐结果
 */
export interface PracticeRecommendation {
  knowledgeUri: string;
  knowledgeName: string;
  questions: PracticeQuestion[];
  count: number;
}

/**
 * 为知识点推荐练习题
 *
 * @param knowledgeName 知识点名称
 * @param options 选项
 */
export async function recommendPracticeQuestions(
  knowledgeName: string,
  options: {
    subject?: string;
    type?: string;  // 题目类型：选择题, 填空题, 解答题
    grade?: string;
    pageSize?: number;
  } = {}
): Promise<PracticeRecommendation> {
  const {
    subject,
    type = '选择题',
    pageSize = 10,
  } = options;

  try {
    log.info('推荐练习题', { knowledgeName, subject, type, pageSize });

    // 调用 eduKG getQuestions
    const questions = await edukgAdapter.getQuestions(knowledgeName, {
      type,
      pageNo: 1,
      pageSize,
    });

    log.info('获取到练习题', { count: questions.length });

    return {
      knowledgeUri: '',  // 由调用方填充
      knowledgeName,
      questions: questions.map(q => ({
        id: q.id,
        question: q.question,
        type: q.type,
        options: q.options,
        answer: q.answer,
        analysis: q.analysis,
        subject: q.subject || subject || '',
        grade: q.grade || '',
        difficulty: q.difficulty,
        source: q.source,
      })),
      count: questions.length,
    };

  } catch (error) {
    log.error('推荐练习题失败', {
      error: error instanceof Error ? error.message : String(error)
    });
    // 返回空结果而不是抛出错误
    return {
      knowledgeUri: '',
      knowledgeName,
      questions: [],
      count: 0,
    };
  }
}

/**
 * 批量推荐练习题
 *
 * @param knowledgePoints 知识点列表
 * @param options 选项
 */
export async function batchRecommendPracticeQuestions(
  knowledgePoints: Array<{ uri: string; name: string; subject: string }>,
  options: {
    type?: string;
    questionsPerPoint?: number;
  } = {}
): Promise<PracticeRecommendation[]> {
  const {
    type = '选择题',
    questionsPerPoint = 5,
  } = options;

  try {
    log.info('批量推荐练习题', { count: knowledgePoints.length });

    // 限制并发数量
    const concurrency = 3;
    const results: PracticeRecommendation[] = [];

    for (let i = 0; i < knowledgePoints.length; i += concurrency) {
      const batch = knowledgePoints.slice(i, i + concurrency);
      const recommendations = await Promise.all(
        batch.map(kp =>
          recommendPracticeQuestions(kp.name, {
            subject: kp.subject,
            type,
            pageSize: questionsPerPoint,
          })
        )
      );

      for (let j = 0; j < recommendations.length; j++) {
        results.push({
          ...recommendations[j],
          knowledgeUri: batch[j].uri,
        });
      }
    }

    log.info('批量推荐完成', { total: results.length });
    return results;

  } catch (error) {
    log.error('批量推荐练习题失败', {
      error: error instanceof Error ? error.message : String(error)
    });
    return [];
  }
}

/**
 * 为弱项知识点生成练习集
 *
 * @param userId 用户ID
 * @param weakPoints 弱项知识点列表
 */
export async function generatePracticeSet(
  userId: string,
  weakPoints: Array<{
    uri: string;
    name: string;
    subject: string;
    grade?: string;
  }>
): Promise<{
  practiceSet: Array<{
    knowledgePoint: {
      uri: string;
      name: string;
      subject: string;
    };
    questions: PracticeQuestion[];
  }>;
  totalQuestions: number;
}> {
  try {
    log.info('生成练习集', { userId, weakPointsCount: weakPoints.length });

    const recommendations = await batchRecommendPracticeQuestions(weakPoints, {
      type: '选择题',
      questionsPerPoint: 5,
    });

    // 过滤掉没有题目的推荐
    const practiceSet = recommendations
      .filter(r => r.questions.length > 0)
      .map(r => ({
        knowledgePoint: {
          uri: r.knowledgeUri,
          name: r.knowledgeName,
          subject: r.questions[0]?.subject || '',
        },
        questions: r.questions,
      }));

    const totalQuestions = practiceSet.reduce((sum, p) => sum + p.questions.length, 0);

    log.info('练习集生成完成', { practiceSets: practiceSet.length, totalQuestions });

    return {
      practiceSet,
      totalQuestions,
    };

  } catch (error) {
    log.error('生成练习集失败', {
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      practiceSet: [],
      totalQuestions: 0,
    };
  }
}
