import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 获取总部运营全局概览
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // 构建时间范围
    const dateFilter: any = {}
    if (startDate || endDate) {
      dateFilter.createdAt = {}
      if (startDate) dateFilter.createdAt.gte = new Date(startDate)
      if (endDate) dateFilter.createdAt.lte = new Date(endDate)
    }

    // 并行获取各项数据
    const [
      totalCities,
      activeCities,
      totalPartners,
      totalTeachers,
      totalLeads,
      convertedLeads,
      totalBookings,
      completedBookings,
      totalRevenue,
      totalPayments
    ] = await Promise.all([
      prisma.city.count(),
      prisma.city.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { role: 'CITY_PARTNER' } }),
      prisma.user.count({ where: { role: 'TEACHER' } }),
      prisma.trialLead.count({ where: dateFilter }),
      prisma.trialLead.count({ where: { ...dateFilter, status: 'CONVERTED' } }),
      prisma.booking.count({ where: dateFilter }),
      prisma.booking.count({ where: { ...dateFilter, status: 'COMPLETED' } }),
      // 计算总收入
      prisma.paymentRecord.aggregate({
        where: { ...dateFilter, status: 'PAID' },
        _sum: { amount: true }
      }),
      prisma.paymentRecord.count({ where: { ...dateFilter, status: 'PAID' } })
    ])

    // 计算转化率
    const conversionRate = totalLeads > 0
      ? Math.round((convertedLeads / totalLeads) * 100)
      : 0

    // 获取各城市数据对比
    const cities = await prisma.city.findMany({
      where: { status: 'ACTIVE' },
      include: {
        partner: { select: { id: true, nickname: true } },
        _count: {
          select: {
            trialLeads: true,
            bookings: true
          }
        }
      }
    })

    // 为每个城市计算统计数据
    const cityStats = await Promise.all(
      cities.map(async (city) => {
        const [converted, revenue, teachers] = await Promise.all([
          prisma.trialLead.count({
            where: { cityId: city.id, status: 'CONVERTED', ...dateFilter }
          }),
          prisma.paymentRecord.aggregate({
            where: { cityId: city.id, status: 'PAID', ...dateFilter },
            _sum: { amount: true }
          }),
          prisma.user.count({
            where: { cityId: city.id, role: 'TEACHER' }
          })
        ])

        return {
          id: city.id,
          name: city.name,
          partner: city.partner,
          stats: {
            leads: city._count.trialLeads,
            converted,
            bookings: city._count.bookings,
            teachers,
            revenue: revenue._sum.amount || 0,
            conversionRate: city._count.trialLeads > 0
              ? Math.round((converted / city._count.trialLeads) * 100)
              : 0
          }
        }
      })
    )

    // 按收入排序城市
    const rankedCities = cityStats.sort((a, b) => b.stats.revenue - a.stats.revenue)

    return NextResponse.json({
      overview: {
        totalCities,
        activeCities,
        totalPartners,
        totalTeachers,
        totalLeads,
        convertedLeads,
        conversionRate,
        totalBookings,
        completedBookings,
        totalRevenue: totalRevenue._sum.amount || 0,
        totalPayments
      },
      cities: rankedCities,
      rankings: {
        byRevenue: rankedCities.slice(0, 5),
        byConversion: [...cityStats].sort((a, b) => b.stats.conversionRate - a.stats.conversionRate).slice(0, 5),
        byLeads: [...cityStats].sort((a, b) => b.stats.leads - a.stats.leads).slice(0, 5)
      }
    })
  } catch (error) {
    console.error('获取全局概览失败:', error)
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    )
  }
}
