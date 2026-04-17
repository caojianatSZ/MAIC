/**
 * 错题本服务
 * 负责错题记录的保存、查询、更新和复核功能
 */

import { createLogger } from '@/lib/logger';
import { PrismaClient } from '@prisma/client';

const log = createLogger('WrongQuestionsService');

// 使用全局变量避免在开发环境中创建多个 Prisma Client 实例
const globalForPrisma = global as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * 知识点信息
 */
export interface KnowledgePoint {
  id: string;
  name: string;
  masteryLevel: 'mastered' | 'partial' | 'weak';
}

/**
 * 错题输入数据
 */
export interface WrongQuestionInput {
  userId: string;
  questionId: string;
  subject: string;
  questionContent: string;
  studentAnswer?: string;
  correctAnswer?: string;
  analysis?: string;
  knowledgePoints?: KnowledgePoint[];
  isCorrect: boolean;
  needsReview?: boolean;
  confidence?: number;
}

/**
 * 错题查询选项
 */
export interface WrongQuestionQueryOptions {
  subject?: string;
  mastered?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * 保存或更新错题
 *
 * 规则：
 * - 答案正确且无需复核的题目不保存到错题本
 * - 已存在的错题更新错误次数、学生答案和解析
 * - 新错题创建记录
 */
export async function saveWrongQuestion(input: WrongQuestionInput): Promise<void> {
  try {
    // 答案正确且无需复核的题目不保存到错题本
    if (input.isCorrect && !input.needsReview) {
      log.info('答案正确且无需复核，不保存到错题本', {
        userId: input.userId,
        questionId: input.questionId
      });
      return;
    }

    // 查找是否已存在该错题记录
    const existing = await prisma.wrongQuestion.findUnique({
      where: {
        userId_questionId: {
          userId: input.userId,
          questionId: input.questionId
        }
      }
    });

    if (existing) {
      // 更新现有记录
      await prisma.wrongQuestion.update({
        where: { id: existing.id },
        data: {
          wrongCount: { increment: 1 },
          studentAnswer: input.studentAnswer,
          correctAnswer: input.correctAnswer,
          analysis: input.analysis,
          knowledgePoints: input.knowledgePoints as any,
          needsReview: input.needsReview || existing.needsReview,
          confidence: input.confidence,
          updatedAt: new Date()
        }
      });
      log.info('更新错题记录', {
        userId: input.userId,
        questionId: input.questionId,
        wrongCount: existing.wrongCount + 1
      });
    } else {
      // 创建新记录
      await prisma.wrongQuestion.create({
        data: {
          userId: input.userId,
          questionId: input.questionId,
          subject: input.subject,
          questionContent: input.questionContent,
          studentAnswer: input.studentAnswer,
          correctAnswer: input.correctAnswer,
          analysis: input.analysis,
          knowledgePoints: input.knowledgePoints as any,
          wrongCount: 1,
          mastered: false,
          needsReview: input.needsReview || false,
          confidence: input.confidence
        }
      });
      log.info('创建错题记录', {
        userId: input.userId,
        questionId: input.questionId
      });
    }

  } catch (error) {
    log.error('保存错题失败', error);
    throw error;
  }
}

/**
 * 批量保存错题
 */
export async function saveWrongQuestions(inputs: WrongQuestionInput[]): Promise<{
  saved: number;
  skipped: number;
}> {
  let saved = 0;
  let skipped = 0;

  for (const input of inputs) {
    try {
      await saveWrongQuestion(input);
      saved++;
    } catch (error) {
      log.error('批量保存错题失败', { questionId: input.questionId, error });
      skipped++;
    }
  }

  return { saved, skipped };
}

/**
 * 获取待复核错题列表
 *
 * @param userId - 用户ID
 * @param subject - 可选科目筛选
 * @returns 待复核的错题列表，按置信度升序、创建时间降序排列
 */
export async function getWrongQuestionsForReview(
  userId: string,
  subject?: string
): Promise<Array<any>> {
  try {
    const where: any = {
      userId,
      needsReview: true,
      mastered: false  // 已掌握的题目不需要复核
    };

    if (subject) {
      where.subject = subject;
    }

    const questions = await prisma.wrongQuestion.findMany({
      where,
      orderBy: [
        { confidence: 'asc' },  // 置信度低的排在前面
        { createdAt: 'desc' }
      ]
    });

    log.info('获取待复核错题列表', {
      userId,
      subject,
      count: questions.length
    });

    return questions;
  } catch (error) {
    log.error('获取待复核错题列表失败', error);
    throw error;
  }
}

/**
 * 获取用户错题列表
 *
 * @param userId - 用户ID
 * @param options - 查询选项
 * @returns 错题列表
 */
export async function getWrongQuestions(
  userId: string,
  options?: WrongQuestionQueryOptions
): Promise<Array<any>> {
  try {
    const where: any = { userId };

    if (options?.subject) {
      where.subject = options.subject;
    }

    if (options?.mastered !== undefined) {
      where.mastered = options.mastered;
    }

    const questions = await prisma.wrongQuestion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit,
      skip: options?.offset
    });

    log.info('获取错题列表', {
      userId,
      subject: options?.subject,
      mastered: options?.mastered,
      count: questions.length
    });

    return questions;
  } catch (error) {
    log.error('获取错题列表失败', error);
    throw error;
  }
}

/**
 * 标记错题为已掌握（并清除复核标记）
 *
 * @param userId - 用户ID
 * @param questionId - 题目ID
 */
export async function markAsMastered(userId: string, questionId: string): Promise<void> {
  try {
    await prisma.wrongQuestion.update({
      where: {
        userId_questionId: { userId, questionId }
      },
      data: {
        mastered: true,
        needsReview: false
      }
    });
    log.info('标记错题为已掌握', { userId, questionId });
  } catch (error) {
    log.error('标记掌握状态失败', error);
    throw error;
  }
}

/**
 * 批量标记错题为已掌握
 */
export async function markMultipleAsMastered(
  userId: string,
  questionIds: string[]
): Promise<{ marked: number; failed: number }> {
  let marked = 0;
  let failed = 0;

  for (const questionId of questionIds) {
    try {
      await markAsMastered(userId, questionId);
      marked++;
    } catch (error) {
      log.error('批量标记掌握失败', { userId, questionId, error });
      failed++;
    }
  }

  return { marked, failed };
}

/**
 * 人工复核后更新错题结果
 *
 * @param userId - 用户ID
 * @param questionId - 题目ID
 * @param updates - 更新内容
 */
export async function updateAfterReview(
  userId: string,
  questionId: string,
  updates: {
    isCorrect?: boolean;
    studentAnswer?: string;
    correctAnswer?: string;
    analysis?: string;
    needsReview?: boolean;
  }
): Promise<void> {
  try {
    const updateData: any = { ...updates };

    // 如果复核后确认为正确，自动标记为已掌握
    if (updates.isCorrect === true) {
      updateData.mastered = true;
      updateData.needsReview = false;
    }

    await prisma.wrongQuestion.update({
      where: {
        userId_questionId: { userId, questionId }
      },
      data: updateData
    });
    log.info('复核后更新错题', { userId, questionId, updates });
  } catch (error) {
    log.error('复核更新失败', error);
    throw error;
  }
}

/**
 * 获取错题统计信息
 */
export async function getWrongQuestionStats(userId: string): Promise<{
  total: number;
  mastered: number;
  pending: number;
  needsReview: number;
  bySubject: Record<string, number>;
}> {
  try {
    const [total, mastered, needsReview, bySubjectData] = await Promise.all([
      prisma.wrongQuestion.count({ where: { userId } }),
      prisma.wrongQuestion.count({ where: { userId, mastered: true } }),
      prisma.wrongQuestion.count({ where: { userId, needsReview: true, mastered: false } }),
      prisma.wrongQuestion.groupBy({
        by: ['subject'],
        where: { userId, mastered: false },
        _count: true
      })
    ]);

    const bySubject: Record<string, number> = {};
    bySubjectData.forEach((item: { subject: string; _count: number }) => {
      bySubject[item.subject] = item._count;
    });

    return {
      total,
      mastered,
      pending: total - mastered,
      needsReview,
      bySubject
    };
  } catch (error) {
    log.error('获取错题统计失败', error);
    throw error;
  }
}
