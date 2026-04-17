// app/api/diagnosis/photo-v2/route.ts

/**
 * 拍照诊断 V2 API - 完整版
 *
 * 功能：完整的拍照批改流程，包含所有校验层
 *
 * 流程：
 * 1. 图片预处理（Sharp 压缩和格式转换）
 * 2. 模式检测（auto/single/batch）
 * 3. TextIn OCR 识别 + 后处理校验
 * 4. 提取题目结构
 * 5. 分层批改（根据 OCR 置信度选择模型）
 *    - 高置信度（≥0.8）：GLM-5/GLM-4.7 文本模型
 *    - 低置信度（<0.8）：GLM-4V-Plus-0111 视觉模型
 * 6. 防幻觉校验
 * 7. 知识点匹配
 * 8. 生成总结
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import sharp from 'sharp';
import type {
  PhotoDiagnosisV2Request,
  PhotoDiagnosisV2Response,
  QuestionJudgment,
  OcrValidation
} from './schema';
import { getTextinClient } from '@/lib/textin/client';
import { judgeHandwrittenAnswers } from '@/lib/glm/judge';
import type { QuestionForJudgment } from '@/lib/glm/types';
import { detectMode, type CorrectionMode } from '@/lib/diagnosis/mode-detector';
import { validateJudgmentResult, calculateReviewNeed } from '@/lib/validation/anti-hallucination';
import { edukgAdapter } from '@/lib/edukg/adapter';
import { PrismaClient } from '@prisma/client';
import { saveWrongQuestion } from '@/lib/wrong-questions/service';
import { createTask, updateProgress, completeTask, failTask, getProgress } from '@/lib/diagnosis/progress';

const log = createLogger('PhotoV2');

// 使用全局变量避免在开发环境中创建多个 Prisma Client 实例
const globalForPrisma = global as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// API 超时时间（秒）
export const maxDuration = 60;

// 置信度阈值
const CONFIDENCE_THRESHOLD_HIGH = parseFloat(process.env.CORRECTION_CONFIDENCE_THRESHOLD_HIGH || '0.8');

/**
 * GET 请求 - API 说明或查询任务状态
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');

  // 查询任务状态
  if (taskId) {
    const progress = getProgress(taskId);
    if (!progress) {
      return NextResponse.json({ error: '任务不存在或已过期' }, { status: 404 });
    }
    return NextResponse.json(progress);
  }

  // API 说明
  return NextResponse.json({
    message: '拍照诊断 V2 API',
    version: '2.1',
    method: 'POST',
    features: [
      '图片预处理（Sharp 压缩）',
      '模式自动检测（单题/整卷）',
      'TextIn 专业 OCR 识别',
      'OCR 结果后处理校验',
      '分层批改策略（成本优化）',
      '  - 高置信度：GLM-5/GLM-4.7 文本模型',
      '  - 低置信度：GLM-4V-Plus-0111 视觉模型',
      '防幻觉校验层',
      'EduKG 知识点匹配',
      '生成诊断总结',
      '实时进度反馈（轮询 /api/diagnosis/photo-v2?taskId=xxx）'
    ],
    parameters: {
      imageBase64: '图片 Base64 编码（可选）',
      imageUrl: '图片 URL（可选）',
      mode: '批改模式：auto/single/batch（默认 auto）',
      subject: '学科：math/physics/chemistry/chinese/english（必填）',
      grade: '年级（必填）',
      userId: '用户 ID（必填）'
    },
    flow: [
      '1. 图片预处理',
      '2. 模式检测',
      '3. TextIn OCR 识别',
      '4. 提取题目结构',
      '5. 分层批改（根据 OCR 置信度选择模型）',
      '6. 防幻觉校验',
      '7. 知识点匹配',
      '8. 生成总结'
    ],
    progress: {
      polling: 'GET /api/diagnosis/photo-v2?taskId=<taskId>',
      response: {
        taskId: '任务ID',
        status: 'processing/completed/failed',
        currentStep: '当前步骤（1-8）',
        totalSteps: '总步骤数',
        stepMessage: '当前步骤描述',
        result: '完成时的完整结果（仅 status=completed 时有）'
      }
    },
    confidenceThresholds: {
      high: '≥ 0.8 (使用 GLM-5/GLM-4.7 文本模型)',
      low: '< 0.8 (使用 GLM-4V-Plus-0111 视觉模型)'
    }
  });
}

/**
 * POST 请求 - 拍照诊断（异步处理模式）
 */
export async function POST(request: NextRequest) {
  // 生成任务ID
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // 创建任务进度
  createTask(taskId, 8);

  // 异步处理任务，不阻塞响应
  processDiagnosisTask(taskId, request).catch((error) => {
    log.error('任务处理失败', { taskId, error });
    failTask(taskId, error instanceof Error ? error.message : '处理失败');
  });

  // 立即返回 taskId
  return NextResponse.json({
    success: true,
    taskId,
    message: '任务已创建，请轮询 /api/diagnosis/photo-v2?taskId=' + taskId + ' 获取进度'
  });
}

/**
 * 异步处理诊断任务
 */
async function processDiagnosisTask(taskId: string, request: NextRequest) {
  const startTime = Date.now();

  try {
    // 解析请求 - 支持 JSON 和 multipart/form-data 两种格式
    let imageBase64: string | undefined;
    let imageUrl: string | undefined;
    let mode = 'auto';
    let subject = '';
    let grade = '';
    let userId = '';

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // 处理 multipart/form-data 格式（微信小程序 wx.uploadFile）
      const formData = await request.formData();
      const file = formData.get('file') as File;

      subject = (formData.get('subject') as string) || '';
      grade = (formData.get('grade') as string) || '';
      userId = (formData.get('userId') as string) || '';
      mode = (formData.get('mode') as string) || 'auto';

      if (file) {
        // 将文件转换为 base64
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        imageBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
      }

      log.info('收到 multipart/form-data 请求', { subject, grade, userId, mode, hasFile: !!file });
    } else {
      // 处理 JSON 格式
      const body: PhotoDiagnosisV2Request = await request.json();
      imageBase64 = body.imageBase64;
      imageUrl = body.imageUrl;
      mode = body.mode || 'auto';
      subject = body.subject || '';
      grade = body.grade || '';
      userId = body.userId || '';
    }

    // 参数校验
    if (!imageBase64 && !imageUrl) {
      throw new Error('请提供图片 Base64 或 URL');
    }

    if (!subject || !grade || !userId) {
      throw new Error('请提供学科、年级和用户 ID');
    }

    const validSubjects = ['math', 'physics', 'chemistry', 'chinese', 'english'];
    if (!validSubjects.includes(subject)) {
      throw new Error(`无效的学科: ${subject}`);
    }

    log.info('开始拍照诊断 V2', { subject, grade, userId, mode, hasImage: !!(imageBase64 || imageUrl) });

    // 获取图片数据
    const imageData = imageBase64 || imageUrl!;
    const isUrl = !imageBase64;

    // ==================== Step 1: 图片预处理 ====================
    updateProgress(taskId, 1, '正在处理图片...');
    log.info('Step 1: 图片预处理...');
    const preprocessedImage = await preprocessImage(imageData, isUrl);
    log.info('图片预处理完成', {
      originalSize: imageBase64 ? Math.floor((imageBase64.length * 3) / 4) : 'unknown',
      processedSize: preprocessedImage.length
    });

    // ==================== Step 2: 模式检测 ====================
    updateProgress(taskId, 2, '正在检测题目类型...');
    let detectedMode: CorrectionMode = 'batch';
    if (mode === 'auto') {
      log.info('Step 2: 模式检测中...');
      detectedMode = await detectMode(preprocessedImage);
      log.info('模式检测完成', { mode: detectedMode });
    } else if (mode === 'single' || mode === 'batch') {
      detectedMode = mode as CorrectionMode;
      log.info('使用指定模式', { mode: detectedMode });
    } else {
      // 默认使用 batch 模式
      log.info('无效的模式，使用默认 batch 模式', { mode });
    }

    // ==================== Step 3: TextIn OCR 识别 ====================
    updateProgress(taskId, 3, '正在识别文字（OCR）...');
    log.info('Step 3: TextIn OCR 识别中...');
    const textinClient = getTextinClient();

    let ocrText: string;
    let ocrValidation: OcrValidation = {
      isValid: true,
      confidence: 0,
      warnings: [],
      errors: []
    };

    try {
      const ocrResult = await textinClient.recognizePaper(preprocessedImage);
      ocrText = ocrResult.markdown;

      // OCR 结果校验
      const validationResult = textinClient.validateResult(ocrResult);
      ocrValidation = {
        isValid: validationResult.isValid,
        confidence: ocrResult.confidence || 0,
        warnings: validationResult.warnings.map(w => w.message),
        errors: validationResult.errors.map(e => e.message)
      };

      log.info('TextIn OCR 识别完成', {
        textLength: ocrText.length,
        confidence: ocrValidation.confidence,
        isValid: ocrValidation.isValid,
        warningCount: ocrValidation.warnings.length,
        errorCount: ocrValidation.errors.length
      });

      // 如果 OCR 校验失败且有严重错误，尝试降级
      if (!ocrValidation.isValid && ocrValidation.errors.length > 0) {
        log.warn('OCR 校验失败，尝试降级方案');
        const fallbackResult = await fallbackOCR(preprocessedImage);
        ocrText = fallbackResult.text;
        ocrValidation.warnings.push('使用降级 OCR 方案');
        log.info('降级 OCR 完成', { textLength: ocrText.length });
      }

    } catch (error) {
      log.error('TextIn OCR 失败，使用降级方案', error);
      const fallbackResult = await fallbackOCR(preprocessedImage);
      ocrText = fallbackResult.text;
      ocrValidation = {
        isValid: false,
        confidence: fallbackResult.confidence,
        warnings: ['TextIn OCR 失败，使用降级方案'],
        errors: []
      };
    }

    // ==================== Step 4: 简化题目结构 ====================
    updateProgress(taskId, 4, '正在分析题目结构...');
    log.info('Step 4: 简化题目结构...');
    // 简化处理：直接将整个 OCR 内容作为一个题目
    // 批改函数会负责识别手写答案和判断对错
    const extractedQuestions = [{
      id: '1',
      content: ocrText.substring(0, 2000), // 限制长度避免 token 超限
      type: 'essay' as const,
      options: undefined
    }];
    log.info('题目结构完成', { count: extractedQuestions.length });

    if (extractedQuestions.length === 0) {
      throw new Error('未能识别到任何题目，请确保图片清晰');
    }

    // ==================== Step 5: 分层批改 ====================
    updateProgress(taskId, 5, '正在批改题目...');
    log.info('Step 5: 分层批改中...', {
      ocrConfidence: ocrValidation.confidence,
      strategy: ocrValidation.confidence >= 0.8 ? 'text-only (GLM-5/4.7)' : 'visual-calibration (GLM-4V-Plus-0111)'
    });
    const questionsForJudgment: QuestionForJudgment[] = extractedQuestions.map(q => ({
      id: q.id,
      content: q.content,
      type: q.type,
      options: q.options
    }));

    let judgmentResult;
    try {
      // 分层批改策略：根据 OCR 置信度选择模型
      // 高置信度（≥0.8）→ GLM-5/GLM-4.7 文本推理（快速便宜）
      // 低置信度（<0.8）→ GLM-4V-Plus-0111 视觉校准（高精度）
      judgmentResult = await judgeHandwrittenAnswers(
        preprocessedImage,
        ocrText,
        questionsForJudgment,
        ocrValidation.confidence
      );

      log.info('GLM 批改完成', {
        questionCount: judgmentResult.questions.length,
        avgConfidence: judgmentResult.questions.reduce((sum, q) => sum + q.confidence, 0) / judgmentResult.questions.length,
        ocrConfidence: ocrValidation.confidence,
        strategy: ocrValidation.confidence >= 0.8 ? 'text-only' : 'visual-calibration'
      });
    } catch (glmError) {
      log.warn('GLM 批改失败，使用降级方案', glmError);

      // 降级方案：基于OCR结果生成默认批改结果
      judgmentResult = {
        questions: extractedQuestions.map(q => ({
          questionId: q.id,
          studentAnswer: '',
          isCorrect: false,
          correctAnswer: '需手动确认',
          analysis: 'AI批改服务暂时不可用，请查看OCR识别结果并手动确认',
          confidence: 0.1
        }))
      };
    }

    // ==================== Step 6: 防幻觉校验 ====================
    updateProgress(taskId, 6, '正在校验结果...');
    log.info('Step 6: 防幻觉校验中...');
    const validatedQuestions: QuestionJudgment[] = [];
    let lowConfidenceCount = 0;

    for (const extractedQ of extractedQuestions) {
      const judgment = judgmentResult.questions.find(j => j.questionId === extractedQ.id);

      if (!judgment) {
        log.warn(`题目 ${extractedQ.id} 未找到批改结果`);
        continue;
      }

      // 防幻觉校验
      const validationResult = validateJudgmentResult({
        questionId: extractedQ.id,
        questionContent: extractedQ.content,
        studentAnswer: judgment.studentAnswer,
        llmIsCorrect: judgment.isCorrect,
        llmConfidence: judgment.confidence,
        questionType: extractedQ.type
      });

      if (validationResult.adjustedConfidence < CONFIDENCE_THRESHOLD_HIGH) {
        lowConfidenceCount++;
      }

      validatedQuestions.push({
        id: extractedQ.id,
        content: extractedQ.content,
        type: extractedQ.type,
        options: extractedQ.options,
        studentAnswer: judgment.studentAnswer,
        judgment: {
          isCorrect: judgment.isCorrect,
          correctAnswer: judgment.correctAnswer,
          analysis: judgment.analysis,
          confidence: validationResult.adjustedConfidence,
          originalConfidence: judgment.confidence,
          needsReview: validationResult.needsReview,
          reviewReason: validationResult.reviewReason,
          warnings: validationResult.warnings
        },
        knowledgePoints: [] // 将在 Step 7 填充
      });
    }

    log.info('防幻觉校验完成', {
      totalQuestions: validatedQuestions.length,
      lowConfidenceCount
    });

    // ==================== Step 7: 知识点匹配 ====================
    updateProgress(taskId, 7, '正在匹配知识点...');
    log.info('Step 7: 知识点匹配中...');

    for (const question of validatedQuestions) {
      const keywords = await extractKeywords(question.content, subject);
      const knowledgePoints = await matchKnowledgePoints(keywords, subject, question.judgment.isCorrect);

      question.knowledgePoints = knowledgePoints;
    }

    log.info('知识点匹配完成');

    // ==================== Step 8: 生成总结 ====================
    updateProgress(taskId, 8, '正在生成报告...');
    const correctCount = validatedQuestions.filter(q => q.judgment.isCorrect).length;
    const totalCount = validatedQuestions.length;
    const score = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

    // 收集薄弱知识点
    const weakKnowledgePointsMap = new Map<string, number>();
    for (const q of validatedQuestions) {
      if (!q.judgment.isCorrect) {
        for (const kp of q.knowledgePoints) {
          weakKnowledgePointsMap.set(kp.name, (weakKnowledgePointsMap.get(kp.name) || 0) + 1);
        }
      }
    }

    const weakKnowledgePoints = Array.from(weakKnowledgePointsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);

    // 判断是否需要复核
    const reviewNeed = calculateReviewNeed({
      lowConfidenceCount,
      totalQuestions: totalCount,
      hasValidationErrors: !ocrValidation.isValid
    });

    const summary = {
      totalQuestions: totalCount,
      correctCount,
      score,
      weakKnowledgePoints,
      lowConfidenceCount,
      needsReview: reviewNeed.needsReview,
      reviewReason: reviewNeed.reviewReason
    };

    const duration = Date.now() - startTime;
    log.info('拍照诊断 V2 完成', { ...summary, duration: `${duration}ms` });

    // 构建响应
    const response: PhotoDiagnosisV2Response = {
      mode: detectedMode,
      questions: validatedQuestions,
      summary,
      ocrValidation
    };

    // ==================== Step 9: 保存记录并触发成就 ====================
    // 异步执行，不阻塞响应
    saveRecordAndTriggerAchievements({
      userId,
      subject,
      grade,
      detectedMode,
      validatedQuestions,
      summary,
      imageUrl: imageUrl || null
    }).catch((err: Error) => {
      log.error('保存记录或触发成就失败', err);
    });

    // 标记任务完成
    completeTask(taskId, response);

  } catch (error) {
    log.error('拍照诊断 V2 失败', error);
    failTask(taskId, error instanceof Error ? error.message : '拍照诊断失败，请稍后重试');
  }
}

/**
 * 图片预处理：压缩和格式转换
 */
async function preprocessImage(imageData: string, isUrl: boolean): Promise<string> {
  try {
    let inputBuffer: Buffer;

    if (isUrl) {
      // 从 URL 下载图片
      const response = await fetch(imageData);
      if (!response.ok) {
        throw new Error(`图片下载失败: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      inputBuffer = Buffer.from(arrayBuffer);
    } else {
      // 从 Base64 解码
      const base64Data = imageData.includes(',')
        ? imageData.split(',')[1]
        : imageData;
      inputBuffer = Buffer.from(base64Data, 'base64');
    }

    // 使用 Sharp 进行预处理
    // 1. 限制最大尺寸为 2048x2048
    // 2. 转换为 PNG 格式（GLM-4V 对格式有要求）
    // 3. 适度压缩
    const processedBuffer = await sharp(inputBuffer)
      .resize(2048, 2048, {
        fit: 'inside',
        withoutEnlargement: false
      })
      .png({
        compressionLevel: 6,
        adaptiveFiltering: true
      })
      .toBuffer();

    return `data:image/png;base64,${processedBuffer.toString('base64')}`;

  } catch (error) {
    log.error('图片预处理失败', error);
    // 如果预处理失败，返回原始数据
    return imageData;
  }
}

/**
 * 降级 OCR 方案：使用 GLM-4V 进行识别
 */
async function fallbackOCR(imageBase64: string): Promise<{
  text: string;
  confidence: number;
}> {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    return { text: '', confidence: 0 };
  }

  try {
    const prompt = `请识别这张图片中的所有题目内容。

要求：
1. 识别所有题目，不要遗漏
2. 数学公式使用 LaTeX 格式，用 $ 包裹
3. 保留题目编号
4. 选择题要提取所有选项
5. 只返回识别的内容，不要有其他说明

请按 Markdown 格式返回所有题目内容。`;

    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'glm-4v-flash',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageBase64 }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }],
        temperature: 0.1,
        max_tokens: 8000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('fallbackOCR GLM 错误', { status: response.status, error: errorText });
      throw new Error(`GLM 请求失败: ${response.status}`);
    }

    // 安全解析 JSON
    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      log.error('fallbackOCR JSON 解析失败', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        responseText: responseText.substring(0, 1000)
      });
      throw new Error('GLM 返回无效的 JSON');
    }
    const content = result.choices?.[0]?.message?.content || '';

    // 清理可能的 markdown 标记
    const cleanContent = content
      .replace(/```markdown\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    return {
      text: cleanContent,
      confidence: 0.7 // 降级方案使用固定置信度
    };

  } catch (error) {
    log.error('降级 OCR 失败', error);
    return { text: '', confidence: 0 };
  }
}

/**
 * 从 OCR 文本中提取题目结构
 */
async function extractQuestions(
  ocrText: string,
  subject: string,
  grade: string
): Promise<Array<{
  id: string;
  content: string;
  type: 'choice' | 'fill_blank' | 'essay';
  options?: string[];
}>> {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    throw new Error('GLM_API_KEY 未配置');
  }

  const prompt = `你是一个专业的题目分析专家。请从以下 OCR 识别的文本中提取所有题目。

【学科】${subject}
【年级】${grade}
【识别文本】
${ocrText}

请分析并返回 JSON 格式（必须是有效的 JSON，不要有 markdown 代码块标记）：
{
  "questions": [
    {
      "id": "题目编号（如 1、2、3 等，如果没有编号按顺序编为 Q1、Q2、Q3...）",
      "content": "题目完整内容（包括题干）",
      "type": "题目类型（choice选择题/fill_blank填空题/essay解答题）",
      "options": ["选项A内容", "选项B内容", "选项C内容", "选项D内容"]
    }
  ]
}

注意事项：
1. 必须提取文本中的所有题目，不要遗漏任何一道题
2. 选择题必须包含 options 字段
3. 只返回纯 JSON，不要有其他说明文字`;

  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 8000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('extractQuestions GLM 错误', { status: response.status, error: errorText });
      throw new Error(`GLM 请求失败: ${response.status}`);
    }

    // 安全解析 JSON
    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      log.error('extractQuestions JSON 解析失败', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        responseText: responseText.substring(0, 1000)
      });
      throw new Error('GLM 返回无效的 JSON');
    }

    // GLM-5 是推理模型，答案可能在 reasoning_content 或 content 中
    const message = result.choices?.[0]?.message;
    const content = message?.reasoning_content || message?.content || '';

    // 解析 JSON 响应（处理常见的转义问题）
    let cleanContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // 修复常见的 JSON 转义问题
    // 1. 移除控制字符
    cleanContent = cleanContent.replace(/[\x00-\x1F\x7F]/g, '');
    // 2. 修复双反斜杠问题（LaTeX 公式）
    cleanContent = cleanContent.replace(/\\\\([{}%$])/g, '\\$1');
    // 3. 修复无效的转义序列
    cleanContent = cleanContent.replace(/\\(?!["\\/bfnrt])/g, '\\\\');

    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('无法从响应中提取 JSON');
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const questions = parsed.questions || [];
      log.info('题目提取成功', { count: questions.length });
      return questions;
    } catch (jsonError) {
      log.warn('JSON 解析失败，尝试清理后重试', { error: jsonError instanceof Error ? jsonError.message : String(jsonError) });
      // 尝试更激进的清理
      let cleaned = jsonMatch[0];
      // 移除所有注释
      cleaned = cleaned.replace(/\/\/.*$/gm, '');
      // 移除控制字符
      cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');
      const parsed = JSON.parse(cleaned);
      const questions = parsed.questions || [];
      log.info('题目提取成功（清理后）', { count: questions.length });
      return questions;
    }

  } catch (error) {
    log.error('题目提取失败', error);

    // 降级方案：尝试简单解析
    return simpleExtractQuestions(ocrText);
  }
}

/**
 * 简单题目提取（降级方案）
 */
function simpleExtractQuestions(ocrText: string): Array<{
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

  // 按行分割
  const lines = ocrText.split('\n').filter(line => line.trim());

  let currentQuestion: string[] = [];
  let questionNum = 0;

  for (const line of lines) {
    // 检测题目编号
    const numMatch = line.match(/^(\d+)[.、．]\s*/);
    if (numMatch) {
      // 保存上一题
      if (currentQuestion.length > 0) {
        questions.push({
          id: String(questionNum),
          content: currentQuestion.join('\n'),
          type: detectQuestionType(currentQuestion.join('\n'))
        });
      }
      questionNum = parseInt(numMatch[1], 10);
      currentQuestion = [line];
    } else {
      currentQuestion.push(line);
    }
  }

  // 保存最后一题
  if (currentQuestion.length > 0) {
    questions.push({
      id: String(questionNum || questions.length + 1),
      content: currentQuestion.join('\n'),
      type: detectQuestionType(currentQuestion.join('\n'))
    });
  }

  return questions;
}

/**
 * 检测题目类型
 */
function detectQuestionType(content: string): 'choice' | 'fill_blank' | 'essay' {
  // 检测选择题：包含选项 A、B、C、D
  if (/[A-D][.、]\s*/.test(content)) {
    return 'choice';
  }

  // 检测填空题：包含下划线或括号
  if (/___|____|（）|【】/g.test(content)) {
    return 'fill_blank';
  }

  // 默认为解答题
  return 'essay';
}

/**
 * 从题目内容中提取关键词
 */
async function extractKeywords(
  questionContent: string,
  subject: string
): Promise<string[]> {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    return [];
  }

  try {
    const prompt = `请从以下${subjectName(subject)}题目中提取 2-3 个最重要的知识点关键词。

题目：${questionContent}

只返回关键词，用空格分隔，不超过 10 个字。不要有任何其他说明。`;

    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 100
      })
    });

    // 安全解析 JSON
    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      log.warn('extractKeywords JSON 解析失败', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        responseText: responseText.substring(0, 500)
      });
      return [];
    }
    const content = result.choices?.[0]?.message?.content?.trim() || '';

    return content.split(/\s+/).filter((k: string) => k.length > 0);

  } catch (error) {
    log.warn('关键词提取失败', error);
    return [];
  }
}

/**
 * 学科名称映射
 */
function subjectName(subject: string): string {
  const names: Record<string, string> = {
    math: '数学',
    physics: '物理',
    chemistry: '化学',
    chinese: '语文',
    english: '英语'
  };
  return names[subject] || subject;
}

/**
 * 匹配知识点
 */
async function matchKnowledgePoints(
  keywords: string[],
  subject: string,
  isCorrect: boolean
): Promise<Array<{
  id: string;
  name: string;
  masteryLevel: 'mastered' | 'partial' | 'weak';
}>> {
  const knowledgePoints: Array<{
    id: string;
    name: string;
    masteryLevel: 'mastered' | 'partial' | 'weak';
  }> = [];

  // 基于答题结果判断掌握程度
  const masteryLevel: 'mastered' | 'partial' | 'weak' = isCorrect ? 'mastered' : 'weak';

  for (const keyword of keywords.slice(0, 3)) {
    try {
      const searchResults = await edukgAdapter.searchKnowledgePoints(keyword, subject);

      if (searchResults && searchResults.length > 0) {
        const entity = searchResults[0];
        const id = `kp_${entity.id || entity.uri?.split('/').pop() || Date.now()}`;

        // 避免重复
        if (!knowledgePoints.find(kp => kp.name === entity.label || kp.name === entity.name)) {
          knowledgePoints.push({
            id,
            name: entity.label || entity.name || keyword,
            masteryLevel
          });
        }
      }
    } catch (error) {
      log.warn('知识点搜索失败', { keyword, error });
    }
  }

  return knowledgePoints;
}

/**
 * 成就触发参数接口
 */
interface AchievementTriggerParams {
  userId: string;
  subject: string;
  grade: string;
  detectedMode: CorrectionMode;
  validatedQuestions: QuestionJudgment[];
  summary: {
    totalQuestions: number;
    correctCount: number;
    score: number;
    weakKnowledgePoints: string[];
    lowConfidenceCount: number;
    needsReview: boolean;
    reviewReason?: string;
  };
  imageUrl: string | null;
}

/**
 * 保存批改记录并触发成就
 */
async function saveRecordAndTriggerAchievements(params: AchievementTriggerParams): Promise<void> {
  const {
    userId,
    subject,
    grade,
    detectedMode,
    validatedQuestions,
    summary,
    imageUrl
  } = params;

  try {
    // 1. 检查用户是否存在
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      log.warn(`用户 ${userId} 不存在，跳过保存记录`);
      return;
    }

    // 2. 保存批改记录
    const correctionRecord = await prisma.paperCorrectionRecord.create({
      data: {
        userId,
        subject,
        grade,
        mode: detectedMode,
        imageUrl,
        totalQuestions: summary.totalQuestions,
        correctCount: summary.correctCount,
        score: summary.score,
        needsReview: summary.needsReview,
        reviewReason: summary.reviewReason,
        lowConfidenceCount: summary.lowConfidenceCount
      }
    });

    log.info('批改记录已保存', { recordId: correctionRecord.id, userId });

    // 3. 保存错题
    const wrongQuestionsPromises = validatedQuestions
      .filter(q => !q.judgment.isCorrect || q.judgment.needsReview)
      .map(question =>
        saveWrongQuestion({
          userId,
          questionId: question.id,
          subject,
          questionContent: question.content,
          studentAnswer: question.studentAnswer,
          correctAnswer: question.judgment.correctAnswer,
          analysis: question.judgment.analysis,
          knowledgePoints: question.knowledgePoints,
          isCorrect: question.judgment.isCorrect,
          needsReview: question.judgment.needsReview,
          confidence: question.judgment.confidence
        })
      );

    await Promise.all(wrongQuestionsPromises);
    log.info('错题保存完成', { count: wrongQuestionsPromises.length });

    // 4. 触发成就事件（异步，不阻塞）
    await triggerCorrectionAchievements(userId, subject, summary);

  } catch (error) {
    log.error('保存记录或触发成就失败', error);
    // 不抛出错误，避免影响主流程
  }
}

/**
 * 触发批改相关成就
 */
async function triggerCorrectionAchievements(
  userId: string,
  subject: string,
  summary: {
    totalQuestions: number;
    correctCount: number;
    score: number;
  }
): Promise<void> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const events: Array<{ type: string; data: Record<string, unknown> }> = [];

    // 基础事件：批改完成
    events.push({
      type: 'correction_finished',
      data: {
        subject,
        score: summary.score,
        correctCount: summary.correctCount,
        totalCount: summary.totalQuestions
      }
    });

    // 满分成就（100分）
    if (summary.score === 100) {
      events.push({
        type: 'perfect_score',
        data: {
          subject,
          score: summary.score,
          correctCount: summary.correctCount,
          totalCount: summary.totalQuestions
        }
      });
    }

    // 高分成就（80-99分）
    if (summary.score >= 80 && summary.score < 100) {
      events.push({
        type: 'high_score',
        data: {
          subject,
          score: summary.score,
          correctCount: summary.correctCount,
          totalCount: summary.totalQuestions
        }
      });
    }

    // 并发触发所有成就事件
    await Promise.all(
      events.map(event =>
        fetch(`${baseUrl}/api/achievements/check`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            event: {
              type: event.type,
              subject,
              data: event.data,
              timestamp: new Date()
            }
          })
        }).catch(err => {
          log.warn(`触发成就事件失败: ${event.type}`, err);
        })
      )
    );

    log.info('批改成就触发完成', {
      userId,
      subject,
      score: summary.score,
      eventCount: events.length
    });

  } catch (error) {
    log.error('触发成就失败', error);
    // 不抛出错误，避免影响主流程
  }
}
