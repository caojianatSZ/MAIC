import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as schema from '@/drizzle/schema';
import { eq, sql, desc, and } from 'drizzle-orm';

/**
 * 相似课程推荐API
 * GET /api/classrooms/{id}/similar?limit={limit}
 *
 * 基于知识点相似度推荐相关课程：
 * 1. 计算共同知识点数量
 * 2. 按相似度排序
 * 3. 优先推荐同科目、同年级的课程
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const classroomId = params.id;
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '10');

  try {
    // 1. 获取当前课程的知识点
    const currentClassroom = await db.query.classrooms.findFirst({
      where: eq(schema.classrooms.id, classroomId),
      columns: {
        id: true,
        knowledgePointUris: true,
        subject: true,
        gradeLevel: true,
        primaryKnowledgePoint: true,
      },
    });

    if (!currentClassroom) {
      return NextResponse.json({
        error: 'Classroom not found',
        classroomId,
      }, { status: 404 });
    }

    // 2. 查找有共同知识点的课程
    const knowledgePointUris = currentClassroom.knowledgePointUris || [];
    if (knowledgePointUris.length === 0) {
      // 如果没有知识点，返回空结果
      return NextResponse.json({
        success: true,
        classroomId,
        similar: [],
        message: 'No knowledge points found for this classroom',
      });
    }

    // 3. 构建查询 - 使用数组重叠运算符
    const similarClassrooms = await db
      .select({
        id: schema.classrooms.id,
        title: schema.classrooms.title,
        description: schema.classrooms.description,
        subject: schema.classrooms.subject,
        gradeLevel: schema.classrooms.gradeLevel,
        difficulty: schema.classrooms.difficulty,
        knowledgePointUris: schema.classrooms.knowledgePointUris,
        primaryKnowledgePoint: schema.classrooms.primaryKnowledgePoint,
        scenesCount: schema.classrooms.scenesCount,
        viewCount: sql<number>`COALESCE(${schema.classroomStats.viewCount}, 0)`.as('viewCount'),
        avgRating: schema.classroomStats.avgRating,
        createdAt: schema.classrooms.createdAt,
      })
      .from(schema.classrooms)
      .leftJoin(schema.classroomStats, eq(schema.classroomStats.classroomId, schema.classrooms.id))
      .where(
        and(
          // 排除自己
          sql`${schema.classrooms.id} != ${classroomId}`,

          // 至少有一个共同知识点
          sql`${schema.classrooms.knowledgePointUris} && ${knowledgePointUris}`.as('hasCommonKP'),

          // 可选：同科目（提升相关性）
          currentClassroom.subject
            ? eq(schema.classrooms.subject, currentClassroom.subject)
            : undefined,

          // 可选：同年级（提升相关性）
          currentClassroom.gradeLevel
            ? eq(schema.classrooms.gradeLevel, currentClassroom.gradeLevel)
            : undefined,

          // 只显示已完成的课程
          eq(schema.classrooms.status, 'completed')
        )
      )
      .orderBy(desc(sql`array_length(${schema.classrooms.knowledgePointUris}, 1)`))
      .limit(limit);

    // 4. 计算相似度（共同知识点数量）
    const similar = similarClassrooms.map((c) => {
      const commonKnowledgePoints = (c.knowledgePointUris || []).filter((uri: string) =>
        knowledgePointUris.includes(uri)
      );

      return {
        id: c.id,
        title: c.title,
        description: c.description,
        subject: c.subject,
        gradeLevel: c.gradeLevel,
        difficulty: c.difficulty,
        primaryKnowledgePoint: c.primaryKnowledgePoint,
        scenesCount: c.scenesCount,
        viewCount: c.viewCount || 0,
        avgRating: c.avgRating ? parseFloat(c.avgRating) : null,
        createdAt: c.createdAt,
        url: `/classroom/${c.id}`,
        similarity: {
          commonKnowledgePoints: commonKnowledgePoints.length,
          totalKnowledgePoints: (c.knowledgePointUris || []).length,
          commonKnowledgePointNames: commonKnowledgePoints.map(
            (uri) => extractKnowledgePointName(uri)
          ),
        },
      };
    });

    // 5. 按相似度排序
    similar.sort((a, b) => b.similarity.commonKnowledgePoints - a.similarity.commonKnowledgePoints);

    return NextResponse.json({
      success: true,
      classroomId,
      currentClassroom: {
        title: currentClassroom.title,
        subject: currentClassroom.subject,
        gradeLevel: currentClassroom.gradeLevel,
        knowledgePointsCount: knowledgePointUris.length,
      },
      similar,
      count: similar.length,
    });
  } catch (error) {
    console.error('Error finding similar classrooms:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * 从URI中提取知识点名称（辅助函数）
 */
function extractKnowledgePointName(uri: string): string {
  const parts = uri.split(':');
  return parts[parts.length - 1] || uri;
}
