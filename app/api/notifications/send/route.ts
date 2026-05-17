import { NextRequest, NextResponse } from 'next/server'
import { sendNotification, sendNotificationBatch } from '@/lib/notifications/notification-service'

// POST /api/notifications/send - 发送通知
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userIds, template, title, content, data, isBatch } = body

    if (!userIds || !template || !title || !content) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数: userIds, template, title, content'
      }, { status: 400 })
    }

    const message = {
      title,
      content,
      data
    }

    let result

    if (isBatch && Array.isArray(userIds)) {
      // 批量发送
      result = await sendNotificationBatch(userIds, template, message)
    } else {
      // 单个发送
      const userId = Array.isArray(userIds) ? userIds[0] : userIds
      const success = await sendNotification(userId, template, message)
      result = { success: success ? 1 : 0, failed: success ? 0 : 1 }
    }

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('发送通知失败:', error)
    return NextResponse.json({
      success: false,
      error: '发送通知失败'
    }, { status: 500 })
  }
}
