import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/teacher/dashboard - 老师仪表盘
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacherId');

    if (!teacherId) {
      return NextResponse.json(
        { error: '缺少 teacherId 参数' },
        { status: 400 }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const weekLater = new Date(today);
    weekLater.setDate(weekLater.getDate() + 7);

    // 并行获取所有数据
    const [
      todayBookings,
      upcomingBookings,
      pendingBookings,
      trialLeads,
      totalStudents,
      conversionStats
    ] = await Promise.all([
      // 今日课程
      prisma.booking.findMany({
        where: {
          teacherId,
          scheduledAt: { gte: today, lt: tomorrow },
          status: { in: ['CONFIRMED', 'PENDING'] }
        },
        include: {
          student: { select: { id: true, nickname: true, phoneNumber: true } },
          city: { select: { id: true, name: true } }
        },
        orderBy: { scheduledAt: 'asc' }
      }),

      // 未来7天课程
      prisma.booking.findMany({
        where: {
          teacherId,
          scheduledAt: { gte: today, lt: weekLater },
          status: { in: ['CONFIRMED', 'PENDING'] }
        },
        include: {
          student: { select: { id: true, nickname: true } }
        },
        orderBy: { scheduledAt: 'asc' }
      }),

      // 待确认预约
      prisma.booking.count({
        where: { teacherId, status: 'PENDING' }
      }),

      // 试课线索
      prisma.trialLead.findMany({
        where: { assignedTeacherId: teacherId },
        include: { city: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),

      // 学生总数
      prisma.booking.groupBy({
        by: ['studentId'],
        where: { teacherId }
      }),

      // 转化统计
      prisma.trialLead.groupBy({
        by: ['status'],
        where: { assignedTeacherId: teacherId },
        _count: true
      })
    ]);

    // 未付款列表（通过 booking 关联）
    const unpaidPayments = await prisma.paymentRecord.findMany({
      where: {
        status: 'PENDING',
        booking: { teacherId }
      },
      include: {
        student: { select: { id: true, nickname: true, phoneNumber: true } },
        booking: {
          select: { id: true, scheduledAt: true, subject: true }
        }
      },
      orderBy: { createdAt: 'asc' },
      take: 20
    });

    // 计算转化率
    const statsByKey = conversionStats.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<string, number>);

    const totalLeads = Object.values(statsByKey).reduce((a, b) => a + b, 0);
    const convertedLeads = statsByKey.CONVERTED || 0;
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads * 100).toFixed(1) : '0.0';

    // 本月收入估算
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const monthlyIncome = await prisma.paymentRecord.aggregate({
      where: {
        status: 'PAID',
        booking: { teacherId },
        paidAt: { gte: thisMonth }
      },
      _sum: { teacherSalary: true }
    });

    return NextResponse.json({
      summary: {
        todayClasses: todayBookings.length,
        pendingConfirmations: pendingBookings,
        totalStudents: totalStudents.length,
        conversionRate: `${conversionRate}%`,
        monthlyIncome: monthlyIncome._sum.teacherSalary || 0
      },
      todaySchedule: todayBookings,
      upcomingBookings: upcomingBookings.slice(0, 5),
      unpaidPayments,
      recentTrialLeads: trialLeads
    });
  } catch (error) {
    console.error('获取仪表盘数据失败:', error);
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    );
  }
}
