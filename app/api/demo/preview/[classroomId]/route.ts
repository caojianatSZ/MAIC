import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * 版本预览API
 * GET /api/demo/preview/:classroomId
 *
 * 获取某个版本的详细信息（大纲+首场景）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classroomId: string }> }
) {
  try {
    const { classroomId } = await params

    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      include: {
        knowledgePoints: {
          include: {
            knowledgePoint: true
          }
        }
      }
    })

    if (!classroom) {
      return NextResponse.json({
        success: false,
        error: '课程不存在'
      }, { status: 404 })
    }

    // 提取场景大纲
    const scenes = classroom.scenes as any[]
    const outline = scenes.map((s, i) => ({
      sceneIndex: i,
      title: s.title,
      type: s.type,
      duration: s.duration
    }))

    // 获取知识点列表
    const knowledgePoints = classroom.knowledgePoints.map(kp => kp.knowledgePoint.name)

    return NextResponse.json({
      success: true,
      data: {
        classroomId: classroom.id,
        title: classroom.title,
        description: classroom.description,
        subject: classroom.subject,
        grade: classroom.grade,
        style: classroom.style,
        difficulty: classroom.difficulty,
        versionType: classroom.versionType,
        duration: classroom.duration,
        sceneCount: classroom.sceneCount,
        knowledgePoints,
        outline,
        firstScene: scenes[0] || null,
        metadata: classroom.metadata
      }
    })
  } catch (error) {
    console.error('预览获取失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取预览失败'
    }, { status: 500 })
  }
}
