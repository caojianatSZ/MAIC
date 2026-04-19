// app/api/diagnosis/photo-latex/route.ts
/**
 * 试卷拍照批改 API V5 - GLM-OCR专业OCR
 *
 * 核心理念：使用GLM-OCR专业OCR模型，而非GLM-4V多模态
 *
 * 架构：
 * 图像 → GLM-OCR（专业OCR）→ Markdown → 轻量解析 → LaTeX转换 → 判题
 *
 * 优势：
 * - GLM-OCR: 0.9B参数，94.6分SOTA
 * - 价格：0.2元/百万Tokens（比GLM-4V便宜10倍）
 * - 输出：Markdown（保留版面结构）
 * - 支持：复杂表格、公式、图文混排
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import {
  recognizeFromBase64,
  type GLMOCRResult
} from '@/lib/glm/glm-ocr-client';

const log = createLogger('PhotoLatex');

export async function GET() {
  return NextResponse.json({
    name: '试卷拍照批改 API V5 (GLM-OCR)',
    version: '5.0.0',
    description: '使用GLM-OCR专业OCR模型进行试卷识别',
    features: [
      '✅ GLM-OCR专业OCR（0.9B参数，94.6分SOTA）',
      '✅ 输出保留版面结构的Markdown',
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
      step3: 'LaTeX转换（可选）',
      step4: '判题（GLM文本模型）'
    },
    usage: 'POST /api/diagnosis/photo-latex',
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
      return_images: true,  // 启用图片返回
      timeout: 60000
    });

    log.info('GLM-OCR 识别完成', {
      requestId,
      markdownLength: ocrResult.markdown.length,
      preview: ocrResult.markdown.substring(0, 200)
    });

    // ==================== Step 2: 解析Markdown提取题目 ====================
    log.info('Step 2: 解析题目', { requestId });

    // 提取图片坐标信息
    const imageCoordinates = extractImageCoordinates(ocrResult.markdown);

    log.info('提取到的图片坐标', {
      requestId,
      imageCount: imageCoordinates.length,
      images: JSON.stringify(imageCoordinates)
    });

    // 优先使用layout_details，如果没有则使用Markdown
    const layoutDetails = ocrResult.raw?.layout_details;
    const questions = layoutDetails
      ? parseQuestionsFromLayoutDetails(layoutDetails)
      : parseQuestionsFromMarkdown(ocrResult.markdown, {
          convertToLatex: true
        });

    // 为每个题目关联附近的图片
    const questionsWithImages = associateImagesWithQuestions(questions, imageCoordinates);

    log.info('题目解析完成', {
      requestId,
      questionCount: questions.length,
      parseMethod: layoutDetails ? 'layout_details' : 'markdown',
      imagesAssociated: questionsWithImages.filter(q => q.images && q.images.length > 0).length
    });

    // ==================== Step 3: 返回结果 ====================
    const result = {
      status: 'success',
      mode: 'glm-ocr',
      markdown: ocrResult.markdown,
      questions: questionsWithImages,  // 使用包含图片坐标的题目
      originalImage: image,  // 包含原始图片base64
      imageCoordinates: imageCoordinates,  // 包含所有图片坐标
      images: ocrResult.images || [],  // 包含图片URL
      raw: ocrResult.raw,  // 包含layout_details
      summary: {
        total_questions: questionsWithImages.length,
        markdown_length: ocrResult.markdown.length,
        ocr_confidence: ocrResult.confidence || 0.95,
        images_count: imageCoordinates.length,
        has_original_image: !!image,
        questions_with_images: questionsWithImages.filter(q => q.images && q.images.length > 0).length
      },
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        method: 'glm-ocr',
        version: '5.2.0'  // 更新版本号
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
 * 提取Markdown中的图片坐标信息
 */
function extractImageCoordinates(markdown: string): Array<{
  bbox: number[];
  page: number;
  label?: string;
}> {
  const images: Array<{ bbox: number[]; page: number; label?: string }> = [];

  // 匹配Markdown图片引用：![](page=0,bbox=[x1,y1,x2,y2])
  const imagePattern = /!\[\]\(page=(\d+),bbox=\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\)\](?:\([^\)]*\))?/g;

  let match;
  while ((match = imagePattern.exec(markdown)) !== null) {
    images.push({
      page: parseInt(match[1]),
      bbox: [
        parseInt(match[2]),  // x1
        parseInt(match[3]),  // y1
        parseInt(match[4]),  // x2
        parseInt(match[5])   // y2
      ],
      label: match[6] || undefined
    });
  }

  return images;
}

/**
 * 将图片坐标与题目关联
 */
function associateImagesWithQuestions(
  questions: Array<any>,
  imageCoordinates: Array<{ bbox: number[]; page: number; label?: string }>
): Array<any> {
  if (!imageCoordinates || imageCoordinates.length === 0) {
    return questions;
  }

  return questions.map((question, index) => {
    // 找到与该题目相关的图片
    const relatedImages: Array<{ bbox: number[]; label?: string }> = [];

    // 策略：查找出现在题目内容中的图片引用
    if (question.content) {
      // 查找题目中的图片标签（如"图17-1"）
      const imageLabelPattern = /图\s*(\d+[\-\.]?\d*)/g;
      const labelsInQuestion: string[] = [];
      let match;
      while ((match = imageLabelPattern.exec(question.content)) !== null) {
        labelsInQuestion.push(match[1]);
      }

      // 根据标签匹配图片坐标
      if (labelsInQuestion.length > 0) {
        imageCoordinates.forEach(img => {
          if (img.label && labelsInQuestion.some(label => img.label.includes(label))) {
            relatedImages.push({
              bbox: img.bbox,
              label: img.label
            });
          }
        });
      }

      // 备选策略：如果题目在前半部分，使用前几个图片
      if (relatedImages.length === 0 && index < imageCoordinates.length) {
        relatedImages.push({
          bbox: imageCoordinates[index].bbox,
          label: imageCoordinates[index].label
        });
      }
    }

    return {
      ...question,
      images: relatedImages
    };
  });
}

/**
 * 从GLM-OCR的layout_details解析题目（更准确）
 */
/**
 * 从GLM-OCR的layout_details解析题目（更准确）
 */
function parseQuestionsFromLayoutDetails(
  layoutDetails: any[][]
): Array<{
  id: string;
  content: string;
  type: 'choice' | 'fill_blank' | 'essay';
  options?: string[];
  formulas?: Array<{ latex: string; raw: string; location: string }>;
}> {
  const questions: Array<{
    id: string;
    content: string;
    type: 'choice' | 'fill_blank' | 'essay';
    options?: string[];
    formulas?: Array<{ latex: string; raw: string; location: string }>;
  }> = [];

  // 获取第一页的blocks（layout_details是分页的数组）
  const blocks = layoutDetails[0] || [];

  // 按Y坐标排序（从上到下）
  const sortedBlocks = blocks
    .filter(block => block.label === 'text')
    .sort((a, b) => a.bbox_2d[1] - b.bbox_2d[1]);

  let currentQuestion: any = null;
  let questionNumber = 0;

  for (const block of sortedBlocks) {
    const content = block.content.trim();
    if (!content) continue;

    // 更灵活的题目编号检测
    const isQuestionStart =
      content.match(/^(\d+)[\.\s\、\．]/) ||  // 数字开头：22.
      content.match(/^([一二三四五六七八九十]+)[\.\s\、\．]/) ||  // 中文数字
      content.match(/^\(([0-9]+)\)/) ||  // 括号数字：(22)
      content.match(/^（[0-9]{4}·/);  // （2011·江苏·4.3分

    log.info('解析block', {
      blockIndex: questions.length,
      contentPreview: content.substring(0, 50),
      isQuestionStart: !!isQuestionStart,
      currentQuestionExists: !!currentQuestion
    });

    if (isQuestionStart) {
      // 保存上一题
      if (currentQuestion) {
        questions.push(currentQuestion);
      }

      // 开始新题目
      questionNumber++;

      // 检查content中是否包含选项
      const hasEmbeddedOptions = content.includes('A.') || content.includes('B.') ||
                                 content.includes('C.') || content.includes('D.');

      if (hasEmbeddedOptions) {
        // 分割题目内容和选项
        const { questionText, optionTexts } = splitQuestionAndOptions(content);

        currentQuestion = {
          id: String(questionNumber),
          content: questionText,
          type: 'choice' as const,
          options: optionTexts,
          formulas: extractFormulas(questionText)
        };
      } else {
        currentQuestion = {
          id: String(questionNumber),
          content: content,
          type: 'essay' as const,
          options: [],
          formulas: extractFormulas(content)
        };
      }
    } else if (currentQuestion) {
      // 检测是否包含选项标记
      const hasOptions = content.includes('A.') || content.includes('B.') ||
                         content.includes('C.') || content.includes('D.');

      if (hasOptions) {
        currentQuestion.type = 'choice' as const;

        // 尝试分割选项（处理同一行多个选项的情况）
        const optionParts = content
          .replace(/([A-D])\./g, '\n$1.')
          .split('\n')
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0);

        for (const part of optionParts) {
          if (part.match(/^[A-D][\.\s]/)) {
            currentQuestion.options!.push(part);
          } else if (part.length > 0 && part.length < 100) {
            // 短文本，可能是选项的延续
            if (currentQuestion.options!.length > 0) {
              currentQuestion.options![currentQuestion.options!.length - 1] += ' ' + part;
            }
          }
        }
      } else if (content.length > 0 && content.length < 500) {
        // 添加到题目内容
        if (content.startsWith('A.') || content.startsWith('B.') ||
            content.startsWith('C.') || content.startsWith('D.')) {
          currentQuestion.type = 'choice' as const;
          currentQuestion.options!.push(content);
        } else {
          currentQuestion.content += '\n' + content;
        }
      }
    }
  }

  // 保存最后一题
  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  return questions;
}

/**
 * 分割题目内容和选项（改进版：支持同一行多个选项）
 */
function splitQuestionAndOptions(
  content: string
): { questionText: string; optionTexts: string[] } {
  let questionText = content;
  const optionTexts: string[] = [];

  // 检测是否包含选项
  const hasOptionA = content.match(/[\s\n](A)\.\s*/);
  const hasOptionB = content.match(/[\s\n](B)\.\s*/);
  const hasOptionC = content.match(/[\s\n](C)\.\s*/);
  const hasOptionD = content.match(/[\s\n](D)\.\s*/);

  const hasOptions = hasOptionA || hasOptionB || hasOptionC || hasOptionD;

  if (!hasOptions) {
    return { questionText: content, optionTexts: [] };
  }

  // 找到第一个选项的位置
  const firstOptionMatch = content.search(/[\s\n](A)\.\s*/);
  if (firstOptionMatch === -1) {
    return { questionText: content, optionTexts: [] };
  }

  // 分割题目内容和选项部分
  questionText = content.substring(0, firstOptionMatch).trim();

  // 处理选项部分：在每个选项字母前添加换行符，便于分割
  const optionsPart = content.substring(firstOptionMatch);

  // 在选项字母前添加换行符（排除已经是换行的情况）
  const normalizedOptions = optionsPart
    .replace(/([A-D])\.\s*/g, '\n$1. ')
    .replace(/^\n+/, '') // 移除开头的多余换行
    .trim();

  // 分割选项
  const optionLines = normalizedOptions.split('\n').map(line => line.trim()).filter(line => line.length > 0);

  for (const line of optionLines) {
    // 检查是否是选项行
    const optionMatch = line.match(/^([A-D])\.\s*(.*)/);
    if (optionMatch) {
      const label = optionMatch[1];
      let optionText = optionMatch[2];

      // 移除图片引用
      optionText = optionText.replace(/!*\[.*?\]\(.*?\)/g, '').trim();

      // 移除可能的后续选项标签（如 A. xxx B. yyy 的情况）
      optionText = optionText.replace(/\s*[A-D]\.\s.*$/, '').trim();

      if (optionText.length > 0) {
        optionTexts.push(`${label}. ${optionText}`);
      }
    }
  }

  return { questionText, optionTexts };
}

/**
 * 从Markdown解析题目（支持LaTeX转换）
 */
function parseQuestionsFromMarkdown(
  markdown: string,
  options: { convertToLatex?: boolean }
): Array<{
  id: string;
  content: string;
  type: 'choice' | 'fill_blank' | 'essay';
  options?: string[];
  formulas?: Array<{ latex: string; raw: string; location: string }>;
}> {
  const questions: Array<{
    id: string;
    content: string;
    type: 'choice' | 'fill_blank' | 'essay';
    options?: string[];
    formulas?: Array<{ latex: string; raw: string; location: string }>;
  }> = [];

  // 简单的题目分割逻辑
  const lines = markdown.split('\n');
  let currentQuestion: any = null;
  let questionNumber = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // 检测题目编号
    const questionMatch = trimmed.match(/^(\d+)[\.\s\、\．]/);

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
        options: [],
        formulas: []
      };
    } else if (currentQuestion) {
      // 检测选项
      const optionMatch = trimmed.match(/^([A-D])[\.\s\、\．](.*)/);

      if (optionMatch) {
        currentQuestion.type = 'choice' as const;
        currentQuestion.options!.push(trimmed);
      } else if (trimmed.length > 0) {
        // 添加到题目内容
        currentQuestion.content += '\n' + trimmed;
      }
    }
  }

  // 保存最后一题
  if (currentQuestion) {
    questions.push(currentQuestion);
  }

  // 如果需要转换为LaTeX
  if (options.convertToLatex) {
    for (const q of questions) {
      q.content = convertToLatexFormat(q.content);
      q.options = q.options?.map(opt => convertToLatexFormat(opt));
      q.formulas = extractFormulas(q.content);
    }
  }

  return questions;
}

/**
 * 转换为LaTeX格式
 */
function convertToLatexFormat(text: string): string {
  // 简单的公式转换规则
  let result = text;

  // 分数：1/2 → \frac{1}{2}
  result = result.replace(/(\d+)\s*\/\s*(\d+)/g, '\\\\frac{$1}{$2}');

  // 根号：√3 → \sqrt{3}
  result = result.replace(/√(\d+)/g, '\\\\sqrt{$1}');

  // 下标：v1 → v_1, F1 → F_1
  result = result.replace(/([a-zA-Z])_?(\d)/g, '$1_{$2}');

  // 用$...$包裹公式
  result = wrapFormulas(result);

  return result;
}

/**
 * 提取公式
 */
function extractFormulas(text: string): Array<{ latex: string; raw: string; location: string }> {
  const formulas: Array<{ latex: string; raw: string; location: string }> = [];

  // 提取$...$包裹的内容
  const regex = /\$([^$]+)\$/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    formulas.push({
      latex: match[1],
      raw: match[1].replace(/\\/g, ''),
      location: 'question'
    });
  }

  return formulas;
}

/**
 * 用$...$包裹公式
 */
function wrapFormulas(text: string): string {
  let result = text;

  // 包含下标的内容：v1, F2
  result = result.replace(/([a-zA-Z])_?(\d+)/g, '$$$1_{$2}$$');

  // 数字运算：1+2=3
  result = result.replace(/(\d+\s*[\+\-\*\/]\s*\d+\s*[=<>]\s*\d+)/g, '$$$1$$');

  return result;
}
