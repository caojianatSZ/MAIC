import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/payments/[id] - 获取支付详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const payment = await prisma.paymentRecord.findUnique({
      where: { id: id },
      include: {
        booking: {
          include: {
            student: { select: { id: true, nickname: true, phoneNumber: true } },
            teacher: { select: { id: true, nickname: true, phoneNumber: true } },
            city: { select: { id: true, name: true } }
          }
        },
        city: {
          include: {
            partner: { select: { id: true, nickname: true } }
          }
        }
      }
    })

    if (!payment) {
      return NextResponse.json(
        { error: '支付记录不存在' },
        { status: 404 }
      )
    }

    // 构造前端期望的结构
    const response = {
      ...payment,
      booking: {
        ...payment.booking,
        cityPartner: payment.city.partner
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('获取支付详情失败:', error)
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    )
  }
}

// PATCH /api/payments/[id] - 更新支付状态
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, paymentChannel, transactionId, notes } = body

    const updateData: any = {}
    if (status) {
      updateData.status = status
      if (status === 'PAID') {
        updateData.paidAt = new Date()
        updateData.paidAmount = body.paidAmount
      }
    }
    if (paymentChannel) updateData.paymentChannel = paymentChannel
    if (transactionId) updateData.transactionId = transactionId
    if (notes) updateData.notes = notes

    const payment = await prisma.paymentRecord.update({
      where: { id: id },
      data: updateData,
      include: {
        student: { select: { id: true, nickname: true } },
        booking: {
          include: {
            teacher: { select: { id: true, nickname: true } }
          }
        }
      }
    })

    return NextResponse.json(payment)
  } catch (error) {
    console.error('更新支付记录失败:', error)
    return NextResponse.json(
      { error: '更新失败' },
      { status: 500 }
    )
  }
}

// POST /api/payments/[id]/settle - 分账结算
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const payment = await prisma.paymentRecord.findUnique({
      where: { id: id },
      include: {
        booking: {
          include: {
            teacher: true,
            cityPartner: true
          }
        }
      }
    })

    if (!payment) {
      return NextResponse.json(
        { error: '支付记录不存在' },
        { status: 404 }
      )
    }

    if (payment.status !== 'PAID') {
      return NextResponse.json(
        { error: '只能结算已支付的订单' },
        { status: 400 }
      )
    }

    if (payment.settlementStatus === 'SETTLED') {
      return NextResponse.json(
        { error: '该订单已结算' },
        { status: 400 }
      )
    }

    // 更新结算状态
    const updated = await prisma.paymentRecord.update({
      where: { id },
      data: {
        settlementStatus: 'SETTLED'
      },
      include: {
        booking: {
          include: {
            student: { select: { id: true, nickname: true } },
            teacher: { select: { id: true, nickname: true } },
            city: { select: { id: true, name: true } }
          }
        },
        city: {
          include: {
            partner: { select: { id: true, nickname: true } }
          }
        }
      }
    })

    // TODO: 这里应该触发实际的分账转账
    // - 转账给老师 (updated.teacherSalary)
    // - 转账给合伙人 (updated.partnerCommission)
    // - 平台收入 (updated.platformRevenue)

    return NextResponse.json({
      ...updated,
      booking: {
        ...updated.booking,
        cityPartner: updated.city.partner
      }
    })
  } catch (error) {
    console.error('结算失败:', error)
    return NextResponse.json(
      { error: '结算失败' },
      { status: 500 }
    )
  }
}
