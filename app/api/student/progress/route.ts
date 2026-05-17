import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess } from '@/lib/server/api-response'

// POST /api/student/progress - 记录学习进度
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      userId,
      type,
      subject,
      knowledgePointId,
      timeSpent,
      score,
      metadata
    } = body

    if (!userId || !type) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数: userId, type'
      }, { status: 400 })
    }

    // 创建学习记录
    const studyRecord = await prisma.studyRecord.create({
      data: {
        userId,
        type,
        subject,
        knowledgePointId,
        timeSpent: timeSpent || 0,
        score,
        metadata
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
        lessonsLearned: 0
      }

      studyStats.totalStudyTime += timeSpent || 0
      if (type === 'quiz') {
        studyStats.questionsCompleted += 1
      } else if (type === 'lesson') {
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

    // 如果关联知识点（eduKG 知识点 URI），更新掌握度
    if (knowledgePointId && type === 'quiz') {
      const existing = await prisma.knowledgeMastery.findUnique({
        where: {
          knowledgeUri: knowledgePointId
        }
      })

      const isCorrect = score !== undefined && score >= 60

      if (existing) {
        // 更新现有记录
        await prisma.knowledgeMastery.update({
          where: { knowledgeUri: knowledgePointId },
          data: {
            totalAttempts: existing.totalAttempts + 1,
            correctCount: existing.correctCount + (isCorrect ? 1 : 0),
            wrongCount: existing.wrongCount + (isCorrect ? 0 : 1),
            masteryScore: Math.min(100, Math.round(
              ((existing.correctCount + (isCorrect ? 1 : 0)) / (existing.totalAttempts + 1)) * 100
            )),
            masteryLevel: calculateMasteryLevel(
              ((existing.correctCount + (isCorrect ? 1 : 0)) / (existing.totalAttempts + 1)) * 100
            ),
            lastAttemptAt: new Date(),
            masteredAt: isCorrect && existing.totalAttempts >= 2 ? new Date() : existing.masteredAt
          }
        })
      } else {
        // 创建新记录
        const masteryScore = isCorrect ? 100 : 0
        await prisma.knowledgeMastery.create({
          data: {
            userId,
            knowledgeUri: knowledgePointId,
            knowledgeName: knowledgePointId.split('/').pop() || 'Unknown',
            subject: subject || 'unknown',
            totalAttempts: 1,
            correctCount: isCorrect ? 1 : 0,
            wrongCount: isCorrect ? 0 : 1,
            masteryScore,
            masteryLevel: calculateMasteryLevel(masteryScore)
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
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return apiSuccess({
      records: records.map(r => ({
        id: r.id,
        type: r.type,
        subject: r.subject,
        knowledgePointId: r.knowledgePointId,
        timeSpent: r.timeSpent,
        score: r.score,
        metadata: r.metadata,
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
function calculateMasteryLevel(score: number): 'mastered' | 'partial' | 'weak' {
  if (score >= 80) {
    return 'mastered'
  } else if (score >= 50) {
    return 'partial'
  } else {
    return 'weak'
  }
}
