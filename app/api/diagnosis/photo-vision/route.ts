// app/api/diagnosis/photo-vision/route.ts
/**
 * 试卷拍照批改 API V3 - 使用 GLM-4V 直接版面理解
 *
 * 核心理念：让多模态模型做"版面理解"，而不是"OCR后重建"
 *
 * 架构：
 * 图像 → GLM-4V（整体理解版面）→ 结构化输出 → 轻量校验 → 判题
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import {
  recognizePaperFromImage,
  validateVisionResult,
  type VisionRecognitionResult
} from '@/lib/glm/vision-recognizer';

const log = createLogger('PhotoVision');

export async function GET() {
  return NextResponse.json({
    name: '试卷拍照批改 API V3 (GLM-4V 直接理解)',
    version: '3.0.0',
    description: '使用 GLM-4V 直接从图像理解版面并输出结构化题目',
    features: [
      '✅ GLM-4V 整体理解版面（不切碎信息）',
      '✅ 自动识别题目结构',
      '✅ 准确提取手写答案',
      '✅ 支持复杂布局（多栏、图文混排）',
      '✅ 轻量级校验（非重建）'
    ],
    advantages: [
      '信息完整性好（不切碎blocks）',
      '空间理解准确（原生视觉）',
      '手写识别准确（多模态优势）'
    ],
    usage: 'POST /api/diagnosis/photo-vision',
    parameters: {
      image: 'Base64编码的试卷图片（必需）',
      subject: '科目（可选，默认"数学"）',
      grade: '年级（可选，默认"初中"）'
    }
  });
}

export async function POST(request: NextRequest) {
  const requestId = `vision_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  try {
    log.info('收到 GLM-4V 版面理解请求', { requestId });

    // 解析请求参数
    const body = await request.json();
    const { image, subject = '数学', grade = '初中' } = body;

    // 验证参数
    if (!image) {
      return NextResponse.json({
        error: '缺少必需参数：image',
        hint: '请提供 Base64 编码的试卷图片'
      }, { status: 400 });
    }

    if (typeof image !== 'string' || image.length === 0) {
      return NextResponse.json({
        error: 'image 参数格式错误',
        hint: 'image 应该是 Base64 编码的字符串'
      }, { status: 400 });
    }

    log.info('参数验证通过', {
      requestId,
      subject,
      grade,
      imageSize: image.length
    });

    // ==================== Step 1: GLM-4V 直接理解版面 ====================
    log.info('Step 1: GLM-4V 版面理解', { requestId });

    const recognitionResult = await recognizePaperFromImage(image, {
      subject,
      grade,
      maxRetries: 2
    });

    log.info('GLM-4V 识别完成', {
      requestId,
      questionCount: recognitionResult.questions.length,
      avgConfidence: recognitionResult.questions.reduce((sum, q) => sum + q.confidence, 0) / recognitionResult.questions.length,
      layoutType: recognitionResult.metadata.layout_type
    });

    // ==================== Step 2: 轻量校验 ====================
    log.info('Step 2: 校验识别结果', { requestId });

    const validation = validateVisionResult(recognitionResult);

    if (!validation.isValid) {
      log.warn('识别结果校验失败', {
        requestId,
        errors: validation.errors
      });

      return NextResponse.json({
        error: '识别结果校验失败',
        errors: validation.errors,
        warnings: validation.warnings
      }, { status: 422 });
    }

    if (validation.warnings.length > 0) {
      log.warn('识别结果有警告', {
        requestId,
        warnings: validation.warnings
      });
    }

    // ==================== Step 3: 格式化输出 ====================
    const formattedQuestions = recognitionResult.questions.map(q => ({
      id: q.id,
      content: q.content,
      type: q.type,
      options: q.options,
      student_answer: q.student_answer || undefined,
      confidence: q.confidence,
      needs_review: q.confidence < 0.8
    }));

    const result = {
      status: 'success',
      mode: 'vision',
      questions: formattedQuestions,
      summary: {
        total_questions: recognitionResult.questions.length,
        answered_questions: recognitionResult.questions.filter(q => q.student_answer).length,
        avg_confidence: recognitionResult.questions.reduce((sum, q) => sum + q.confidence, 0) / recognitionResult.questions.length,
        layout_type: recognitionResult.metadata.layout_type,
        has_handwriting: recognitionResult.metadata.has_handwriting
      },
      warnings: validation.warnings,
      ocr_validation: {
        is_valid: validation.isValid,
        confidence: recognitionResult.ocr_confidence,
        warnings: validation.warnings,
        errors: validation.errors
      },
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        method: 'glm-4v-direct',
        version: '3.0.0'
      }
    };

    log.info('GLM-4V 版面理解完成', {
      requestId,
      questionCount: result.summary.total_questions,
      avgConfidence: result.summary.avg_confidence
    });

    return NextResponse.json(result);

  } catch (error) {
    log.error('GLM-4V 版面理解失败', {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json({
      error: '版面理解失败',
      message: error instanceof Error ? error.message : '未知错误',
      requestId
    }, { status: 500 });
  }
}
