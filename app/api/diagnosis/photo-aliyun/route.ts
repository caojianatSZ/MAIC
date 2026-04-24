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
import { readFile, writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { quickPreprocess, needsPreprocessing } from '@/lib/image/preprocessing';
import { validateQuestionContinuity } from '@/lib/validation/continuity';
import { adaptiveRecognize } from '@/lib/recognition/adaptive-retry';
import sharp from 'sharp';

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
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

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

    // ==================== Step 1: 图像预处理（可选） ====================
    log.info('Step 1: 检查是否需要图像预处理', { requestId });

    let processedImage = image;
    let preprocessUsed = false;

    try {
      const preprocessCheck = await needsPreprocessing(image);

      if (preprocessCheck.needs) {
        log.info('图像需要预处理', {
          requestId,
          reason: preprocessCheck.reason,
          suggestions: preprocessCheck.suggestions
        });

        processedImage = await quickPreprocess(image);
        preprocessUsed = true;

        log.info('图像预处理完成', { requestId });
      } else {
        log.info('图像质量良好，跳过预处理', { requestId });
      }
    } catch (error) {
      log.warn('图像预处理失败，使用原图', {
        requestId,
        error: error instanceof Error ? error.message : String(error)
      });
      // 预处理失败不影响主流程
    }

    // ==================== Step 2: 将Base64转换为临时文件URL ====================
    log.info('Step 2: 创建临时图片文件', { requestId });

    const tempImageUrl = await createTempImageFile(processedImage, requestId);

    log.info('临时图片创建成功', {
      requestId,
      preprocessUsed,
      tempImageUrl
    });

    // ==================== Step 3: 调用阿里云CutQuestions API ====================
    log.info('Step 3: 调用阿里云CutQuestions API', { requestId });

    const aliyunResult = await cutQuestions(tempImageUrl, {
      struct: true,
      extract_images: true
    });

    log.info('阿里云CutQuestions API调用完成', {
      requestId,
      questionCount: aliyunResult.questions.length
    });

    // ==================== Step 4: 转换数据格式 ====================
    log.info('Step 4: 转换数据格式', {
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

    // ==================== Step 5: 服务器端图片切割 ====================
    log.info('Step 5: 服务器端图片切割', { requestId });

    // 读取原始图片文件
    const tempImagePath = join(process.cwd(), 'public', 'temp', 'images', tempImageUrl.split('/').pop() || '');
    let originalImageBuffer: Buffer | null = null;

    try {
      originalImageBuffer = await readFile(tempImagePath);
      log.info('原始图片读取成功', { requestId, size: originalImageBuffer.length });
    } catch (error) {
      log.warn('读取原始图片失败，将使用阿里云预切割图片', {
        requestId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // 如果有原始图片，对每个题目的图形进行切割
    if (originalImageBuffer) {
      try {
        const metadata = await sharp(originalImageBuffer).metadata();
        log.info('原始图片元数据', {
          requestId,
          width: metadata.width,
          height: metadata.height
        });

        // 为每个题目切割图形
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          if (!q.aliyunData?.info?.figure || q.aliyunData.info.figure.length === 0) {
            continue;
          }

          // 检查题干是否已包含完整公式，如果是则跳过图片
          // 因为OCR已经识别出公式文字，图片是冗余的
          const content = q.content || '';
          const hasLatexFormula = /\\[a-zA-Z]+{.*}|\\frac|\\sqrt|\\sum|\\int|\\lim|_[a-zA-Z]|\\^[a-zA-Z]|\$.*\$/.test(content);
          const contentLength = content.length;

          // 如果题干包含LaTeX公式且长度足够，说明OCR已成功识别公式文字
          // 这种情况下不需要显示图片（图片很可能是冗余的公式文字）
          if (hasLatexFormula && contentLength > 50) {
            log.info(`跳过图片切割（题干已包含完整公式） 题目${i + 1}`, {
              contentLength,
              hasLatexFormula: true
            });
            (questions[i] as any).images = [];
            continue;
          }

          const cutImages: Array<{ bbox: number[]; label: string; url: string }> = [];

          for (let figIndex = 0; figIndex < q.aliyunData.info.figure.length; figIndex++) {
            const fig = q.aliyunData.info.figure[figIndex];
            const posList = fig?.pos_list?.[0];

            if (!posList || posList.length !== 8) {
              continue;
            }

            // 计算边界框
            const [x1, y1, x2, y2, x3, y3, x4, y4] = posList;
            const minX = Math.min(x1, x2, x3, x4);
            const maxX = Math.max(x1, x2, x3, x4);
            const minY = Math.min(y1, y2, y3, y4);
            const maxY = Math.max(y1, y2, y3, y4);

            const width = maxX - minX;
            const height = maxY - minY;
            const area = width * height;

            // 过滤小面积 - 提高阈值以过滤更多无效区域
            if (area < 15000) {
              log.info(`过滤小面积图形 题目${i + 1}-图形${figIndex + 1}`, { area, width, height });
              continue;
            }

            // 计算长宽比
            const aspectRatio = width / height;

            // 过滤可能是公式文字的区域：
            // 1. 竖向细长区域（长宽比 < 0.4）可能是单行公式
            // 2. 横向很宽但很矮的区域（长宽比 > 5）可能是横排公式
            if (aspectRatio < 0.4 || aspectRatio > 5) {
              log.info(`过滤疑似公式文字区域 题目${i + 1}-图形${figIndex + 1}`, {
                area,
                width,
                height,
                aspectRatio: aspectRatio.toFixed(2)
              });
              continue;
            }

            // 过滤尺寸很小的区域（可能是单个公式符号）
            const minDimension = Math.min(width, height);
            if (minDimension < 100) {
              log.info(`过滤小尺寸区域 题目${i + 1}-图形${figIndex + 1}`, {
                area,
                width,
                height,
                minDimension
              });
              continue;
            }

            // 使用sharp切割图片
            try {
              // 确保切割区域在图片范围内
              const imgWidth = metadata.width || 0;
              const imgHeight = metadata.height || 0;

              if (minX >= imgWidth || minY >= imgHeight || maxX <= 0 || maxY <= 0) {
                log.warn(`切割区域超出图片范围 题目${i + 1}-图形${figIndex + 1}`, {
                  bbox: [minX, minY, maxX, maxY],
                  imageSize: [imgWidth, imgHeight]
                });
                continue;
              }

              const cropX = Math.max(0, minX);
              const cropY = Math.max(0, minY);
              const cropW = Math.min(width, imgWidth - cropX);
              const cropH = Math.min(height, imgHeight - cropY);

              const croppedBuffer = await sharp(originalImageBuffer)
                .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
                .jpeg({ quality: 80 })
                .toBuffer();

              // 保存切割后的图片
              const croppedFilename = `${requestId}_q${i + 1}_fig${figIndex + 1}.jpg`;
              const croppedPath = join(process.cwd(), 'public', 'temp', 'images', croppedFilename);
              await mkdir(join(process.cwd(), 'public', 'temp', 'images'), { recursive: true });
              await writeFile(croppedPath, croppedBuffer);

              const croppedUrl = `${baseUrl}/temp/images/${croppedFilename}`;

              cutImages.push({
                bbox: [minX, minY, maxX, maxY],
                label: `插图${figIndex + 1}`,
                url: croppedUrl
              });

              log.info(`图片切割成功 题目${i + 1}-图形${figIndex + 1}`, {
                bbox: [minX, minY, maxX, maxY],
                cropSize: [cropW, cropH],
                outputSize: croppedBuffer.length,
                url: croppedUrl
              });
            } catch (cropError) {
              log.warn(`切割图片失败 题目${i + 1}-图形${figIndex + 1}`, {
                error: cropError instanceof Error ? cropError.message : String(cropError)
              });
            }
          }

          // 更新题目图片
          if (cutImages.length > 0) {
            (questions[i] as any).images = cutImages;
          } else {
            // 没有切割出图片，清空images
            (questions[i] as any).images = [];
          }
        }

        log.info('图片切割完成', {
          requestId,
          questionsProcessed: questions.length
        });
      } catch (error) {
        log.error('图片切割失败', {
          requestId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // ==================== Step 5.5: 服务器端选项图片裁剪 ====================
    log.info('Step 5.5: 服务器端选项图片裁剪', { requestId });
    if (originalImageBuffer) {
      try {
        const metadata = await sharp(originalImageBuffer).metadata();
        const imgWidth = metadata.width || 1920;
        const imgHeight = metadata.height || 1080;

        let totalOptionImages = 0;

        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          if (!q.aliyunData?.info?.option || q.aliyunData.info.option.length === 0) {
            continue;
          }

          const optionImages: Array<{ bbox: number[]; label: string; url: string }> = [];

          for (let optIndex = 0; optIndex < q.aliyunData.info.option.length; optIndex++) {
            const opt = q.aliyunData.info.option[optIndex];
            const posList = opt?.pos_list?.[0];

            if (!posList || posList.length !== 8) {
              continue;
            }

            // 计算边界框
            const [x1, y1, x2, y2, x3, y3, x4, y4] = posList;
            const minX = Math.min(x1, x2, x3, x4);
            const maxX = Math.max(x1, x2, x3, x4);
            const minY = Math.min(y1, y2, y3, y4);
            const maxY = Math.max(y1, y2, y3, y4);

            const width = maxX - minX;
            const height = maxY - minY;

            // 扩展边界框，确保包含完整的选项图形
            const padding = 30;
            const cropX = Math.max(0, minX - padding);
            const cropY = Math.max(0, minY - padding);
            const cropW = Math.min(width + padding * 2, imgWidth - cropX);
            const cropH = Math.min(height + padding * 2, imgHeight - cropY);

            try {
              const croppedBuffer = await sharp(originalImageBuffer)
                .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
                .jpeg({ quality: 80 })
                .toBuffer();

              // 保存切割后的图片
              const croppedFilename = `${requestId}_q${i + 1}_opt${optIndex + 1}.jpg`;
              const croppedPath = join(process.cwd(), 'public', 'temp', 'images', croppedFilename);
              await mkdir(join(process.cwd(), 'public', 'temp', 'images'), { recursive: true });
              await writeFile(croppedPath, croppedBuffer);

              const croppedUrl = `${baseUrl}/temp/images/${croppedFilename}`;

              optionImages.push({
                bbox: [minX, minY, maxX, maxY],
                label: `选项${opt.text?.trim() || String.fromCharCode(65 + optIndex)}`,
                url: croppedUrl
              });

              totalOptionImages++;

              log.info(`选项图片切割成功 题目${i + 1}-选项${optIndex + 1}`, {
                bbox: [minX, minY, maxX, maxY],
                cropSize: [cropW, cropH],
                outputSize: croppedBuffer.length,
                url: croppedUrl
              });
            } catch (cropError) {
              log.warn(`选项图片切割失败 题目${i + 1}-选项${optIndex + 1}`, {
                error: cropError instanceof Error ? cropError.message : String(cropError)
              });
            }
          }

          // 将裁剪后的选项图片存储到题目数据中
          if (optionImages.length > 0) {
            (questions[i] as any).optionCroppedImages = optionImages;
          }
        }

        log.info('选项图片切割完成', {
          requestId,
          totalOptionImages
        });
      } catch (error) {
        log.error('选项图片切割失败', {
          requestId,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // ==================== Step 6: 提取选项图形 ====================
    log.info('Step 6: 提取选项图形', { requestId });
    let enrichedQuestions;
    try {
      enrichedQuestions = questions.map(q => {
        if (q.aliyunData) {
          const enriched = enrichQuestionWithOptions(q.aliyunData, tempImageUrl);

          // 将optionImages合并到options数组中
          const optionsWithImages = (q.options || []).map((opt, idx) => {
            const optionImage = enriched.optionImages?.[idx];
            const optionText = typeof opt === 'string' ? opt : opt.text || '';

            // 判断选项是否需要图片
            // 如果选项文本已包含完整LaTeX公式，就不需要显示图片
            // 检测 $...$ 或 $$...$$ 包裹的公式
            const hasMathDelimiters = /\$\$?[^\$]+\$\$?/.test(optionText);
            // 检测 LaTeX 命令（如 \frac, \sqrt, \text 等）
            const hasLatexCommands = /\\[a-zA-Z]+/.test(optionText);
            // 检测下标/上标模式 (如 _{...} 或 ^{...})
            const hasSubSuperscript = /[\_\^]\{/.test(optionText);
            // 检测独立下标（如 W_F 或 x^2）
            const hasSimpleSubSuperscript = /[a-zA-Z][\_\^][a-zA-Z0-9]/.test(optionText);

            const hasLatexFormula = hasMathDelimiters || hasLatexCommands || hasSubSuperscript || hasSimpleSubSuperscript;

            // 特殊情况：如果选项文本只是字母（如A、B、C、D），可能包含图形，需要显示图片
            const isOnlyLetters = /^[A-Z]$/.test(optionText.trim());
            const isVeryShortText = optionText.length < 10;

            // 只有以下情况不需要图片：
            // 1. 包含LaTeX公式（公式已经用文字表达了）
            // 2. 文本较长（>=10字符）且不是纯字母
            const needsImage = !hasLatexFormula && (isOnlyLetters || !isVeryShortText);

            // 调试日志 - 显示所有选项
            log.info(`选项图片判断`, {
              questionId: q.id,
              optionIndex: idx,
              optionText: optionText.substring(0, 50),
              textLength: optionText.length,
              hasMathDelimiters,
              hasLatexCommands,
              hasSubSuperscript,
              hasSimpleSubSuperscript,
              hasLatexFormula,
              isVeryShortText,
              needsImage,
              hasExistingImages: typeof opt !== 'string' && !!(opt as any).images?.length
            });

            // 只有需要图片的选项才添加images
            if (opt && needsImage) {
              // 优先使用服务器端裁剪的选项图片
              const serverCroppedImage = (q as any).optionCroppedImages?.[idx];
              const imageUrl = serverCroppedImage?.url || opt.croppedImage || optionImage?.imageUrl || '';
              const bbox = serverCroppedImage?.bbox || opt.bbox_2d || optionImage?.bbox || [];

              // 将croppedImage转换为小程序期望的images格式
              if (imageUrl) {
                return {
                  ...opt,
                  images: [
                    {
                      bbox: bbox || [],
                      label: `选项${opt.text?.trim() || ''}`,
                      url: imageUrl
                    }
                  ]
                };
              }
            }

            // 不需要图片的选项，明确删除images字段
            const { images, ...optionWithoutImages } = opt as any;
            return optionWithoutImages;
          });

          return {
            ...q,
            options: optionsWithImages,
            optionImages: enriched.optionImages
          } as typeof q & {
            optionImages?: typeof enriched.optionImages;
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

    // ==================== Step 6: 连续性验证 ====================
    log.info('Step 6: 连续性验证', { requestId });

    let validation;
    try {
      // 转换为验证模块期望的格式
      const questionsForValidation = questions.map(q => ({
        id: q.id,
        content: q.content,
        type: q.type,
        options: (q.options || []).map(opt => typeof opt === 'string' ? opt : opt.text)
      }));

      validation = validateQuestionContinuity(questionsForValidation);

      log.info('连续性验证完成', {
        requestId,
        isValid: validation.isValid,
        score: validation.score,
        issueCount: validation.issues.length,
        errorCount: validation.issues.filter(i => i.severity === 'error').length
      });

      // 如果有错误级别的问题，记录警告
      if (!validation.isValid) {
        log.warn('连续性验证发现问题', {
          requestId,
          issues: validation.issues.map(i => ({ type: i.type, message: i.message }))
        });
      }
    } catch (error) {
      log.error('连续性验证失败', {
        requestId,
        error: error instanceof Error ? error.message : String(error)
      });
      // 验证失败不影响主流程
    }

    // 暂时禁用临时文件清理，测试图片显示
    // TODO: 确认图片正常显示后，恢复延迟删除逻辑
    // setTimeout(() => {
    //   cleanupTempImageFile(tempImageUrl).catch(error => {
    //     log.warn('清理临时文件失败', { error, tempImageUrl });
    //   });
    // }, 5 * 60 * 1000);

    log.info('临时文件清理已禁用（测试模式）', {
      tempImageUrl
    });

    // ==================== Step 7: 返回结果 ====================
    const result = {
      status: 'success',
      mode: 'aliyun-edututor',
      markdown: (questions || []).map(q => q.content || '').join('\n\n'),
      questions: enrichedQuestions,
      originalImage: image,
      summary: {
        total_questions: enrichedQuestions.length,
        markdown_length: (questions || []).map(q => q.content || '').join('\n\n').length,
        questions_with_images: (questions || []).filter(q => q.images && q.images.length > 0).length,
        questions_with_options: (questions || []).filter(q => q.options && q.options.length > 0).length,
        total_option_images: totalOptionImages
      },
      validation: validation ? {
        isValid: validation.isValid,
        score: validation.score,
        issueCount: validation.issues.length,
        errorCount: validation.issues.filter(i => i.severity === 'error').length,
        warningCount: validation.issues.filter(i => i.severity === 'warning').length,
        issues: validation.issues,
        suggestions: validation.suggestions
      } : undefined,
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        method: 'aliyun-edututor',
        version: '6.4.0',
        preprocessUsed
      }
    };

    log.info('阿里云EduTutor 流程完成（V6.4.0 - 增强版）', {
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
  return `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/temp/images/${filename}`;
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
