import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/bookings/[id] - 获取约课详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        student: {
          select: { id: true, nickname: true, phoneNumber: true }
        },
        teacher: {
          select: { id: true, nickname: true, phoneNumber: true }
        },
        trialLead: {
          select: { id: true, studentName: true, parentName: true, status: true }
        },
        city: {
          select: { id: true, name: true }
        },
        cityPartner: {
          select: { id: true, nickname: true }
        },
        course: {
          select: { id: true, title: true, topic: true }
        },
        payments: {
          select: { id: true, amount: true, status: true, settlementStatus: true }
        }
      }
    })

    if (!booking) {
      return NextResponse.json(
        { error: '约课记录不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json(booking)
  } catch (error) {
    console.error('获取约课详情失败:', error)
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    )
  }
}

// PATCH /api/bookings/[id] - 更新约课状态
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const {
      status,
      attendanceStatus,
      notes,
      courseId
    } = body

    const updateData: any = {}
    if (status) updateData.status = status
    if (attendanceStatus) updateData.attendanceStatus = attendanceStatus
    if (courseId) updateData.courseId = courseId

    // 处理 notes
    if (notes) {
      const booking = await prisma.booking.findUnique({
        where: { id },
        select: { notes: true }
      })

      const existingNotes = (booking?.notes as any) || {}
      updateData.notes = {
        ...existingNotes,
        ...notes,
        updatedAt: new Date().toISOString()
      }
    }

    const booking = await prisma.booking.update({
      where: { id: id },
      data: updateData,
      include: {
        student: { select: { id: true, nickname: true } },
        teacher: { select: { id: true, nickname: true } }
      }
    })

    // 如果课程完成且学生到场，自动创建支付记录
    if (status === 'COMPLETED' && attendanceStatus === 'ATTENDED') {
      const existingPayment = await prisma.paymentRecord.findFirst({
        where: { bookingId: id }
      })

      if (!existingPayment) {
        // 根据班级类型确定价格
        const basePrice = getBasePrice(booking.classType)

        await prisma.paymentRecord.create({
          data: {
            studentId: booking.studentId,
            bookingId: id,
            cityId: booking.cityId,
            amount: basePrice,
            teacherSalary: Math.floor(basePrice * 0.6),
            partnerCommission: Math.floor(basePrice * 0.2),
            platformRevenue: Math.floor(basePrice * 0.2),
            status: 'PENDING',
            settlementStatus: 'UNSETTLED'
          }
        })
      }
    }

    return NextResponse.json(booking)
  } catch (error) {
    console.error('更新约课失败:', error)
    return NextResponse.json(
      { error: '更新失败' },
      { status: 500 }
    )
  }
}

// 根据班级类型获取基础价格（分）
function getBasePrice(classType: string): number {
  const prices: Record<string, number> = {
    'ONE_V1': 30000,   // 1对1: 300元
    'ONE_V2': 20000,   // 1对2: 200元
    'ONE_V3': 15000,   // 1对3: 150元
    'ONE_V4': 12000,   // 1对4: 120元
    'ONE_VN': 10000    // 1对N: 100元
  }
  return prices[classType] || 20000
}
