import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/hq-ops/teachers - 获取教师列表及统计数据
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cityId = searchParams.get('cityId')
    const sortBy = searchParams.get('sortBy') || 'bookings' // bookings, revenue, rating

    const where: any = {
      role: 'TEACHER'
    }
    if (cityId) where.cityId = cityId

    const teachers = await prisma.user.findMany({
      where,
      include: {
        city: {
          select: { id: true, name: true }
        },
        teacherBookings: {
          select: {
            id: true,
            status: true,
            payments: {
              select: {
                amount: true,
                platformRevenue: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // 计算统计数据
    const teachersWithStats = teachers.map(teacher => {
      const completedBookings = teacher.teacherBookings.filter(b => b.status === 'COMPLETED')
      const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.payments?.[0]?.amount || 0), 0)
      const avgRating = 4.5 // 简化处理，实际应从评价表计算

      return {
        id: teacher.id,
        name: teacher.nickname || teacher.name,
        phone: teacher.phoneNumber,
        city: teacher.city,
        stats: {
          totalBookings: teacher.teacherBookings.length,
          completedBookings: completedBookings.length,
          totalRevenue,
          avgRating,
          subject: '未指定'
        }
      }
    })

    // 排序
    const sortedTeachers = [...teachersWithStats].sort((a, b) => {
      if (sortBy === 'bookings') return b.stats.totalBookings - a.stats.totalBookings
      if (sortBy === 'revenue') return b.stats.totalRevenue - a.stats.totalRevenue
      if (sortBy === 'rating') return b.stats.avgRating - a.stats.avgRating
      return 0
    })

    return NextResponse.json({
      success: true,
      teachers: sortedTeachers
    })
  } catch (error) {
    console.error('获取教师数据失败:', error)
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    )
  }
}
