import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';
import { createLogger } from '@/lib/logger';

const prisma = new PrismaClient();
const log = createLogger('CoursesAPI');

// GET /api/courses - 获取课程列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get('teacherId');
    const subject = searchParams.get('subject');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: any = {};

    if (teacherId) where.teacherId = teacherId;
    if (subject) where.subject = subject;
    if (status) where.isCompleted = status === 'COMPLETED';

    const [courses, total] = await Promise.all([
      prisma.courseSession.findMany({
        where,
        include: {
          bookings: {
            select: { id: true, scheduledAt: true, status: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.courseSession.count({ where })
    ]);

    return NextResponse.json({
      data: courses,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    log.error('获取课程列表失败:', error);
    return NextResponse.json({ error: '获取数据失败' }, { status: 500 });
  }
}

// POST /api/courses/generate - 生成课程（简化版，先保存基本结构）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      teacherId,
      subject,
      topic,
      grade,
      classType = 'ONE_V1',
      duration = 60,
      difficulty = 2,
      lessonPlan,
      quizQuestions
    } = body;

    if (!teacherId || !subject || !topic) {
      return NextResponse.json(
        { error: '缺少必填字段: teacherId, subject, topic' },
        { status: 400 }
      );
    }

    log.info(`创建课程: ${subject} - ${topic}`);

    // 创建课程记录
    const course = await prisma.courseSession.create({
      data: {
        title: `${subject} - ${topic}`,
        description: `课程教案 - ${topic}`,
        subject,
        grade,
        topic,
        classType,
        duration,
        difficulty,
        knowledgePointIds: [],
        generationMethod: 'manually_created',
        generationPrompt: topic,
        scenes: lessonPlan || [],
        sceneCount: 0,
        planData: quizQuestions ? { quizQuestions } : Prisma.JsonNull,
        isCompleted: true,
        metadata: {
          createdBy: teacherId,
          createdAt: new Date().toISOString()
        }
      }
    });

    return NextResponse.json({
      course,
      message: '课程创建成功'
    }, { status: 201 });
  } catch (error) {
    log.error('创建课程失败:', error);
    return NextResponse.json({ error: '创建失败' }, { status: 500 });
  }
}
