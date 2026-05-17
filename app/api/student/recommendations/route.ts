import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
    const weakPoints = await prisma.knowledgeMastery.findMany({
      where: {
        userId,
        masteryLevel: 'weak',
        ...(subject && { subject })
      },
      orderBy: { lastAttemptAt: 'asc' },
      take: limit * 2
    })

    // 获取需要巩固的知识点（部分掌握）
    const partialPoints = await prisma.knowledgeMastery.findMany({
      where: {
        userId,
        masteryLevel: 'partial',
        ...(subject && { subject })
      },
      orderBy: { totalAttempts: 'asc' },
      take: limit
    })

    // 获取已掌握但可能需要复习的知识点
    const masteredPoints = await prisma.knowledgeMastery.findMany({
      where: {
        userId,
        masteryLevel: 'mastered',
        ...(subject && { subject })
      },
      orderBy: { lastAttemptAt: 'asc' },
      take: Math.ceil(limit / 2)
    })

    // 组合推荐
    const recommendations = [
      // 优先推荐薄弱知识点
      ...weakPoints.slice(0, limit).map(m => ({
        type: 'weak' as const,
        priority: 'high' as const,
        knowledgePoint: {
          uri: m.knowledgeUri,
          name: m.knowledgeName,
          subject: m.subject,
          grade: m.grade
        },
        reason: '需要重点学习',
        masteryInfo: {
          level: 'weak' as const,
          attempts: m.totalAttempts,
          score: m.masteryScore,
          lastAttempt: m.lastAttemptAt
        }
      })),
      // 其次推荐需要巩固的
      ...partialPoints.slice(0, Math.ceil(limit / 2)).map(m => ({
        type: 'practice' as const,
        priority: 'medium' as const,
        knowledgePoint: {
          uri: m.knowledgeUri,
          name: m.knowledgeName,
          subject: m.subject,
          grade: m.grade
        },
        reason: '需要巩固练习',
        masteryInfo: {
          level: 'partial' as const,
          attempts: m.totalAttempts,
          score: m.masteryScore,
          lastAttempt: m.lastAttemptAt
        }
      })),
      // 最后推荐复习已掌握的
      ...masteredPoints.slice(0, Math.ceil(limit / 3)).map(m => ({
        type: 'review' as const,
        priority: 'low' as const,
        knowledgePoint: {
          uri: m.knowledgeUri,
          name: m.knowledgeName,
          subject: m.subject,
          grade: m.grade
        },
        reason: '定时复习防止遗忘',
        masteryInfo: {
          level: 'mastered' as const,
          attempts: m.totalAttempts,
          score: m.masteryScore,
          lastAttempt: m.lastAttemptAt
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
