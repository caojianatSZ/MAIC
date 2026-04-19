// app/api/diagnosis/photo-ocr/route.ts
/**
 * 试卷拍照批改 API V4 - 使用 GLM-OCR 专业识别
 *
 * 核心理念：让专业OCR模型做文档理解，而不是多模态对话
 *
 * 架构：
 * 图像 → GLM-OCR（专业OCR）→ Markdown → 题目解析 → 判题
 *
 * 优势：
 * - GLM-OCR是专门的OCR模型（0.9B参数）
 * - 在OmniDocBench V1.5上94.6分SOTA
 * - 价格：0.2元/百万Tokens（比GLM-4V便宜10倍）
 * - 输出保留版面结构的Markdown
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import {
  recognizeFromBase64,
  type GLMOCRResult
} from '@/lib/glm/glm-ocr-client';

const log = createLogger('PhotoOCR');

export async function GET() {
  return NextResponse.json({
    name: '试卷拍照批改 API V4 (GLM-OCR)',
    version: '4.0.0',
    description: '使用 GLM-OCR 专业OCR模型进行试卷识别',
    features: [
      '✅ GLM-OCR专业OCR（94.6分SOTA）',
      '✅ 保留版面结构的Markdown输出',
      '✅ 支持复杂表格、公式、图文混排',
      '✅ 轻量级题目解析（无需复杂Graph）',
      '✅ 高性价比（0.2元/百万Tokens）'
    ],
    advantages: [
      '专业OCR模型（非多模态对话）',
      '版面理解准确（Markdown保留结构）',
      '价格便宜（比GLM-4V便宜10倍）'
    ],
    architecture: {
      step1: 'GLM-OCR识别 → 输出Markdown',
      step2: '解析Markdown → 提取题目',
      step3: '判题（GLM文本模型或GLM-4V视觉校准）'
    },
    usage: 'POST /api/diagnosis/photo-ocr',
    parameters: {
      image: 'Base64编码的试卷图片（必需）',
      subject: '科目（可选）',
      grade: '年级（可选）'
    }
  });
}

export async function POST(request: NextRequest) {
  const requestId = `ocr_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  try {
    log.info('收到 GLM-OCR 识别请求', { requestId });

    // 解析请求参数
    const body = await request.json();
    const { image, subject = '数学', grade = '初中' } = body;

    // 验证参数
    if (!image) {
      return NextResponse.json({
        error: '缺少必需参数：image'
      }, { status: 400 });
    }

    log.info('参数验证通过', {
      requestId,
      subject,
      grade,
      imageSize: image.length
    });

    // ==================== Step 1: GLM-OCR 专业识别 ====================
    log.info('Step 1: GLM-OCR 识别', { requestId });

    const ocrResult: GLMOCRResult = await recognizeFromBase64(image, {
      return_markdown: true,
      return_images: false,
      timeout: 60000
    });

    log.info('GLM-OCR 识别完成', {
      requestId,
      markdownLength: ocrResult.markdown.length,
      preview: ocrResult.markdown.substring(0, 200)
    });

    // ==================== Step 2: 解析Markdown提取题目 ====================
    log.info('Step 2: 解析题目', { requestId });

    const questions = parseQuestionsFromMarkdown(ocrResult.markdown);

    log.info('题目解析完成', {
      requestId,
      questionCount: questions.length
    });

    // ==================== Step 3: 返回结果 ====================
    const result = {
      status: 'success',
      mode: 'glm-ocr',
      markdown: ocrResult.markdown,
      questions: questions,
      summary: {
        total_questions: questions.length,
        markdown_length: ocrResult.markdown.length
      },
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        method: 'glm-ocr',
        version: '4.0.0'
      }
    };

    log.info('GLM-OCR 流程完成', {
      requestId,
      questionCount: result.summary.total_questions
    });

    return NextResponse.json(result);

  } catch (error) {
    log.error('GLM-OCR 识别失败', {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json({
      error: '识别失败',
      message: error instanceof Error ? error.message : '未知错误',
      requestId
    }, { status: 500 });
  }
}

/**
 * 从Markdown解析题目
 * 这是一个轻量级的解析器，因为GLM-OCR已经保留了版面结构
 */
function parseQuestionsFromMarkdown(markdown: string): Array<{
  id: string;
  content: string;
  type: 'choice' | 'fill_blank' | 'essay';
  options?: string[];
}> {
  const questions: Array<{
    id: string;
    content: string;
    type: 'choice' | 'fill_blank' | 'essay';
    options?: string[];
  }> = [];

  // 简单的题目分割逻辑（可以根据实际Markdown格式优化）
  const lines = markdown.split('\n');
  let currentQuestion: any = null;
  let questionNumber = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // 检测题目编号（如：1. 2. 3. 或 (1) (2) (3)）
    const questionMatch = trimmed.match(/^(\d+|[（\(]\d+[）\)])[\.\s\、\．]/);

    if (questionMatch) {
      // 保存上一题
      if (currentQuestion) {
        questions.push(currentQuestion);
      }

      // 开始新题目
      questionNumber++;
      currentQuestion = {
        id: String(questionNumber),
        content: trimmed,
        type: 'essay' as const,
        options: []
      };
    } else if (currentQuestion) {
      // 检测选项（A. B. C. D.）
      const optionMatch = trimmed.match(/^([A-D])[\.\s\、\．](.*)/);

      if (optionMatch) {
        currentQuestion.type = 'choice' as const;
        currentQuestion.options!.push(trimmed);
      } else {
        // 添加到题目内容
        currentQuestion.content += '\n' + trimmed;
      }
    }
  }

  // 保存最后一题
  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  return questions;
}
