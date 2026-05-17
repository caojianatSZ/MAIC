import { NextRequest, NextResponse } from 'next/server'
import { globalScheduler } from '@/lib/scheduler'
import { CRON_PRESETS } from '@/lib/scheduler/cron-parser'

// GET /api/admin/scheduler - 获取调度器状态
export async function GET() {
  const status = globalScheduler.getStatus()

  return NextResponse.json({
    success: true,
    data: {
      running: true,
      tasks: status,
      presets: Object.entries(CRON_PRESETS).map(([name, expression]) => ({
        name,
        expression
      }))
    }
  })
}

// POST /api/admin/scheduler/trigger - 手动触发任务
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { taskId } = body

    if (!taskId) {
      return NextResponse.json({
        success: false,
        error: '缺少任务ID'
      }, { status: 400 })
    }

    const result = await globalScheduler.trigger(taskId)

    return NextResponse.json({
      success: true,
      data: { triggered: result }
    })
  } catch (error) {
    console.error('[调度器] 触发任务失败:', error)
    return NextResponse.json({
      success: false,
      error: '触发任务失败'
    }, { status: 500 })
  }
}

// PATCH /api/admin/scheduler - 更新任务配置
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { taskId, enabled, schedule } = body

    if (!taskId) {
      return NextResponse.json({
        success: false,
        error: '缺少任务ID'
      }, { status: 400 })
    }

    if (enabled !== undefined) {
      globalScheduler.toggle(taskId, enabled)
    }

    if (schedule) {
      globalScheduler.reschedule(taskId, schedule)
    }

    const updatedStatus = globalScheduler.getStatus()

    return NextResponse.json({
      success: true,
      data: updatedStatus.find(t => t.id === taskId)
    })
  } catch (error) {
    console.error('[调度器] 更新任务失败:', error)
    return NextResponse.json({
      success: false,
      error: '更新任务失败'
    }, { status: 500 })
  }
}
