import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, TrialStatus } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/trial-leads/[id] - 获取试课线索详情
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const lead = await prisma.trialLead.findUnique({
      where: { id },
      include: {
        city: {
          select: { id: true, name: true }
        },
        cityPartner: {
          select: { id: true, nickname: true, phoneNumber: true }
        },
        assignedTeacher: {
          select: { id: true, nickname: true }
        },
        trialBookings: {
          select: { id: true, scheduledAt: true, status: true }
        }
      }
    });

    if (!lead) {
      return NextResponse.json(
        { error: '线索不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error('获取试课线索详情失败:', error);
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    );
  }
}

// PUT /api/trial-leads/[id] - 更新试课线索
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const {
      status,
      studentName,
      parentName,
      phoneNumber,
      grade,
      assignedTeacherId,
      scheduledTime,
      sourceChannel,
      notes,
      lostReason
    } = body;

    // 验证状态值
    if (status && !Object.values(TrialStatus).includes(status)) {
      return NextResponse.json(
        { error: '无效的状态值' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (studentName) updateData.studentName = studentName;
    if (parentName) updateData.parentName = parentName;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (grade) updateData.grade = grade;
    if (assignedTeacherId) updateData.assignedTeacherId = assignedTeacherId;
    if (scheduledTime) updateData.scheduledTime = new Date(scheduledTime);
    if (sourceChannel) updateData.sourceChannel = sourceChannel;
    if (lostReason) updateData.lostReason = lostReason;

    // 处理状态变更
    if (status) {
      updateData.status = status;

      // 状态为已转化时记录时间
      if (status === 'CONVERTED') {
        updateData.convertedAt = new Date();
      }
    }

    // 处理跟进记录
    if (notes) {
      const lead = await prisma.trialLead.findUnique({
        where: { id },
        select: { notes: true }
      });

      const existingNotes = (lead?.notes as any) || [];
      updateData.notes = [...existingNotes, ...notes];
    }

    const lead = await prisma.trialLead.update({
      where: { id },
      data: updateData,
      include: {
        city: { select: { id: true, name: true } },
        cityPartner: { select: { id: true, nickname: true } },
        assignedTeacher: { select: { id: true, nickname: true } }
      }
    });

    return NextResponse.json(lead);
  } catch (error) {
    console.error('更新试课线索失败:', error);
    return NextResponse.json(
      { error: '更新失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/trial-leads/[id] - 删除试课线索（仅NEW状态可删除）
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const lead = await prisma.trialLead.findUnique({
      where: { id },
      select: { status: true }
    });

    if (!lead) {
      return NextResponse.json(
        { error: '线索不存在' },
        { status: 404 }
      );
    }

    if (lead.status !== 'NEW') {
      return NextResponse.json(
        { error: '只能删除新线索(NEW状态)' },
        { status: 400 }
      );
    }

    await prisma.trialLead.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除试课线索失败:', error);
    return NextResponse.json(
      { error: '删除失败' },
      { status: 500 }
    );
  }
}
