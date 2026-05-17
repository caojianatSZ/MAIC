// 单个试卷操作 API

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

type RouteContext = {
  params: Promise<{ id: string }>
}

/**
 * GET /api/papers/[id] - 获取试卷详情
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    const paper = await prisma.testPaper.findFirst({
      where: { id },
      include: {
        questions: {
          include: {
            question: true
          },
          orderBy: { order: 'asc' }
        },
        creator: {
          select: {
            id: true,
            nickname: true
          }
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

/**
 * PUT /api/papers/[id] - 更新试卷
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const { title, description } = body

    const paper = await prisma.testPaper.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description })
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
        message: error instanceof Error ? error.message : '更新失败'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/papers/[id] - 删除试卷
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params

    await prisma.testPaper.delete({
      where: { id }
    })

    return Response.json({
      code: 0,
      message: 'success'
    })
  } catch (error) {
    return Response.json(
      {
        code: -1,
        message: error instanceof Error ? error.message : '删除失败'
      },
      { status: 500 }
    )
  }
}

