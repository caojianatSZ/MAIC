/**
 * Voice Clone API for GLM-TTS-Clone
 *
 * Creates a cloned voice profile from an uploaded audio file.
 * Requires a file_id from the audio upload endpoint.
 * Returns a voice_id that can be used with GLM-TTS for audio generation.
 *
 * POST /api/voice/clone
 * Body: { fileId: string, ttsApiKey?: string, ttsBaseUrl?: string }
 */

import { NextRequest } from 'next/server';
import { resolveTTSApiKey, resolveTTSBaseUrl } from '@/lib/server/provider-config';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import { validateUrlForSSRF } from '@/lib/server/ssrf-guard';

const log = createLogger('Voice Clone API');

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileId, ttsApiKey, ttsBaseUrl } = body as {
      fileId: string;
      ttsApiKey?: string;
      ttsBaseUrl?: string;
    };

    // Validate required fields
    if (!fileId || typeof fileId !== 'string') {
      return apiError(
        'MISSING_REQUIRED_FIELD',
        400,
        'Missing required field: fileId',
      );
    }

    // Resolve API configuration
    const clientBaseUrl = ttsBaseUrl || undefined;
    if (clientBaseUrl && process.env.NODE_ENV === 'production') {
      const ssrfError = validateUrlForSSRF(clientBaseUrl);
      if (ssrfError) {
        return apiError('INVALID_URL', 403, ssrfError);
      }
    }

    const apiKey = clientBaseUrl
      ? ttsApiKey || ''
      : resolveTTSApiKey('glm-tts', ttsApiKey || undefined);
    const baseUrl = clientBaseUrl
      ? clientBaseUrl
      : resolveTTSBaseUrl('glm-tts', ttsBaseUrl || undefined) || 'https://open.bigmodel.cn/api/paas/v4';

    if (!apiKey) {
      return apiError(
        'MISSING_API_KEY',
        400,
        'GLM API key is required. Please configure TTS_GLM_API_KEY in environment or provide ttsApiKey.',
      );
    }

    log.info(`Creating voice clone from file: ${fileId}`);

    // Call GLM voice clone API
    // Reference: https://docs.bigmodel.cn/cn/guide/models/sound-and-video/glm-tts-clone
    const cloneUrl = `${baseUrl}/voice/clone`;

    // Generate unique voice name and request ID
    const voiceName = `voice_${Date.now()}`;
    const requestId = `voice_clone_req_${Date.now()}`;

    const requestBody = {
      model: 'glm-tts-clone',
      voice_name: voiceName,
      text: '你好，这是一段示例音频的文本内容，用于音色复刻参考。', // 示例音频的文本
      input: '欢迎使用我们的音色复刻服务，这将生成与示例音频相同音色的语音。', // 试听文本
      file_id: fileId,
      request_id: requestId,
    };

    log.info(`GLM voice clone request URL: ${cloneUrl}`);
    log.info(`GLM voice clone request body:`, JSON.stringify(requestBody, null, 2));

    const response = await fetch(cloneUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error(`GLM voice clone failed: ${response.status} - ${errorText}`);

      // Try to parse error for better message
      let errorMsg = `音色复刻失败 (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMsg = errorJson.error.message;
        } else if (errorJson.message) {
          errorMsg = errorJson.message;
        }
      } catch {
        // If not JSON, use status text
        errorMsg = `音色复刻失败: ${response.statusText}`;
      }

      return apiError(
        'UPSTREAM_ERROR',
        response.status,
        errorMsg,
        errorText.substring(0, 500), // Truncate very long error responses
      );
    }

    const result = await response.json();

    log.info('GLM voice clone response:', result);

    // GLM returns { voice: "xxx", file_id: "xxx", ... }
    // The 'voice' field contains the voice_id
    const voiceId = result.voice;

    if (!voiceId) {
      log.error('Invalid GLM voice clone response:', result);
      return apiError(
        'UPSTREAM_ERROR',
        500,
        'Invalid response from GLM voice clone API: missing voice field',
      );
    }

    log.info(`Voice cloned successfully: voiceId=${voiceId}`);

    return apiSuccess({
      voiceId: voiceId,
      fileId: fileId,
      createdAt: result.created_at,
    });
  } catch (error) {
    log.error('Voice clone error:', error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? error.message : 'Failed to clone voice',
    );
  }
}
