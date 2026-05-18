import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/courses/[id] - 获取课程详情
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const course = await prisma.courseSession.findUnique({
      where: { id },
      include: {
        bookings: {
          include: {
            student: { select: { id: true, nickname: true } },
            teacher: { select: { id: true, nickname: true } }
          }
        }
      }
    });

    if (!course) {
      return NextResponse.json({ error: '课程不存在' }, { status: 404 });
    }

    return NextResponse.json(course);
  } catch (error) {
    console.error('获取课程详情失败:', error);
    return NextResponse.json({ error: '获取数据失败' }, { status: 500 });
  }
}

// PUT /api/courses/[id] - 更新课程
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, scenes, planData, isCompleted } = body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (scenes !== undefined) {
      updateData.scenes = scenes;
      updateData.sceneCount = scenes.length;
    }
    if (planData !== undefined) updateData.planData = planData;
    if (isCompleted !== undefined) updateData.isCompleted = isCompleted;

    const course = await prisma.courseSession.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json(course);
  } catch (error) {
    console.error('更新课程失败:', error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

// DELETE /api/courses/[id] - 删除课程
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 检查是否有关联的预约
    const bookingCount = await prisma.booking.count({
      where: { courseId: id }
    });

    if (bookingCount > 0) {
      return NextResponse.json(
        { error: `该课程已有${bookingCount}个预约，无法删除` },
        { status: 400 }
      );
    }

    await prisma.courseSession.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除课程失败:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
