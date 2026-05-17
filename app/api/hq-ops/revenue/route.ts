import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/hq-ops/revenue - 获取收入分析
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const cityId = searchParams.get('cityId')
    const groupBy = searchParams.get('groupBy') || 'day' // day, week, month, city

    // 构建时间范围
    const dateFilter: any = {}
    if (startDate || endDate) {
      dateFilter.createdAt = {}
      if (startDate) dateFilter.createdAt.gte = new Date(startDate)
      if (endDate) dateFilter.createdAt.lte = new Date(endDate)
    }

    const where: any = {
      status: 'PAID',
      ...dateFilter
    }
    if (cityId) where.cityId = cityId

    // 总收入统计
    const [
      totalRevenue,
      teacherSalaryTotal,
      partnerCommissionTotal,
      platformRevenueTotal,
      paymentCount,
      settledCount,
      unsettledCount
    ] = await Promise.all([
      prisma.paymentRecord.aggregate({
        where,
        _sum: { amount: true }
      }),
      prisma.paymentRecord.aggregate({
        where,
        _sum: { teacherSalary: true }
      }),
      prisma.paymentRecord.aggregate({
        where,
        _sum: { partnerCommission: true }
      }),
      prisma.paymentRecord.aggregate({
        where,
        _sum: { platformRevenue: true }
      }),
      prisma.paymentRecord.count({ where }),
      prisma.paymentRecord.count({
        where: { ...where, settlementStatus: 'SETTLED' }
      }),
      prisma.paymentRecord.count({
        where: { ...where, settlementStatus: 'UNSETTLED' }
      })
    ])

    // 分组统计
    let groupData: any[] = []

    if (groupBy === 'city') {
      // 按城市分组
      const cities = await prisma.city.findMany({
        where: cityId ? { id: cityId } : undefined,
        include: {
          _count: { select: { payments: true } }
        }
      })

      groupData = await Promise.all(
        cities.map(async (city) => {
          const cityWhere = { ...where, cityId: city.id }
          const [revenue, salary, commission, platform] = await Promise.all([
            prisma.paymentRecord.aggregate({
              where: cityWhere,
              _sum: { amount: true }
            }),
            prisma.paymentRecord.aggregate({
              where: cityWhere,
              _sum: { teacherSalary: true }
            }),
            prisma.paymentRecord.aggregate({
              where: cityWhere,
              _sum: { partnerCommission: true }
            }),
            prisma.paymentRecord.aggregate({
              where: cityWhere,
              _sum: { platformRevenue: true }
            })
          ])

          return {
            id: city.id,
            name: city.name,
            revenue: revenue._sum.amount || 0,
            teacherSalary: salary._sum.teacherSalary || 0,
            partnerCommission: commission._sum.partnerCommission || 0,
            platformRevenue: platform._sum.platformRevenue || 0
          }
        })
      )

      groupData.sort((a, b) => b.revenue - a.revenue)
    } else if (groupBy === 'day') {
      // 按天分组（这里简化处理，实际应用中需要更复杂的日期处理）
      const payments = await prisma.paymentRecord.findMany({
        where,
        select: {
          createdAt: true,
          amount: true,
          teacherSalary: true,
          partnerCommission: true,
          platformRevenue: true
        },
        orderBy: { createdAt: 'asc' }
      })

      const byDay: Record<string, any> = {}
      for (const payment of payments) {
        const day = payment.createdAt.toISOString().split('T')[0]
        if (!byDay[day]) {
          byDay[day] = {
            date: day,
            revenue: 0,
            teacherSalary: 0,
            partnerCommission: 0,
            platformRevenue: 0,
            count: 0
          }
        }
        byDay[day].revenue += payment.amount
        byDay[day].teacherSalary += payment.teacherSalary || 0
        byDay[day].partnerCommission += payment.partnerCommission || 0
        byDay[day].platformRevenue += payment.platformRevenue || 0
        byDay[day].count += 1
      }

      groupData = Object.values(byDay)
    }

    return NextResponse.json({
      summary: {
        totalRevenue: totalRevenue._sum.amount || 0,
        teacherSalaryTotal: teacherSalaryTotal._sum.teacherSalary || 0,
        partnerCommissionTotal: partnerCommissionTotal._sum.partnerCommission || 0,
        platformRevenueTotal: platformRevenueTotal._sum.platformRevenue || 0,
        paymentCount,
        settledCount,
        unsettledCount,
        settlementRate: paymentCount > 0
          ? Math.round((settledCount / paymentCount) * 100)
          : 0
      },
      groupBy,
      groupData
    })
  } catch (error) {
    console.error('获取收入分析失败:', error)
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    )
  }
}
