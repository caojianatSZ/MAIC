/**
 * 微信小程序错题本操作API（单个错题）
 *
 * POST /api/miniprogram/wrong-questions/[id]/practice - 练习错题
 * POST /api/miniprogram/wrong-questions/[id]/master - 标记已掌握
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userWrongQuestions, userKnowledgeMastery, practiceQuestions, homeworkResults, homeworkSubmissions } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { createLogger } from '@/lib/logger';

const log = createLogger('Wrong Question Operations API');

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
 * POST /api/miniprogram/wrong-questions/[id]/practice
 *
 * 练习错题，返回原题、我的答案、正确答案和AI讲解
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
    const action = body.action; // 'practice' 或 'master'

    if (action === 'master') {
      return await markAsMastered(userId, id);
    }

    // 默认是练习操作
    return await practiceQuestion(userId, id);
  } catch (error) {
    log.error('错题操作失败', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '错题操作失败'
        }
      },
      { status: 500 }
    );
  }
}

/**
 * 练习错题
 */
async function practiceQuestion(userId: string, wrongQuestionId: string) {
  // 1. 查询错题记录
  const wrongQuestionList = await db
    .select()
    .from(userWrongQuestions)
    .where(
      and(
        eq(userWrongQuestions.id, wrongQuestionId),
        eq(userWrongQuestions.userId, userId)
      )
    )
    .limit(1);

  if (wrongQuestionList.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'WRONG_QUESTION_NOT_FOUND',
          message: '错题不存在'
        }
      },
      { status: 404 }
    );
  }

  const wrongQuestion = wrongQuestionList[0];

  // 2. 更新练习次数和最后练习时间
  await db
    .update(userWrongQuestions)
    .set({
      practiceCount: (wrongQuestion.practiceCount || 0) + 1,
      lastPracticedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(userWrongQuestions.id, wrongQuestionId));

  // 3. 如果错题来源于作业，获取AI讲解
  let explanation = wrongQuestion.explanation;
  if (!explanation && wrongQuestion.sourceType === 'homework' && wrongQuestion.sourceId) {
    // 查询原始作业结果
    const submissionList = await db
      .select({
        explanationText: homeworkResults.explanationText,
      })
      .from(homeworkResults)
      .innerJoin(
        homeworkSubmissions,
        eq(homeworkResults.submissionId, homeworkSubmissions.id)
      )
      .where(eq(homeworkSubmissions.id, wrongQuestion.sourceId))
      .limit(1);

    if (submissionList.length > 0) {
      explanation = submissionList[0].explanationText;
    }
  }

  // 4. 如果来源于练习题，获取练习题解析
  if (!explanation && wrongQuestion.sourceType === 'practice' && wrongQuestion.sourceId) {
    const practiceQuestionList = await db
      .select({
        explanation: practiceQuestions.explanation,
      })
      .from(practiceQuestions)
      .where(eq(practiceQuestions.id, wrongQuestion.sourceId))
      .limit(1);

    if (practiceQuestionList.length > 0) {
      explanation = practiceQuestionList[0].explanation;
    }
  }

  // 5. 返回练习内容
  return NextResponse.json({
    success: true,
    data: {
      id: wrongQuestion.id,
      questionText: wrongQuestion.questionText,
      questionImageUrl: wrongQuestion.questionImageUrl,
      myAnswer: wrongQuestion.myAnswer,
      correctAnswer: wrongQuestion.correctAnswer,
      explanation,
      subject: wrongQuestion.subject,
      gradeLevel: wrongQuestion.gradeLevel,
      edukgUri: wrongQuestion.edukgUri,
      practiceCount: (wrongQuestion.practiceCount || 0) + 1,
      lastPracticedAt: new Date(),
    },
  });
}

/**
 * 标记为已掌握
 */
async function markAsMastered(userId: string, wrongQuestionId: string) {
  // 1. 查询错题记录
  const wrongQuestionList = await db
    .select()
    .from(userWrongQuestions)
    .where(
      and(
        eq(userWrongQuestions.id, wrongQuestionId),
        eq(userWrongQuestions.userId, userId)
      )
    )
    .limit(1);

  if (wrongQuestionList.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'WRONG_QUESTION_NOT_FOUND',
          message: '错题不存在'
        }
      },
      { status: 404 }
    );
  }

  // 2. 更新为已掌握
  await db
    .update(userWrongQuestions)
    .set({
      isMastered: true,
      masteredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(userWrongQuestions.id, wrongQuestionId));

  // 3. 如果有EduKG URI，同时更新用户知识点掌握表
  if (wrongQuestionList[0].edukgUri) {
    await db
      .update(userKnowledgeMastery)
      .set({
        masteryLevel: 'mastered',
        masteredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userKnowledgeMastery.userId, userId),
          eq(userKnowledgeMastery.edukgUri, wrongQuestionList[0].edukgUri!)
        )
      );
  }

  return NextResponse.json({
    success: true,
    message: '已标记为掌握',
    data: {
      id: wrongQuestionId,
      isMastered: true,
      masteredAt: new Date(),
    },
  });
}

// 支持 OPTIONS 请求（预检）
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
