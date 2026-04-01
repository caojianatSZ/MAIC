/**
 * 成就系统测试API
 * 用于验证成就系统功能
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { AchievementEngine } from '@/lib/achievements/engine'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'status'
    const userId = searchParams.get('userId') || 'test_user'

    // 测试状态
    if (action === 'status') {
      const achievementCount = await prisma.achievement.count()
      const userAchievementCount = await prisma.userAchievement.count({
        where: { userId }
      })

      return NextResponse.json({
        success: true,
        data: {
          message: '成就系统运行正常',
          stats: {
            totalAchievements: achievementCount,
            userAchievements: userAchievementCount
          }
        }
      })
    }

    // 模拟诊断事件
    if (action === 'simulate_diagnosis') {
      const engine = new AchievementEngine()

      const result = await engine.processEvent({
        type: 'diagnosis_finished',
        userId,
        subject: 'math',
        knowledgePointId: 'kp_quadratic_function',
        data: {
          score: 80,
          correctCount: 4,
          totalCount: 5
        },
        timestamp: new Date()
      })

      return NextResponse.json({
        success: true,
        data: {
          message: '诊断事件处理完成',
          unlockedAchievements: result,
          event: {
            type: 'diagnosis_finished',
            subject: 'math',
            score: 80
          }
        }
      })
    }

    // 模拟学习打卡
    if (action === 'simulate_streak') {
      // 创建最近7天的学习记录
      const today = new Date()
      for (let i = 0; i < 7; i++) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)
        date.setHours(10, 0, 0, 0)

        await prisma.studyRecord.create({
          data: {
            userId,
            type: 'quiz',
            subject: 'math',
            knowledgePointId: 'kp_quadratic_function',
            score: Math.floor(Math.random() * 40) + 60,
            timeSpent: 300
          }
        })
      }

      // 检查成就
      const engine = new AchievementEngine()
      const result = await engine.processEvent({
        type: 'streak',
        userId,
        data: {},
        timestamp: new Date()
      })

      return NextResponse.json({
        success: true,
        data: {
          message: '已创建7天学习记录',
          unlockedAchievements: result
        }
      })
    }

    // 获取用户成就
    if (action === 'user_achievements') {
      const achievements = await prisma.userAchievement.findMany({
        where: { userId },
        include: {
          achievement: true
        }
      })

      return NextResponse.json({
        success: true,
        data: {
          achievements: achievements.map(ua => ({
            name: ua.achievement.name,
            level: ua.achievement.level,
            progress: ua.progress,
            unlocked: ua.unlockedAt !== null
          }))
        }
      })
    }

    // 重置测试数据
    if (action === 'reset') {
      await prisma.userAchievement.deleteMany({
        where: { userId }
      })
      await prisma.studyRecord.deleteMany({
        where: { userId }
      })

      return NextResponse.json({
        success: true,
        data: {
          message: '测试数据已重置'
        }
      })
    }

    return NextResponse.json({
      success: false,
      error: '未知操作'
    }, { status: 400 })

  } catch (error) {
    console.error('测试API错误:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '测试失败'
    }, { status: 500 })
  }
}
