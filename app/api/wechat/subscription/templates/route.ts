import { NextRequest, NextResponse } from 'next/server'
import { wechatSubscriptionService } from '@/lib/wechat/subscription-service'

// GET /api/wechat/subscription/templates - 获取订阅消息模板列表
export async function GET() {
  try {
    const templates = wechatSubscriptionService.getTemplates()

    return NextResponse.json({
      success: true,
      data: templates
    })
  } catch (error) {
    console.error('获取模板列表失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取模板列表失败'
    }, { status: 500 })
  }
}
