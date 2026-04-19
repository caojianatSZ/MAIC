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
   * 识别的Markdown文本（包含LaTeX公式）
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

  /**
   * 提取的题目列表（如果进行了结构化解析）
   */
  questions?: ParsedQuestion[];
}

/**
 * 公式信息
 */
export interface FormulaInfo {
  /**
   * LaTeX格式（用$...$包裹）
   */
  latex: string;

  /**
   * 原始文本（fallback用）
   */
  raw: string;

  /**
   * 公式位置
   */
  location: 'question' | 'answer' | 'option';

  /**
   * 置信度（0-1）
   */
  confidence: number;

  /**
   * 是否不确定（需要人工校验）
   */
  uncertain?: boolean;
}

/**
 * 解析的题目
 */
export interface ParsedQuestion {
  question_id: string;
  question: string;  // 包含 $LaTeX$ 的题目
  student_answer?: string;  // 包含 $LaTeX$ 的答案
  type: 'choice' | 'fill_blank' | 'essay';
  options?: string[];  // 包含 $LaTeX$ 的选项
  formulas: FormulaInfo[];  // 提取的所有公式
  uncertain: boolean;  // 是否需要人工复核
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
        'Authorization': apiKey,  // GLM-OCR 直接使用 API key，不需要 Bearer 前缀
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
      hasMdResults: !!data.md_results,
      hasLayoutDetails: !!data.layout_details,
      mdLength: data.md_results?.length || 0,
      usage: data.usage
    });

    // GLM-OCR API 返回格式：直接包含 md_results，不是 data.mddown
    if (!data.md_results) {
      log.error('GLM-OCR API 响应格式错误', {
        responseKeys: Object.keys(data),
        hasData: !!data.data
      });
      throw new Error('GLM-OCR API 返回格式错误：缺少 md_results 字段');
    }

    const result: GLMOCRResult = {
      markdown: data.md_results || '',
      images: data.images || [],  // 提取图片URL数组
      raw: data,
      confidence: 0.95  // GLM-OCR 在 OmniDocBench V1.5 上取得 94.6 分
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
  // 添加 data:image 前缀（如果还没有）
  const base64WithPrefix = imageBase64.includes(',')
    ? imageBase64
    : `data:image/jpeg;base64,${imageBase64}`;

  // GLM-OCR 需要带前缀的base64来识别格式
  return recognizeDocument({
    file: base64WithPrefix,
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
