/**
 * 练习题推荐 API
 *
 * 基于弱项知识点推荐练习题
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import {
  recommendPracticeQuestions,
  batchRecommendPracticeQuestions,
  generatePracticeSet,
} from '@/lib/knowledge/practice-recommendation';
import { getStudentMasteryStats } from '@/lib/knowledge/mastery-service';

const log = createLogger('PracticeRecommendationAPI');

/**
 * GET - 获取练习题推荐
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const knowledgeName = searchParams.get('knowledgeName');
    const subject = searchParams.get('subject');
    const type = searchParams.get('type');
    const pageSize = searchParams.get('pageSize');
    const mode = searchParams.get('mode');  // 'single' | 'weak' | 'batch'

    if (!userId) {
      return NextResponse.json(
        { success: false, error: '缺少 userId' },
        { status: 400 }
      );
    }

    log.info('获取练习题推荐', { userId, mode, knowledgeName });

    // 模式1: 单个知识点推荐
    if (mode === 'single' && knowledgeName) {
      const recommendation = await recommendPracticeQuestions(knowledgeName, {
        subject: subject || undefined,
        type: type || undefined,
        pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      });

      return NextResponse.json({
        success: true,
        ...recommendation,
      });
    }

    // 模式2: 基于弱项知识点推荐
    if (mode === 'weak' || !mode) {
      // 获取弱项知识点
      const weakPoints = await getStudentMasteryStats(userId, {
        masteryLevel: 'weak',
        limit: 5,
        sortBy: 'wrongCount',
        sortOrder: 'desc',
      });

      if (weakPoints.length === 0) {
        return NextResponse.json({
          success: true,
          practiceSet: [],
          totalQuestions: 0,
          message: '没有弱项知识点，继续保持！',
        });
      }

      const practiceSet = await generatePracticeSet(
        userId,
        weakPoints.map(p => ({
          uri: p.knowledgeUri,
          name: p.knowledgeName,
          subject: p.subject,
        }))
      );

      return NextResponse.json({
        success: true,
        ...practiceSet,
        weakPointsCount: weakPoints.length,
      });
    }

    // 模式3: 批量指定知识点推荐
    if (mode === 'batch') {
      const body = await request.json().catch(() => ({}));
      const { knowledgePoints } = body;

      if (!knowledgePoints || !Array.isArray(knowledgePoints)) {
        return NextResponse.json(
          { success: false, error: '缺少 knowledgePoints 数组' },
          { status: 400 }
        );
      }

      const recommendations = await batchRecommendPracticeQuestions(knowledgePoints, {
        type: type || undefined,
        questionsPerPoint: pageSize ? parseInt(pageSize, 10) : undefined,
      });

      return NextResponse.json({
        success: true,
        recommendations,
      });
    }

    return NextResponse.json(
      { success: false, error: '无效的请求模式' },
      { status: 400 }
    );

  } catch (error) {
    log.error('获取练习题推荐失败', {
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取练习题推荐失败'
      },
      { status: 500 }
    );
  }
}

/**
 * POST - API 说明
 */
export async function POST() {
  return NextResponse.json({
    message: '练习题推荐 API',
    method: 'GET',
    features: [
      '基于 eduKG 知识图谱推荐练习题',
      '支持单个知识点推荐',
      '支持基于弱项知识点批量推荐',
      '支持指定知识点列表批量推荐'
    ],
    parameters: {
      userId: '用户ID（必需）',
      mode: '推荐模式（可选）: single/weak/batch，默认 weak',
      knowledgeName: '知识点名称（mode=single 时必需）',
      subject: '科目筛选（可选）: math/physics/english等',
      type: '题目类型（可选）: 选择题/填空题/解答题，默认选择题',
      pageSize: '每个知识点推荐题目数（可选，默认10）',
    },
    modes: {
      single: '单个知识点推荐，需要 knowledgeName 参数',
      weak: '基于用户弱项知识点自动推荐（默认）',
      batch: '批量指定知识点推荐，需要在 body 中提供 knowledgePoints 数组'
    },
    example: {
      weak: '/api/practice/recommend?userId=xxx&mode=weak',
      single: '/api/practice/recommend?userId=xxx&mode=single&knowledgeName=二次函数',
      batch: {
        url: '/api/practice/recommend?userId=xxx&mode=batch',
        body: {
          knowledgePoints: [
            { uri: 'http://edukg.cn/xxx', name: '二次函数', subject: 'math' },
            { uri: 'http://edukg.cn/yyy', name: '因式分解', subject: 'math' },
          ]
        }
      }
    }
  });
}
