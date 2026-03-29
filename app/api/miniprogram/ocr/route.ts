/**
 * 微信小程序图片识别API
 *
 * 功能：
 * - 接收图片URL或Base64
 * - 调用OCR服务识别文字
 * - 返回识别结果
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';

const log = createLogger('OCR API');

export const maxDuration = 30; // 30秒超时

/**
 * POST /api/miniprogram/ocr
 *
 * 请求体：
 * {
 *   "imageUrl": string,  // 图片URL（云存储地址）
 *   "imageBase64": string,  // 图片Base64（可选，替代URL）
 * }
 *
 * 响应：
 * {
 *   "success": true,
 *   "data": {
 *     "text": string,  // 识别的文字
 *     "confidence": number,  // 置信度
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 解析请求体
    const body = await request.json();
    const { imageUrl, imageBase64 } = body;

    // 验证参数
    if (!imageUrl && !imageBase64) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_IMAGE',
            message: '请提供图片URL或Base64'
          }
        },
        { status: 400 }
      );
    }

    // 2. 调用OCR服务识别文字
    let ocrResult: { text: string; confidence?: number };

    if (process.env.OCR_PROVIDER === 'mineru' && process.env.PDF_MINERU_BASE_URL) {
      // 使用MinerU OCR服务
      ocrResult = await recognizeWithMinerU(imageUrl || imageBase64);
    } else {
      // 使用Google Cloud Vision API（备用方案）
      if (!process.env.GOOGLE_CLOUD_VISION_API_KEY) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'OCR_SERVICE_NOT_CONFIGURED',
              message: 'OCR服务未配置，请设置PDF_MINERU_BASE_URL或GOOGLE_CLOUD_VISION_API_KEY'
            }
          },
          { status: 500 }
        );
      }
      ocrResult = await recognizeWithGoogleVision(imageUrl || imageBase64);
    }

    log.info('OCR识别成功', { textLength: ocrResult.text.length });

    // 3. 返回识别结果
    return NextResponse.json({
      success: true,
      data: {
        text: ocrResult.text,
        confidence: ocrResult.confidence || 0.9,
      },
    });
  } catch (error) {
    log.error('OCR识别失败', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'OCR识别失败，请稍后重试'
        }
      },
      { status: 500 }
    );
  }
}

/**
 * 使用MinerU OCR服务识别图片
 */
async function recognizeWithMinerU(imageSource: string): Promise<{ text: string }> {
  const baseUrl = process.env.PDF_MINERU_BASE_URL || 'http://localhost:8888';

  try {
    // 如果是Base64，先上传或转换
    let imageUrl = imageSource;

    if (imageSource.startsWith('data:image')) {
      // Base64图片，需要先保存到临时存储或直接发送
      // 这里假设MinerU支持直接接收Base64
      imageUrl = imageSource;
    }

    // 调用MinerU OCR API
    const response = await fetch(`${baseUrl}/ocr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: imageUrl,
        language: 'chinese', // 中文识别
      }),
    });

    if (!response.ok) {
      throw new Error(`MinerU OCR API error: ${response.status}`);
    }

    const result = await response.json();

    return {
      text: result.text || '',
    };
  } catch (error) {
    log.error('MinerU OCR failed', error);
    throw new Error('MinerU OCR服务调用失败');
  }
}

/**
 * 使用Google Cloud Vision API识别图片
 */
async function recognizeWithGoogleVision(imageSource: string): Promise<{ text: string; confidence: number }> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  const baseUrl = 'https://vision.googleapis.com/v1/images:annotate';

  try {
    // 准备请求数据
    let imageContent: { content?: string; source?: { imageUri: string } };

    if (imageSource.startsWith('data:image')) {
      // Base64图片
      const base64Data = imageSource.split(',')[1];
      imageContent = { content: base64Data };
    } else if (imageSource.startsWith('http')) {
      // 图片URL
      imageContent = { source: { imageUri: imageSource } };
    } else {
      throw new Error('无效的图片格式');
    }

    // 调用Google Cloud Vision API
    const response = await fetch(`${baseUrl}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            image: imageContent,
            features: [
              {
                type: 'TEXT_DETECTION',
                maxResults: 1,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Google Vision API error: ${response.status}`);
    }

    const result = await response.json();
    const annotations = result.responses[0].textAnnotations;

    if (!annotations || annotations.length === 0) {
      return { text: '', confidence: 0 };
    }

    // 第一个annotation是完整文本，后面的是单个字/词
    const fullText = annotations[0].description || '';

    return {
      text: fullText,
      confidence: 0.95, // Google Vision API不返回单个置信度，使用默认值
    };
  } catch (error) {
    log.error('Google Vision OCR failed', error);
    throw new Error('Google Vision OCR服务调用失败');
  }
}

// 支持 OPTIONS 请求（预检）
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
