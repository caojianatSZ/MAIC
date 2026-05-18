import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// PUT /api/bookings/[id]/confirm - 确认预约
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const booking = await prisma.booking.findUnique({
      where: { id }
    });

    if (!booking) {
      return NextResponse.json(
        { error: '预约不存在' },
        { status: 404 }
      );
    }

    if (booking.status !== 'PENDING') {
      return NextResponse.json(
        { error: '只能确认待定状态的预约' },
        { status: 400 }
      );
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: { status: 'CONFIRMED' },
      include: {
        student: { select: { id: true, nickname: true, phoneNumber: true } },
        teacher: { select: { id: true, nickname: true, phoneNumber: true } },
        city: { select: { id: true, name: true } },
        course: { select: { id: true, title: true } }
      }
    });

    return NextResponse.json(updatedBooking);
  } catch (error) {
    console.error('确认预约失败:', error);
    return NextResponse.json(
      { error: '确认失败' },
      { status: 500 }
    );
  }
}
