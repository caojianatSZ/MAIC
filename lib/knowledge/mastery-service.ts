/**
 * 知识点掌握度统计服务
 *
 * 基于 KnowledgeMastery 表聚合学生的知识点掌握情况
 * 用于家长视图和错题合并功能
 */

import { PrismaClient } from '@prisma/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('KnowledgeMastery');

// 使用全局变量避免在开发环境中创建多个 Prisma Client 实例
const globalForPrisma = global as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * 掌握等级定义
 */
export type MasteryLevel = 'weak' | 'partial' | 'mastered';

/**
 * 知识点掌握度统计
 */
export interface KnowledgeMasteryStats {
  knowledgeUri: string;
  knowledgeName: string;
  subject: string;
  grade?: string;
  masteryLevel: MasteryLevel;
  masteryScore: number;  // 0-100
  totalAttempts: number;
  correctCount: number;
  wrongCount: number;
  accuracy: number;  // 正确率 0-1
  relatedWrongQuestionCount: number;
  classList?: Array<{ id: string; label: string }>;
  abstractMessage?: string;
  lastAttemptAt: Date;
  firstAttemptAt: Date;
  masteredAt?: Date;
}

/**
 * 学生掌握度汇总
 */
export interface StudentMasterySummary {
  userId: string;
  totalKnowledgePoints: number;
  masteredCount: number;
  partialCount: number;
  weakCount: number;
  bySubject: {
    [subject: string]: {
      total: number;
      mastered: number;
      partial: number;
      weak: number;
    };
  };
  weakKnowledgePoints: KnowledgeMasteryStats[];
  recentWeakPoints: KnowledgeMasteryStats[];
}

/**
 * 获取学生的知识点掌握度统计
 *
 * @param userId 用户ID
 * @param options 选项
 */
export async function getStudentMasteryStats(
  userId: string,
  options: {
    subject?: string;
    masteryLevel?: MasteryLevel;
    limit?: number;
    sortBy?: 'lastAttemptAt' | 'masteryScore' | 'wrongCount';
    sortOrder?: 'asc' | 'desc';
  } = {}
): Promise<KnowledgeMasteryStats[]> {
  const {
    subject,
    masteryLevel,
    limit = 50,
    sortBy = 'lastAttemptAt',
    sortOrder = 'desc'
  } = options;

  try {
    log.info('获取学生掌握度统计', { userId, subject, masteryLevel });

    const where: any = { userId };

    if (subject) {
      where.subject = subject;
    }

    if (masteryLevel) {
      where.masteryLevel = masteryLevel;
    }

    // 构建排序
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const records = await prisma.knowledgeMastery.findMany({
      where,
      orderBy,
      take: limit,
    });

    // 转换为统计格式
    const stats: KnowledgeMasteryStats[] = records.map(record => ({
      knowledgeUri: record.knowledgeUri,
      knowledgeName: record.knowledgeName,
      subject: record.subject,
      grade: record.grade,
      masteryLevel: record.masteryLevel as MasteryLevel,
      masteryScore: record.masteryScore,
      totalAttempts: record.totalAttempts,
      correctCount: record.correctCount,
      wrongCount: record.wrongCount,
      accuracy: record.totalAttempts > 0
        ? record.correctCount / record.totalAttempts
        : 0,
      relatedWrongQuestionCount: record.relatedWrongQuestionCount,
      classList: record.classList as Array<{ id: string; label: string }> | undefined,
      abstractMessage: record.abstractMessage,
      lastAttemptAt: record.lastAttemptAt,
      firstAttemptAt: record.firstAttemptAt,
      masteredAt: record.masteredAt,
    }));

    log.info('获取掌握度统计成功', { count: stats.length });
    return stats;

  } catch (error) {
    log.error('获取掌握度统计失败', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * 获取学生掌握度汇总
 *
 * @param userId 用户ID
 */
export async function getStudentMasterySummary(
  userId: string
): Promise<StudentMasterySummary> {
  try {
    log.info('获取学生掌握度汇总', { userId });

    const allRecords = await prisma.knowledgeMastery.findMany({
      where: { userId },
    });

    // 统计各等级数量
    const masteredCount = allRecords.filter(r => r.masteryLevel === 'mastered').length;
    const partialCount = allRecords.filter(r => r.masteryLevel === 'partial').length;
    const weakCount = allRecords.filter(r => r.masteryLevel === 'weak').length;

    // 按科目统计
    const bySubject: {
      [subject: string]: { total: number; mastered: number; partial: number; weak: number };
    } = {};

    for (const record of allRecords) {
      if (!bySubject[record.subject]) {
        bySubject[record.subject] = { total: 0, mastered: 0, partial: 0, weak: 0 };
      }
      bySubject[record.subject].total++;
      bySubject[record.subject][record.masteryLevel]++;
    }

    // 弱项知识点（按错误次数降序）
    const weakKnowledgePoints = allRecords
      .filter(r => r.masteryLevel === 'weak')
      .sort((a, b) => b.wrongCount - a.wrongCount)
      .slice(0, 20)
      .map(record => ({
        knowledgeUri: record.knowledgeUri,
        knowledgeName: record.knowledgeName,
        subject: record.subject,
        grade: record.grade,
        masteryLevel: record.masteryLevel as MasteryLevel,
        masteryScore: record.masteryScore,
        totalAttempts: record.totalAttempts,
        correctCount: record.correctCount,
        wrongCount: record.wrongCount,
        accuracy: record.totalAttempts > 0
          ? record.correctCount / record.totalAttempts
          : 0,
        relatedWrongQuestionCount: record.relatedWrongQuestionCount,
        classList: record.classList as Array<{ id: string; label: string }> | undefined,
        abstractMessage: record.abstractMessage,
        lastAttemptAt: record.lastAttemptAt,
        firstAttemptAt: record.firstAttemptAt,
        masteredAt: record.masteredAt,
      }));

    // 最近产生的弱项（按最近尝试时间降序）
    const recentWeakPoints = [...weakKnowledgePoints]
      .sort((a, b) => b.lastAttemptAt.getTime() - a.lastAttemptAt.getTime())
      .slice(0, 10);

    return {
      userId,
      totalKnowledgePoints: allRecords.length,
      masteredCount,
      partialCount,
      weakCount,
      bySubject,
      weakKnowledgePoints,
      recentWeakPoints,
    };

  } catch (error) {
    log.error('获取掌握度汇总失败', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * 更新知识点掌握度
 *
 * @param userId 用户ID
 * @param knowledgeUri 知识点URI
 * @param isCorrect 本次是否正确
 */
export async function updateKnowledgeMastery(
  userId: string,
  knowledgeUri: string,
  knowledgeName: string,
  subject: string,
  isCorrect: boolean
): Promise<void> {
  try {
    log.info('更新知识点掌握度', { userId, knowledgeUri, isCorrect });

    // 查找或创建记录
    const existing = await prisma.knowledgeMastery.findUnique({
      where: { knowledgeUri },
    });

    if (existing) {
      // 更新现有记录
      const totalAttempts = existing.totalAttempts + 1;
      const correctCount = isCorrect ? existing.correctCount + 1 : existing.correctCount;
      const wrongCount = isCorrect ? existing.wrongCount : existing.wrongCount + 1;

      // 计算掌握度分数
      const masteryScore = calculateMasteryScore(correctCount, wrongCount);

      // 计算掌握等级
      const masteryLevel = calculateMasteryLevel(masteryScore, totalAttempts);

      await prisma.knowledgeMastery.update({
        where: { knowledgeUri },
        data: {
          totalAttempts,
          correctCount,
          wrongCount,
          masteryScore,
          masteryLevel,
          lastAttemptAt: new Date(),
          masteredAt: masteryLevel === 'mastered' && !existing.masteredAt
            ? new Date()
            : existing.masteredAt,
        },
      });
    } else {
      // 创建新记录
      const totalAttempts = 1;
      const correctCount = isCorrect ? 1 : 0;
      const wrongCount = isCorrect ? 0 : 1;
      const masteryScore = calculateMasteryScore(correctCount, wrongCount);
      const masteryLevel = calculateMasteryLevel(masteryScore, totalAttempts);

      await prisma.knowledgeMastery.create({
        data: {
          userId,
          knowledgeUri,
          knowledgeName,
          subject,
          totalAttempts,
          correctCount,
          wrongCount,
          masteryScore,
          masteryLevel,
          firstAttemptAt: new Date(),
          lastAttemptAt: new Date(),
        },
      });
    }

    log.info('更新知识点掌握度成功');

  } catch (error) {
    log.error('更新知识点掌握度失败', {
      error: error instanceof Error ? error.message : String(error)
    });
    // 不抛出错误，避免影响主流程
  }
}

/**
 * 计算掌握度分数 (0-100)
 *
 * 算法：基于正确率，但考虑样本量
 */
function calculateMasteryScore(correctCount: number, wrongCount: number): number {
  const total = correctCount + wrongCount;

  if (total === 0) return 0;

  const accuracy = correctCount / total;

  // 样本量惩罚：样本越少，分数越保守
  let samplePenalty = 0;
  if (total < 3) {
    samplePenalty = 0.3;  // 30% 惩罚
  } else if (total < 5) {
    samplePenalty = 0.15;  // 15% 惩罚
  } else if (total < 10) {
    samplePenalty = 0.05;  // 5% 惩罚
  }

  const adjustedScore = accuracy * (1 - samplePenalty);
  return Math.round(adjustedScore * 100);
}

/**
 * 计算掌握等级
 */
function calculateMasteryLevel(masteryScore: number, totalAttempts: number): MasteryLevel {
  // 至少需要 3 次尝试才能判定为掌握
  if (totalAttempts < 3) {
    return masteryScore >= 60 ? 'partial' : 'weak';
  }

  if (masteryScore >= 80) return 'mastered';
  if (masteryScore >= 50) return 'partial';
  return 'weak';
}

/**
 * 获取错题合并视图
 *
 * 按知识点将错题分组，优先显示弱项知识点的错题
 *
 * @param userId 用户ID
 * @param options 选项
 */
export async function getConsolidatedWrongQuestions(
  userId: string,
  options: {
    subject?: string;
    masteryLevel?: MasteryLevel;
    limit?: number;
  } = {}
) {
  const { subject, masteryLevel, limit = 20 } = options;

  try {
    log.info('获取错题合并视图', { userId, subject, masteryLevel });

    // 获取符合条件的知识点掌握记录
    const masteryRecords = await getStudentMasteryStats(userId, {
      subject,
      masteryLevel,
      limit: 100,  // 获取更多以便后续筛选
      sortBy: 'wrongCount',
      sortOrder: 'desc',
    });

    // 为每个知识点获取关联的错题
    const consolidated = [];

    for (const mastery of masteryRecords) {
      // 获取该知识点的错题
      const wrongQuestions = await prisma.wrongQuestion.findMany({
        where: {
          userId,
          primaryKnowledgeUri: mastery.knowledgeUri,
          mastered: false,  // 只显示未掌握的错题
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 5,  // 每个知识点最多显示 5 道错题
      });

      if (wrongQuestions.length > 0) {
        consolidated.push({
          knowledgePoint: {
            uri: mastery.knowledgeUri,
            name: mastery.knowledgeName,
            subject: mastery.subject,
            grade: mastery.grade,
            masteryLevel: mastery.masteryLevel,
            masteryScore: mastery.masteryScore,
            totalAttempts: mastery.totalAttempts,
            accuracy: mastery.accuracy,
            abstractMessage: mastery.abstractMessage,
          },
          wrongQuestions: wrongQuestions.map(q => ({
            id: q.id,
            questionId: q.questionId,
            questionContent: q.questionContent,
            studentAnswer: q.studentAnswer,
            correctAnswer: q.correctAnswer,
            wrongCount: q.wrongCount,
            reviewCount: q.reviewCount,
            lastReviewedAt: q.lastReviewedAt,
            createdAt: q.createdAt,
          })),
          totalWrongQuestions: mastery.relatedWrongQuestionCount,
        });
      }

      if (consolidated.length >= (limit || 20)) {
        break;
      }
    }

    log.info('获取错题合并视图成功', { count: consolidated.length });
    return consolidated;

  } catch (error) {
    log.error('获取错题合并视图失败', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
