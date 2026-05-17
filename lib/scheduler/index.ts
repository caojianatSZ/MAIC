/**
 * 调度器配置和初始化
 *
 * 注册所有定时任务
 */

import { globalScheduler } from './task-scheduler'
import { CRON_PRESETS } from './cron-parser'
import {
  bookingReminderTask,
  teacherBookingReminderTask
} from './tasks/booking-reminder-task'
import {
  dailyStudySummaryTask,
  dailyLeadSummaryTask,
  dailyOpsReportTask
} from './tasks/daily-summary-task'

/**
 * 初始化并启动调度器
 */
export function initScheduler() {
  console.log('[调度器] 初始化定时任务...')

  // 课前提醒 - 每5分钟检查一次
  globalScheduler.addTask({
    id: 'booking-reminder',
    name: '课前提醒（学生）',
    schedule: CRON_PRESETS.EVERY_5_MINUTES,
    enabled: true,
    description: '课程开始前15分钟提醒学生',
    handler: bookingReminderTask
  })

  // 课前提醒（老师）- 每5分钟检查一次
  globalScheduler.addTask({
    id: 'teacher-booking-reminder',
    name: '课前提醒（老师）',
    schedule: CRON_PRESETS.EVERY_5_MINUTES,
    enabled: true,
    description: '课程开始前15分钟提醒老师',
    handler: teacherBookingReminderTask
  })

  // 每日学习报告 - 每天21:00发送
  globalScheduler.addTask({
    id: 'daily-study-summary',
    name: '每日学习报告',
    schedule: '0 21 * * *', // 每天21点
    enabled: true,
    description: '每日晚上9点发送学习日报',
    handler: dailyStudySummaryTask
  })

  // 每日线索汇总 - 每天9:00生成
  globalScheduler.addTask({
    id: 'daily-lead-summary',
    name: '每日线索汇总',
    schedule: '0 9 * * *', // 每天9点
    enabled: true,
    description: '每天早上9点生成线索报告',
    handler: dailyLeadSummaryTask
  })

  // 每日运营报告 - 每天8:00生成
  globalScheduler.addTask({
    id: 'daily-ops-report',
    name: '每日运营报告',
    schedule: '0 8 * * *', // 每天8点
    enabled: true,
    description: '每天早上8点生成运营数据',
    handler: dailyOpsReportTask
  })

  // 启动调度器
  globalScheduler.start()

  console.log('[调度器] 定时任务初始化完成')
}

/**
 * 服务端启动时自动初始化
 */
if (typeof window === 'undefined') {
  initScheduler()
}

export { globalScheduler }
export type { ScheduledTask } from './task-scheduler'
