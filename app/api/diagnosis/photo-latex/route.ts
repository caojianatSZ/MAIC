// app/api/diagnosis/photo-latex/route.ts
/**
 * 试卷拍照批改 API V5 - LaTeX公式支持
 *
 * 核心理念：LaTeX不是为了"好看"，而是为了"可计算、可验证、可判题"
 *
 * 架构：
 * 图像 → GLM-4V（专业Prompt）→ LaTeX结构化输出 → 语法校验 → 判题
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import {
  recognizePaperWithLatex,
  type LatexRecognitionResult
} from '@/lib/glm/latex-recognizer';

const log = createLogger('PhotoLatex');

export async function GET() {
  return NextResponse.json({
    name: '试卷拍照批改 API V5 (LaTeX支持)',
    version: '5.0.0',
    description: '使用GLM-4V识别试卷并输出LaTeX公式，支持可计算、可验证的判题',
    features: [
      '✅ 所有公式用$...$包裹（强约束）',
      '✅ LaTeX语法校验（避免"看起来对，其实错"）',
      '✅ 结构化formulas字段（可计算）',
      '✅ 置信度标记（支持fallback）',
      '✅ 不确定标记（人工复核）'
    ],
    advantages: [
      'LaTeX可计算（用于符号计算）',
      'LaTeX可验证（语法校验）',
      'LaTeX可判题（不依赖字符串比较）'
    ],
    output_format: {
      question: "解方程 $x^2 + 2x = 3$",
      formulas: [
        {
          latex: "x^2 + 2x = 3",
          raw: "原始文本",
          location: "question",
          confidence: 0.95,
          uncertain: false
        }
      ]
    },
    usage: 'POST /api/diagnosis/photo-latex',
    parameters: {
      image: 'Base64编码的试卷图片（必需）',
      subject: '科目（可选，默认"数学"）',
      grade: '年级（可选，默认"初中"）'
    }
  });
}

export async function POST(request: NextRequest) {
  const requestId = `latex_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  try {
    log.info('收到 LaTeX 识别请求', { requestId });

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

    // ==================== Step 1: GLM-4V LaTeX识别 ====================
    log.info('Step 1: GLM-4V LaTeX 识别', { requestId });

    const recognitionResult: LatexRecognitionResult = await recognizePaperWithLatex(image, {
      subject,
      grade,
      maxRetries: 2
    });

    log.info('GLM-4V LaTeX 识别完成', {
      requestId,
      questionCount: recognitionResult.questions.length,
      totalFormulas: recognitionResult.metadata.total_formulas,
      avgConfidence: recognitionResult.metadata.avg_confidence
    });

    // ==================== Step 2: 统计不确定的题目 ====================
    const uncertainQuestions = recognitionResult.questions.filter(q => q.uncertain);
    const needsReview = uncertainQuestions.length > 0;

    if (needsReview) {
      log.warn('发现不确定的题目', {
        requestId,
        uncertainCount: uncertainQuestions.length,
        uncertainIds: uncertainQuestions.map(q => q.question_id)
      });
    }

    // ==================== Step 3: 格式化输出 ====================
    const result = {
      status: 'success',
      mode: 'latex',
      questions: recognitionResult.questions.map(q => ({
        id: q.question_id,
        content: q.question,
        student_answer: q.student_answer,
        type: q.type,
        options: q.options,
        formulas: q.formulas,
        uncertain: q.uncertain,
        needs_review: q.uncertain
      })),
      summary: {
        total_questions: recognitionResult.questions.length,
        answered_questions: recognitionResult.questions.filter(q => q.student_answer).length,
        uncertain_questions: uncertainQuestions.length,
        needs_review: needsReview,
        total_formulas: recognitionResult.metadata.total_formulas,
        avg_confidence: recognitionResult.metadata.avg_confidence,
        layout_type: recognitionResult.metadata.layout_type
      },
      warnings: recognitionResult.warnings,
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        method: 'glm-4v-latex',
        version: '5.0.0'
      }
    };

    log.info('LaTeX 识别流程完成', {
      requestId,
      questionCount: result.summary.total_questions,
      needsReview
    });

    return NextResponse.json(result);

  } catch (error) {
    log.error('LaTeX 识别失败', {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });

    return NextResponse.json({
      error: 'LaTeX识别失败',
      message: error instanceof Error ? error.message : '未知错误',
      requestId
    }, { status: 500 });
  }
}
