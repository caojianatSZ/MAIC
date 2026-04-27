/**
 * 错题合并视图 API
 *
 * 按知识点将错题分组，优先显示弱项知识点的错题
 * 用于家长端查看学生需要重点巩固的知识点
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import {
  getConsolidatedWrongQuestions,
  getStudentMasterySummary,
} from '@/lib/knowledge/mastery-service';

const log = createLogger('ConsolidatedWrongQuestionsAPI');

/**
 * GET - 获取错题合并视图
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const subject = searchParams.get('subject');
    const masteryLevel = searchParams.get('masteryLevel');
    const limit = searchParams.get('limit');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: '缺少 userId' },
        { status: 400 }
      );
    }

    log.info('获取错题合并视图', { userId, subject, masteryLevel });

    // 获取合并的错题
    const consolidated = await getConsolidatedWrongQuestions(userId, {
      subject: subject || undefined,
      masteryLevel: (masteryLevel || undefined) as 'weak' | 'partial' | 'mastered' | undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    // 获取掌握度汇总
    const summary = await getStudentMasterySummary(userId);

    return NextResponse.json({
      success: true,
      consolidated,
      summary: {
        totalKnowledgePoints: summary.totalKnowledgePoints,
        masteredCount: summary.masteredCount,
        partialCount: summary.partialCount,
        weakCount: summary.weakCount,
        bySubject: summary.bySubject,
      },
    });

  } catch (error) {
    log.error('获取错题合并视图失败', {
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取错题合并视图失败'
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
    message: '错题合并视图 API',
    method: 'GET',
    features: [
      '按知识点将错题分组显示',
      '优先显示弱项知识点的错题',
      '提供掌握度汇总统计',
      '支持按科目和掌握等级筛选'
    ],
    parameters: {
      userId: '用户ID（必需）',
      subject: '科目筛选（可选）: math/physics/english等',
      masteryLevel: '掌握等级筛选（可选）: weak/partial/mastered',
      limit: '返回数量限制（可选，默认20）'
    },
    responseFormat: {
      consolidated: [
        {
          knowledgePoint: {
            uri: '知识点URI',
            name: '知识点名称',
            subject: '科目',
            masteryLevel: '掌握等级',
            masteryScore: '掌握分数',
            totalAttempts: '总尝试次数',
            accuracy: '正确率'
          },
          wrongQuestions: [
            {
              id: '错题记录ID',
              questionId: '题目ID',
              questionContent: '题目内容',
              studentAnswer: '学生答案',
              correctAnswer: '正确答案',
              wrongCount: '错误次数',
              reviewCount: '复习次数'
            }
          ],
          totalWrongQuestions: '该知识点总错题数'
        }
      ],
      summary: {
        totalKnowledgePoints: '总知识点数',
        masteredCount: '已掌握数量',
        partialCount: '部分掌握数量',
        weakCount: '薄弱数量',
        bySubject: '按科目统计'
      }
    }
  });
}
