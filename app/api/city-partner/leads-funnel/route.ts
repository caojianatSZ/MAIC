import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 获取城市合伙人的线索漏斗数据
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cityPartnerId = searchParams.get('cityPartnerId')
    const cityId = searchParams.get('cityId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!cityPartnerId && !cityId) {
      return NextResponse.json(
        { error: '需要提供 cityPartnerId 或 cityId' },
        { status: 400 }
      )
    }

    // 构建查询条件
    const where: any = {}
    if (cityPartnerId) where.cityPartnerId = cityPartnerId
    if (cityId) where.cityId = cityId
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    // 获取各状态的线索数量
    const [
      newLeads,
      contactedLeads,
      scheduledLeads,
      completedLeads,
      convertedLeads,
      lostLeads,
      totalLeads
    ] = await Promise.all([
      prisma.trialLead.count({ where: { ...where, status: 'NEW' } }),
      prisma.trialLead.count({ where: { ...where, status: 'CONTACTED' } }),
      prisma.trialLead.count({ where: { ...where, status: 'SCHEDULED' } }),
      prisma.trialLead.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.trialLead.count({ where: { ...where, status: 'CONVERTED' } }),
      prisma.trialLead.count({ where: { ...where, status: 'LOST' } }),
      prisma.trialLead.count({ where })
    ])

    // 计算转化率
    const conversionRate = totalLeads > 0
      ? Math.round((convertedLeads / totalLeads) * 100)
      : 0

    // 获取试课到场率
    const scheduledWithBooking = await prisma.trialLead.count({
      where: {
        ...where,
        status: { in: ['COMPLETED', 'CONVERTED', 'LOST'] },
        scheduledTime: { not: null }
      }
    })

    const noShowBookings = await prisma.booking.count({
      where: {
        trialLead: { ...where },
        attendanceStatus: 'ABSENT'
      }
    })

    const attendanceRate = scheduledWithBooking > 0
      ? Math.round(((scheduledWithBooking - noShowBookings) / scheduledWithBooking) * 100)
      : 0

    // 漏斗数据
    const funnel = [
      { stage: '新线索', count: newLeads, status: 'NEW' },
      { stage: '已联系', count: contactedLeads, status: 'CONTACTED' },
      { stage: '已试课', count: completedLeads, status: 'COMPLETED' },
      { stage: '已转化', count: convertedLeads, status: 'CONVERTED' },
      { stage: '流失', count: lostLeads, status: 'LOST' }
    ]

    return NextResponse.json({
      funnel,
      summary: {
        totalLeads,
        convertedLeads,
        conversionRate,
        attendanceRate
      }
    })
  } catch (error) {
    console.error('获取线索漏斗失败:', error)
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    )
  }
}
