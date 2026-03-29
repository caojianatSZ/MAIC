import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileId } = body as { fileId: string };

    if (!fileId) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing fileId');
    }

    // Return debug info about the file_id
    return apiSuccess({
      debug: true,
      fileId: fileId,
      fileIdLength: fileId.length,
      fileIdPrefix: fileId.substring(0, 10),
      fileIdFormat: fileId.startsWith('file-') ? 'OpenAI format' : 'GLM format',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return apiError('INTERNAL_ERROR', 500, 'Debug endpoint error');
  }
}
