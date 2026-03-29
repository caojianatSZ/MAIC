import { NextRequest } from 'next/server';
import { resolveTTSApiKey } from '@/lib/server/provider-config';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';

const log = createLogger('Debug Voice Clone');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileId } = body as { fileId: string };

    if (!fileId) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Missing fileId');
    }

    const apiKey = resolveTTSApiKey('glm-tts', undefined);
    const baseUrl = 'https://open.bigmodel.cn/api/paas/v4';

    if (!apiKey) {
      return apiError('MISSING_API_KEY', 400, 'GLM API key not configured');
    }

    const voiceName = `voice_${Date.now()}`;
    const requestId = `voice_clone_req_${Date.now()}`;

    const requestBody = {
      model: 'glm-tts-clone',
      voice_name: voiceName,
      text: '你好，这是一段示例音频的文本内容，用于音色复刻参考。',
      input: '欢迎使用我们的音色复刻服务，这将生成与示例音频相同音色的语音。',
      file_id: fileId,
      request_id: requestId,
    };

    log.info('=== Voice Clone Debug Info ===');
    log.info('API Key (first 10 chars):', apiKey.substring(0, 10) + '...');
    log.info('File ID:', fileId);
    log.info('File ID length:', fileId.length);
    log.info('Request Body:', JSON.stringify(requestBody, null, 2));

    const cloneUrl = `${baseUrl}/voice/clone`;
    log.info('Clone URL:', cloneUrl);

    const response = await fetch(cloneUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(requestBody),
    });

    log.info('Response Status:', response.status);
    log.info('Response OK:', response.ok);

    const responseText = await response.text();
    log.info('Response Body:', responseText);

    let responseJson;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      responseJson = { raw: responseText };
    }

    return apiSuccess({
      debug: true,
      request: {
        url: cloneUrl,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.substring(0, 10)}...`,
          'Content-Type': 'application/json',
        },
        body: requestBody,
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        body: responseJson,
      },
    });
  } catch (error) {
    log.error('Debug error:', error);
    return apiError('INTERNAL_ERROR', 500, error instanceof Error ? error.message : 'Unknown error');
  }
}
