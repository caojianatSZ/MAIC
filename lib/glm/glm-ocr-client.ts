// lib/glm/glm-ocr-client.ts
/**
 * GLM-OCR 专业OCR模型客户端
 *
 * GLM-OCR是0.9B参数的专业OCR模型，在OmniDocBench V1.5上取得94.6分SOTA
 * 专门用于文档解析、表格识别、信息提取
 *
 * API文档：https://open.bigmodel.cn/api-reference/模型-api/文档解析
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('GLM-OCR');

export interface GLMOCRResult {
  /**
   * 识别的Markdown文本
   */
  markdown: string;

  /**
   * 识别的图片链接列表（如果有）
   */
  images?: string[];

  /**
   * 原始响应数据
   */
  raw?: any;

  /**
   * 识别置信度（如果提供）
   */
  confidence?: number;
}

/**
 * GLM-OCR 配置选项
 */
export interface GLMOCRClientOptions {
  /**
   * 图片URL（支持HTTP/HTTPS）或Base64
   */
  file: string;

  /**
   * 是否返回Markdown格式（默认true）
   */
  return_markdown?: boolean;

  /**
   * 是否返回图片链接（默认false）
   */
  return_images?: boolean;

  /**
   * 超时时间（毫秒）
   */
  timeout?: number;
}

/**
 * 调用 GLM-OCR 进行文档识别
 *
 * @param options 识别选项
 * @returns 识别结果（Markdown文本）
 */
export async function recognizeDocument(options: GLMOCRClientOptions): Promise<GLMOCRResult> {
  const {
    file,
    return_markdown = true,
    return_images = false,
    timeout = 60000
  } = options;

  const apiKey = process.env.GLM_API_KEY;

  if (!apiKey) {
    throw new Error('GLM_API_KEY not configured');
  }

  log.info('GLM-OCR 识别开始', {
    fileLength: file.length,
    isUrl: file.startsWith('http'),
    return_markdown,
    return_images
  });

  const requestBody = {
    model: 'glm-ocr',
    file: file,
    return_markdown,
    return_images
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/layout_parsing', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      const errorText = await response.text();
      log.error('GLM-OCR API 错误', {
        status: response.status,
        error: errorText
      });
      throw new Error(`GLM-OCR request failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    log.info('GLM-OCR API 响应', {
      hasData: !!data.data,
      dataKeys: data.data ? Object.keys(data.data) : []
    });

    if (!data.data) {
      throw new Error('GLM-OCR API 返回空数据');
    }

    const result: GLMOCRResult = {
      markdown: data.data.markdown || '',
      images: data.data.images,
      raw: data
    };

    log.info('GLM-OCR 识别完成', {
      markdownLength: result.markdown.length,
      hasImages: !!result.images?.length
    });

    return result;

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      log.error('GLM-OCR 请求超时', { timeout });
      throw new Error(`GLM-OCR recognition timeout (${timeout}ms)`);
    }
    throw error;
  }
}

/**
 * 从Base64图片识别文档
 */
export async function recognizeFromBase64(
  imageBase64: string,
  options?: Partial<GLMOCRClientOptions>
): Promise<GLMOCRResult> {
  // 移除 data:image 前缀（如果有）
  const base64Data = imageBase64.includes(',')
    ? imageBase64.split(',')[1]
    : imageBase64;

  // GLM-OCR 需要纯base64，不需要前缀
  return recognizeDocument({
    file: base64Data,
    ...options
  });
}

/**
 * 从图片URL识别文档
 */
export async function recognizeFromUrl(
  imageUrl: string,
  options?: Partial<GLMOCRClientOptions>
): Promise<GLMOCRResult> {
  return recognizeDocument({
    file: imageUrl,
    ...options
  });
}
