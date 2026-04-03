import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * 课程库查询API
 * GET /api/demo/library?topic=二次函数最值
 *
 * 查询某个主题的所有生成版本
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const topic = searchParams.get('topic')

    if (!topic) {
      return NextResponse.json({
        success: false,
        error: '缺少topic参数'
      }, { status: 400 })
    }

    // 查询该主题的所有版本
    const classrooms = await prisma.classroom.findMany({
      where: {
        parentTopic: topic,
        generationMethod: 'ai_generated'
      },
      orderBy: { createdAt: 'desc' },
      take: 4
    })

    // 格式化返回
    const versions = classrooms.map(c => ({
      classroomId: c.id,
      title: c.title,
      style: c.style,
      difficulty: c.difficulty,
      duration: c.duration,
      sceneCount: c.sceneCount,
      versionType: c.versionType,
      createdAt: c.createdAt
    }))

    return NextResponse.json({
      success: true,
      data: {
        topic,
        count: versions.length,
        versions
      }
    })
  } catch (error) {
    console.error('课程库查询失败:', error)
    return NextResponse.json({
      success: false,
      error: '查询失败'
    }, { status: 500 })
  }
}
