/**
 * 创建测试学习记录
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId') || 'test_user'

    // 为二次函数知识点创建5条正确率90%的学习记录
    const knowledgePointId = 'kp_quadratic_function'

    console.log('创建学习记录...')

    for (let i = 0; i < 7; i++) {
      await prisma.studyRecord.create({
        data: {
          userId,
          type: 'quiz',
          subject: 'math',
          knowledgePointId,
          score: 90,
          timeSpent: 300,
          metadata: {
            isCorrect: i < 6 // 6正确1错误
          }
        }
      })
    }

    // 更新learning_progress
    await prisma.learningProgress.upsert({
      where: {
        userId_knowledgePointId: {
          userId,
          knowledgePointId
        }
      },
      create: {
        userId,
        knowledgePointId,
        knowledgePointName: '二次函数',
        masteryLevel: 90,
        practiceCount: 7,
        correctCount: 6,
        lastPracticedAt: new Date()
      },
      update: {
        masteryLevel: 90,
        practiceCount: 7,
        correctCount: 6,
        lastPracticedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        message: '已创建7条学习记录',
        stats: {
          total: 7,
          correct: 6,
          accuracy: 85.7
        }
      }
    })

  } catch (error) {
    console.error('创建数据失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '创建数据失败'
    }, { status: 500 })
  }
}
