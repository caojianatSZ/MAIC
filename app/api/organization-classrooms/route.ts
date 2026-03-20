import { NextRequest } from 'next/server';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { organizationClassrooms, organizations } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organizationId, classroomId, subject, grade } = body;

    // Verify organization exists
    const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId));
    if (!org) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 404, '机构不存在');
    }

    // Generate unique token
    const shareToken = nanoid(16);

    // Create association
    const [orgClassroom] = await db.insert(organizationClassrooms).values({
      organizationId,
      classroomId,
      shareToken,
      subject: subject || null,
      grade: grade || null,
    }).returning();

    return apiSuccess({
      id: orgClassroom.id,
      shareToken: orgClassroom.shareToken,
    });
  } catch (error) {
    console.error('Association error:', error);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '创建失败');
  }
}
