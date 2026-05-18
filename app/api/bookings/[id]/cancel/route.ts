import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// PUT /api/bookings/[id]/cancel - 取消预约
export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await _request.json();
    const { reason } = body;

    const booking = await prisma.booking.findUnique({
      where: { id }
    });

    if (!booking) {
      return NextResponse.json(
        { error: '预约不存在' },
        { status: 404 }
      );
    }

    if (booking.status === 'CANCELLED') {
      return NextResponse.json(
        { error: '预约已取消' },
        { status: 400 }
      );
    }

    if (booking.status === 'COMPLETED') {
      return NextResponse.json(
        { error: '已完成课程不能取消' },
        { status: 400 }
      );
    }

    // 将取消原因添加到 notes
    const existingNotes = (booking.notes as any) || [];
    const newNotes = reason
      ? [...existingNotes, { type: 'cancellation', reason, timestamp: new Date().toISOString() }]
      : existingNotes;

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        notes: newNotes
      },
      include: {
        student: { select: { id: true, nickname: true } },
        teacher: { select: { id: true, nickname: true } }
      }
    });

    return NextResponse.json(updatedBooking);
  } catch (error) {
    console.error('取消预约失败:', error);
    return NextResponse.json(
      { error: '取消失败' },
      { status: 500 }
    );
  }
}
