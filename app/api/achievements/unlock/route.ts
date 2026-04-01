/**
 * 解锁成就API
 * POST /api/achievements/unlock
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, achievementId, knowledgePointId } = body

    if (!userId || !achievementId) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数'
      }, { status: 400 })
    }

    // 检查成就是否存在
    const achievement = await prisma.achievement.findUnique({
      where: { id: achievementId }
    })

    if (!achievement) {
      return NextResponse.json({
        success: false,
        error: '成就不存在'
      }, { status: 404 })
    }

    // 检查用户是否已解锁该成就
    const existingUserAchievement = await prisma.userAchievement.findUnique({
      where: {
        userId_achievementId: {
          userId,
          achievementId
        }
      }
    })

    if (existingUserAchievement && existingUserAchievement.unlockedAt) {
      return NextResponse.json({
        success: false,
        error: '成就已解锁'
      }, { status: 400 })
    }

    // 解锁成就
    const userAchievement = await prisma.userAchievement.upsert({
      where: {
        userId_achievementId: {
          userId,
          achievementId
        }
      },
      create: {
        userId,
        achievementId,
        progress: 100,
        unlockedAt: new Date(),
        notified: false
      },
      update: {
        progress: 100,
        unlockedAt: new Date()
      },
      include: {
        achievement: true
      }
    })

    // TODO: 发送成就解锁通知（WebSocket或小程序通知）

    return NextResponse.json({
      success: true,
      data: {
        achievement: {
          id: userAchievement.achievement.id,
          type: userAchievement.achievement.type,
          subject: userAchievement.achievement.subject,
          knowledgePointId: userAchievement.achievement.knowledgePointId,
          level: userAchievement.achievement.level,
          name: userAchievement.achievement.name,
          description: userAchievement.achievement.description,
          icon: userAchievement.achievement.iconUrl,
          unlockedAt: userAchievement.unlockedAt
        }
      }
    })

  } catch (error) {
    console.error('解锁成就失败:', error)
    return NextResponse.json({
      success: false,
      error: '解锁成就失败'
    }, { status: 500 })
  }
}
