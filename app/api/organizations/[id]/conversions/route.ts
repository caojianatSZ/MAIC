import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { organizations, organizationClassrooms, classroomConversions } from '@/drizzle/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = req.nextUrl.searchParams;
    const classroomId = searchParams.get('classroomId');
    const limit = parseInt(searchParams.get('limit') || '10');

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

    // 构建查询条件
    let orgClassroomList;

    if (classroomId) {
      // 如果指定了 classroomId，只查询该课堂
      orgClassroomList = await db
        .select()
        .from(organizationClassrooms)
        .where(
          eq(organizationClassrooms.classroomId, classroomId)
        );
    } else {
      // 否则查询该组织的所有课堂
      orgClassroomList = await db
        .select()
        .from(organizationClassrooms)
        .where(eq(organizationClassrooms.organizationId, id));
    }

    const orgClassroomIds = orgClassroomList.map((oc) => oc.id);

    if (orgClassroomIds.length === 0) {
      return apiSuccess({
        conversions: [],
      });
    }

    // 获取转化记录
    const conversions = await db
      .select({
        phone: classroomConversions.phone,
        createdAt: classroomConversions.createdAt,
      })
      .from(classroomConversions)
      .where(sql`${classroomConversions.organizationClassroomId} = ANY(${orgClassroomIds})`)
      .orderBy(desc(classroomConversions.createdAt))
      .limit(limit);

    return apiSuccess({
      conversions,
    });
  } catch (error) {
    console.error('Conversions API error:', error);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      '获取转化记录失败'
    );
  }
}
