import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { organizationClassrooms, organizations } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';

export async function GET(
  req: NextRequest,
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
    const classroomResponse = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/classroom?id=${encodeURIComponent(orgClassroom.classroomId)}`
    );
    const classroomData = await classroomResponse.json();

    if (!classroomData.success || !classroomData.classroom) {
      return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '获取课程数据失败');
    }

    return apiSuccess({
      classroom: classroomData.classroom,
      organization: orgClassroom.organization,
    });
  } catch (error) {
    console.error('Fetch error:', error);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '获取失败');
  }
}
