/**
 * 每日学习打卡API
 * POST /api/checkin - 签到
 * GET /api/checkin?userId=xxx - 获取打卡信息
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { AchievementEngine } from '@/lib/achievements/engine'

const prisma = new PrismaClient()

/**
 * GET 获取打卡信息
 */
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

    // 获取今天的日期
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 检查今天是否已打卡
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const todayCheckin = await prisma.studyRecord.findFirst({
      where: {
        userId,
        type: 'checkin',
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    // 计算连续打卡天数
    const streak = await calculateStreak(userId)

    // 获取本月打卡天数
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const monthCheckins = await prisma.studyRecord.count({
      where: {
        userId,
        type: 'checkin',
        createdAt: {
          gte: monthStart
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        checkedIn: !!todayCheckin,
        checkinTime: todayCheckin?.createdAt,
        streak,
        monthCheckins,
        todayDate: today.toISOString()
      }
    })

  } catch (error) {
    console.error('获取打卡信息失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取打卡信息失败'
    }, { status: 500 })
  }
}

/**
 * POST 签到打卡
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '缺少用户ID'
      }, { status: 400 })
    }

    // 获取今天的日期
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // 检查今天是否已打卡
    const existingCheckin = await prisma.studyRecord.findFirst({
      where: {
        userId,
        type: 'checkin',
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      }
    })

    if (existingCheckin) {
      return NextResponse.json({
        success: false,
        error: '今天已经打卡过了'
      }, { status: 400 })
    }

    // 创建打卡记录
    const checkin = await prisma.studyRecord.create({
      data: {
        userId,
        type: 'checkin',
        subject: 'daily',
        score: 1,
        timeSpent: 0,
        metadata: {
          checkin_date: today.toISOString()
        }
      }
    })

    // 计算当前连续天数
    const streak = await calculateStreak(userId)

    // 触发成就检查
    const engine = new AchievementEngine()
    const unlockedAchievements = await engine.processEvent({
      type: 'streak',
      userId,
      data: {
        streak
      },
      timestamp: new Date()
    })

    return NextResponse.json({
      success: true,
      data: {
        checkinId: checkin.id,
        checkinTime: checkin.createdAt,
        streak,
        unlockedAchievements
      }
    })

  } catch (error) {
    console.error('打卡失败:', error)
    return NextResponse.json({
      success: false,
      error: '打卡失败'
    }, { status: 500 })
  }
}

/**
 * 计算连续打卡天数
 */
async function calculateStreak(userId: string): Promise<number> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let streak = 0
  const checkDate = today

  // 向前查找连续打卡记录
  while (true) {
    const nextDay = new Date(checkDate)
    nextDay.setDate(nextDay.getDate() + 1)

    const checkin = await prisma.studyRecord.findFirst({
      where: {
        userId,
        type: 'checkin',
        createdAt: {
          gte: checkDate,
          lt: nextDay
        }
      }
    })

    if (checkin) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      break
    }
  }

  return streak
}
