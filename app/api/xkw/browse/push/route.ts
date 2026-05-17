// 学科网推题浏览 API
// 实时调用学科网 API 获取题目列表

import { NextRequest } from 'next/server'
import { getXkwClient } from '@/lib/xkw'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 验证必需参数
    if (!body.course_id || !body.grade_id) {
      return Response.json(
        { code: -1, message: '缺少必需参数: course_id, grade_id' },
        { status: 400 }
      )
    }

    // 记录 API 调用
    await prisma.xkwApiLog.create({
      data: {
        endpoint: 'push_question',
        request: body,
        status: 'pending'
      }
    })

    // 调用学科网 API
    const xkwClient = getXkwClient()
    const questions = await xkwClient.pushQuestions({
      course_id: body.course_id,
      grade_id: body.grade_id,
      volume_id: body.volume_id,
      chapter_id: body.chapter_id,
      section_id: body.section_id,
      knowledge_point_ids: body.knowledge_point_ids,
      difficulty: body.difficulty,
      question_type_ids: body.question_type_ids,
      paper_type_ids: body.paper_type_ids,
      year: body.year,
      area_id: body.area_id,
      count: body.count || 20
    })

    // 检查本地是否已保存
    const questionsWithLocalStatus = await Promise.all(
      questions.map(async (q) => {
        const local = await prisma.question.findFirst({
          where: {
            sourceType: 'xkw',
            sourceId: q.id
          }
        })
        return {
          ...q,
          isLocal: !!local,
          localId: local?.id
        }
      })
    )

    // 更新日志状态
    await prisma.xkwApiLog.create({
      data: {
        endpoint: 'push_question',
        request: body,
        response: { count: questions.length },
        status: 'success'
      }
    })

    return Response.json({
      code: 0,
      message: 'success',
      data: {
        total: questions.length,
        questions: questionsWithLocalStatus
      }
    })
  } catch (error) {
    // 记录错误
    await prisma.xkwApiLog.create({
      data: {
        endpoint: 'push_question',
        request: await request.json().catch(() => ({})),
        status: 'error',
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    }).catch(() => {})

    return Response.json(
      {
        code: -1,
        message: error instanceof Error ? error.message : '请求失败'
      },
      { status: 500 }
    )
  }
}
