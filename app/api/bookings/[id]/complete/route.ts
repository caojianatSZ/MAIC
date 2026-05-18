import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, AttendanceStatus } from '@prisma/client';

const prisma = new PrismaClient();

// PUT /api/bookings/[id]/complete - 完成课程并记录出勤
export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await _request.json();
    const { attendanceStatus, notes } = body;

    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        student: true,
        teacher: true,
        city: true,
        course: true
      }
    });

    if (!booking) {
      return NextResponse.json(
        { error: '预约不存在' },
        { status: 404 }
      );
    }

    if (booking.status !== 'CONFIRMED') {
      return NextResponse.json(
        { error: '只能完成已确认的预约' },
        { status: 400 }
      );
    }

    // 验证出勤状态
    if (attendanceStatus && !Object.values(AttendanceStatus).includes(attendanceStatus)) {
      return NextResponse.json(
        { error: '无效的出勤状态' },
        { status: 400 }
      );
    }

    // 计算课酬
    const teacherSalary = calculateTeacherSalary(booking.classType);

    // 创建支付记录（仅学生出勤时）
    let paymentRecord = null;
    if (attendanceStatus === 'ATTENDED' || attendanceStatus === 'LATE') {
      paymentRecord = await prisma.paymentRecord.create({
        data: {
          studentId: booking.studentId,
          bookingId: booking.id,
          cityId: booking.cityId,
          amount: calculateClassPrice(booking.classType),
          teacherSalary,
          status: 'PENDING',
          settlementStatus: 'UNSETTLED'
        }
      });
    }

    // 更新预约状态
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        attendanceStatus: attendanceStatus || 'ATTENDED',
        notes: notes || booking.notes
      },
      include: {
        student: { select: { id: true, nickname: true } },
        teacher: { select: { id: true, nickname: true } },
        city: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } }
      }
    });

    return NextResponse.json({
      booking: updatedBooking,
      paymentRecord
    });
  } catch (error) {
    console.error('完成课程失败:', error);
    return NextResponse.json(
      { error: '操作失败' },
      { status: 500 }
    );
  }
}

// 计算课程价格（分）
function calculateClassPrice(classType: string): number {
  const prices: Record<string, number> = {
    'ONE_V1': 30000,
    'ONE_V2': 20000,
    'ONE_V3': 15000,
    'ONE_V4': 12000,
    'ONE_VN': 10000
  };
  return prices[classType] || 10000;
}

// 计算老师课酬（分）
function calculateTeacherSalary(classType: string): number {
  const salaries: Record<string, number> = {
    'ONE_V1': 15000,
    'ONE_V2': 10000,
    'ONE_V3': 8000,
    'ONE_V4': 6000,
    'ONE_VN': 5000
  };
  return salaries[classType] || 5000;
}
