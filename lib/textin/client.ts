// lib/textin/client.ts

import { createLogger } from '@/lib/logger';
import type { TextinResult, ValidationResult, ValidationError, ValidationWarning } from './types';

const log = createLogger('TextInClient');

const TEXTIN_API_URL = 'https://api.textin.com/xparse/v3/paper';

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
   * 识别试卷内容（返回完整结果，含 confidence）
   */
  async recognizePaper(imageBase64: string): Promise<TextinResult> {
    try {
      log.info('TextIn OCR 识别开始');

      const base64Data = imageBase64.includes(',')
        ? imageBase64.split(',')[1]
        : imageBase64;

      const response = await fetch(TEXTIN_API_URL, {
        method: 'POST',
        headers: {
          'x-ti-app-id': this.appId,
          'x-ti-secret-code': this.secretCode,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image_base64: base64Data,
          // 请求返回详细信息和置信度
          return_text_blocks: true,
          return_formula_blocks: true,
          return_confidence: true
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        log.error('TextIn HTTP 错误', { status: response.status, error: errorText });
        throw new Error(`TextIn request failed: ${response.status}`);
      }

      const result = await response.json() as {
        code: number;
        message: string;
        result?: TextinResult;
      };

      if (result.code !== 200) {
        log.error('TextIn 业务错误', { code: result.code, message: result.message });
        throw new Error(`TextIn error: ${result.message}`);
      }

      if (!result.result) {
        throw new Error('TextIn 返回结果为空');
      }

      // 如果 TextIn 没有返回 confidence，根据 text_blocks 计算平均置信度
      if (!result.result.confidence && result.result.text_blocks) {
        const confidences = result.result.text_blocks
          .map(b => b.confidence)
          .filter((c): c is number => c !== undefined);
        if (confidences.length > 0) {
          result.result.confidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
        }
      }

      log.info('TextIn OCR 识别成功', {
        markdownLength: result.result.markdown.length,
        confidence: result.result.confidence,
        textBlocksCount: result.result.text_blocks?.length
      });

      return result.result;

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

    if (!result.text_blocks) {
      return {
        isValid: false,
        errors: [{ type: 'abnormal_text_length', message: '未识别到文本块', severity: 'error' }],
        warnings: []
      };
    }

    // 1. 检查整体置信度
    if (result.confidence !== undefined && result.confidence < 0.7) {
      warnings.push({
        type: 'low_confidence',
        message: `整体识别置信度较低: ${(result.confidence * 100).toFixed(1)}%`
      });
    }

    // 2. 检查低置信度文本块
    result.text_blocks.forEach((block, index) => {
      if (block.confidence !== undefined && block.confidence < 0.6) {
        warnings.push({
          type: 'low_confidence',
          blockIndex: index,
          confidence: block.confidence,
          message: `文本块 ${index} 置信度较低: ${(block.confidence * 100).toFixed(1)}%`
        });
      }
    });

    // 3. 检查题号连续性
    const questionBlocks = result.text_blocks.filter(b => b.type === 'question_number');
    const questionNumbers = questionBlocks
      .map(b => b.question_number)
      .filter((n): n is string => n !== undefined);

    if (questionNumbers.length > 1) {
      const gaps = this.detectGapsInSequence(questionNumbers);
      if (gaps.length > 0) {
        errors.push({
          type: 'gap_in_sequence',
          message: `题号不连续，可能遗漏题目: ${gaps.join(', ')}`,
          severity: 'error'
        });
      }
    }

    // 4. 检查答案区域是否为空
    const answerBlocks = result.text_blocks.filter(b => b.type === 'answer');
    const emptyAnswers = answerBlocks.filter(b => !b.text || b.text.trim().length === 0);
    if (emptyAnswers.length > 0) {
      errors.push({
        type: 'empty_answer_area',
        message: `${emptyAnswers.length} 个答案区域为空`,
        severity: 'error'
      });
    }

    // 5. 检查文本长度异常
    result.text_blocks.forEach((block, index) => {
      const text = block.text || '';
      if (text.length > 500) {
        errors.push({
          type: 'abnormal_text_length',
          blockIndex: index,
          message: `文本块 ${index} 长度异常 (${text.length} 字符)，可能识别错误`,
          severity: 'error'
        });
      }
      if (text.length < 3 && block.type === 'question') {
        warnings.push({
          type: 'abnormal_text_length',
          blockIndex: index,
          message: `题目文本过短，可能识别不完整`
        });
      }
    });

    const isValid = errors.filter(e => e.severity === 'error').length === 0;

    if (!isValid) {
      log.warn('TextIn 结果校验失败', { errors, warnings });
    } else if (warnings.length > 0) {
      log.info('TextIn 结果校验通过，但有警告', { warnings });
    }

    return {
      isValid,
      errors,
      warnings,
      filteredBlocks: isValid ? result.text_blocks : undefined
    };
  }

  /**
   * 检测题号序列中的缺口
   */
  private detectGapsInSequence(numbers: string[]): string[] {
    const gaps: string[] = [];
    const numericNumbers = numbers
      .map(n => parseInt(n.replace(/\D/g, ''), 10))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b);

    for (let i = 1; i < numericNumbers.length; i++) {
      const prev = numericNumbers[i - 1];
      const curr = numericNumbers[i];
      if (curr - prev > 1) {
        for (let n = prev + 1; n < curr; n++) {
          gaps.push(n.toString());
        }
      }
    }

    return gaps;
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
