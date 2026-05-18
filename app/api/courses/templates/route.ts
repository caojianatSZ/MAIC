import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/courses/templates - 获取课程模板列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject');
    const grade = searchParams.get('grade');
    const classType = searchParams.get('classType');

    // 从 metadata 中筛选模板课程
    const where: any = {
      isCompleted: true,
      generationMethod: 'manually_created'
    };

    if (subject) where.subject = subject;
    if (grade) where.grade = grade;

    const templates = await prisma.courseSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return NextResponse.json({ data: templates });
  } catch (error) {
    console.error('获取课程模板失败:', error);
    return NextResponse.json({ error: '获取数据失败' }, { status: 500 });
  }
}

// POST /api/courses/templates - 保存课程模板
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      subject,
      grade,
      topic,
      classType,
      duration,
      difficulty,
      scenes,
      quizQuestions,
      teacherId
    } = body;

    if (!title || !subject || !topic) {
      return NextResponse.json(
        { error: '缺少必填字段: title, subject, topic' },
        { status: 400 }
      );
    }

    const template = await prisma.courseSession.create({
      data: {
        title: `[模板] ${title}`,
        description: `课程模板 - ${topic}`,
        subject,
        grade,
        topic,
        classType,
        duration,
        difficulty,
        knowledgePointIds: [],
        generationMethod: 'manually_created',
        scenes: scenes || [],
        sceneCount: scenes?.length || 0,
        planData: quizQuestions ? { quizQuestions } : Prisma.JsonNull,
        isCompleted: true,
        metadata: {
          isTemplate: true,
          createdBy: teacherId
        }
      }
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('保存课程模板失败:', error);
    return NextResponse.json({ error: '保存失败' }, { status: 500 });
  }
}
