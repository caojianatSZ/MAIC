// 通过试卷码获取试卷（供诊断使用）

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

type RouteContext = {
  params: Promise<{ code: string }>
}

/**
 * GET /api/papers/code/[code] - 通过试卷码获取试卷
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { code } = await context.params

    const paper = await prisma.testPaper.findFirst({
      where: { code: code.toUpperCase() },
      include: {
        questions: {
          include: {
            question: true
          },
          orderBy: { order: 'asc' }
        }
      }
    })

    if (!paper) {
      return Response.json(
        { code: -1, message: '试卷不存在' },
        { status: 404 }
      )
    }

    return Response.json({
      code: 0,
      message: 'success',
      data: paper
    })
  } catch (error) {
    return Response.json(
      {
        code: -1,
        message: error instanceof Error ? error.message : '获取失败'
      },
      { status: 500 }
    )
  }
}
