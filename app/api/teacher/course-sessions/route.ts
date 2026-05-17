import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { runGenerationPipeline, CreateAICallFn } from '@/lib/generation/generation-pipeline'

const prisma = new PrismaClient()

// POST /api/teacher/course-sessions - 创建并生成课程
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

    // 异步启动课程生成
    generateCourseAsync(courseSession.id, {
      subject,
      grade,
      topic,
      classType: classType || 'ONE_V1',
      duration: duration || 60,
      difficulty: difficulty || 2,
      teacherPersona,
      studentPersona
    })

    return NextResponse.json({
      courseSession,
      status: 'generating',
      message: '课程生成任务已创建，AI 正在生成课程内容'
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
    const teacherId = searchParams.get('teacherId')
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
        ...s,
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

// 异步生成课程内容
async function generateCourseAsync(
  sessionId: string,
  params: {
    subject: string
    grade?: string
    topic: string
    classType: string
    duration: number
    difficulty: number
    teacherPersona?: string
    studentPersona?: string
  }
) {
  try {
    console.log(`[课程生成] 开始生成课程 ${sessionId}`)

    // 获取 AI 调用函数
    const createAICall: CreateAICallFn = async (options) => {
      // 这里应该使用实际的 LLM 提供商
      // 暂时返回模拟数据
      return {
        content: JSON.stringify({
          outlines: [
            {
              title: `导入：${params.topic}`,
              duration: 5,
              description: '激发兴趣，引入主题',
              agent: 'teacher'
            },
            {
              title: '知识点讲解',
              duration: Math.floor(params.duration * 0.5),
              description: `讲解${params.topic}的核心知识点`,
              agent: 'teacher'
            },
            {
              title: '示例练习',
              duration: Math.floor(params.duration * 0.3),
              description: '通过示例巩固理解',
              agent: 'teacher'
            },
            {
              title: '总结回顾',
              duration: Math.floor(params.duration * 0.2),
              description: '总结本节课重点',
              agent: 'teacher'
            }
          ]
        }),
        usage: { promptTokens: 100, completionTokens: 200 }
      }
    }

    // 运行生成流程
    const result = await runGenerationPipeline({
      subject: params.subject,
      grade: params.grade,
      topic: params.topic,
      duration: params.duration,
      difficulty: params.difficulty,
      classType: params.classType,
      createAICall,
      callbacks: {
        onOutlineGenerated: async (outlines) => {
          console.log(`[课程生成] 大纲生成完成: ${outlines.length} 个场景`)
        },
        onSceneGenerated: async (scene) => {
          console.log(`[课程生成] 场景生成: ${scene.title}`)
        }
      }
    })

    // 更新课程会话
    await prisma.courseSession.update({
      where: { id: sessionId },
      data: {
        scenes: result.scenes || [],
        sceneCount: result.scenes?.length || 0,
        isCompleted: true,
        completedAt: new Date(),
        generationResult: {
          success: true,
          sceneCount: result.scenes?.length || 0,
          totalDuration: params.duration
        }
      }
    })

    console.log(`[课程生成] 课程 ${sessionId} 生成完成`)
  } catch (error) {
    console.error(`[课程生成] 课程 ${sessionId} 生成失败:`, error)

    // 更新失败状态
    await prisma.courseSession.update({
      where: { id: sessionId },
      data: {
        generationResult: {
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    })
  }
}
