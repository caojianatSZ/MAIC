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

    return NextResponse.json({
      success: true,
      data: {
        unlockedCount: unlockedAchievements.length,
        unlockedAchievements
      }
    })

  } catch (error) {
    console.error('成就检查失败:', error)
    return NextResponse.json({
      success: false,
      error: '成就检查失败'
    }, { status: 500 })
  }
}
