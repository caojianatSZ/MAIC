/**
 * Audio Upload API for GLM-TTS-Clone
 *
 * Uploads audio files to GLM server for voice cloning.
 * Returns a file_id that can be used with the voice/clone endpoint.
 *
 * POST /api/upload/audio
 * Content-Type: multipart/form-data
 * Body: { file: File }
 */

import { NextRequest } from 'next/server';
import { resolveTTSApiKey } from '@/lib/server/provider-config';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';

const log = createLogger('Audio Upload API');

export const maxDuration = 60;

// Maximum file size: 10MB (generous for 3-second audio)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Allowed audio formats
const ALLOWED_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
  'audio/m4a',
  'audio/mp4',
  'audio/x-m4a',
];

export async function POST(req: NextRequest) {
  try {
    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const ttsApiKey = formData.get('ttsApiKey') as string | null;

    // Validate file exists
    if (!file) {
      return apiError(
        'MISSING_REQUIRED_FIELD',
        400,
        'Missing required field: file',
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return apiError(
        'INVALID_REQUEST',
        400,
        `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      );
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return apiError(
        'INVALID_REQUEST',
        400,
        `Invalid file type: ${file.type}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    // Resolve API key
    const apiKey = ttsApiKey
      ? ttsApiKey
      : resolveTTSApiKey('glm-tts', undefined);

    if (!apiKey) {
      return apiError(
        'MISSING_API_KEY',
        400,
        'GLM API key is required. Please configure TTS_GLM_API_KEY in environment or provide ttsApiKey.',
      );
    }

    log.info(
      `Uploading audio file: name=${file.name}, size=${file.size}, type=${file.type}`,
    );

    // GLM File Upload API
    // Reference: https://docs.bigmodel.cn/api-reference/文件-api/上传文件
    const uploadFormData = new FormData();

    // Convert file to blob and create a new File with the correct name
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: file.type });

    // GLM uses 'file' parameter (singular)
    uploadFormData.append('file', blob, file.name);

    // Purpose: voice-clone-input for audio files used in voice cloning
    uploadFormData.append('purpose', 'voice-clone-input');

    // Use the correct GLM file upload endpoint
    // Reference: https://docs.bigmodel.cn/api-reference/文件-api/上传文件
    const uploadUrl = 'https://open.bigmodel.cn/api/paas/v4/files';

    try {
      log.info(`Uploading to GLM file API: ${uploadUrl}`);

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: uploadFormData,
      });

      log.info(`Response status: ${response.status}, OK: ${response.ok}`);

      if (response.ok) {
        const result = await response.json();
        log.info('Upload response:', result);

        // GLM returns { id: "file-xxx", ... }
        // This 'id' is the file_id needed for voice clone API
        if (result.id) {
          const fileId = result.id;
          log.info(`Audio uploaded successfully: fileId=${fileId}`);
          log.info(`File details - Name: ${file.name}, Size: ${file.size}, Type: ${file.type}`);
          log.info(`Full upload response:`, JSON.stringify(result, null, 2));
          return apiSuccess({
            fileId: fileId,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
          });
        } else {
          log.warn('Response OK but no id found:', result);
          return apiError(
            'INVALID_REQUEST',
            500,
            'GLM API返回了成功响应，但没有返回文件ID',
            `响应内容: ${JSON.stringify(result)}`,
          );
        }
      } else {
        // Error response
        const statusText = response.statusText;
        const responseText = await response.text();
        log.error(`GLM upload failed: ${response.status} ${statusText}`);
        log.error(`Response body: ${responseText}`);

        let errorMsg = `GLM API文件上传失败 (${response.status})`;
        try {
          const errorJson = JSON.parse(responseText);
          if (errorJson.error) {
            errorMsg = errorJson.error.message || errorJson.error || errorMsg;
          }
        } catch {
          // If not JSON, use status text
        }

        return apiError(
          'UPSTREAM_ERROR',
          response.status,
          errorMsg,
        );
      }
    } catch (err) {
      log.error('Upload request error:', err);
      return apiError(
        'INTERNAL_ERROR',
        500,
        err instanceof Error ? err.message : '文件上传请求失败',
      );
    }
  } catch (error) {
    log.error('Audio upload error:', error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? error.message : 'Failed to upload audio file',
    );
  }
}
