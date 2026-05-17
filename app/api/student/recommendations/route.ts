import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/student/recommendations?userId=xxx&subject=math - 获取学习推荐
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const subject = searchParams.get('subject')
    const limit = parseInt(searchParams.get('limit') || '5')

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '缺少用户ID'
      }, { status: 400 })
    }

    // 获取学生薄弱知识点
    const weakPoints = await prisma.knowledgePointMastery.findMany({
      where: {
        userId,
        masteryLevel: 'WEAK',
        ...(subject && { knowledgePoint: { subject } })
      },
      include: { knowledgePoint: true },
      orderBy: { lastReviewedAt: 'asc' },
      take: limit * 2
    })

    // 获取需要巩固的知识点（部分掌握）
    const partialPoints = await prisma.knowledgePointMastery.findMany({
      where: {
        userId,
        masteryLevel: 'PARTIAL',
        ...(subject && { knowledgePoint: { subject } })
      },
      include: { knowledgePoint: true },
      orderBy: { practiceCount: 'asc' },
      take: limit
    })

    // 获取已掌握但可能需要复习的知识点
    const masteredPoints = await prisma.knowledgePointMastery.findMany({
      where: {
        userId,
        masteryLevel: 'MASTERED',
        ...(subject && { knowledgePoint: { subject } })
      },
      include: { knowledgePoint: true },
      orderBy: { lastReviewedAt: 'asc' },
      take: Math.ceil(limit / 2)
    })

    // 组合推荐
    const recommendations = [
      // 优先推荐薄弱知识点
      ...weakPoints.slice(0, limit).map(m => ({
        type: 'weak',
        priority: 'high',
        knowledgePoint: {
          id: m.knowledgePoint.id,
          name: m.knowledgePoint.name,
          subject: m.knowledgePoint.subject,
          grade: m.knowledgePoint.grade
        },
        reason: '需要重点学习',
        masteryInfo: {
          level: 'weak',
          practiceCount: m.practiceCount,
          lastReviewed: m.lastReviewedAt
        }
      })),
      // 其次推荐需要巩固的
      ...partialPoints.slice(0, Math.ceil(limit / 2)).map(m => ({
        type: 'practice',
        priority: 'medium',
        knowledgePoint: {
          id: m.knowledgePoint.id,
          name: m.knowledgePoint.name,
          subject: m.knowledgePoint.subject,
          grade: m.knowledgePoint.grade
        },
        reason: '需要巩固练习',
        masteryInfo: {
          level: 'partial',
          practiceCount: m.practiceCount,
          lastReviewed: m.lastReviewedAt
        }
      })),
      // 最后推荐复习已掌握的
      ...masteredPoints.slice(0, Math.ceil(limit / 3)).map(m => ({
        type: 'review',
        priority: 'low',
        knowledgePoint: {
          id: m.knowledgePoint.id,
          name: m.knowledgePoint.name,
          subject: m.knowledgePoint.subject,
          grade: m.knowledgePoint.grade
        },
        reason: '定时复习防止遗忘',
        masteryInfo: {
          level: 'mastered',
          practiceCount: m.practiceCount,
          lastReviewed: m.lastReviewedAt
        }
      }))
    ].slice(0, limit)

    return NextResponse.json({
      success: true,
      data: {
        recommendations,
        summary: {
          weakCount: weakPoints.length,
          partialCount: partialPoints.length,
          masteredCount: masteredPoints.length
        }
      }
    })
  } catch (error) {
    console.error('获取学习推荐失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取学习推荐失败'
    }, { status: 500 })
  }
}
