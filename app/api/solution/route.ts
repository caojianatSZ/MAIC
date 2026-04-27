/**
 * 标准答案与解析 API
 *
 * 按需获取题目的标准答案和详细解析
 * 使用 Aliyun AnswerSSE 接口
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import { getSolution, getCachedSolution, cacheSolution } from '@/lib/aliyun/answersse-client';
import { PrismaClient } from '@prisma/client';

const log = createLogger('SolutionAPI');

// 使用全局变量避免在开发环境中创建多个 Prisma Client 实例
const globalForPrisma = global as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * GET - API 说明
 */
export async function GET() {
  return NextResponse.json({
    message: '标准答案与解析 API',
    method: 'POST',
    features: [
      '按需获取题目的标准答案',
      '详细解析（考点分析、方法点拨、详细步骤）',
      '结果缓存（24小时）',
      '支持文本和图片输入'
    ],
    parameters: {
      questionId: '题目ID',
      questionContent: '题目内容（可选，如果数据库中没有）',
      subject: '学科 (math/english/chinese/physics/chemistry)',
      grade: '年级 (如: 七年级/初二/8)',
      imageUrl: '题目图片URL（可选）'
    }
  });
}

/**
 * POST - 获取题目解析
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      questionId,
      questionContent,
      subject,
      grade,
      imageUrl
    } = body;

    // 参数校验
    if (!questionId) {
      return NextResponse.json(
        { success: false, error: '缺少 questionId' },
        { status: 400 }
      );
    }

    if (!subject || !grade) {
      return NextResponse.json(
        { success: false, error: '缺少 subject 或 grade' },
        { status: 400 }
      );
    }

    log.info('获取题目解析', { questionId, subject, grade });

    // 1. 检查缓存
    const cached = getCachedSolution(questionId, subject);
    if (cached) {
      log.info('使用缓存的解析', { questionId });
      return NextResponse.json({
        success: true,
        cached: true,
        ...cached
      });
    }

    // 2. 从数据库获取题目内容（如果未提供）
    let finalQuestionContent = questionContent;
    if (!finalQuestionContent) {
      // 尝试从错题本获取
      const wrongQuestion = await prisma.wrongQuestion.findFirst({
        where: {
          questionId
        }
      });

      if (wrongQuestion) {
        finalQuestionContent = wrongQuestion.questionContent;

        // 如果数据库中已有解析，直接返回
        if (wrongQuestion.detailedAnalysis || wrongQuestion.standardAnswer) {
          log.info('使用数据库中的解析', { questionId });
          return NextResponse.json({
            success: true,
            fromDatabase: true,
            examPoints: wrongQuestion.examPoints || '',
            methodGuide: wrongQuestion.methodGuide || '',
            detailedAnalysis: wrongQuestion.detailedAnalysis || '',
            standardAnswer: wrongQuestion.standardAnswer || ''
          });
        }
      }
    }

    if (!finalQuestionContent) {
      return NextResponse.json(
        { success: false, error: '未找到题目内容，请提供 questionContent' },
        { status: 400 }
      );
    }

    // 3. 调用 AnswerSSE API
    log.info('调用 AnswerSSE API', { questionId });
    const solution = await getSolution(finalQuestionContent, {
      subject,
      grade,
      imageUrl
    });

    // 4. 缓存结果
    cacheSolution(questionId, subject, solution);

    // 5. 更新数据库（异步，不阻塞响应）
    if (solution.standardAnswer || solution.detailedAnalysis) {
      prisma.wrongQuestion.updateMany({
        where: { questionId },
        data: {
          standardAnswer: solution.standardAnswer || null,
          examPoints: solution.examPoints || null,
          methodGuide: solution.methodGuide || null,
          detailedAnalysis: solution.detailedAnalysis || null
        }
      }).catch(err => {
        log.warn('更新错题本解析失败', { questionId, error: err });
      });
    }

    return NextResponse.json({
      success: true,
      ...solution
    });

  } catch (error) {
    log.error('获取解析失败', {
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取解析失败，请稍后重试'
      },
      { status: 500 }
    );
  }
}
