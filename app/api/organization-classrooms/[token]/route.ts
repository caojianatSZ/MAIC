import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { organizationClassrooms, organizations } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const [orgClassroom] = await db
      .select({
        classroomId: organizationClassrooms.classroomId,
        organization: {
          id: organizations.id,
          name: organizations.name,
          logoData: organizations.logoData,
          logoMimeType: organizations.logoMimeType,
          phone: organizations.phone,
        },
      })
      .from(organizationClassrooms)
      .innerJoin(organizations, eq(organizationClassrooms.organizationId, organizations.id))
      .where(eq(organizationClassrooms.shareToken, token));

    if (!orgClassroom) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 404, '课程不存在');
    }

    // Get classroom data from existing API
    let classroomData = null;
    try {
      const classroomResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/classroom?id=${encodeURIComponent(orgClassroom.classroomId)}`,
        { signal: AbortSignal.timeout(5000) } // 5秒超时
      );
      classroomData = await classroomResponse.json();
    } catch (error) {
      console.error('Failed to fetch classroom:', error);
    }

    // 如果 classroom 数据不存在，返回仅有组织信息的响应
    if (!classroomData?.success || !classroomData?.classroom) {
      return apiSuccess({
        classroom: null,
        organization: orgClassroom.organization,
        classroomId: orgClassroom.classroomId,
        classroomNotFound: true,
      });
    }

    return apiSuccess({
      classroom: classroomData.classroom,
      organization: orgClassroom.organization,
      classroomId: orgClassroom.classroomId,
      classroomNotFound: false,
    });
  } catch (error) {
    console.error('Fetch error:', error);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '获取失败');
  }
}

// PATCH: Update classroom by share token
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await req.json();
    const { subject, grade } = body;

    // Check if classroom exists
    const [existing] = await db
      .select()
      .from(organizationClassrooms)
      .where(eq(organizationClassrooms.shareToken, token));

    if (!existing) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 404, '课程不存在');
    }

    // Update classroom
    const [updated] = await db
      .update(organizationClassrooms)
      .set({
        ...(subject !== undefined && { subject }),
        ...(grade !== undefined && { grade }),
      })
      .where(eq(organizationClassrooms.shareToken, token))
      .returning();

    return apiSuccess({
      id: updated.id,
      shareToken: updated.shareToken,
      subject: updated.subject,
      grade: updated.grade,
    });
  } catch (error) {
    console.error('Update classroom error:', error);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '更新失败');
  }
}
