import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { db } from '@/lib/db';
import { clonedVoices } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * DELETE /api/voices/[id] - 删除已保存的克隆音色
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const deleted = await db
      .delete(clonedVoices)
      .where(eq(clonedVoices.id, id))
      .returning();

    if (deleted.length === 0) {
      return apiError('NOT_FOUND', 404, 'Voice not found');
    }

    return apiSuccess({
      message: 'Voice deleted successfully',
    });
  } catch (error) {
    return apiError(
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? error.message : 'Failed to delete voice',
    );
  }
}
