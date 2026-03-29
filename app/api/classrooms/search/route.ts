import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as schema from '@/drizzle/schema';
import { sql, and, or, desc, eq, gte } from 'drizzle-orm';

/**
 * 课程搜索API
 * GET /api/classrooms/search?q={keyword}&subject={subject}&gradeLevel={grade}&difficulty={difficulty}&knowledgePoint={uri}&page={page}&limit={limit}
 *
 * 支持的搜索方式：
 * 1. 全文搜索：q=关键词
 * 2. 知识点搜索：knowledgePoint=EduKG URI
 * 3. 多维度筛选：subject, gradeLevel, difficulty
 * 4. 分页和排序
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // 解析查询参数
  const query = searchParams.get('q') || '';
  const subject = searchParams.get('subject');
  const gradeLevel = searchParams.get('gradeLevel');
  const difficulty = searchParams.get('difficulty');
  const knowledgePoint = searchParams.get('knowledgePoint');
  const organizationId = searchParams.get('organizationId');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const sortBy = searchParams.get('sortBy') || 'relevance'; // relevance/latest/views/rating

  try {
    // 构建查询条件
    const conditions = [];

    // 1. 全文搜索（优先级最高）
    if (query) {
      conditions.push(
        sql`${schema.classrooms.searchVector} @@ plainto_tsquery('simple', ${query})`
      );
    }

    // 2. 知识点筛选（数组包含查询）
    if (knowledgePoint) {
      conditions.push(
        sql`${schema.classrooms.knowledgePointUris} @> ARRAY[${knowledgePoint}]::text[]`
      );
    }

    // 3. 精确筛选
    if (subject) {
      conditions.push(eq(schema.classrooms.subject, subject));
    }
    if (gradeLevel) {
      conditions.push(eq(schema.classrooms.gradeLevel, gradeLevel));
    }
    if (difficulty) {
      conditions.push(eq(schema.classrooms.difficulty, difficulty));
    }
    if (organizationId) {
      conditions.push(eq(schema.classrooms.organizationId, organizationId));
    }

    // 组合条件
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // 排序逻辑
    let orderBy;
    switch (sortBy) {
      case 'latest':
        orderBy = desc(schema.classrooms.createdAt);
        break;
      case 'views':
        // 需要join stats表
        orderBy = sql`COALESCE(${schema.classroomStats.viewCount}, 0) DESC`;
        break;
      case 'rating':
        orderBy = sql`COALESCE(${schema.classroomStats.avgRating}, 0) DESC`;
        break;
      case 'relevance':
      default:
        // 全文搜索相关性排序
        if (query) {
          orderBy = sql`ts_rank(${schema.classrooms.searchVector}, plainto_tsquery('simple', ${query})) DESC`;
        } else {
          orderBy = desc(schema.classrooms.createdAt);
        }
        break;
    }

    // 执行查询
    const [classrooms, totalCount] = await Promise.all([
      db
        .select({
          id: schema.classrooms.id,
          title: schema.classrooms.title,
          description: schema.classrooms.description,
          requirement: schema.classrooms.requirement,
          subject: schema.classrooms.subject,
          gradeLevel: schema.classrooms.gradeLevel,
          difficulty: schema.classrooms.difficulty,
          knowledgePointUris: schema.classrooms.knowledgePointUris,
          primaryKnowledgePoint: schema.classrooms.primaryKnowledgePoint,
          scenesCount: schema.classrooms.scenesCount,
          durationMinutes: schema.classrooms.durationMinutes,
          hasTTS: schema.classrooms.hasTTS,
          mainJsonFile: schema.classrooms.mainJsonFile,
          keywords: schema.classrooms.keywords,
          tags: schema.classrooms.tags,
          createdAt: schema.classrooms.createdAt,
          // Stats（左连接）
          viewCount: sql<number>`COALESCE(${schema.classroomStats.viewCount}, 0)`.as('viewCount'),
          avgRating: schema.classroomStats.avgRating,
        })
        .from(schema.classrooms)
        .leftJoin(schema.classroomStats, eq(schema.classroomStats.classroomId, schema.classrooms.id))
        .where(where)
        .orderBy(orderBy)
        .limit(limit)
        .offset((page - 1) * limit),

      db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.classrooms)
        .where(where),
    ]);

    const total = totalCount[0].count;

    // 格式化返回结果
    const results = classrooms.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      subject: c.subject,
      gradeLevel: c.gradeLevel,
      difficulty: c.difficulty,
      knowledgePointUris: c.knowledgePointUris || [],
      primaryKnowledgePoint: c.primaryKnowledgePoint,
      scenesCount: c.scenesCount,
      durationMinutes: c.durationMinutes,
      hasTTS: c.hasTTS,
      viewCount: c.viewCount || 0,
      avgRating: c.avgRating ? parseFloat(c.avgRating) : null,
      createdAt: c.createdAt,
      url: `/classroom/${c.id}`,
    }));

    return NextResponse.json({
      success: true,
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
      filters: {
        query,
        subject,
        gradeLevel,
        difficulty,
        knowledgePoint,
        sortBy,
      },
    });
  } catch (error) {
    console.error('Error searching classrooms:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
