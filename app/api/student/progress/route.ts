import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { apiSuccess } from '@/lib/server/api-response'

const prisma = new PrismaClient()

// POST /api/student/progress - 记录学习进度
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      userId,
      recordType,
      subject,
      knowledgePointId,
      studyDuration,
      score,
      totalQuestions,
      correctQuestions,
      courseId
    } = body

    if (!userId || !recordType) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数: userId, recordType'
      }, { status: 400 })
    }

    // 创建学习记录
    const studyRecord = await prisma.studyRecord.create({
      data: {
        userId,
        recordType,
        subject,
        knowledgePointId,
        studyDuration: studyDuration || 0,
        score,
        totalQuestions,
        correctQuestions,
        courseId
      }
    })

    // 更新学生画像统计
    const profile = await prisma.studentProfile.findUnique({
      where: { userId }
    })

    if (profile) {
      const studyStats = (profile.studyStats as any) || {
        totalStudyTime: 0,
        questionsCompleted: 0,
        lessonsLearned: 0,
        currentStreak: 0,
        longestStreak: 0
      }

      studyStats.totalStudyTime += studyDuration || 0
      if (recordType === 'quiz') {
        studyStats.questionsCompleted += totalQuestions || 0
      } else if (recordType === 'lesson') {
        studyStats.lessonsLearned += 1
      }

      await prisma.studentProfile.update({
        where: { userId },
        data: {
          studyStats,
          lastUpdated: new Date()
        }
      })
    }

    // 如果关联知识点，更新掌握度
    if (knowledgePointId) {
      const existing = await prisma.knowledgePointMastery.findUnique({
        where: {
          userId_knowledgePointId: {
            userId,
            knowledgePointId
          }
        }
      })

      const newMasteryLevel = calculateMasteryLevel({
        score,
        correctQuestions,
        totalQuestions,
        existingLevel: existing?.masteryLevel,
        practiceCount: existing?.practiceCount || 0
      })

      if (existing) {
        await prisma.knowledgePointMastery.update({
          where: { id: existing.id },
          data: {
            masteryLevel: newMasteryLevel,
            practiceCount: existing.practiceCount + 1,
            lastPracticeScore: score,
            lastReviewedAt: new Date()
          }
        })
      } else {
        await prisma.knowledgePointMastery.create({
          data: {
            userId,
            knowledgePointId,
            masteryLevel: newMasteryLevel,
            practiceCount: 1,
            lastPracticeScore: score,
            lastReviewedAt: new Date()
          }
        })
      }
    }

    // 检查并触发成就
    // TODO: 调用成就检查 API

    return apiSuccess({
      studyRecord,
      message: '学习进度已记录'
    }, 201)
  } catch (error) {
    console.error('记录学习进度失败:', error)
    return NextResponse.json({
      success: false,
      error: '记录学习进度失败'
    }, { status: 500 })
  }
}

// GET /api/student/progress?userId=xxx - 获取学习进度历史
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '缺少用户ID'
      }, { status: 400 })
    }

    const records = await prisma.studyRecord.findMany({
      where: { userId },
      include: {
        knowledgePoint: {
          select: { id: true, name: true, subject: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return apiSuccess({
      records: records.map(r => ({
        id: r.id,
        type: r.recordType,
        subject: r.subject,
        knowledgePoint: r.knowledgePoint,
        studyDuration: r.studyDuration,
        score: r.score,
        totalQuestions: r.totalQuestions,
        correctQuestions: r.correctQuestions,
        createdAt: r.createdAt.toISOString()
      }))
    })
  } catch (error) {
    console.error('获取学习进度失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取学习进度失败'
    }, { status: 500 })
  }
}

// 计算掌握度等级
function calculateMasteryLevel({
  score,
  correctQuestions,
  totalQuestions,
  existingLevel,
  practiceCount
}: {
  score?: number
  correctQuestions?: number
  totalQuestions?: number
  existingLevel?: string | null
  practiceCount?: number
}): 'MASTERED' | 'PARTIAL' | 'WEAK' {
  // 计算正确率
  let accuracy = 0
  if (score !== undefined) {
    accuracy = score / 100
  } else if (correctQuestions !== undefined && totalQuestions && totalQuestions > 0) {
    accuracy = correctQuestions / totalQuestions
  }

  // 基于正确率和练习次数判断掌握度
  if (accuracy >= 0.8 && (practiceCount || 0) >= 2) {
    return 'MASTERED'
  } else if (accuracy >= 0.5) {
    return 'PARTIAL'
  } else {
    return 'WEAK'
  }
}
