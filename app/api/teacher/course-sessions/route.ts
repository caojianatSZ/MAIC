import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/teacher/course-sessions - 创建课程会话
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      subject,
      grade,
      topic,
      classType,
      duration,
      difficulty,
      knowledgePointIds,
      teacherPersona,
      studentPersona
    } = body

    if (!subject || !topic) {
      return NextResponse.json(
        { error: '缺少必要参数: subject, topic' },
        { status: 400 }
      )
    }

    // 创建课程生成会话
    const courseSession = await prisma.courseSession.create({
      data: {
        title: `${grade || ''}${topic}`,
        description: `AI 生成的${subject}课程: ${topic}`,
        subject,
        grade,
        topic,
        classType: classType || 'ONE_V1',
        duration: duration || 60,
        difficulty: difficulty || 2,
        knowledgePointIds: knowledgePointIds || [],
        generationMethod: 'ai_generated',
        generationPrompt: topic,
        scenes: [],
        sceneCount: 0,
        isCompleted: false,
        planData: {
          objectives: [],
          keyPoints: [],
          difficultyPoints: []
        },
        metadata: {
          teacherPersona,
          studentPersona,
          requestedAt: new Date().toISOString()
        }
      }
    })

    return NextResponse.json({
      courseSession,
      status: 'created',
      message: '课程会话已创建，请使用其他接口生成内容'
    }, { status: 201 })
  } catch (error) {
    console.error('创建课程生成任务失败:', error)
    return NextResponse.json(
      { error: '创建失败' },
      { status: 500 }
    )
  }
}

// GET /api/teacher/course-sessions - 获取课程列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const subject = searchParams.get('subject')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: any = {}
    if (subject) where.subject = subject
    if (status === 'completed') where.isCompleted = true
    if (status === 'pending') where.isCompleted = false

    const [sessions, total] = await Promise.all([
      prisma.courseSession.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.courseSession.count({ where })
    ])

    return NextResponse.json({
      sessions: sessions.map(s => ({
        id: s.id,
        title: s.title,
        subject: s.subject,
        grade: s.grade,
        topic: s.topic,
        classType: s.classType,
        duration: s.duration,
        difficulty: s.difficulty,
        sceneCount: s.sceneCount,
        isCompleted: s.isCompleted,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString()
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('获取课程列表失败:', error)
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    )
  }
}
