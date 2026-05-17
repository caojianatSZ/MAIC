import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/hq-ops/cities/[id]/teachers - 获取城市老师列表
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const available = searchParams.get('available')
    const date = searchParams.get('date')

    const where: any = {
      cityId: params.id,
      role: 'TEACHER',
      isActive: true
    }

    const teachers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        nickname: true,
        phoneNumber: true,
        avatarUrl: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    })

    // 如果需要查询可用时段，获取每个老师的课程安排
    let teachersWithAvailability = teachers
    if (available === 'true' && date) {
      const targetDate = new Date(date)
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0))
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999))

      // 获取当天所有约课
      const bookings = await prisma.booking.findMany({
        where: {
          teacherId: { in: teachers.map(t => t.id) },
          scheduledAt: { gte: startOfDay, lte: endOfDay },
          status: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] }
        },
        select: {
          teacherId: true,
          scheduledAt: true,
          duration: true
        }
      })

      // 为每个老师标记已占用时段
      teachersWithAvailability = teachers.map(teacher => {
        const teacherBookings = bookings.filter(b => b.teacherId === teacher.id)
        const busySlots = teacherBookings.map(booking => {
          const start = new Date(booking.scheduledAt)
          const end = new Date(start.getTime() + booking.duration * 60 * 1000)
          return { start, end }
        })

        return {
          ...teacher,
          busySlots,
          available: busySlots.length < 8  // 假设一天最多8节课
        }
      })
    }

    return NextResponse.json({
      teachers: teachersWithAvailability,
      total: teachers.length
    })
  } catch (error) {
    console.error('获取城市老师列表失败:', error)
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    )
  }
}
