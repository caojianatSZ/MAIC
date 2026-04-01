/**
 * 获取用户成就列表API
 * GET /api/achievements?userId=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '缺少用户ID'
      }, { status: 400 })
    }

    // 获取用户的所有成就
    const userAchievements = await prisma.userAchievement.findMany({
      where: {
        userId
      },
      include: {
        achievement: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // 格式化返回数据
    const achievements = userAchievements.map(ua => ({
      id: ua.achievement.id,
      type: ua.achievement.type,
      subject: ua.achievement.subject,
      knowledgePointId: ua.achievement.knowledgePointId,
      level: ua.achievement.level,
      name: ua.achievement.name,
      description: ua.achievement.description,
      icon: ua.achievement.iconUrl,
      unlockedAt: ua.unlockedAt,
      progress: ua.progress,
      unlocked: ua.unlockedAt !== null
    }))

    return NextResponse.json({
      success: true,
      data: {
        achievements,
        summary: {
          total: achievements.length,
          unlocked: achievements.filter(a => a.unlocked).length,
          byLevel: {
            bronze: achievements.filter(a => a.level === 'bronze' && a.unlocked).length,
            silver: achievements.filter(a => a.level === 'silver' && a.unlocked).length,
            gold: achievements.filter(a => a.level === 'gold' && a.unlocked).length,
            diamond: achievements.filter(a => a.level === 'diamond' && a.unlocked).length,
            king: achievements.filter(a => a.level === 'king' && a.unlocked).length
          }
        }
      }
    })

  } catch (error) {
    console.error('获取成就列表失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取成就列表失败'
    }, { status: 500 })
  }
}
