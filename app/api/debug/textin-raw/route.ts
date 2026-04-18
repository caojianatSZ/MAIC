import { NextRequest, NextResponse } from 'next/server';
import { getTextinClient } from '@/lib/textin/client';

/**
 * 调试 API：显示 TextIn 原始输出
 * 用于分析和理解 TextIn 的结构化数据格式
 */
export async function POST(request: NextRequest) {
  try {
    const { imageBase64 } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ error: '请提供 imageBase64' }, { status: 400 });
    }

    const textinClient = getTextinClient();
    const result = await textinClient.recognizePaper(imageBase64);

    // 返回完整的原始结果供分析
    return NextResponse.json({
      markdown: result.markdown,
      markdownLength: result.markdown.length,
      confidence: result.confidence,
      structuredDataCount: result.structuredData?.length || 0,
      structuredDataSample: result.structuredData?.slice(0, 20) || [],
      structuredDataFull: result.structuredData || []
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'TextIn 原始输出调试 API',
    method: 'POST',
    usage: {
      endpoint: '/api/debug/textin-raw',
      body: {
        imageBase64: 'base64 encoded image'
      }
    }
  });
}
