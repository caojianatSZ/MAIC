// app/api/diagnosis/photo-aliyun/route.ts
/**
 * 试卷拍照批改 API V6 - 阿里云EduTutor CutQuestions
 *
 * 核心理念：使用阿里云专业的试卷切分API
 *
 * 架构：
 * 图片 → 阿里云CutQuestions → 结构化题目数据 → 判题
 *
 * 优势：
 * - 专门为教育场景优化
 * - 自动切分题目（精确坐标）
 * - 结构化识别（题干、选项、答案、插图）
 * - 返回7天有效的临时图片链接
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import {
  cutQuestions,
  convertAliyunQuestionsToOurFormat
} from '@/lib/aliyun/edututor-client';
import { enrichQuestionWithOptions } from '@/lib/aliyun/extract-option-images';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const log = createLogger('PhotoAliyun');

export async function GET() {
  return NextResponse.json({
    name: '试卷拍照批改 API V6 (阿里云EduTutor)',
    version: '6.0.0',
    description: '使用阿里云CutQuestions API进行试卷切分',
    features: [
      '✅ 阿里云专业试卷切分',
      '✅ 自动识别题干、选项、答案、插图',
      '✅ 精确的题目坐标信息',
      '✅ 7天有效临时图片链接',
      '✅ 专门为教育场景优化'
    ],
    advantages: [
      '专业教育API（非通用OCR）',
      '自动切分题目',
      '结构化数据输出',
      '图片坐标精确'
    ],
    architecture: {
      step1: '接收Base64图片',
      step2: '转换为可访问URL（临时文件）',
      step3: '调用阿里云CutQuestions API',
      step4: '转换为我们的数据格式'
    },
    usage: 'POST /api/diagnosis/photo-aliyun',
    parameters: {
      image: 'Base64编码的试卷图片（必需）',
      subject: '科目（可选）',
      grade: '年级（可选）'
    }
  });
}

export async function POST(request: NextRequest) {
  const requestId = `aliyun_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  try {
    log.info('收到 阿里云EduTutor 识别请求', { requestId });

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

    // ==================== Step 1: 将Base64转换为临时文件URL ====================
    log.info('Step 1: 创建临时图片文件', { requestId });

    const tempImageUrl = await createTempImageFile(image, requestId);

    log.info('临时图片创建成功', {
      requestId,
      tempImageUrl
    });

    // ==================== Step 2: 调用阿里云CutQuestions API ====================
    log.info('Step 2: 调用阿里云CutQuestions API', { requestId });

    const aliyunResult = await cutQuestions(tempImageUrl, {
      struct: true,
      extract_images: true
    });

    log.info('阿里云CutQuestions API调用完成', {
      requestId,
      questionCount: aliyunResult.questions.length
    });

    // ==================== Step 3: 转换数据格式 ====================
    log.info('Step 3: 转换数据格式', {
      requestId,
      questionsCount: aliyunResult.questions.length,
      hasTempImageUrl: !!tempImageUrl
    });

    let questions;
    try {
      questions = convertAliyunQuestionsToOurFormat(
        aliyunResult.questions,
        tempImageUrl  // 传递我们自己的临时图片URL
      );
      log.info('数据格式转换成功', { questionsCount: questions.length });
    } catch (error) {
      log.error('数据格式转换失败', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }

    // ==================== Step 4: 提取选项图形 ====================
    log.info('Step 4: 提取选项图形', { requestId });

    let enrichedQuestions;
    try {
      enrichedQuestions = questions.map(q => {
        if (q.aliyunData) {
          const enriched = enrichQuestionWithOptions(q.aliyunData);

          // 将optionImages合并到options数组中
          const optionsWithImages = q.options?.map((opt, idx) => {
            const optionImage = enriched.optionImages?.[idx];
            return {
              ...opt,
              croppedImage: optionImage?.imageUrl || '',
              imageBbox: optionImage?.bbox
            };
          }) || [];

          return {
            ...q,
            options: optionsWithImages,
            optionImages: enriched.optionImages
          } as typeof q & {
            optionImages?: typeof enriched.optionImages;
            options: typeof q.options & Array<{croppedImage?: string; imageBbox?: number[]}>
          };
        }
        return q;
      });
      log.info('选项图形提取成功', { enrichedCount: enrichedQuestions.length });
    } catch (error) {
      log.error('选项图形提取失败', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }

    // 统计选项图形数量
    const totalOptionImages = enrichedQuestions.reduce(
      (sum, q) => sum + ((q as any).optionImages?.length || 0),
      0
    );

    log.info('选项图形提取完成', {
      requestId,
      totalOptionImages
    });

    // 调试：打印题6的选项数据
    const question6 = enrichedQuestions.find(q => q.id === '6');
    if (question6) {
      log.info('题6选项数据示例', {
        id: question6.id,
        optionsCount: question6.options?.length,
        firstOption: question6.options?.[0],
        hasOptionImages: !!(question6 as any).optionImages?.length,
        firstOptionImage: (question6 as any).optionImages?.[0]
      });
    }

    // 清理临时文件（异步，不阻塞响应）
    cleanupTempImageFile(tempImageUrl).catch(error => {
      log.warn('清理临时文件失败', { error, tempImageUrl });
    });

    // ==================== Step 5: 返回结果 ====================
    const result = {
      status: 'success',
      mode: 'aliyun-edututor',
      markdown: questions.map(q => q.content).join('\n\n'),
      questions: enrichedQuestions,
      originalImage: image,
      summary: {
        total_questions: enrichedQuestions.length,
        markdown_length: questions.map(q => q.content).join('\n\n').length,
        questions_with_images: questions.filter(q => q.images && q.images.length > 0).length,
        questions_with_options: questions.filter(q => q.options && q.options.length > 0).length,
        total_option_images: totalOptionImages
      },
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        method: 'aliyun-edututor',
        version: '6.1.0'
      }
    };

    log.info('阿里云EduTutor 流程完成', {
      requestId,
      questionCount: result.summary.total_questions
    });

    return NextResponse.json(result);

  } catch (error) {
    log.error('阿里云EduTutor 识别失败', {
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
 * 创建临时图片文件（用于阿里云API访问）
 */
async function createTempImageFile(
  base64Data: string,
  requestId: string
): Promise<string> {
  // 提取Base64数据
  const base64DataClean = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64DataClean, 'base64');

  // 生成唯一文件名
  const filename = `${requestId}_${uuidv4()}.jpg`;
  const tempDir = join(process.cwd(), 'public', 'temp', 'images');
  const tempFilePath = join(tempDir, filename);

  // 确保临时目录存在
  const fs = require('fs');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // 写入文件
  await writeFile(tempFilePath, buffer);

  // 返回可访问的URL（使用公网域名）
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  return `${baseUrl}/temp/images/${filename}`;
}

/**
 * 清理临时图片文件
 */
async function cleanupTempImageFile(tempImageUrl: string): Promise<void> {
  try {
    // 从URL提取文件路径
    const url = new URL(tempImageUrl);
    const pathname = url.pathname;
    const filename = pathname.split('/').pop();

    if (!filename) return;

    const tempFilePath = join(process.cwd(), 'public', 'temp', 'images', filename);

    // 删除文件
    await unlink(tempFilePath);

    log.info('临时文件已删除', { filename });
  } catch (error) {
    log.warn('删除临时文件失败', { error, tempImageUrl });
  }
}
