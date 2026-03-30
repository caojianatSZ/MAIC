import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { classrooms, classroomTemplates, users, userWrongQuestions } from '@/drizzle/schema';
import { sql } from 'drizzle-orm';

/**
 * 获取系统统计数据
 * GET /api/stats
 */
export async function GET() {
  try {
    const [coursesCount, templatesCount, usersCount, wrongQuestionsCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(classrooms),
      db.select({ count: sql<number>`count(*)::int` }).from(classroomTemplates),
      db.select({ count: sql<number>`count(*)::int` }).from(users),
      db.select({ count: sql<number>`count(*)::int` }).from(userWrongQuestions),
    ]);

    return NextResponse.json({
      courses: coursesCount[0].count,
      templates: templatesCount[0].count,
      users: usersCount[0].count,
      wrongQuestions: wrongQuestionsCount[0].count,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('获取统计数据失败', error);
    return NextResponse.json({
      courses: 0,
      templates: 0,
      users: 0,
      wrongQuestions: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
