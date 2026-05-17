import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/leads/[id] - 获取线索详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const lead = await prisma.trialLead.findUnique({
      where: { id },
      include: {
        city: { select: { id: true, name: true } },
        cityPartner: { select: { id: true, nickname: true } },
        assignedTeacher: { select: { id: true, nickname: true } },
        trialBookings: {
          include: {
            teacher: { select: { id: true, nickname: true } }
          }
        }
      }
    })

    if (!lead) {
      return NextResponse.json(
        { error: '线索不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json(lead)
  } catch (error) {
    console.error('获取线索详情失败:', error)
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    )
  }
}

// PATCH /api/leads/[id] - 更新线索
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
  try {
    const body = await request.json()
    const {
      status,
      scheduledTime,
      assignedTeacherId,
      notes,
      sourceNotes,
      lostReason
    } = body

    // 如果需要分配老师，验证老师属于同一城市
    if (assignedTeacherId) {
      const lead = await prisma.trialLead.findUnique({
        where: { id: id },
        select: { cityId: true }
      })

      if (!lead) {
        return NextResponse.json(
          { error: '线索不存在' },
          { status: 404 }
        )
      }

      const teacher = await prisma.user.findFirst({
        where: {
          id: assignedTeacherId,
          cityId: lead.cityId,
          role: 'TEACHER'
        }
      })

      if (!teacher) {
        return NextResponse.json(
          { error: '老师不存在或不属于该城市' },
          { status: 400 }
        )
      }
    }

    // 更新线索
    const updateData: any = {}
    if (status !== undefined) updateData.status = status
    if (scheduledTime !== undefined) updateData.scheduledTime = new Date(scheduledTime)
    if (assignedTeacherId !== undefined) updateData.assignedTeacherId = assignedTeacherId
    if (sourceNotes !== undefined) updateData.sourceNotes = sourceNotes
    if (lostReason !== undefined) updateData.lostReason = lostReason
    if (status === 'CONVERTED') updateData.convertedAt = new Date()

    // 处理跟进记录
    if (notes) {
      const lead = await prisma.trialLead.findUnique({
        where: { id: id },
        select: { notes: true }
      })

      const existingNotes = (lead?.notes as any[]) || []
      updateData.notes = [
        ...existingNotes,
        {
          time: new Date().toISOString(),
          content: notes,
          author: body.authorId || 'system'
        }
      ]
    }

    const updatedLead = await prisma.trialLead.update({
      where: { id: id },
      data: updateData
    })

    return NextResponse.json(updatedLead)
  } catch (error) {
    console.error('更新线索失败:', error)
    return NextResponse.json(
      { error: '更新失败' },
      { status: 500 }
    )
  }
}

// POST /api/leads/[id]/schedule - 安排试课
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
  try {
    const body = await request.json()
    const { scheduledTime, teacherId, classType, subject, grade } = body

    if (!scheduledTime || !teacherId) {
      return NextResponse.json(
        { error: '缺少必要参数' },
        { status: 400 }
      )
    }

    // 获取线索信息
    const lead = await prisma.trialLead.findUnique({
      where: { id: id },
      include: { city: true }
    })

    if (!lead) {
      return NextResponse.json(
        { error: '线索不存在' },
        { status: 404 }
      )
    }

    // 验证老师
    const teacher = await prisma.user.findFirst({
      where: {
        id: teacherId,
        cityId: lead.cityId,
        role: 'TEACHER'
      }
    })

    if (!teacher) {
      return NextResponse.json(
        { error: '老师不存在或不属于该城市' },
        { status: 400 }
      )
    }

    // 创建试课约课记录
    const booking = await prisma.booking.create({
      data: {
        studentId: lead.cityPartnerId, // 临时使用合伙人ID，需要实际学生ID
        teacherId,
        trialLeadId: id,
        cityId: lead.cityId,
        cityPartnerId: lead.cityPartnerId,
        classType: classType || 'ONE_V1',
        subject: subject || 'math',
        grade,
        scheduledAt: new Date(scheduledTime),
        status: 'PENDING'
      }
    })

    // 更新线索状态
    await prisma.trialLead.update({
      where: { id: id },
      data: {
        status: 'SCHEDULED',
        scheduledTime: new Date(scheduledTime),
        assignedTeacherId: teacherId
      }
    })

    return NextResponse.json(booking)
  } catch (error) {
    console.error('安排试课失败:', error)
    return NextResponse.json(
      { error: '安排失败' },
      { status: 500 }
    )
  }
}
