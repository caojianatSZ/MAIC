// 获取学生诊断历史

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/diagnosis/history?studentId=xxx&paperCode=xxx
 *
 * 查询参数:
 * - studentId: 学生ID（必需）
 * - paperCode: 试卷码（可选，查询特定试卷的诊断记录）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const paperCode = searchParams.get('paperCode');

    if (!studentId) {
      return NextResponse.json({
        success: false,
        error: '缺少 studentId 参数'
      }, { status: 400 });
    }

    const where: any = {
      studentId
    };

    // 如果指定了试卷码，先查找试卷
    if (paperCode) {
      const paper = await prisma.testPaper.findFirst({
        where: { code: paperCode.toUpperCase() }
      });

      if (!paper) {
        return NextResponse.json({
          success: false,
          error: '试卷不存在'
        }, { status: 404 });
      }

      where.paperId = paper.id;
    }

    const results = await prisma.diagnosisResult.findMany({
      where,
      include: {
        paper: {
          select: {
            id: true,
            title: true,
            code: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('获取诊断历史失败:', error);
    return NextResponse.json({
      success: false,
      error: '获取诊断历史失败'
    }, { status: 500 });
  }
}
