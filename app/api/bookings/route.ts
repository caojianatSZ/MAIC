import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, BookingStatus } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/bookings - 获取约课列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const studentId = searchParams.get('studentId');
    const teacherId = searchParams.get('teacherId');
    const cityId = searchParams.get('cityId');
    const cityPartnerId = searchParams.get('cityPartnerId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status && Object.values(BookingStatus).includes(status as BookingStatus)) {
      where.status = status;
    }

    if (studentId) where.studentId = studentId;
    if (teacherId) where.teacherId = teacherId;
    if (cityId) where.cityId = cityId;
    if (cityPartnerId) where.cityPartnerId = cityPartnerId;

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          student: {
            select: { id: true, nickname: true, phoneNumber: true }
          },
          teacher: {
            select: { id: true, nickname: true, phoneNumber: true }
          },
          trialLead: {
            select: { id: true, studentName: true, status: true }
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
        },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit
      }),
      prisma.booking.count({ where })
    ]);

    return NextResponse.json({
      data: bookings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取约课列表失败:', error);
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    );
  }
}

// POST /api/bookings - 创建约课
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      studentId,
      teacherId,
      trialLeadId,
      cityId,
      cityPartnerId,
      classType,
      subject,
      grade,
      scheduledAt,
      duration,
      courseId
    } = body;

    // 验证必填字段
    if (!studentId || !teacherId || !cityId || !cityPartnerId || !classType || !subject || !scheduledAt) {
      return NextResponse.json(
        { error: '缺少必填字段' },
        { status: 400 }
      );
    }

    // 检查时段冲突（同一老师、同一时间、非取消状态的预约）
    const scheduledDate = new Date(scheduledAt);
    const endTime = new Date(scheduledDate.getTime() + (duration || 60) * 60000);

    const conflictCount = await prisma.booking.count({
      where: {
        teacherId,
        status: { not: 'CANCELLED' },
        scheduledAt: {
          gte: scheduledDate,
          lt: endTime
        }
      }
    });

    if (conflictCount > 0) {
      return NextResponse.json(
        { error: '该时段已被预约' },
        { status: 409 }
      );
    }

    // 检查班型容量
    const maxStudents = getMaxStudents(classType);
    const existingBookings = await prisma.booking.count({
      where: {
        scheduledAt,
        status: { not: 'CANCELLED' },
        teacherId
      }
    });

    if (existingBookings >= maxStudents) {
      return NextResponse.json(
        { error: `该时段已满 (${existingBookings}/${maxStudents})` },
        { status: 409 }
      );
    }

    const booking = await prisma.booking.create({
      data: {
        studentId,
        teacherId,
        trialLeadId,
        cityId,
        cityPartnerId,
        classType,
        subject,
        grade,
        scheduledAt: scheduledDate,
        duration: duration || 60,
        courseId,
        status: 'PENDING'
      },
      include: {
        student: { select: { id: true, nickname: true } },
        teacher: { select: { id: true, nickname: true } },
        city: { select: { id: true, name: true } }
      }
    });

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error('创建约课失败:', error);
    return NextResponse.json(
      { error: '创建失败' },
      { status: 500 }
    );
  }
}

// 根据班型获取最大学生数
function getMaxStudents(classType: string): number {
  const limits: Record<string, number> = {
    'ONE_V1': 1,
    'ONE_V2': 2,
    'ONE_V3': 3,
    'ONE_V4': 4,
    'ONE_VN': 99  // 1对N不限制
  };
  return limits[classType] || 1;
}
