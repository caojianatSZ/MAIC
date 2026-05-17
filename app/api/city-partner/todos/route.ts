import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 获取城市合伙人的今日待办
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cityPartnerId = searchParams.get('cityPartnerId')
    const cityId = searchParams.get('cityId')

    if (!cityPartnerId && !cityId) {
      return NextResponse.json(
        { error: '需要提供 cityPartnerId 或 cityId' },
        { status: 400 }
      )
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // 构建基础查询条件
    const leadWhere: any = {}
    if (cityPartnerId) leadWhere.cityPartnerId = cityPartnerId
    if (cityId) leadWhere.cityId = cityId

    const bookingWhere: any = {}
    if (cityId) bookingWhere.cityId = cityId
    if (cityPartnerId) bookingWhere.cityPartnerId = cityPartnerId

    // 1. 待跟进的新线索
    const newLeads = await prisma.trialLead.findMany({
      where: { ...leadWhere, status: 'NEW' },
      take: 10,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        studentName: true,
        parentName: true,
        phoneNumber: true,
        grade: true,
        createdAt: true,
        sourceChannel: true
      }
    })

    // 2. 今日待安排试课
    const toSchedule = await prisma.trialLead.findMany({
      where: { ...leadWhere, status: 'CONTACTED' },
      take: 10,
      orderBy: { updatedAt: 'asc' },
      select: {
        id: true,
        studentName: true,
        parentName: true,
        phoneNumber: true,
        grade: true,
        updatedAt: true
      }
    })

    // 3. 今日试课
    const todayBookings = await prisma.booking.findMany({
      where: {
        ...bookingWhere,
        scheduledAt: { gte: today, lt: tomorrow },
        status: { in: ['PENDING', 'CONFIRMED'] }
      },
      include: {
        student: { select: { id: true, nickname: true, phoneNumber: true } },
        teacher: { select: { id: true, nickname: true } },
        trialLead: { select: { id: true, studentName: true } }
      },
      orderBy: { scheduledAt: 'asc' }
    })

    // 4. 待沟通家长（试课已完成，待转化）
    const followUpLeads = await prisma.trialLead.findMany({
      where: { ...leadWhere, status: 'COMPLETED' },
      take: 10,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        studentName: true,
        parentName: true,
        phoneNumber: true,
        updatedAt: true,
        notes: true
      }
    })

    // 5. 即将流失（超过3天未跟进的已联系线索）
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    const staleLeads = await prisma.trialLead.findMany({
      where: {
        ...leadWhere,
        status: 'CONTACTED',
        updatedAt: { lt: threeDaysAgo }
      },
      take: 5,
      orderBy: { updatedAt: 'asc' },
      select: {
        id: true,
        studentName: true,
        phoneNumber: true,
        updatedAt: true
      }
    })

    return NextResponse.json({
      todos: [
        {
          type: 'new_leads',
          title: '待跟进线索',
          count: newLeads.length,
          priority: 'high',
          items: newLeads
        },
        {
          type: 'to_schedule',
          title: '待安排试课',
          count: toSchedule.length,
          priority: 'medium',
          items: toSchedule
        },
        {
          type: 'today_classes',
          title: '今日试课',
          count: todayBookings.length,
          priority: 'high',
          items: todayBookings
        },
        {
          type: 'follow_up',
          title: '待跟进家长',
          count: followUpLeads.length,
          priority: 'medium',
          items: followUpLeads
        },
        {
          type: 'stale_leads',
          title: '需及时跟进',
          count: staleLeads.length,
          priority: 'high',
          items: staleLeads
        }
      ],
      summary: {
        total: newLeads.length + toSchedule.length + todayBookings.length + followUpLeads.length + staleLeads.length,
        highPriority: newLeads.length + todayBookings.length + staleLeads.length
      }
    })
  } catch (error) {
    console.error('获取待办失败:', error)
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    )
  }
}
