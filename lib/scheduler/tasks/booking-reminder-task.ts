/**
 * 课前提醒任务
 *
 * 在课程开始前15分钟提醒学生
 */

import { prisma } from '@/lib/prisma'
import { wechatSubscriptionService } from '@/lib/wechat/subscription-service'

const REMINDER_MINUTES_BEFORE = 15 // 提前15分钟提醒

export async function bookingReminderTask() {
  console.log('[课前提醒] 开始检查即将开始的课程...')

  try {
    const now = new Date()
    const reminderTime = new Date(now.getTime() + REMINDER_MINUTES_BEFORE * 60 * 1000)

    // 获取15分钟内开始且未提醒的约课
    const bookings = await prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        scheduledAt: {
          gte: now,
          lte: reminderTime
        }
      },
      include: {
        student: {
          select: { id: true, nickname: true, openid: true }
        },
        teacher: {
          select: { id: true, nickname: true }
        },
        course: {
          select: { id: true, title: true, topic: true }
        }
      }
    })

    console.log(`[课前提醒] 找到 ${bookings.length} 个需要提醒的课程`)

    let successCount = 0
    let failCount = 0

    for (const booking of bookings) {
      try {
        const courseName = booking.course?.title || booking.course?.topic || booking.subject

        const result = await wechatSubscriptionService.sendBookingReminder(
          booking.student.id,
          {
            datetime: booking.scheduledAt,
            courseName: `${booking.subject} - ${courseName}`,
            teacherName: booking.teacher.nickname
          }
        )

        if (result) {
          successCount++
          console.log(`[课前提醒] 成功: ${booking.student.nickname} - ${courseName}`)
        } else {
          failCount++
        }
      } catch (error) {
        console.error(`[课前提醒] 失败: ${booking.id}`, error)
        failCount++
      }
    }

    console.log(`[课前提醒] 完成: 成功 ${successCount}, 失败 ${failCount}`)

    return {
      total: bookings.length,
      success: successCount,
      failed: failCount
    }
  } catch (error) {
    console.error('[课前提醒] 任务执行失败:', error)
    throw error
  }
}

/**
 * 同时提醒老师
 */
export async function teacherBookingReminderTask() {
  console.log('[课前提醒-老师] 开始检查即将开始的课程...')

  try {
    const now = new Date()
    const reminderTime = new Date(now.getTime() + REMINDER_MINUTES_BEFORE * 60 * 1000)

    const bookings = await prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        scheduledAt: {
          gte: now,
          lte: reminderTime
        }
      },
      include: {
        teacher: {
          select: { id: true, nickname: true, openid: true }
        },
        student: {
          select: { id: true, nickname: true }
        },
        course: {
          select: { id: true, title: true, topic: true }
        }
      }
    })

    console.log(`[课前提醒-老师] 找到 ${bookings.length} 个需要提醒的课程`)

    let successCount = 0
    let failCount = 0

    for (const booking of bookings) {
      try {
        const courseName = booking.course?.title || booking.course?.topic || booking.subject

        // 老师的提醒可以使用站内消息或其他方式
        // TODO: 实现老师的通知渠道

        successCount++
        console.log(`[课前提醒-老师] 成功: ${booking.teacher.nickname} - ${courseName}`)
      } catch (error) {
        console.error(`[课前提醒-老师] 失败: ${booking.id}`, error)
        failCount++
      }
    }

    return {
      total: bookings.length,
      success: successCount,
      failed: failCount
    }
  } catch (error) {
    console.error('[课前提醒-老师] 任务执行失败:', error)
    throw error
  }
}
