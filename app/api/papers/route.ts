// 试卷 CRUD API

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { generatePaperCode } from '@/lib/utils/identifier'

/**
 * GET /api/papers - 获取试卷列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!userId) {
      return Response.json(
        { code: -1, message: '缺少 userId 参数' },
        { status: 400 }
      )
    }

    const where = {
      creatorId: userId
    }

    const [papers, total] = await Promise.all([
      prisma.testPaper.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { questions: true }
          }
        }
      }),
      prisma.testPaper.count({ where })
    ])

    return Response.json({
      code: 0,
      message: 'success',
      data: {
        papers,
        total,
        page,
        limit
      }
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

/**
 * POST /api/papers - 创建新试卷
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description, userId } = body

    if (!title || !userId) {
      return Response.json(
        { code: -1, message: '缺少必需参数: title, userId' },
        { status: 400 }
      )
    }

    // 检查用户是否存在
    const user = await prisma.user.findFirst({
      where: { id: userId }
    })

    if (!user) {
      return Response.json(
        { code: -1, message: '用户不存在' },
        { status: 404 }
      )
    }

    // 生成唯一试卷码
    let code = generatePaperCode()
    let codeExists = await prisma.testPaper.findFirst({ where: { code } })
    while (codeExists) {
      code = generatePaperCode()
      codeExists = await prisma.testPaper.findFirst({ where: { code } })
    }

    const paper = await prisma.testPaper.create({
      data: {
        title,
        description,
        code,
        creatorId: userId
      }
    })

    return Response.json({
      code: 0,
      message: 'success',
      data: paper
    })
  } catch (error) {
    return Response.json(
      {
        code: -1,
        message: error instanceof Error ? error.message : '创建失败'
      },
      { status: 500 }
    )
  }
}
