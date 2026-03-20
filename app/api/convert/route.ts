import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { classroomConversions, organizationClassrooms } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { shareToken, phone } = body;

    if (!shareToken || !phone) {
      return apiError(API_ERROR_CODES.MISSING_REQUIRED_FIELD, 400, 'Missing required fields');
    }

    // Validate phone number (11 digits, starts with 1)
    if (!/^[1][3-9]\d{9}$/.test(phone)) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 400, '请输入正确的手机号');
    }

    // Find organization_classroom
    const [orgClassroom] = await db
      .select()
      .from(organizationClassrooms)
      .where(eq(organizationClassrooms.shareToken, shareToken));

    if (!orgClassroom) {
      return apiError(API_ERROR_CODES.INVALID_REQUEST, 404, '课程不存在');
    }

    // Insert conversion (UNIQUE constraint will prevent duplicates)
    await db.insert(classroomConversions).values({
      organizationClassroomId: orgClassroom.id,
      phone,
    }).onConflictDoNothing();

    return apiSuccess({
      success: true,
      message: '提交成功！我们会尽快联系您'
    });
  } catch (error) {
    console.error('Conversion error:', error);
    return apiError(API_ERROR_CODES.INTERNAL_ERROR, 500, '提交失败');
  }
}
