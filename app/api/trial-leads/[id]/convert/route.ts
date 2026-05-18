import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// POST /api/trial-leads/[id]/convert - 将试课线索转化为正式学生
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await _request.json();
    const { packageType } = body;

    // 获取线索信息
    const lead = await prisma.trialLead.findUnique({
      where: { id },
      include: {
        city: true,
        cityPartner: true,
        assignedTeacher: true
      }
    });

    if (!lead) {
      return NextResponse.json(
        { error: '线索不存在' },
        { status: 404 }
      );
    }

    if (lead.status === 'CONVERTED') {
      return NextResponse.json(
        { error: '该线索已转化' },
        { status: 400 }
      );
    }

    if (lead.status === 'LOST') {
      return NextResponse.json(
        { error: '已流失线索不能转化' },
        { status: 400 }
      );
    }

    // 更新线索状态为已转化，保存套餐信息到 notes
    const existingNotes = (lead.notes as any) || [];
    const newNotes = packageType
      ? [...existingNotes, { type: 'conversion', packageType, timestamp: new Date().toISOString() }]
      : existingNotes;

    const updatedLead = await prisma.trialLead.update({
      where: { id },
      data: {
        status: 'CONVERTED',
        convertedAt: new Date(),
        notes: newNotes
      }
    });

    // 更新或创建学生档案，将套餐信息存入 metadata
    const studentProfile = await prisma.studentProfile.upsert({
      where: { userId: lead.cityPartnerId },
      create: {
        userId: lead.cityPartnerId,
        metadata: packageType ? { selectedPackage: packageType, trialLeadId: id } : {}
      },
      update: packageType ? {
        metadata: { selectedPackage: packageType, trialLeadId: id }
      } : {}
    });

    return NextResponse.json({
      lead: updatedLead,
      studentProfile,
      message: '转化成功'
    });
  } catch (error) {
    console.error('转化试课线索失败:', error);
    return NextResponse.json(
      { error: '转化失败' },
      { status: 500 }
    );
  }
}
