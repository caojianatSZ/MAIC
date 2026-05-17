import { NextRequest, NextResponse } from 'next/server'
import { notificationService } from '@/lib/notifications/notification-service'

// GET /api/notifications/templates - 获取通知模板列表
export async function GET() {
  try {
    const templates = notificationService.getTemplates()

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
