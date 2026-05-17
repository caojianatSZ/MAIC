/**
 * 每日学习汇总任务
 *
 * 每天晚上9点发送学习日报给学生
 */

import { PrismaClient } from '@prisma/client'
import { wechatSubscriptionService } from '@/lib/wechat/subscription-service'

const prisma = new PrismaClient()

export async function dailyStudySummaryTask() {
  console.log('[每日汇总] 开始生成学习日报...')

  try {
    // 获取昨天的日期范围
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 获取昨天有学习记录的学生
    const studyRecords = await prisma.studyRecord.groupBy({
      by: ['userId'],
      where: {
        createdAt: {
          gte: yesterday,
          lt: today
        }
      },
      _count: true,
      _sum: {
        studyDuration: true
      }
    })

    console.log(`[每日汇总] 找到 ${studyRecords.length} 个有学习记录的学生`)

    let successCount = 0
    let failCount = 0

    for (const record of studyRecords) {
      try {
        // 获取详细信息
        const user = await prisma.user.findUnique({
          where: { id: record.userId },
          select: { id: true, nickname: true, wechatOpenid: true }
        })

        if (!user || !user.wechatOpenid) {
          failCount++
          continue
        }

        // 统计课程数量
        const lessonCount = await prisma.studyRecord.count({
          where: {
            userId: record.userId,
            recordType: 'lesson',
            createdAt: {
              gte: yesterday,
              lt: today
            }
          }
        })

        // 计算表现评价
        const quizRecords = await prisma.studyRecord.findMany({
          where: {
            userId: record.userId,
            recordType: 'quiz',
            createdAt: {
              gte: yesterday,
              lt: today
            },
            score: { not: null }
          },
          select: { score: true }
        })

        let performance = '继续保持'
        if (quizRecords.length > 0) {
          const avgScore = quizRecords.reduce((sum, r) => sum + (r.score || 0), 0) / quizRecords.length
          if (avgScore >= 90) performance = '表现优秀'
          else if (avgScore >= 80) performance = '表现良好'
          else if (avgScore >= 60) performance = '继续努力'
        }

        const studyTime = record._sum.studyDuration || 0

        // 发送订阅消息
        const result = await wechatSubscriptionService.sendDailyStudyReport(
          [user.id],
          {
            date: yesterday,
            studyTime,
            completedCourses: lessonCount,
            performance
          }
        )

        if (result.success > 0) {
          successCount++
          console.log(`[每日汇总] 成功: ${user.nickname}`)
        } else {
          failCount++
        }
      } catch (error) {
        console.error(`[每日汇总] 失败: ${record.userId}`, error)
        failCount++
      }
    }

    console.log(`[每日汇总] 完成: 成功 ${successCount}, 失败 ${failCount}`)

    return {
      total: studyRecords.length,
      success: successCount,
      failed: failCount
    }
  } catch (error) {
    console.error('[每日汇总] 任务执行失败:', error)
    throw error
  }
}

/**
 * 为合伙人生成每日线索汇总
 */
export async function dailyLeadSummaryTask() {
  console.log('[线索汇总] 开始生成每日线索报告...')

  try {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 获取所有有线索的城市合伙人
    const partners = await prisma.user.findMany({
      where: {
        role: 'CITY_PARTNER'
      },
      include: {
        city: {
          select: { id: true, name: true }
        }
      }
    })

    console.log(`[线索汇总] 找到 ${partners.length} 个城市合伙人`)

    for (const partner of partners) {
      try {
        // 统计该城市的新线索
        const newLeads = await prisma.trialLead.count({
          where: {
            cityId: partner.cityId,
            createdAt: {
              gte: yesterday,
              lt: today
            }
          }
        })

        // 统计转化的线索
        const convertedLeads = await prisma.trialLead.count({
          where: {
            cityId: partner.cityId,
            status: 'CONVERTED',
            convertedAt: {
              gte: yesterday,
              lt: today
            }
          }
        })

        // 统计今天的试课
        const todayBookings = await prisma.booking.count({
          where: {
            cityId: partner.cityId,
            scheduledAt: {
              gte: yesterday,
              lt: today
            }
          }
        })

        console.log(`[线索汇总] ${partner.city?.name}: 新线索${newLeads}, 转化${convertedLeads}, 试课${todayBookings}`)

        // TODO: 发送给合伙人（需要实现合伙人通知渠道）

      } catch (error) {
        console.error(`[线索汇总] 处理合伙人失败: ${partner.id}`, error)
      }
    }

    console.log('[线索汇总] 完成')

    return { success: true }
  } catch (error) {
    console.error('[线索汇总] 任务执行失败:', error)
    throw error
  }
}

/**
 * 为总部生成每日运营报告
 */
export async function dailyOpsReportTask() {
  console.log('[运营报告] 开始生成每日运营数据...')

  try {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 全局统计
    const [newLeads, conversions, bookings, revenue] = await Promise.all([
      prisma.trialLead.count({
        where: { createdAt: { gte: yesterday, lt: today } }
      }),
      prisma.trialLead.count({
        where: {
          status: 'CONVERTED',
          convertedAt: { gte: yesterday, lt: today }
        }
      }),
      prisma.booking.count({
        where: { scheduledAt: { gte: yesterday, lt: today } }
      }),
      prisma.paymentRecord.aggregate({
        where: {
          status: 'PAID',
          createdAt: { gte: yesterday, lt: today }
        },
        _sum: { amount: true }
      })
    ])

    const report = {
      date: yesterday.toISOString().split('T')[0],
      newLeads,
      conversions,
      conversionRate: newLeads > 0 ? ((conversions / newLeads) * 100).toFixed(2) + '%' : '0%',
      bookings,
      revenue: (revenue._sum.amount || 0) / 100
    }

    console.log(`[运营报告] ${report.date}: 新线索${newLeads}, 转化${conversions}, 转化率${report.conversionRate}, 约课${bookings}, 收入¥${report.revenue}`)

    // TODO: 保存报告到数据库或发送通知

    return report
  } catch (error) {
    console.error('[运营报告] 任务执行失败:', error)
    throw error
  }
}
