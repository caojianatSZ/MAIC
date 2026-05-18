import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, TrialStatus } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/trial-leads - 获取试课线索列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const cityId = searchParams.get('cityId');
    const cityPartnerId = searchParams.get('cityPartnerId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status && Object.values(TrialStatus).includes(status as TrialStatus)) {
      where.status = status;
    }

    if (cityId) {
      where.cityId = cityId;
    }

    if (cityPartnerId) {
      where.cityPartnerId = cityPartnerId;
    }

    const [leads, total] = await Promise.all([
      prisma.trialLead.findMany({
        where,
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
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.trialLead.count({ where })
    ]);

    return NextResponse.json({
      data: leads,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取试课线索列表失败:', error);
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    );
  }
}

// POST /api/trial-leads - 创建试课线索
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      studentName,
      parentName,
      phoneNumber,
      grade,
      cityId,
      cityPartnerId,
      sourceChannel,
      sourceNotes,
      scheduledTime
    } = body;

    // 验证必填字段
    if (!studentName || !phoneNumber || !cityId || !cityPartnerId) {
      return NextResponse.json(
        { error: '缺少必填字段: studentName, phoneNumber, cityId, cityPartnerId' },
        { status: 400 }
      );
    }

    // 检查手机号是否已存在（按城市去重）
    const existing = await prisma.trialLead.findFirst({
      where: {
        phoneNumber,
        cityId,
        status: { not: 'LOST' }
      }
    });

    if (existing) {
      return NextResponse.json(
        { error: '该手机号在此城市已有线索记录', existingId: existing.id },
        { status: 409 }
      );
    }

    const lead = await prisma.trialLead.create({
      data: {
        studentName,
        parentName,
        phoneNumber,
        grade,
        cityId,
        cityPartnerId,
        sourceChannel,
        sourceNotes,
        scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
        status: 'NEW',
        notes: []
      },
      include: {
        city: {
          select: { id: true, name: true }
        },
        cityPartner: {
          select: { id: true, nickname: true }
        }
      }
    });

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error('创建试课线索失败:', error);
    return NextResponse.json(
      { error: '创建失败' },
      { status: 500 }
    );
  }
}
