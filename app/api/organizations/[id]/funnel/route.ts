import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { organizations, organizationClassrooms, classroomViews, classroomConversions } from '@/drizzle/schema';
import { eq, count, and, sql, avg } from 'drizzle-orm';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';

export async function GET(
  _req: NextRequest,
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
        funnel: {
          stage1: {
            name: '浏览',
            count: 0,
            percentage: 100,
          },
          stage2: {
            name: '完成',
            count: 0,
            percentage: 0,
            rate: 0,
          },
          stage3: {
            name: '转化',
            count: 0,
            percentage: 0,
            rate: 0,
          },
        },
        stageToStage: {
          viewToCompletion: 0,
          completionToConversion: 0,
          viewToConversion: 0,
        },
        averageWatchDuration: 0,
      });
    }

    // 阶段1：浏览量（100%）
    const [viewsResult] = await db
      .select({ count: count() })
      .from(classroomViews)
      .where(sql`${classroomViews.organizationClassroomId} = ANY(${orgClassroomIds})`);

    const viewsCount = viewsResult?.count || 0;

    // 阶段2：完成量
    const [completionsResult] = await db
      .select({ count: count() })
      .from(classroomViews)
      .where(
        and(
          sql`${classroomViews.organizationClassroomId} = ANY(${orgClassroomIds})`,
          eq(classroomViews.completed, true)
        )
      );

    const completionsCount = completionsResult?.count || 0;

    // 阶段3：转化量
    const [conversionsResult] = await db
      .select({ count: count() })
      .from(classroomConversions)
      .where(sql`${classroomConversions.organizationClassroomId} = ANY(${orgClassroomIds})`);

    const conversionsCount = conversionsResult?.count || 0;

    // 计算各阶段占比（相对于浏览量）
    const completionPercentage = viewsCount > 0 ? (completionsCount / viewsCount) * 100 : 0;
    const conversionPercentage = viewsCount > 0 ? (conversionsCount / viewsCount) * 100 : 0;

    // 计算阶段间转化率
    const viewToCompletionRate = viewsCount > 0 ? (completionsCount / viewsCount) * 100 : 0;
    const completionToConversionRate = completionsCount > 0 ? (conversionsCount / completionsCount) * 100 : 0;
    const viewToConversionRate = viewsCount > 0 ? (conversionsCount / viewsCount) * 100 : 0;

    // 计算平均观看时长（秒）
    const [durationResult] = await db
      .select({
        avgDuration: avg(sql<number>`COALESCE(${classroomViews.durationSeconds}, 0)`),
      })
      .from(classroomViews)
      .where(
        and(
          sql`${classroomViews.organizationClassroomId} = ANY(${orgClassroomIds})`,
          eq(classroomViews.completed, true)
        )
      );

    const averageWatchDuration = durationResult?.avgDuration
      ? Math.round(Number(durationResult.avgDuration))
      : 0;

    return apiSuccess({
      organizationId: id,
      organizationName: org.name,
      funnel: {
        stage1: {
          name: '浏览',
          count: viewsCount,
          percentage: 100,
        },
        stage2: {
          name: '完成',
          count: completionsCount,
          percentage: Number(completionPercentage.toFixed(2)),
          rate: Number(viewToCompletionRate.toFixed(2)),
        },
        stage3: {
          name: '转化',
          count: conversionsCount,
          percentage: Number(conversionPercentage.toFixed(2)),
          rate: Number(viewToConversionRate.toFixed(2)),
        },
      },
      stageToStage: {
        viewToCompletion: Number(viewToCompletionRate.toFixed(2)),
        completionToConversion: Number(completionToConversionRate.toFixed(2)),
        viewToConversion: Number(viewToConversionRate.toFixed(2)),
      },
      averageWatchDuration,
    });
  } catch (error) {
    console.error('Funnel API error:', error);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      '获取漏斗数据失败'
    );
  }
}
