/**
 * 微信小程序错题本API
 *
 * 功能：
 * - 获取错题列表（支持筛选、排序）
 * - 自动收集错题
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userWrongQuestions } from '@/drizzle/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { createLogger } from '@/lib/logger';

const log = createLogger('Wrong Questions API');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * 验证JWT token并返回用户ID
 */
async function getUserIdFromToken(request: NextRequest): Promise<string | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded.userId;
  } catch (error) {
    return null;
  }
}

/**
 * GET /api/miniprogram/wrong-questions
 *
 * 查询参数：
 * - subject: 科目筛选（可选）
 * - gradeLevel: 年级筛选（可选）
 * - isMastered: 是否已掌握（可选）
 * - sortBy: 排序方式（recent/wrongCount/practiceCount）
 * - page: 页码（默认1）
 * - limit: 每页数量（默认20）
 *
 * 响应：
 * {
 *   "success": true,
 *   "data": {
 *     "wrongQuestions": Array<WrongQuestion>,
 *     "pagination": { page, limit, total, totalPages, hasMore }
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const userId = await getUserIdFromToken(request);
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '未授权访问'
          }
        },
        { status: 401 }
      );
    }

    // 2. 解析查询参数
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject');
    const gradeLevel = searchParams.get('gradeLevel');
    const isMastered = searchParams.get('isMastered');
    const sortBy = searchParams.get('sortBy') || 'recent';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // 3. 构建查询条件
    const conditions = [eq(userWrongQuestions.userId, userId)];

    if (subject) {
      conditions.push(eq(userWrongQuestions.subject, subject));
    }

    if (gradeLevel) {
      conditions.push(eq(userWrongQuestions.gradeLevel, gradeLevel));
    }

    if (isMastered !== null && isMastered !== undefined) {
      const mastered = isMastered === 'true';
      conditions.push(eq(userWrongQuestions.isMastered, mastered));
    }

    // 4. 构建排序条件
    let orderBy;
    switch (sortBy) {
      case 'wrongCount':
        orderBy = desc(userWrongQuestions.wrongCount);
        break;
      case 'practiceCount':
        orderBy = desc(userWrongQuestions.practiceCount);
        break;
      case 'recent':
      default:
        orderBy = desc(userWrongQuestions.createdAt);
        break;
    }

    // 5. 执行查询
    const offset = (page - 1) * limit;

    const [wrongQuestions, totalCountResult] = await Promise.all([
      db
        .select()
        .from(userWrongQuestions)
        .where(and(...conditions))
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(userWrongQuestions)
        .where(and(...conditions)),
    ]);

    const total = totalCountResult[0].count;
    const totalPages = Math.ceil(total / limit);
    const hasMore = page * limit < total;

    // 6. 格式化返回结果
    const formatted = wrongQuestions.map((wq) => ({
      id: wq.id,
      questionText: wq.questionText,
      questionImageUrl: wq.questionImageUrl,
      myAnswer: wq.myAnswer,
      correctAnswer: wq.correctAnswer,
      explanation: wq.explanation,
      subject: wq.subject,
      gradeLevel: wq.gradeLevel,
      difficulty: wq.difficulty,
      edukgUri: wq.edukgUri,
      edukgUris: wq.edukgUris || [],
      wrongCount: wq.wrongCount,
      practiceCount: wq.practiceCount,
      isMastered: wq.isMastered,
      lastPracticedAt: wq.lastPracticedAt,
      sourceType: wq.sourceType,
      sourceId: wq.sourceId,
      createdAt: wq.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        wrongQuestions: formatted,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore,
        },
      },
    });
  } catch (error) {
    log.error('获取错题列表失败', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取错题列表失败'
        }
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/miniprogram/wrong-questions/collect
 *
 * 自动收集错题（当练习题答错时调用）
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证用户身份
    const userId = await getUserIdFromToken(request);
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '未授权访问'
          }
        },
        { status: 401 }
      );
    }

    // 2. 解析请求体
    const body = await request.json();
    const {
      questionText,
      questionImageUrl,
      myAnswer,
      correctAnswer,
      explanation,
      subject,
      gradeLevel,
      difficulty,
      edukgUri,
      edukgUris,
      sourceType,
      sourceId,
    } = body;

    // 验证必填字段
    if (!questionText || !sourceType || !sourceId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_REQUIRED_FIELDS',
            message: '缺少必填字段：questionText、sourceType、sourceId'
          }
        },
        { status: 400 }
      );
    }

    // 3. 检查是否已收集过该错题
    const existing = await db
      .select()
      .from(userWrongQuestions)
      .where(
        and(
          eq(userWrongQuestions.userId, userId),
          eq(userWrongQuestions.sourceType, sourceType),
          eq(userWrongQuestions.sourceId, sourceId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // 已存在，更新错误次数
      await db
        .update(userWrongQuestions)
        .set({
          wrongCount: (existing[0].wrongCount || 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(userWrongQuestions.id, existing[0].id));

      return NextResponse.json({
        success: true,
        message: '错题已存在，更新错误次数',
        data: {
          id: existing[0].id,
          wrongCount: (existing[0].wrongCount || 0) + 1,
        },
      });
    }

    // 4. 如果未调用AI识别，且没有提供知识点，则调用识别
    let finalEdukgUri = edukgUri;
    let finalEdukgUris = edukgUris;

    if (!finalEdukgUri && questionText) {
      try {
        const { getEduKGService } = await import('@/lib/services/edukg');
        const edukg = getEduKGService();
        const knowledgePoints = await edukg.recognizeKnowledgePoints(
          questionText,
          subject || undefined
        );

        if (knowledgePoints.length > 0) {
          finalEdukgUri = knowledgePoints[0].uri;
          finalEdukgUris = knowledgePoints.map((kp) => kp.uri);
        }
      } catch (error) {
        log.warn('AI识别知识点失败，继续收集错题', error);
      }
    }

    // 5. 收集错题
    const [newWrongQuestion] = await db
      .insert(userWrongQuestions)
      .values({
        userId,
        questionText,
        questionImageUrl: questionImageUrl || null,
        myAnswer: myAnswer || null,
        correctAnswer: correctAnswer || null,
        explanation: explanation || null,
        subject: subject || null,
        gradeLevel: gradeLevel || null,
        difficulty: difficulty || null,
        edukgUri: finalEdukgUri || null,
        edukgUris: finalEdukgUris || null,
        wrongCount: 1,
        practiceCount: 0,
        isMastered: false,
        sourceType,
        sourceId,
      })
      .returning();

    log.info('错题已收集', {
      userId,
      wrongQuestionId: newWrongQuestion.id,
      sourceType,
      sourceId,
    });

    return NextResponse.json({
      success: true,
      message: '错题已收集',
      data: {
        id: newWrongQuestion.id,
        questionText: newWrongQuestion.questionText,
        subject: newWrongQuestion.subject,
        gradeLevel: newWrongQuestion.gradeLevel,
        edukgUri: newWrongQuestion.edukgUri,
      },
    });
  } catch (error) {
    log.error('收集错题失败', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '收集错题失败'
        }
      },
      { status: 500 }
    );
  }
}

// 支持 OPTIONS 请求（预检）
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
