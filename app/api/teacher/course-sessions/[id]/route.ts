import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/teacher/course-sessions/[id] - 获取课程详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await prisma.courseSession.findUnique({
      where: { id: id }
    })

    if (!session) {
      return NextResponse.json(
        { error: '课程不存在' },
        { status: 404 }
      )
    }

    // 序列化返回
    const response = {
      id: session.id,
      title: session.title,
      description: session.description,
      subject: session.subject,
      grade: session.grade,
      topic: session.topic,
      classType: session.classType,
      duration: session.duration,
      difficulty: session.difficulty,
      knowledgePointIds: session.knowledgePointIds,
      generationMethod: session.generationMethod,
      generationPrompt: session.generationPrompt,
      scenes: session.scenes,
      sceneCount: session.sceneCount,
      planData: session.planData,
      isCompleted: session.isCompleted,
      metadata: session.metadata,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString()
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { title, description, difficulty, isCompleted } = body

    const updateData: any = {}
    if (title) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (difficulty) updateData.difficulty = difficulty
    if (isCompleted !== undefined) updateData.isCompleted = isCompleted

    const session = await prisma.courseSession.update({
      where: { id: id },
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.courseSession.delete({
      where: { id: id }
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

// POST /api/teacher/course-sessions/[id]/complete - 标记课程完成
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await prisma.courseSession.update({
      where: { id: id },
      data: {
        isCompleted: true
      }
    })

    return NextResponse.json(session)
  } catch (error) {
    console.error('标记课程完成失败:', error)
    return NextResponse.json(
      { error: '操作失败' },
      { status: 500 }
    )
  }
}
