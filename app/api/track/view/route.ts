import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { classroomViews, organizationClassrooms } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shareToken, sessionId } = body;

    if (!shareToken || !sessionId) {
      return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing required fields');
    }

    // Find organization_classroom
    const [orgClassroom] = await db
      .select()
      .from(organizationClassrooms)
      .where(eq(organizationClassrooms.shareToken, shareToken));

    if (!orgClassroom) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 404, '课程不存在');
    }

    // Insert view record (UNIQUE constraint will prevent duplicates)
    await db.insert(classroomViews).values({
      organizationClassroomId: orgClassroom.id,
      sessionId,
    }).onConflictDoNothing();

    return apiSuccess({ success: true });
  } catch (error) {
    console.error('Tracking error:', error);
    return apiSuccess({ success: true }); // Don't fail tracking
  }
}
