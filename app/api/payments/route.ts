import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { apiSuccess } from '@/lib/server/api-response'

const prisma = new PrismaClient()

// GET /api/payments - 获取支付记录列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cityId = searchParams.get('cityId')
    const status = searchParams.get('status')
    const settlementStatus = searchParams.get('settlementStatus')
    const studentId = searchParams.get('studentId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: any = {}
    if (cityId) where.cityId = cityId
    if (status) where.status = status
    if (settlementStatus) where.settlementStatus = settlementStatus
    if (studentId) where.studentId = studentId

    const [payments, total] = await Promise.all([
      prisma.paymentRecord.findMany({
        where,
        include: {
          booking: {
            include: {
              student: { select: { id: true, nickname: true } },
              teacher: { select: { id: true, nickname: true, phoneNumber: true } },
              city: { select: { id: true, name: true } },
              cityPartner: { select: { id: true, nickname: true } }
            }
          },
          city: { select: { id: true, name: true } }
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.paymentRecord.count({ where })
    ])

    // 手动序列化
    const serializedPayments = payments.map(p => ({
      id: p.id,
      amount: p.amount,
      status: p.status,
      settlementStatus: p.settlementStatus,
      createdAt: p.createdAt.toISOString(),
      settledAt: p.settledAt?.toISOString(),
      teacherSalary: p.teacherSalary,
      partnerCommission: p.partnerCommission,
      platformRevenue: p.platformRevenue,
      booking: {
        id: p.booking.id,
        scheduledAt: p.booking.scheduledAt.toISOString(),
        duration: p.booking.duration,
        subject: p.booking.subject,
        classType: p.booking.classType,
        status: p.booking.status,
        attendanceStatus: p.booking.attendanceStatus,
        student: p.booking.student,
        teacher: p.booking.teacher,
        city: p.booking.city,
        cityPartner: p.booking.cityPartner
      },
      city: p.city
    }))

    return apiSuccess({
      payments: serializedPayments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('获取支付记录失败:', error)
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    )
  }
}

// POST /api/payments - 创建支付记录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      studentId,
      bookingId,
      amount,
      teacherSalary,
      partnerCommission,
      platformRevenue
    } = body

    if (!studentId || !bookingId || !amount) {
      return NextResponse.json(
        { error: '缺少必要参数: studentId, bookingId, amount' },
        { status: 400 }
      )
    }

    // 获取约课信息以确定城市
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { city: true }
    })

    if (!booking) {
      return NextResponse.json(
        { error: '约课记录不存在' },
        { status: 404 }
      )
    }

    // 计算分账（如果未提供）
    const salary = teacherSalary || Math.floor(amount * 0.6)  // 老师 60%
    const commission = partnerCommission || Math.floor(amount * 0.2)  // 合伙人 20%
    const revenue = platformRevenue || amount - salary - commission  // 平台剩余

    const payment = await prisma.paymentRecord.create({
      data: {
        studentId,
        bookingId,
        cityId: booking.cityId,
        amount,
        teacherSalary: salary,
        partnerCommission: commission,
        platformRevenue: revenue,
        status: 'PENDING',
        settlementStatus: 'PENDING'
      },
      include: {
        booking: {
          include: {
            student: { select: { id: true, nickname: true } },
            teacher: { select: { id: true, nickname: true } },
            city: { select: { id: true, name: true } }
          }
        },
        city: { select: { id: true, name: true } }
      }
    })

    return apiSuccess(payment, 201)
  } catch (error) {
    console.error('创建支付记录失败:', error)
    return NextResponse.json(
      { error: '创建失败' },
      { status: 500 }
    )
  }
}
