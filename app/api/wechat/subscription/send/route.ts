import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { wechatSubscriptionService } from '@/lib/wechat/subscription-service'

// POST /api/wechat/subscription/send - 发送订阅消息
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, type, data } = body

    if (!userId || !type) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数: userId, type'
      }, { status: 400 })
    }

    let result = false

    switch (type) {
      case 'booking_reminder':
        result = await wechatSubscriptionService.sendBookingReminder(userId, data)
        break

      case 'course_complete':
        result = await wechatSubscriptionService.sendCourseComplete(userId, data)
        break

      case 'achievement_unlock':
        result = await wechatSubscriptionService.sendAchievementUnlock(userId, data)
        break

      case 'payment_received':
        result = await wechatSubscriptionService.sendPaymentReceived(userId, data)
        break

      default:
        return NextResponse.json({
          success: false,
          error: `不支持的消息类型: ${type}`
        }, { status: 400 })
    }

    return NextResponse.json({
      success: result,
      message: result ? '订阅消息发送成功' : '订阅消息发送失败'
    })
  } catch (error) {
    console.error('发送订阅消息失败:', error)
    return NextResponse.json({
      success: false,
      error: '发送订阅消息失败'
    }, { status: 500 })
  }
}

// GET /api/wechat/subscription/send?userId=xxx - 获取用户订阅状态
export async function GET_REQUEST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '缺少用户ID'
      }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nickname: true,
        openid: true
      }
    })

    if (!user) {
      return NextResponse.json({
        success: false,
        error: '用户不存在'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        nickname: user.nickname,
        hasOpenid: !!user.openid,
        canReceive: !!user.openid
      }
    })
  } catch (error) {
    console.error('获取订阅状态失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取订阅状态失败'
    }, { status: 500 })
  }
}
