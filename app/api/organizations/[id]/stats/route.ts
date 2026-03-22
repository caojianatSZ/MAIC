import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { organizations, organizationClassrooms, classroomViews, classroomConversions } from '@/drizzle/schema';
import { eq, count, and, sql, inArray } from 'drizzle-orm';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 验证组织是否存在
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id));

    if (!org) {
      return apiError(
        API_ERROR_CODES.INVALID_REQUEST,
        404,
        '机构不存在'
      );
    }

    // 获取该组织的所有课堂
    const orgClassroomList = await db
      .select()
      .from(organizationClassrooms)
      .where(eq(organizationClassrooms.organizationId, id));

    const orgClassroomIds = orgClassroomList.map((oc) => oc.id);

    // 如果没有课堂，返回空数据
    if (orgClassroomIds.length === 0) {
      return apiSuccess({
        organizationId: id,
        organizationName: org.name,
        totalViews: 0,
        totalCompletions: 0,
        totalConversions: 0,
        conversionRate: 0,
        statsPerClassroom: [],
      });
    }

    // 统计总浏览量（唯一 session 数）
    const [viewsResult] = await db
      .select({ count: count() })
      .from(classroomViews)
      .where(inArray(classroomViews.organizationClassroomId, orgClassroomIds));

    const totalViews = viewsResult?.count || 0;

    // 统计总完成量
    const [completionsResult] = await db
      .select({ count: count() })
      .from(classroomViews)
      .where(
        and(
          inArray(classroomViews.organizationClassroomId, orgClassroomIds),
          eq(classroomViews.completed, true)
        )
      );

    const totalCompletions = completionsResult?.count || 0;

    // 统计总转化量（唯一电话号码数）
    const [conversionsResult] = await db
      .select({ count: count() })
      .from(classroomConversions)
      .where(inArray(classroomConversions.organizationClassroomId, orgClassroomIds));

    const totalConversions = conversionsResult?.count || 0;

    // 计算转化率（转化量 / 浏览量）
    const conversionRate = totalViews > 0 ? (totalConversions / totalViews) * 100 : 0;

    // 统计每个课堂的数据
    const statsPerClassroom = await Promise.all(
      orgClassroomList.map(async (orgClassroom) => {
        // 该课堂的浏览量
        const [classViewsResult] = await db
          .select({ count: count() })
          .from(classroomViews)
          .where(eq(classroomViews.organizationClassroomId, orgClassroom.id));

        const views = classViewsResult?.count || 0;

        // 该课堂的完成量
        const [classCompletionsResult] = await db
          .select({ count: count() })
          .from(classroomViews)
          .where(
            and(
              eq(classroomViews.organizationClassroomId, orgClassroom.id),
              eq(classroomViews.completed, true)
            )
          );

        const completions = classCompletionsResult?.count || 0;

        // 该课堂的转化量
        const [classConversionsResult] = await db
          .select({ count: count() })
          .from(classroomConversions)
          .where(eq(classroomConversions.organizationClassroomId, orgClassroom.id));

        const conversions = classConversionsResult?.count || 0;

        // 计算该课堂的转化率
        const classConversionRate = views > 0 ? (conversions / views) * 100 : 0;

        return {
          classroomId: orgClassroom.classroomId,
          shareToken: orgClassroom.shareToken,
          subject: orgClassroom.subject,
          grade: orgClassroom.grade,
          views,
          completions,
          conversions,
          conversionRate: Number(classConversionRate.toFixed(2)),
        };
      })
    );

    return apiSuccess({
      organizationId: id,
      organizationName: org.name,
      totalViews,
      totalCompletions,
      totalConversions,
      conversionRate: Number(conversionRate.toFixed(2)),
      statsPerClassroom,
    });
  } catch (error) {
    console.error('Stats API error:', error);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      '获取统计数据失败'
    );
  }
}
