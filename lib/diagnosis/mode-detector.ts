// lib/diagnosis/mode-detector.ts

import { createLogger } from '@/lib/logger';

const log = createLogger('ModeDetector');

export type CorrectionMode = 'single' | 'batch';

/**
 * 检测图片是单题还是整卷
 * 使用 GLM-4V-Flash 快速判断
 */
export async function detectMode(imageBase64: string): Promise<CorrectionMode> {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    return 'batch';
  }

  try {
    log.info('开始模式检测');

    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'glm-4v-flash',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageBase64 }
            },
            {
              type: 'text',
              text: '这张图片是单道题目还是整张试卷/多道题目？只回答：single 或 batch'
            }
          ]
        }],
        temperature: 0.1,
        max_tokens: 10
      })
    });

    if (!response.ok) {
      log.warn('模式检测失败，使用默认值');
      return 'batch';
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content?.toLowerCase().trim();

    if (content?.includes('single')) {
      log.info('检测为单题模式');
      return 'single';
    }

    log.info('检测为整卷模式');
    return 'batch';

  } catch (error) {
    log.warn('模式检测异常，使用默认值 batch', error);
    return 'batch';
  }
}
