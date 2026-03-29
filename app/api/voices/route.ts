import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { db } from '@/lib/db';
import { clonedVoices } from '@/drizzle/schema';
import { desc, eq } from 'drizzle-orm';

/**
 * GET /api/voices - 获取所有已保存的克隆音色
 */
export async function GET() {
  try {
    const voices = await db
      .select()
      .from(clonedVoices)
      .orderBy(desc(clonedVoices.createdAt));

    return apiSuccess({
      voices: voices.map((v: any) => ({
        id: v.id,
        voiceId: v.voiceId,
        voiceName: v.voiceName,
        description: v.description,
        createdAt: v.createdAt,
      })),
    });
  } catch (error) {
    return apiError(
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? error.message : 'Failed to fetch voices',
    );
  }
}

/**
 * POST /api/voices - 保存新克隆的音色
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { voiceId, voiceName, fileId, description } = body as {
      voiceId: string;
      voiceName: string;
      fileId?: string;
      description?: string;
    };

    if (!voiceId || !voiceName) {
      return apiError(
        'MISSING_REQUIRED_FIELD',
        400,
        'Missing required fields: voiceId, voiceName',
      );
    }

    // 检查是否已存在
    const existing = await db
      .select()
      .from(clonedVoices)
      .where(eq(clonedVoices.voiceId, voiceId))
      .limit(1);

    if (existing.length > 0) {
      return apiSuccess({
        message: 'Voice already saved',
        voice: existing[0],
      });
    }

    // 保存新音色
    const [newVoice] = await db
      .insert(clonedVoices)
      .values({
        voiceId,
        voiceName,
        fileId,
        description,
      })
      .returning();

    return apiSuccess({
      voice: newVoice,
    });
  } catch (error) {
    return apiError(
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? error.message : 'Failed to save voice',
    );
  }
}
