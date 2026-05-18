import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/teacher/slots - 获取老师可用时间段
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacherId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!teacherId) {
      return NextResponse.json(
        { error: '缺少 teacherId 参数' },
        { status: 400 }
      );
    }

    const where: any = { teacherId };

    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    }

    const slots = await prisma.teacherSlot.findMany({
      where,
      orderBy: { startTime: 'asc' }
    });

    // 过滤已过期的时间段
    const now = new Date();
    const validSlots = slots.filter(slot => new Date(slot.endTime) > now);

    return NextResponse.json({ data: validSlots });
  } catch (error) {
    console.error('获取时间段失败:', error);
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    );
  }
}

// POST /api/teacher/slots - 设置可用时间段
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      teacherId,
      startTime,
      endTime,
      recurringType,
      recurringEndDate
    } = body;

    // 验证必填字段
    if (!teacherId || !startTime || !endTime) {
      return NextResponse.json(
        { error: '缺少必填字段' },
        { status: 400 }
      );
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (end <= start) {
      return NextResponse.json(
        { error: '结束时间必须晚于开始时间' },
        { status: 400 }
      );
    }

    // 验证时间段是否合理（15分钟到8小时）
    const duration = (end.getTime() - start.getTime()) / 60000;
    if (duration < 15 || duration > 480) {
      return NextResponse.json(
        { error: '时间段长度必须在15分钟到8小时之间' },
        { status: 400 }
      );
    }

    // 非重复模式 - 创建单个时间段
    if (!recurringType) {
      const slot = await prisma.teacherSlot.create({
        data: {
          teacherId,
          startTime: start,
          endTime: end,
          isAvailable: true
        }
      });
      return NextResponse.json(slot, { status: 201 });
    }

    // 重复模式 - 批量创建时间段
    const recurringEnd = recurringEndDate ? new Date(recurringEndDate) : null;
    const slots = [];

    let currentStart = new Date(start);
    let currentEnd = new Date(end);

    // 最多创建90天的时间段
    const maxDate = recurringEnd || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    while (currentStart < maxDate) {
      // 跳过过去的时间
      if (currentEnd > new Date()) {
        const slot = await prisma.teacherSlot.create({
          data: {
            teacherId,
            startTime: new Date(currentStart),
            endTime: new Date(currentEnd),
            isAvailable: true,
            recurringType
          }
        });
        slots.push(slot);
      }

      // 根据重复类型增加日期
      switch (recurringType) {
        case 'DAILY':
          currentStart.setDate(currentStart.getDate() + 1);
          currentEnd.setDate(currentEnd.getDate() + 1);
          break;
        case 'WEEKLY':
          currentStart.setDate(currentStart.getDate() + 7);
          currentEnd.setDate(currentEnd.getDate() + 7);
          break;
        case 'BIWEEKLY':
          currentStart.setDate(currentStart.getDate() + 14);
          currentEnd.setDate(currentEnd.getDate() + 14);
          break;
        default:
          // 不支持的重复类型，只创建一个
          currentStart = maxDate;
      }
    }

    return NextResponse.json({
      count: slots.length,
      data: slots
    }, { status: 201 });
  } catch (error) {
    console.error('创建时间段失败:', error);
    return NextResponse.json(
      { error: '创建失败' },
      { status: 500 }
    );
  }
}
