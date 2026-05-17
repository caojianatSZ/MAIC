import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// POST /api/test/flow - 执行完整流程测试
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    switch (action) {
      case 'full_flow':
        return await runFullFlow()
      case 'create_city':
        return await createTestCity(body.cityName)
      case 'create_lead':
        return await createTestLead(body)
      case 'schedule_trial':
        return await scheduleTrialClass(body)
      case 'complete_booking':
        return await completeBooking(body)
      default:
        return NextResponse.json(
          { error: '未知操作' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('流程测试失败:', error)
    return NextResponse.json(
      { error: '测试失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// 完整流程测试
async function runFullFlow() {
  const results: any[] = []

  // 1. 创建测试城市
  results.push({ step: '创建城市', status: 'pending' })
  const city = await prisma.city.create({
    data: { name: `测试城市_${Date.now()}`, status: 'ACTIVE' }
  })
  results[0] = { step: '创建城市', status: 'success', data: { id: city.id, name: city.name } }

  // 2. 创建合伙人
  results.push({ step: '创建合伙人', status: 'pending' })
  const partner = await prisma.user.create({
    data: {
      openid: `test_partner_${city.id}`,
      nickname: '测试合伙人',
      phoneNumber: '13800000001',
      role: 'CITY_PARTNER',
      cityId: city.id,
      isActive: true
    }
  })
  await prisma.city.update({
    where: { id: city.id },
    data: { partnerId: partner.id }
  })
  results[1] = { step: '创建合伙人', status: 'success', data: { id: partner.id, nickname: partner.nickname } }

  // 3. 创建老师
  results.push({ step: '创建老师', status: 'pending' })
  const teacher = await prisma.user.create({
    data: {
      openid: `test_teacher_${city.id}`,
      nickname: '测试老师',
      phoneNumber: '13800000002',
      role: 'TEACHER',
      cityId: city.id,
      isActive: true
    }
  })
  results[2] = { step: '创建老师', status: 'success', data: { id: teacher.id, nickname: teacher.nickname } }

  // 4. 创建线索
  results.push({ step: '创建线索', status: 'pending' })
  const lead = await prisma.trialLead.create({
    data: {
      studentName: '测试学生',
      parentName: '测试家长',
      phoneNumber: '13900000001',
      grade: '初二',
      cityId: city.id,
      cityPartnerId: partner.id,
      status: 'NEW',
      sourceChannel: '测试渠道',
      notes: [{ time: new Date().toISOString(), content: '测试创建', author: 'system' }]
    }
  })
  results[3] = { step: '创建线索', status: 'success', data: { id: lead.id, studentName: lead.studentName } }

  // 5. 安排试课
  results.push({ step: '安排试课', status: 'pending' })
  const scheduledTime = new Date(Date.now() + 24 * 60 * 60 * 1000) // 明天
  const booking = await prisma.booking.create({
    data: {
      studentId: partner.id,
      teacherId: teacher.id,
      trialLeadId: lead.id,
      cityId: city.id,
      cityPartnerId: partner.id,
      classType: 'ONE_V1',
      subject: 'math',
      grade: '初二',
      scheduledAt: scheduledTime,
      duration: 60,
      status: 'CONFIRMED'
    }
  })
  await prisma.trialLead.update({
    where: { id: lead.id },
    data: {
      status: 'SCHEDULED',
      scheduledTime,
      assignedTeacherId: teacher.id
    }
  })
  results[4] = { step: '安排试课', status: 'success', data: { id: booking.id, scheduledTime } }

  // 6. 完成课程
  results.push({ step: '完成课程', status: 'pending' })
  const updatedBooking = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: 'COMPLETED',
      attendanceStatus: 'ATTENDED'
    }
  })
  results[5] = { step: '完成课程', status: 'success', data: { id: updatedBooking.id, status: updatedBooking.status } }

  // 7. 创建支付记录
  results.push({ step: '创建支付', status: 'pending' })
  const payment = await prisma.paymentRecord.create({
    data: {
      studentId: partner.id,
      bookingId: updatedBooking.id,
      cityId: city.id,
      amount: 30000,
      teacherSalary: 18000,
      partnerCommission: 6000,
      platformRevenue: 6000,
      status: 'PAID',
      settlementStatus: 'UNSETTLED',
      paymentChannel: 'wechat',
      paidAt: new Date()
    }
  })
  results[6] = { step: '创建支付', status: 'success', data: { id: payment.id, amount: payment.amount } }

  // 8. 结算分账
  results.push({ step: '结算分账', status: 'pending' })
  const settledPayment = await prisma.paymentRecord.update({
    where: { id: payment.id },
    data: { settlementStatus: 'SETTLED' }
  })
  results[7] = { step: '结算分账', status: 'success', data: { settlementStatus: settledPayment.settlementStatus } }

  return NextResponse.json({
    success: true,
    message: '完整流程测试成功',
    results,
    summary: {
      city: { id: city.id, name: city.name },
      partner: { id: partner.id, name: partner.nickname },
      teacher: { id: teacher.id, name: teacher.nickname },
      lead: { id: lead.id, name: lead.studentName },
      booking: { id: booking.id },
      payment: { id: payment.id, amount: payment.amount }
    }
  })
}

// 创建测试城市
async function createTestCity(cityName?: string) {
  const name = cityName || `测试城市_${Date.now()}`
  const city = await prisma.city.create({
    data: { name, status: 'ACTIVE' }
  })

  return NextResponse.json({
    success: true,
    city
  })
}

// 创建测试线索
async function createTestLead(data: any) {
  const { cityId, cityPartnerId, studentName, parentName, phoneNumber, grade } = data

  if (!cityId || !cityPartnerId) {
    return NextResponse.json(
      { error: '缺少 cityId 或 cityPartnerId' },
      { status: 400 }
    )
  }

  const lead = await prisma.trialLead.create({
    data: {
      studentName: studentName || '测试学生',
      parentName: parentName || '测试家长',
      phoneNumber: phoneNumber || '13900000000',
      grade: grade || '初二',
      cityId,
      cityPartnerId,
      status: 'NEW',
      sourceChannel: 'API测试',
      notes: [{ time: new Date().toISOString(), content: 'API创建', author: 'api' }]
    }
  })

  return NextResponse.json({
    success: true,
    lead
  })
}

// 安排试课
async function scheduleTrialClass(data: any) {
  const { leadId, teacherId, scheduledTime } = data

  if (!leadId || !teacherId) {
    return NextResponse.json(
      { error: '缺少 leadId 或 teacherId' },
      { status: 400 }
    )
  }

  const lead = await prisma.trialLead.findUnique({
    where: { id: leadId },
    include: { city: true }
  })

  if (!lead) {
    return NextResponse.json(
      { error: '线索不存在' },
      { status: 404 }
    )
  }

  const booking = await prisma.booking.create({
    data: {
      studentId: lead.cityPartnerId,
      teacherId,
      trialLeadId: leadId,
      cityId: lead.cityId,
      cityPartnerId: lead.cityPartnerId,
      classType: 'ONE_V1',
      subject: 'math',
      grade: lead.grade,
      scheduledAt: new Date(scheduledTime || Date.now() + 24 * 60 * 60 * 1000),
      duration: 60,
      status: 'CONFIRMED'
    }
  })

  await prisma.trialLead.update({
    where: { id: leadId },
    data: {
      status: 'SCHEDULED',
      scheduledTime: booking.scheduledAt,
      assignedTeacherId: teacherId
    }
  })

  return NextResponse.json({
    success: true,
    booking
  })
}

// 完成约课
async function completeBooking(data: any) {
  const { bookingId } = data

  if (!bookingId) {
    return NextResponse.json(
      { error: '缺少 bookingId' },
      { status: 400 }
    )
  }

  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: 'COMPLETED',
      attendanceStatus: 'ATTENDED'
    }
  })

  // 检查是否已有支付记录
  const existingPayment = await prisma.paymentRecord.findFirst({
    where: { bookingId }
  })

  let payment = existingPayment
  if (!existingPayment) {
    payment = await prisma.paymentRecord.create({
      data: {
        studentId: booking.studentId,
        bookingId,
        cityId: booking.cityId,
        amount: 30000,
        teacherSalary: 18000,
        partnerCommission: 6000,
        platformRevenue: 6000,
        status: 'PENDING',
        settlementStatus: 'UNSETTLED'
      }
    })
  }

  return NextResponse.json({
    success: true,
    booking,
    payment
  })
}

// GET /api/test/flow - 获取测试状态
export async function GET() {
  const stats = {
    cities: await prisma.city.count(),
    partners: await prisma.user.count({ where: { role: 'CITY_PARTNER' } }),
    teachers: await prisma.user.count({ where: { role: 'TEACHER' } }),
    leads: await prisma.trialLead.count(),
    bookings: await prisma.booking.count(),
    payments: await prisma.paymentRecord.count()
  }

  return NextResponse.json({
    message: '运营平台 API 测试端点',
    stats,
    endpoints: [
      'POST /api/test/flow?action=full_flow - 执行完整流程',
      'POST /api/test/flow?action=create_city&cityName=xxx - 创建城市',
      'POST /api/test/flow?action=create_lead&cityId=xxx&cityPartnerId=xxx - 创建线索',
      'POST /api/test/flow?action=schedule_trial&leadId=xxx&teacherId=xxx - 安排试课',
      'POST /api/test/flow?action=complete_booking&bookingId=xxx - 完成约课'
    ]
  })
}
