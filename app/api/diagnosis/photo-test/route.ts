// app/api/diagnosis/photo-test/route.ts
/**
 * 简化的GLM-4V测试端点
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';

const log = createLogger('PhotoTest');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image } = body;

    if (!image) {
      return NextResponse.json({ error: '缺少image参数' }, { status: 400 });
    }

    log.info('测试GLM-4V API', { imageSize: image.length });

    // 移除 data:image 前缀
    const glmImageUrl = image.includes(',') ? image.split(',')[1] : image;

    const requestBody = {
      model: 'glm-4v-plus-0111',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: glmImageUrl }
          },
          {
            type: 'text',
            text: '请描述这张图片的内容。'
          }
        ]
      }],
      temperature: 0.1,
      max_tokens: 1000
    };

    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GLM_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();

    log.info('GLM-4V 响应', {
      hasChoices: !!result.choices,
      hasContent: !!result.choices?.[0]?.message?.content,
      preview: result.choices?.[0]?.message?.content?.substring(0, 200)
    });

    return NextResponse.json({
      success: true,
      content: result.choices?.[0]?.message?.content,
      full: result
    });

  } catch (error) {
    log.error('测试失败', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({
      error: '测试失败',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
