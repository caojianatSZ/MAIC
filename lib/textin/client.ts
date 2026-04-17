// lib/textin/client.ts

import { createLogger } from '@/lib/logger';
import type { TextinResult, ValidationResult, ValidationError, ValidationWarning } from './types';

const log = createLogger('TextInClient');

// 正确的 TextIn API 端点
const TEXTIN_API_URL = 'https://api.textin.com/ai/service/v1/pdf_to_markdown';

export interface TextinClientOptions {
  appId?: string;
  secretCode?: string;
}

export class TextinClient {
  private appId: string;
  private secretCode: string;

  constructor(options: TextinClientOptions = {}) {
    this.appId = options.appId || process.env.TEXTIN_APP_ID || '';
    this.secretCode = options.secretCode || process.env.TEXTIN_SECRET_CODE || '';

    if (!this.appId || !this.secretCode) {
      throw new Error('TextIn credentials not configured');
    }
  }

  /**
   * 识别试卷内容，返回 markdown 格式
   * 使用 TextIn pdf_to_markdown API
   */
  async recognizePaper(imageBase64: string): Promise<TextinResult> {
    try {
      log.info('TextIn OCR 识别开始');

      // 将 base64 转换为 Buffer
      const base64Data = imageBase64.includes(',')
        ? imageBase64.split(',')[1]
        : imageBase64;
      const imageBuffer = Buffer.from(base64Data, 'base64');

      // 构建请求参数
      const params = new URLSearchParams({
        dpi: '144',
        get_image: 'none',
        markdown_details: '1',
        parse_mode: 'scan',
        table_flavor: 'html',
        apply_document_tree: '1',
        formula_level: '0'
      });

      // 发送请求
      const response = await fetch(`${TEXTIN_API_URL}?${params.toString()}`, {
        method: 'POST',
        headers: {
          'x-ti-app-id': this.appId,
          'x-ti-secret-code': this.secretCode,
          'Content-Type': 'application/octet-stream'
        },
        body: imageBuffer
      });

      if (!response.ok) {
        const errorText = await response.text();
        log.error('TextIn HTTP 错误', { status: response.status, error: errorText });
        throw new Error(`TextIn request failed: ${response.status}`);
      }

      const result = await response.json() as {
        code: number;
        message: string;
        result?: {
          markdown: string;
          pages?: Array<{
            page_id: number;
            content: Array<{
              text: string;
              score: number;
              type: string;
            }>;
          }>;
        };
        x_request_id?: string;
      };

      if (result.code !== 200) {
        log.error('TextIn 业务错误', { code: result.code, message: result.message });
        throw new Error(`TextIn error: ${result.message}`);
      }

      if (!result.result || !result.result.markdown) {
        throw new Error('TextIn 返回结果为空');
      }

      // 计算平均置信度
      let confidence: number | undefined;
      if (result.result.pages) {
        const scores: number[] = [];
        result.result.pages.forEach(page => {
          page.content.forEach(item => {
            if (item.score !== undefined) {
              scores.push(item.score);
            }
          });
        });
        if (scores.length > 0) {
          confidence = scores.reduce((a, b) => a + b, 0) / scores.length;
        }
      }

      log.info('TextIn OCR 识别成功', {
        markdownLength: result.result.markdown.length,
        confidence,
        pagesCount: result.result.pages?.length
      });

      return {
        markdown: result.result.markdown,
        confidence
      };

    } catch (error) {
      log.error('TextIn OCR 识别失败', error);
      throw error;
    }
  }

  /**
   * 后处理校验
   */
  validateResult(result: TextinResult): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const markdown = result.markdown || '';

    // 1. 检查内容长度
    if (markdown.length < 50) {
      errors.push({
        type: 'content_too_short',
        message: '识别内容过短，可能识别失败',
        severity: 'error'
      });
    }

    // 2. 检查整体置信度
    if (result.confidence !== undefined && result.confidence < 0.7) {
      warnings.push({
        type: 'low_confidence',
        message: `整体识别置信度较低: ${(result.confidence * 100).toFixed(1)}%`
      });
    }

    // 3. 检查是否有题目编号
    const hasQuestionNumber = /^\s*\d+[\.\、]|^\s*\([1-9]\)|^\s*[一二三四五六七八九十]+[\.\、]/m.test(markdown);
    if (!hasQuestionNumber && markdown.length > 100) {
      warnings.push({
        type: 'no_question_number',
        message: '未检测到明显的题目编号，可能识别不完整'
      });
    }

    const isValid = errors.filter(e => e.severity === 'error').length === 0;

    if (!isValid) {
      log.warn('TextIn 结果校验失败', { errors, warnings });
    } else if (warnings.length > 0) {
      log.info('TextIn 结果校验通过，但有警告', { warnings });
    }

    return {
      isValid,
      errors,
      warnings
    };
  }
}

// 单例导出
let textinClientInstance: TextinClient | null = null;

export function getTextinClient(): TextinClient {
  if (!textinClientInstance) {
    textinClientInstance = new TextinClient();
  }
  return textinClientInstance;
}
