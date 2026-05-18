import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// POST /api/bookings/batch - 批量创建预约
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      teacherId,
      studentIds,
      cityId,
      cityPartnerId,
      classType,
      subject,
      grade,
      startDate,
      endDate,
      timeSlots, // [{ weekday: 1, hour: 14, minute: 0, duration: 60 }]
      courseId
    } = body;

    if (!teacherId || !studentIds || !cityId || !cityPartnerId || !timeSlots) {
      return NextResponse.json(
        { error: '缺少必填字段' },
        { status: 400 }
      );
    }

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json(
        { error: 'studentIds 必须是非空数组' },
        { status: 400 }
      );
    }

    if (!Array.isArray(timeSlots) || timeSlots.length === 0) {
      return NextResponse.json(
        { error: 'timeSlots 必须是非空数组' },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const createdBookings = [];
    const conflicts = [];

    // 遍历每个时间段模板
    for (const slot of timeSlots) {
      const { weekday, hour, minute, duration = 60 } = slot;

      // 找出日期范围内所有匹配的日期
      let currentDate = new Date(start);
      while (currentDate <= end) {
        if (currentDate.getDay() === weekday) {
          const scheduledAt = new Date(currentDate);
          scheduledAt.setHours(hour, minute, 0, 0);

          const endTime = new Date(scheduledAt.getTime() + duration * 60000);

          // 检查冲突
          const conflictCount = await prisma.booking.count({
            where: {
              teacherId,
              status: { not: 'CANCELLED' },
              scheduledAt: {
                gte: scheduledAt,
                lt: endTime
              }
            }
          });

          if (conflictCount > 0) {
            conflicts.push({
              scheduledAt: scheduledAt.toISOString(),
              reason: '时段冲突'
            });
            continue;
          }

          // 为每个学生创建预约
          for (const studentId of studentIds) {
            try {
              const booking = await prisma.booking.create({
                data: {
                  studentId,
                  teacherId,
                  cityId,
                  cityPartnerId,
                  classType,
                  subject,
                  grade,
                  scheduledAt,
                  duration,
                  courseId,
                  status: 'PENDING'
                },
                include: {
                  student: { select: { id: true, nickname: true } },
                  teacher: { select: { id: true, nickname: true } }
                }
              });
              createdBookings.push(booking);
            } catch (error) {
              conflicts.push({
                studentId,
                scheduledAt: scheduledAt.toISOString(),
                reason: '创建失败'
              });
            }
          }
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    return NextResponse.json({
      created: createdBookings.length,
      conflicts: conflicts.length,
      bookings: createdBookings,
      conflicts
    }, { status: 201 });
  } catch (error) {
    console.error('批量创建预约失败:', error);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
