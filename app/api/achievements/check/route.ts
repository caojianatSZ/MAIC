/**
 * 成就检查API
 * POST /api/achievements/check
 */

import { NextRequest, NextResponse } from 'next/server'
import { AchievementEngine } from '@/lib/achievements/engine'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, event } = body

    console.log('收到成就检查请求:', { userId, event })

    if (!userId || !event) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数'
      }, { status: 400 })
    }

    // 创建成就引擎实例
    const engine = new AchievementEngine()

    // 处理事件并检查成就
    const unlockedAchievements = await engine.processEvent({
      ...event,
      userId,
      timestamp: new Date()
    })

    console.log('成就检查完成，解锁成就数:', unlockedAchievements.length)

    return NextResponse.json({
      success: true,
      data: {
        unlockedCount: unlockedAchievements.length,
        unlockedAchievements
      }
    })

  } catch (error) {
    console.error('成就检查失败详细错误:', error)
    console.error('错误堆栈:', error instanceof Error ? error.stack : 'Unknown error')

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '成就检查失败',
      debug: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 })
  }
}
