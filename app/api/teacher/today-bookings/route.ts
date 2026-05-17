import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 获取老师的今日课程
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const teacherId = searchParams.get('teacherId')

    if (!teacherId) {
      return NextResponse.json(
        { error: '需要提供 teacherId' },
        { status: 400 }
      )
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // 今日课程（包括试课和正式课）
    const bookings = await prisma.booking.findMany({
      where: {
        teacherId,
        scheduledAt: { gte: today, lt: tomorrow },
        status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] }
      },
      include: {
        student: {
          select: { id: true, nickname: true, phoneNumber: true }
        },
        trialLead: {
          select: { id: true, studentName: true, parentName: true }
        },
        course: {
          select: { id: true, title: true, topic: true }
        },
        city: {
          select: { id: true, name: true }
        }
      },
      orderBy: { scheduledAt: 'asc' }
    })

    // 统计信息
    const stats = {
      total: bookings.length,
      completed: await prisma.booking.count({
        where: {
          teacherId,
          status: 'COMPLETED',
          scheduledAt: { gte: today, lt: tomorrow }
        }
      }),
      thisWeek: await prisma.booking.count({
        where: {
          teacherId,
          status: { in: ['CONFIRMED', 'COMPLETED'] },
          scheduledAt: {
            gte: today,
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    }

    // 按时间段分组
    const morning = bookings.filter(b => {
      const hour = new Date(b.scheduledAt).getHours()
      return hour >= 6 && hour < 12
    })
    const afternoon = bookings.filter(b => {
      const hour = new Date(b.scheduledAt).getHours()
      return hour >= 12 && hour < 18
    })
    const evening = bookings.filter(b => {
      const hour = new Date(b.scheduledAt).getHours()
      return hour >= 18 && hour < 24
    })

    return NextResponse.json({
      bookings,
      stats,
      byTimeOfDay: {
        morning,
        afternoon,
        evening
      }
    })
  } catch (error) {
    console.error('获取今日课程失败:', error)
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    )
  }
}
