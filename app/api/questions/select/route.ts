// 选择题目并保存到本地题库

import { NextRequest } from 'next/server'
import { getXkwClient } from '@/lib/xkw'
import { prisma } from '@/lib/db'
import { generateIdentifier } from '@/lib/utils/identifier'

// 学科科目映射
const SUBJECT_MAP: Record<number, string> = {
  1: 'math',
  2: 'chinese',
  3: 'english',
  4: 'physics',
  5: 'chemistry',
  6: 'biology',
  7: 'history',
  8: 'geography',
  9: 'politics'
}

// 题型映射
const QUESTION_TYPE_MAP: Record<number, string> = {
  1: 'single_choice',
  2: 'multiple_choice',
  3: 'fill_blank',
  4: 'essay',
  5: 'judge',
  6: 'calculation'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { xkwQuestionId, paperId } = body

    if (!xkwQuestionId) {
      return Response.json(
        { code: -1, message: '缺少 xkwQuestionId 参数' },
        { status: 400 }
      )
    }

    // 检查是否已保存
    const existing = await prisma.question.findFirst({
      where: {
        sourceType: 'xkw',
        sourceId: xkwQuestionId
      }
    })

    if (existing) {
      // 已存在，直接关联到试卷
      if (paperId) {
        const paper = await prisma.testPaper.findFirst({
          where: { id: paperId }
        })

        if (paper) {
          const maxOrder = await prisma.testPaperQuestion.findFirst({
            where: { paperId },
            orderBy: { order: 'desc' }
          })

          await prisma.testPaperQuestion.create({
            data: {
              paperId,
              questionId: existing.id,
              order: (maxOrder?.order ?? 0) + 1
            }
          })
        }
      }

      return Response.json({
        code: 0,
        message: 'success',
        data: {
          questionId: existing.id,
          isNew: false
        }
      })
    }

    // 从学科网获取详情
    const xkwClient = getXkwClient()
    const xkwQuestion = await xkwClient.getQuestionDetail(xkwQuestionId)

    // 保存到本地
    const newQuestion = await prisma.question.create({
      data: {
        identifier: generateIdentifier(),
        subject: SUBJECT_MAP[xkwQuestion.course_id] || 'other',
        type: QUESTION_TYPE_MAP[xkwQuestion.type] || 'choice',
        questionType: QUESTION_TYPE_MAP[xkwQuestion.question_type] || 'choice',
        question: xkwQuestion.content,
        options: xkwQuestion.options || [],
        answer: xkwQuestion.answer,
        explanation: xkwQuestion.analysis,
        difficulty: xkwQuestion.difficulty || 3,
        sourceType: 'xkw',
        sourceId: xkwQuestion.id,
        xkwData: xkwQuestion as any
      }
    })

    // 关联到试卷
    if (paperId) {
      const paper = await prisma.testPaper.findFirst({
        where: { id: paperId }
      })

      if (paper) {
        const maxOrder = await prisma.testPaperQuestion.findFirst({
          where: { paperId },
          orderBy: { order: 'desc' }
        })

        await prisma.testPaperQuestion.create({
          data: {
            paperId,
            questionId: newQuestion.id,
            order: (maxOrder?.order ?? 0) + 1
          }
        })
      }
    }

    return Response.json({
      code: 0,
      message: 'success',
      data: {
        questionId: newQuestion.id,
        isNew: true
      }
    })
  } catch (error) {
    return Response.json(
      {
        code: -1,
        message: error instanceof Error ? error.message : '保存失败'
      },
      { status: 500 }
    )
  }
}
