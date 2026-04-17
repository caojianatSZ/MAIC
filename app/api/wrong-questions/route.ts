/**
 * 错题本 API
 *
 * 支持操作：
 * - GET - 获取错题列表（支持 review 参数获取待复核列表）
 * - POST - 保存错题（支持单个或批量）
 * - PATCH - 更新错题（mark_mastered 或 review_update 操作）
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import {
  saveWrongQuestion,
  saveWrongQuestions,
  getWrongQuestions,
  getWrongQuestionsForReview,
  markAsMastered,
  markMultipleAsMastered,
  updateAfterReview,
  getWrongQuestionStats,
  type WrongQuestionInput
} from '@/lib/wrong-questions/service';

const log = createLogger('WrongQuestionsAPI');

/**
 * GET - 获取错题列表
 *
 * Query Parameters:
 * - userId: string (required) - 用户ID
 * - subject: string (optional) - 科目筛选
 * - mastered: boolean (optional) - 掌握状态筛选
 * - review: boolean (optional) - 设为 true 获取待复核列表
 * - limit: number (optional) - 限制返回数量
 * - offset: number (optional) - 偏移量
 * - stats: boolean (optional) - 设为 true 获取统计信息
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const subject = searchParams.get('subject');
    const mastered = searchParams.get('mastered');
    const review = searchParams.get('review');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    const stats = searchParams.get('stats');

    if (!userId) {
      return apiError('MISSING_REQUIRED_FIELD', 400, '缺少用户ID');
    }

    // 获取统计信息
    if (stats === 'true') {
      const statistics = await getWrongQuestionStats(userId);
      return apiSuccess({ statistics });
    }

    // 获取待复核列表
    if (review === 'true') {
      const questions = await getWrongQuestionsForReview(
        userId,
        subject || undefined
      );
      return apiSuccess({
        questions,
        count: questions.length
      });
    }

    // 获取普通错题列表
    const questions = await getWrongQuestions(userId, {
      subject: subject || undefined,
      mastered: mastered === 'true' ? true : mastered === 'false' ? false : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined
    });

    return apiSuccess({ questions });

  } catch (error) {
    log.error('获取错题列表失败', error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? error.message : '获取错题列表失败'
    );
  }
}

/**
 * POST - 保存错题
 *
 * Request Body (单个):
 * {
 *   "userId": string,
 *   "questionId": string,
 *   "subject": string,
 *   "questionContent": string,
 *   "studentAnswer": string,
 *   "correctAnswer": string,
 *   "analysis": string,
 *   "knowledgePoints": Array<{id, name, masteryLevel}>,
 *   "isCorrect": boolean,
 *   "needsReview": boolean,
 *   "confidence": number
 * }
 *
 * Request Body (批量):
 * {
 *   "questions": WrongQuestionInput[]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 批量保存
    if (Array.isArray(body.questions)) {
      const result = await saveWrongQuestions(body.questions);
      return apiSuccess({
        saved: result.saved,
        skipped: result.skipped,
        total: body.questions.length
      });
    }

    // 单个保存
    await saveWrongQuestion(body as WrongQuestionInput);
    return apiSuccess({
      saved: 1,
      message: '错题保存成功'
    });

  } catch (error) {
    log.error('保存错题失败', error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? error.message : '保存错题失败'
    );
  }
}

/**
 * PATCH - 更新错题
 *
 * Request Body:
 * {
 *   "userId": string (required),
 *   "questionId": string (required),
 *   "action": string (required) - "mark_mastered" | "mark_multiple_mastered" | "review_update",
 *   ...updates - 根据操作类型不同，额外参数不同
 * }
 *
 * Action: mark_mastered
 * - 标记单个错题为已掌握
 *
 * Action: mark_multiple_mastered
 * - 批量标记错题为已掌握
 * - 额外参数: questionIds: string[]
 *
 * Action: review_update
 * - 人工复核后更新错题信息
 * - 额外参数: isCorrect, studentAnswer, correctAnswer, analysis, needsReview
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, questionId, action, ...updates } = body;

    if (!userId) {
      return apiError('MISSING_REQUIRED_FIELD', 400, '缺少用户ID');
    }

    // 标记单个错题为已掌握
    if (action === 'mark_mastered') {
      if (!questionId) {
        return apiError('MISSING_REQUIRED_FIELD', 400, '缺少题目ID');
      }
      await markAsMastered(userId, questionId);
      return apiSuccess({
        success: true,
        message: '已标记为掌握'
      });
    }

    // 批量标记错题为已掌握
    if (action === 'mark_multiple_mastered') {
      const { questionIds } = updates;
      if (!Array.isArray(questionIds) || questionIds.length === 0) {
        return apiError('INVALID_REQUEST', 400, '请提供要标记的题目ID列表');
      }
      const result = await markMultipleAsMastered(userId, questionIds);
      return apiSuccess({
        ...result,
        message: `已标记 ${result.marked} 道题为掌握`
      });
    }

    // 人工复核后更新
    if (action === 'review_update') {
      if (!questionId) {
        return apiError('MISSING_REQUIRED_FIELD', 400, '缺少题目ID');
      }
      await updateAfterReview(userId, questionId, updates);
      return apiSuccess({
        success: true,
        message: '复核更新成功'
      });
    }

    return apiError('INVALID_ACTION', 400, '无效的操作');

  } catch (error) {
    log.error('更新错题失败', error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? error.message : '更新错题失败'
    );
  }
}

/**
 * DELETE - 删除错题
 *
 * Query Parameters:
 * - userId: string (required) - 用户ID
 * - questionId: string (required) - 题目ID
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const questionId = searchParams.get('questionId');

    if (!userId || !questionId) {
      return apiError('MISSING_REQUIRED_FIELD', 400, '缺少用户ID或题目ID');
    }

    const { PrismaClient } = await import('@prisma/client');
    const globalForPrisma = global as unknown as { prisma?: any };
    const prisma = globalForPrisma.prisma || new PrismaClient();

    await prisma.wrongQuestion.delete({
      where: {
        userId_questionId: { userId, questionId }
      }
    });

    log.info('删除错题', { userId, questionId });
    return apiSuccess({
      success: true,
      message: '错题删除成功'
    });

  } catch (error) {
    log.error('删除错题失败', error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? error.message : '删除错题失败'
    );
  }
}

/**
 * OPTIONS - API 说明
 */
export async function OPTIONS() {
  return NextResponse.json({
    message: '错题本 API',
    version: '1.0',
    methods: {
      GET: '获取错题列表（支持 review 参数获取待复核列表，stats 参数获取统计）',
      POST: '保存错题（支持单个或批量）',
      PATCH: '更新错题（mark_mastered, mark_multiple_mastered, review_update）',
      DELETE: '删除错题'
    },
    queryParameters: {
      userId: '用户ID（必需）',
      subject: '科目筛选（可选）',
      mastered: '掌握状态筛选 true/false（可选）',
      review: '获取待复核列表 true/false（可选）',
      limit: '限制返回数量（可选）',
      offset: '偏移量（可选）',
      stats: '获取统计信息 true/false（可选）'
    },
    patchActions: {
      mark_mastered: '标记单个错题为已掌握（需要 questionId）',
      mark_multiple_mastered: '批量标记错题为已掌握（需要 questionIds 数组）',
      review_update: '人工复核后更新错题信息（需要 questionId 和更新字段）'
    }
  });
}
