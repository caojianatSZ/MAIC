import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/teachers/[id]/availability - 获取老师空闲时段
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: '需要提供 startDate 和 endDate' },
        { status: 400 }
      )
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    // 获取该时段内的所有约课
    const bookings = await prisma.booking.findMany({
      where: {
        teacherId: params.id,
        scheduledAt: { gte: start, lte: end },
        status: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] }
      },
      select: {
        id: true,
        scheduledAt: true,
        duration: true,
        status: true,
        classType: true
      },
      orderBy: { scheduledAt: 'asc' }
    })

    // 生成空闲时段
    const busySlots = bookings.map(booking => {
      const startTime = new Date(booking.scheduledAt)
      const endTime = new Date(startTime.getTime() + booking.duration * 60 * 1000)
      return {
        startTime,
        endTime,
        bookingId: booking.id
      }
    })

    // 按天分组空闲时段
    const availabilityByDay: Record<string, any[]> = {}

    // 生成日期范围内的每一天
    const currentDay = new Date(start)
    currentDay.setHours(0, 0, 0, 0)

    while (currentDay <= end) {
      const dayKey = currentDay.toISOString().split('T')[0]
      availabilityByDay[dayKey] = []

      // 当天的忙碌时段
      const dayBusySlots = busySlots.filter(slot => {
        return slot.startTime.toISOString().split('T')[0] === dayKey
      })

      // 生成当天的空闲时段（9:00 - 21:00）
      const dayStart = new Date(currentDay)
      dayStart.setHours(9, 0, 0, 0)
      const dayEnd = new Date(currentDay)
      dayEnd.setHours(21, 0, 0, 0)

      let currentTime = dayStart.getTime()
      const endTimeMs = dayEnd.getTime()

      for (const busySlot of dayBusySlots) {
        const busyStart = busySlot.startTime.getTime()
        const busyEnd = busySlot.endTime.getTime()

        // 如果当前时间在忙碌时段之前，添加空闲时段
        if (currentTime < busyStart) {
          availabilityByDay[dayKey].push({
            startTime: new Date(currentTime),
            endTime: new Date(busyStart),
            availableMinutes: Math.floor((busyStart - currentTime) / 60000)
          })
        }

        currentTime = Math.max(currentTime, busyEnd)
      }

      // 添加最后一段空闲时间
      if (currentTime < endTimeMs) {
        availabilityByDay[dayKey].push({
          startTime: new Date(currentTime),
          endTime: new Date(endTimeMs),
          availableMinutes: Math.floor((endTimeMs - currentTime) / 60000)
        })
      }

      // 下一天
      currentDay.setDate(currentDay.getDate() + 1)
    }

    // 获取老师信息
    const teacher = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        nickname: true,
        avatarUrl: true,
        city: { select: { id: true, name: true } }
      }
    })

    return NextResponse.json({
      teacher,
      busySlots,
      availabilityByDay,
      summary: {
        totalBookings: bookings.length,
        totalHours: bookings.reduce((sum, b) => sum + b.duration, 0) / 60
      }
    })
  } catch (error) {
    console.error('获取老师空闲时段失败:', error)
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    )
  }
}
