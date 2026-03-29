/**
 * 微信小程序AI识别知识点API
 *
 * 功能：
 * - 接收题目文本
 * - AI分析提取关键词
 * - 调用EduKG搜索匹配知识点
 * - 返回最佳匹配的知识点
 * - 保存到user_knowledge_mastery表
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { userKnowledgeMastery } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { getEduKGService } from '@/lib/services/edukg';
import { createLogger } from '@/lib/logger';

const log = createLogger('AI Knowledge Point Recognition');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export const maxDuration = 30; // 30秒超时

/**
 * POST /api/miniprogram/ai/recognize-knowledge-point
 *
 * 请求体：
 * {
 *   "questionText": string,  // 题目文本
 *   "subject": string,  // 科目（可选）
 *   "gradeLevel": string,  // 年级（可选）
 *   "autoSave": boolean,  // 是否自动保存到用户掌握表（默认true）
 * }
 *
 * 响应：
 * {
 *   "success": true,
 *   "data": {
 *     "knowledgePoints": Array<{
 *       "uri": string,
 *       "label": string,
 *       "category": string,
 *       "relevanceScore": number,
 *     }>,
 *     "primaryKnowledgePoint": {
 *       "uri": string,
 *       "label": string,
 *       "category": string,
 *     },
 *     "saved": boolean,  // 是否已保存到用户掌握表
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证 JWT token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { userId: string; openid: string };
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token 无效'
          }
        },
        { status: 401 }
      );
    }

    // 2. 解析请求体
    const body = await request.json();
    const { questionText, subject, gradeLevel, autoSave = true } = body;

    // 验证参数
    if (!questionText) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_QUESTION',
            message: '请提供题目内容'
          }
        },
        { status: 400 }
      );
    }

    // 3. 调用EduKG服务识别知识点
    const edukg = getEduKGService();
    const knowledgePoints = await edukg.recognizeKnowledgePoints(questionText, subject);

    if (knowledgePoints.length === 0) {
      log.info('未识别到知识点', { questionText: questionText.substring(0, 50) });

      return NextResponse.json({
        success: true,
        data: {
          knowledgePoints: [],
          primaryKnowledgePoint: null,
          saved: false,
          message: '未能识别到相关知识点',
        },
      });
    }

    // 4. 选择主要知识点（相关性最高的）
    const primaryKnowledgePoint = knowledgePoints[0];

    log.info('识别到知识点', {
      count: knowledgePoints.length,
      primary: primaryKnowledgePoint.label,
    });

    // 5. 保存到用户掌握表（如果启用）
    let saved = false;
    if (autoSave) {
      try {
        await saveKnowledgePointsToUser(
          decoded.userId,
          knowledgePoints,
          primaryKnowledgePoint,
          subject,
          gradeLevel
        );
        saved = true;

        log.info('知识点已保存到用户掌握表', {
          userId: decoded.userId,
          count: knowledgePoints.length,
        });
      } catch (error) {
        log.error('保存知识点失败', error);
        // 保存失败不影响返回结果
      }
    }

    // 6. 返回识别结果
    return NextResponse.json({
      success: true,
      data: {
        knowledgePoints: knowledgePoints.map((kp) => ({
          uri: kp.uri,
          label: kp.label,
          category: kp.category,
          relevanceScore: 0, // TODO: 计算相关性得分
        })),
        primaryKnowledgePoint: {
          uri: primaryKnowledgePoint.uri,
          label: primaryKnowledgePoint.label,
          category: primaryKnowledgePoint.category,
        },
        saved,
      },
    });
  } catch (error) {
    log.error('知识点识别失败', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '知识点识别失败，请稍后重试'
        }
      },
      { status: 500 }
    );
  }
}

/**
 * 保存知识点到用户掌握表
 */
async function saveKnowledgePointsToUser(
  userId: string,
  knowledgePoints: Array<{ uri: string; label: string; category: string }>,
  primaryKnowledgePoint: { uri: string; label: string; category: string },
  subject?: string,
  gradeLevel?: string
): Promise<void> {
  // 1. 保存主要知识点
  const primaryExists = await db
    .select()
    .from(userKnowledgeMastery)
    .where(
      and(
        eq(userKnowledgeMastery.userId, userId),
        eq(userKnowledgeMastery.edukgUri, primaryKnowledgePoint.uri)
      )
    )
    .limit(1);

  if (primaryExists.length === 0) {
    // 新知识点，插入记录
    await db.insert(userKnowledgeMastery).values({
      userId,
      edukgUri: primaryKnowledgePoint.uri,
      knowledgePointName: primaryKnowledgePoint.label,
      subject: subject || primaryKnowledgePoint.category,
      masteryLevel: 'learning', // 首次识别，设置为"学习中"
      practiceCount: 0,
      correctCount: 0,
      wrongCount: 0,
      firstPracticedAt: new Date(),
      lastPracticedAt: new Date(),
    });
  } else {
    // 已存在，更新最后练习时间
    await db
      .update(userKnowledgeMastery)
      .set({
        lastPracticedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userKnowledgeMastery.id, primaryExists[0].id));
  }

  // 2. 保存次要知识点（前3个）
  for (const kp of knowledgePoints.slice(1, 4)) {
    const exists = await db
      .select()
      .from(userKnowledgeMastery)
      .where(
        and(
          eq(userKnowledgeMastery.userId, userId),
          eq(userKnowledgeMastery.edukgUri, kp.uri)
        )
      )
      .limit(1);

    if (exists.length === 0) {
      await db.insert(userKnowledgeMastery).values({
        userId,
        edukgUri: kp.uri,
        knowledgePointName: kp.label,
        subject: subject || kp.category,
        masteryLevel: 'unknown', // 次要知识点，初始状态为"未知"
        practiceCount: 0,
        correctCount: 0,
        wrongCount: 0,
      });
    }
  }
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
