import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/teacher/course-sessions/[id] - 获取课程详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await prisma.courseSession.findUnique({
      where: { id: params.id }
    })

    if (!session) {
      return NextResponse.json(
        { error: '课程不存在' },
        { status: 404 }
      )
    }

    // 序列化返回
    const response = {
      ...session,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      completedAt: session.completedAt?.toISOString(),
      metadata: session.metadata as any,
      planData: session.planData as any,
      scenes: session.scenes as any[],
      generationResult: session.generationResult as any
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('获取课程详情失败:', error)
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    )
  }
}

// PATCH /api/teacher/course-sessions/[id] - 更新课程
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { title, description, difficulty, isPublished } = body

    const updateData: any = {}
    if (title) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (difficulty) updateData.difficulty = difficulty
    if (isPublished !== undefined) updateData.isPublished = isPublished

    const session = await prisma.courseSession.update({
      where: { id: params.id },
      data: updateData
    })

    return NextResponse.json(session)
  } catch (error) {
    console.error('更新课程失败:', error)
    return NextResponse.json(
      { error: '更新失败' },
      { status: 500 }
    )
  }
}

// DELETE /api/teacher/course-sessions/[id] - 删除课程
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.courseSession.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除课程失败:', error)
    return NextResponse.json(
      { error: '删除失败' },
      { status: 500 }
    )
  }
}

// POST /api/teacher/course-sessions/[id]/publish - 发布课程
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await prisma.courseSession.update({
      where: { id: params.id },
      data: {
        isPublished: true,
        publishedAt: new Date()
      }
    })

    return NextResponse.json(session)
  } catch (error) {
    console.error('发布课程失败:', error)
    return NextResponse.json(
      { error: '发布失败' },
      { status: 500 }
    )
  }
}
