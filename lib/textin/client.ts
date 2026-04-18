// lib/textin/client.ts

import { createLogger } from '@/lib/logger';
import type { TextinResult, ValidationResult, ValidationError, ValidationWarning, StructuredData } from './types';

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

      // 先获取原始响应文本进行调试
      const responseText = await response.text();
      log.info('TextIn API 原始响应', {
        status: response.status,
        responseLength: responseText.length,
        responsePreview: responseText.substring(0, 500)
      });

      let result: {
        code: number;
        message: string;
        result?: {
          markdown: string;
          pages?: Array<{
            page_id: number;
            structured?: StructuredData[];
            content?: Array<{
              text: string;
              score: number;
              type: string;
            }>;
          }>;
        };
        x_request_id?: string;
      };

      try {
        result = JSON.parse(responseText) as typeof result;
      } catch (parseError) {
        log.error('TextIn JSON 解析失败', {
          error: parseError instanceof Error ? parseError.message : String(parseError),
          responseText: responseText.substring(0, 1000)
        });
        throw new Error(`TextIn API 返回无效的 JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

      if (result.code !== 200) {
        log.error('TextIn 业务错误', { code: result.code, message: result.message });
        throw new Error(`TextIn error: ${result.message}`);
      }

      if (!result.result || !result.result.markdown) {
        throw new Error('TextIn 返回结果为空');
      }

      // 计算平均置信度并提取结构化数据
      let confidence: number | undefined;
      let structuredData: StructuredData[] | undefined;

      if (result.result.pages) {
        // 计算置信度（使用 content 字段）
        const scores: number[] = [];
        result.result.pages.forEach(page => {
          page.content?.forEach(item => {
            if (item.score !== undefined) {
              scores.push(item.score);
            }
          });
        });
        if (scores.length > 0) {
          confidence = scores.reduce((a, b) => a + b, 0) / scores.length;
        }

        // 提取结构化数据
        if (result.result.pages[0]?.structured) {
          structuredData = result.result.pages[0].structured;
          log.info('TextIn 结构化数据', { itemsCount: structuredData.length });
        }
      }

      log.info('TextIn OCR 识别成功', {
        markdownLength: result.result.markdown.length,
        confidence,
        pagesCount: result.result.pages?.length,
        hasStructuredData: !!structuredData
      });

      return {
        markdown: result.result.markdown,
        confidence,
        structuredData
      };

    } catch (error) {
      log.error('TextIn OCR 识别失败', error);
      throw error;
    }
  }

  /**
   * 从结构化数据中提取题目（优化版）
   * 针对物理试卷格式优化
   */
  extractQuestionsFromStructured(structuredData: StructuredData[]): Array<{
    id: string;
    content: string;
    type: 'choice' | 'fill_blank' | 'essay';
    options?: string[];
  }> {
    if (!structuredData || structuredData.length === 0) {
      return [];
    }

    log.info('TextIn 结构化数据详情', {
      totalItems: structuredData.length,
      items: structuredData.slice(0, 30).map(item => ({
        type: item.type,
        subType: item.sub_type,
        outlineLevel: item.outline_level,
        textPreview: this.extractTextFromContent(item)?.substring(0, 50)
      }))
    });

    // 第一步：过滤和分类内容
    const items = structuredData
      .map(item => ({ item, text: this.extractTextFromContent(item)?.trim() }))
      .filter(({ text }) => text && text.length > 0);

    // 第二步：识别题目边界
    const questions: Array<{
      id: string;
      content: string;
      type: 'choice' | 'fill_blank' | 'essay';
      options?: string[];
    }> = [];

    let currentQuestion: {
      lines: string[];
      options: string[];
      hasOptionStart: boolean;
    } | null = null;
    let questionNum = 0;

    for (const { item, text } of items) {
      // 跳过标题
      if (item.type === 'text_title' || item.outline_level <= 1) {
        log.info('跳过标题', { text, level: item.outline_level });
        // 如果有当前题目，先保存
        if (currentQuestion && currentQuestion.lines.length > 0) {
          this.saveQuestion(questions, currentQuestion, questionNum++);
        }
        currentQuestion = null;
        continue;
      }

      // 检测题目开始的模式
      const isNewQuestion = this.isQuestionStart(text);

      // 检测选项
      const isOption = /^([A-D])[.、)\]]\s*/.test(text);

      if (isNewQuestion && currentQuestion && currentQuestion.lines.length > 2) {
        // 保存上一题
        this.saveQuestion(questions, currentQuestion, questionNum++);
        currentQuestion = { lines: [text], options: [], hasOptionStart: false };
      } else if (isOption && currentQuestion) {
        currentQuestion.options.push(text);
        currentQuestion.hasOptionStart = true;
        currentQuestion.lines.push(text);
      } else if (currentQuestion || text.length > 5) {
        // 添加到当前题目或开始新题目
        if (!currentQuestion) {
          currentQuestion = { lines: [text], options: [], hasOptionStart: false };
        } else {
          currentQuestion.lines.push(text);
        }
      }
    }

    // 保存最后一题
    if (currentQuestion && currentQuestion.lines.length > 0) {
      this.saveQuestion(questions, currentQuestion, questionNum);
    }

    log.info('结构化数据提取完成', {
      count: questions.length,
      questions: questions.map(q => ({ id: q.id, contentPreview: q.content.substring(0, 40) }))
    });

    return questions;
  }

  /**
   * 判断是否是题目开始
   */
  private isQuestionStart(text: string): boolean {
    // 数字编号开头
    if (/^\d+[.、．]\s*/.test(text)) {
      return true;
    }
    // 年份开头（但选项除外）
    if (/^\(\d{4}[^A-D]/.test(text)) {
      return true;
    }
    return false;
  }

  /**
   * 保存题目
   */
  private saveQuestion(
    questions: Array<{
      id: string;
      content: string;
      type: 'choice' | 'fill_blank' | 'essay';
      options?: string[];
    }>,
    currentQuestion: { lines: string[]; options: string[]; hasOptionStart: boolean },
    num: number
  ): void {
    const content = currentQuestion.lines.join('\n');
    const numText = currentQuestion.lines[0]?.match(/^(\d+)/)?.[1];
    const questionNum = numText ? parseInt(numText, 10) : (num + 1);

    questions.push({
      id: String(questionNum),
      content: content,
      type: this.detectQuestionType(content, currentQuestion.options),
      options: currentQuestion.options.length > 0 ? [...currentQuestion.options] : undefined
    });

    log.info('保存题目', {
      id: questionNum,
      contentLength: content.length,
      linesCount: currentQuestion.lines.length,
      optionsCount: currentQuestion.options.length
    });
  }

  /**
   * 从结构化数据中提取题目
   * 利用 TextIn 的 outline_level 和 type 信息
   */
  extractQuestionsFromStructured_OLD(structuredData: StructuredData[]): Array<{
    id: string;
    content: string;
    type: 'choice' | 'fill_blank' | 'essay';
    options?: string[];
  }> {
    if (!structuredData || structuredData.length === 0) {
      return [];
    }

    // 详细日志：记录所有结构化数据
    log.info('TextIn 结构化数据详情', {
      totalItems: structuredData.length,
      items: structuredData.slice(0, 20).map(item => ({
        type: item.type,
        subType: item.sub_type,
        outlineLevel: item.outline_level,
        textPreview: this.extractTextFromContent(item)?.substring(0, 50)
      }))
    });

    const questions: Array<{
      id: string;
      content: string;
      type: 'choice' | 'fill_blank' | 'essay';
      options?: string[];
    }> = [];

    // 分析结构：找出标题和题目
    let currentSectionTitle = '';
    let currentQuestion: string[] = [];
    let questionNum = 0;
    let currentOptions: string[] = [];

    for (const item of structuredData) {
      const text = this.extractTextFromContent(item);
      if (!text || text.trim().length === 0) continue;

      // 检测标题（outline_level=0 或 1，type=text_title）
      if (item.type === 'text_title' || item.outline_level <= 1) {
        currentSectionTitle = text;
        log.info('检测到标题', { title: text, level: item.outline_level });
        continue;
      }

      // 检测题目编号
      const numMatch = text.match(/^(\d+)[.、．]\s*/);
      const yearMatch = text.match(/^\((\d{4})/);

      // 检测选项
      const optionMatch = text.match(/^[A-D][.、)\]]\s*(.+)/);

      // 新题目开始
      if (numMatch || (yearMatch && currentQuestion.length > 5)) {
        // 保存上一题
        if (currentQuestion.length > 0) {
          const content = currentQuestion.join('\n');
          questions.push({
            id: String(questionNum || questions.length + 1),
            content: content,
            type: this.detectQuestionType(content, currentOptions),
            options: currentOptions.length > 0 ? [...currentOptions] : undefined
          });
          log.info('保存题目', { id: questionNum, contentLength: content.length, optionsCount: currentOptions.length });
        }

        questionNum = numMatch ? parseInt(numMatch[1], 10) : questions.length + 1;
        currentQuestion = [text];
        currentOptions = [];
      } else if (optionMatch) {
        currentOptions.push(optionMatch[1] || text);
        currentQuestion.push(text);
      } else if (currentQuestion.length > 0 || text.length > 3) {
        currentQuestion.push(text);
      }
    }

    // 保存最后一题
    if (currentQuestion.length > 0) {
      const content = currentQuestion.join('\n');
      questions.push({
        id: String(questionNum || questions.length + 1),
        content: content,
        type: this.detectQuestionType(content, currentOptions),
        options: currentOptions.length > 0 ? [...currentOptions] : undefined
      });
      log.info('保存最后一题', { id: questionNum, contentLength: content.length });
    }

    log.info('从结构化数据提取题目完成', {
      count: questions.length,
      questions: questions.map(q => ({ id: q.id, contentPreview: q.content.substring(0, 30) }))
    });
    return questions;
  }

  /**
   * 从 content 字段中提取文本
   */
  private extractTextFromContent(item: StructuredData): string {
    if (typeof item.content === 'string') {
      return item.content;
    }
    if (Array.isArray(item.content)) {
      return item.content.map(c => typeof c === 'string' ? c : '').join('');
    }
    if (typeof item.content === 'object' && item.content !== null) {
      return JSON.stringify(item.content);
    }
    return '';
  }

  /**
   * 检测题目类型
   */
  private detectQuestionType(content: string, options: string[]): 'choice' | 'fill_blank' | 'essay' {
    // 有选项则是选择题
    if (options && options.length > 0) {
      return 'choice';
    }

    // 检测填空题
    if (/___|____|（）|【】/.test(content)) {
      return 'fill_blank';
    }

    // 默认为解答题
    return 'essay';
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
