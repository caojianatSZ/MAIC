import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { edukgAdapter } from '@/lib/edukg/adapter';
import { createLogger } from '@/lib/logger';
import sharp from 'sharp';

const log = createLogger('Photo Diagnosis');

/**
 * 拍照诊断 API
 * POST /api/diagnosis/photo
 *
 * 流程：
 * 1. OCR识别题目内容
 * 2. 使用AI分析题目结构和知识点
 * 3. 匹配EduKG知识点
 * 4. 如果有答案，判断对错
 * 5. 生成诊断结果
 */
export const maxDuration = 30;

interface PhotoDiagnosisRequest {
  imageUrl?: string;
  imageBase64?: string;
  subject?: string;  // 学科，默认math
  grade?: string;    // 年级，默认初三
}

interface Question {
  id: string;
  content: string;
  type: 'choice' | 'fill_blank' | 'essay' | 'unknown';
  options?: string[];
  studentAnswer?: string;
  correctAnswer?: string;
  isCorrect?: boolean;
  knowledgePoints: Array<{
    id: string;
    name: string;
    uri?: string;
  }>;
  analysis?: string;
}

interface PhotoDiagnosisResponse {
  ocrText: string;
  questions: Question[];
  summary: {
    totalQuestions: number;
    correctCount: number;
    knowledgePoints: string[];
  };
}

/**
 * 工具函数：File转Base64（JPEG转PNG，使用极简格式）
 * GLM-4V只支持PNG格式，且对格式有严格要求
 */
async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);

  // 使用Sharp将图片转换为PNG格式
  // 限制图片尺寸为512x512以内，使用最基础的PNG格式
  const pngBuffer = await sharp(inputBuffer)
    .resize(512, 512, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .png({
      compressionLevel: 6
    })
    .toBuffer();

  // GLM-4V只支持PNG格式的base64图片
  return `data:image/png;base64,${pngBuffer.toString('base64')}`;
}

export async function POST(request: NextRequest) {
  try {
    // 检查请求类型
    const contentType = request.headers.get('content-type') || '';

    let imageBase64: string | undefined;
    let imageUrl: string | undefined;
    let subject = 'math';
    let grade = '初三';

    if (contentType.includes('multipart/form-data')) {
      // 处理文件上传请求
      const formData = await request.formData();
      const file = formData.get('file') as File;
      subject = (formData.get('subject') as string) || 'math';
      grade = (formData.get('grade') as string) || '初三';

      if (!file) {
        return apiError('MISSING_REQUIRED_FIELD', 400, '请上传图片文件');
      }

      log.info('开始拍照诊断(文件上传)', { subject, grade, fileName: file.name, fileSize: file.size });

      // 将文件转换为Base64
      imageBase64 = await fileToBase64(file);

    } else {
      // 处理JSON请求
      const body: PhotoDiagnosisRequest = await request.json();
      imageUrl = body.imageUrl;
      imageBase64 = body.imageBase64;
      subject = body.subject || 'math';
      grade = body.grade || '初三';

      // 验证参数
      if (!imageUrl && !imageBase64) {
        return apiError('MISSING_REQUIRED_FIELD', 400, '请提供图片URL或Base64');
      }

      log.info('开始拍照诊断', { subject, grade, hasImage: !!imageUrl || !!imageBase64 });
    }

    // 步骤1: OCR识别
    log.info('步骤1: OCR识别中...');
    const ocrText = await performOCR(imageUrl || imageBase64!);
    log.info('OCR识别完成', { textLength: ocrText.length });

    // 步骤2: 使用AI分析题目
    log.info('步骤2: AI分析题目中...');
    const questions = await analyzeQuestions(ocrText, subject, grade);
    log.info('题目分析完成', { questionCount: questions.length });

    // 步骤3: 为每个题目匹配EduKG知识点
    log.info('步骤3: 匹配EduKG知识点...');
    for (const question of questions) {
      const knowledgePoints = await matchKnowledgePoints(question.content, subject);
      question.knowledgePoints = knowledgePoints;
    }
    log.info('知识点匹配完成');

    // 步骤4: 如果有学生答案，判断对错
    log.info('步骤4: 判断答案对错...');
    for (const question of questions) {
      if (question.studentAnswer) {
        const judgment = await judgeAnswer(question);
        question.correctAnswer = judgment.correctAnswer;
        question.isCorrect = judgment.isCorrect;
        question.analysis = judgment.analysis;
      }
    }
    log.info('答案判断完成');

    // 步骤5: 生成诊断总结
    const summary = generateSummary(questions);

    const response: PhotoDiagnosisResponse = {
      ocrText,
      questions,
      summary
    };

    log.info('拍照诊断完成', summary);
    return apiSuccess(response as unknown as Record<string, unknown>);

  } catch (error) {
    log.error('拍照诊断失败', error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? error.message : '拍照诊断失败，请稍后重试'
    );
  }
}

/**
 * 步骤1: 使用GLM-4V视觉模型识别图片内容
 * GLM-4V可以理解图片内容，并按要求格式化数学公式
 */
async function performOCR(imageBase64: string): Promise<string> {
  const ZHIPU_API_KEY = process.env.GLM_API_KEY;

  if (!ZHIPU_API_KEY) {
    throw new Error('GLM服务未配置，请设置GLM_API_KEY');
  }

  try {
    // 提取MIME类型和base64数据
    const mimeMatch = imageBase64.match(/^data:([^;]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const base64Data = imageBase64.split(',')[1] || imageBase64;
    const maxSize = 10 * 1024 * 1024;
    if (base64Data.length > maxSize) {
      throw new Error('图片太大，请使用小于10MB的图片');
    }

    log.info('使用GLM-4V视觉模型进行OCR识别', { mimeType, base64Length: base64Data.length });

    // 构建OCR识别的prompt，要求正确格式化公式
    const ocrPrompt = `请识别这张图片中的所有题目内容。

重要格式要求：
1. 数学公式必须使用LaTeX格式，并用$符号包裹
2. 例如：下标F_{1}、上标v^{2}、分数\\frac{a}{b}、根号\\sqrt{x}、希腊字母\\alpha、\\beta、\\omega等
3. 题目编号要保留（如：1、2、(1)、2011·江苏等）
4. 选择题选项要完整提取（A、B、C、D）
5. 只返回识别的文本内容，不要有额外的说明

请按Markdown格式返回所有题目内容。`;

    // 使用GLM-4V进行图片识别，保留原始MIME类型
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ZHIPU_API_KEY}`
      },
      body: JSON.stringify({
        model: 'glm-4v',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Data}`
                }
              },
              {
                type: 'text',
                text: ocrPrompt
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 16000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('GLM-4V API错误', { status: response.status, error: errorText });
      throw new Error(`GLM-4V请求失败: ${response.status}`);
    }

    const result = await response.json();

    if (result.error) {
      log.error('GLM-4V返回错误', result.error);
      throw new Error(result.error.message || 'GLM-4V识别失败');
    }

    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('GLM-4V返回为空');
    }

    // 记录OCR识别结果
    log.info('OCR识别结果', { textLength: content.length, preview: content.substring(0, 500) });

    return content;

  } catch (error) {
    log.error('GLM-4V识别失败', error);
    throw new Error('图片识别失败，请重试');
  }
}/**
 * 步骤2: AI分析题目结构
 */
async function analyzeQuestions(
  ocrText: string,
  subject: string,
  grade: string
): Promise<Question[]> {
  // 使用GLM-4分析题目
  const GLM_API_KEY = process.env.GLM_API_KEY;
  if (!GLM_API_KEY) {
    throw new Error('GLM服务未配置');
  }

  const prompt = `你是一个专业的学科题目分析专家。请从以下OCR识别的文本中提取所有题目（可能是数学、物理、化学等科目）。

文本内容：
${ocrText}

请分析并返回JSON格式，务必提取文本中的所有题目：
{
  "questions": [
    {
      "id": "题目编号（如1、2、22、(1)等，如果图片中没有明确编号，按顺序编为Q1、Q2、Q3...）",
      "content": "题目完整内容（包括题干）",
      "type": "题目类型（choice选择题/fill_blank填空题/essay解答题/unknown未知）",
      "options": ["选项A内容", "选项B内容", "选项C内容", "选项D内容"],  // 仅选择题有
      "studentAnswer": "学生填写的答案（如果识别到）"  // 可选
    }
  ]
}

重要注意事项：
1. 必须提取文本中的所有题目，不要遗漏任何一道题
2. 题目编号可以包含年份信息（如"2011·江苏·4.3分"）或纯数字编号
3. 选择题要提取所有选项（A、B、C、D等）
4. 如果能识别出学生填写的答案（如打了勾、填写的字母等），请包含studentAnswer字段
5. 填空题的答案可能是横线后的内容
6. 解答题可能没有标准答案格式
7. 如果图片中包含多个小题，请分别提取`;

  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GLM_API_KEY}`
      },
      body: JSON.stringify({
        model: 'glm-4',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 16000
      })
    });

    if (!response.ok) {
      log.error('GLM API请求失败', { status: response.status });
      throw new Error('AI分析失败');
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('AI返回为空');
    }

    // 记录AI返回的原始内容用于调试
    log.info('AI分析原始返回', { contentLength: content.length, preview: content.substring(0, 1000) });

    // 解析JSON响应 - 首先移除markdown代码块标记
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    // 提取JSON对象（从第一个{到最后一个}）
    const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('无法解析AI返回的JSON');
    }

    log.info('AI分析JSON匹配', { matchLength: jsonMatch[0].length });

    let questions: Question[] = [];
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      questions = parsed.questions || [];
    } catch (parseError: unknown) {
      // 如果直接解析失败，尝试修复常见的JSON问题
      const errorMsg = parseError instanceof Error ? parseError.message : String(parseError);
      log.warn('JSON解析失败，尝试修复', { error: errorMsg });

      // 尝试使用Function构造函数（比eval安全）解析
      try {
        const jsonString = jsonMatch[0];
        const parseFn = new Function('return ' + jsonString);
        const parsed = parseFn();
        questions = parsed.questions || [];
      } catch (fnError: unknown) {
        throw new Error(`JSON解析失败: ${errorMsg}`);
      }
    }

    log.info('AI分析解析结果', { questionsCount: questions.length });

    // 初始化知识点字段
    questions.forEach(q => {
      q.knowledgePoints = [];
    });

    return questions;

  } catch (error) {
    log.error('AI分析题目失败', error);

    // 降级方案：返回单个未知类型的题目
    return [{
      id: '1',
      content: ocrText.substring(0, 200),
      type: 'unknown',
      knowledgePoints: []
    }];
  }
}

/**
 * 步骤3: 匹配EduKG知识点
 */
async function matchKnowledgePoints(
  questionContent: string,
  subject: string
): Promise<Array<{ id: string; name: string; uri?: string }>> {
  try {
    // 使用GLM提取关键词
    const GLM_API_KEY = process.env.GLM_API_KEY;
    if (!GLM_API_KEY) {
      return [];
    }

    const prompt = `请从以下数学题目中提取2-3个最重要的知识点关键词。

题目：${questionContent}

只返回关键词，用空格分隔，不超过10个字。`;

    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GLM_API_KEY}`
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      })
    });

    const keywords = (await response.json())
      .choices?.[0]?.message?.content
      ?.trim()
      ?.split(/\s+/) || [];

    log.info('提取的关键词', { keywords });

    // 使用EduKG搜索相关知识点
    const matchedPoints: Array<{ id: string; name: string; uri?: string }> = [];

    for (const keyword of keywords.slice(0, 3)) {
      try {
        const searchResults = await edukgAdapter.searchKnowledgePoints(keyword, subject);

        // searchKnowledgePoints 返回的格式
        if (searchResults && searchResults.length > 0) {
          const entity = searchResults[0];
          const id = `kp_${entity.id || entity.uri?.split('/').pop()}`;

          // 避免重复
          if (!matchedPoints.find(p => p.id === id)) {
            matchedPoints.push({
              id,
              name: entity.label || entity.name || keyword,
              uri: entity.uri
            });
          }
        }
      } catch (error) {
        log.warn('EduKG搜索失败', { keyword, error });
      }
    }

    return matchedPoints;

  } catch (error) {
    log.error('匹配知识点失败', error);
    return [];
  }
}

/**
 * 步骤4: 判断答案对错
 */
async function judgeAnswer(question: Question): Promise<{
  correctAnswer: string;
  isCorrect: boolean;
  analysis: string;
}> {
  const GLM_API_KEY = process.env.GLM_API_KEY;
  if (!GLM_API_KEY) {
    throw new Error('GLM服务未配置');
  }

  const prompt = `你是一个专业的数学老师。请判断以下题目的答案是否正确。

题目：${question.content}
${question.options ? `选项：\n${question.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join('\n')}` : ''}
学生答案：${question.studentAnswer}

请返回JSON格式：
{
  "correctAnswer": "正确答案（如果是选择题，填选项字母；填空题填答案内容）",
  "isCorrect": true/false,
  "analysis": "简要分析（说明为什么对，或错在哪里）"
}

注意：
1. 选择题：判断选项是否正确
2. 填空题：判断答案是否合理（可能有多种表述方式）
3. 如果学生答案为空或不清楚，isCorrect设为false
4. analysis要简洁明了，适合家长理解`;

  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GLM_API_KEY}`
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      })
    });

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('AI返回为空');
    }

    // 解析JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('无法解析AI返回的JSON');
    }

    return JSON.parse(jsonMatch[0]);

  } catch (error) {
    log.error('判断答案失败', error);

    // 降级方案：无法判断，返回默认值
    return {
      correctAnswer: '未知',
      isCorrect: false,
      analysis: 'AI无法判断该题目的对错，建议家长手动检查'
    };
  }
}

/**
 * 步骤5: 生成诊断总结
 */
function generateSummary(questions: Question[]): {
  totalQuestions: number;
  correctCount: number;
  knowledgePoints: string[];
} {
  const totalQuestions = questions.length;
  const correctCount = questions.filter(q => q.isCorrect === true).length;

  // 收集所有知识点
  const allKnowledgePoints = new Set<string>();
  questions.forEach(q => {
    q.knowledgePoints.forEach(kp => {
      allKnowledgePoints.add(kp.name);
    });
  });

  return {
    totalQuestions,
    correctCount,
    knowledgePoints: Array.from(allKnowledgePoints)
  };
}

/**
 * 工具函数：Blob转Base64
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * GET请求说明
 */
export async function GET() {
  return NextResponse.json({
    message: '拍照诊断接口',
    method: 'POST',
    parameters: {
      imageUrl: '图片云存储URL（可选）',
      imageBase64: '图片Base64编码（可选）',
      subject: '学科（可选，默认math）',
      grade: '年级（可选，默认初三）'
    },
    flow: [
      '1. OCR识别题目内容',
      '2. AI分析题目结构和知识点',
      '3. 匹配EduKG知识点',
      '4. 如果有答案，判断对错',
      '5. 生成诊断结果'
    ],
    example: {
      request: {
        imageUrl: 'cloud://...',
        subject: 'math',
        grade: '初三'
      },
      response: {
        ocrText: '识别的完整文本',
        questions: [
          {
            id: '1',
            content: '题目内容',
            type: 'choice',
            options: ['A', 'B', 'C', 'D'],
            studentAnswer: 'A',
            correctAnswer: 'A',
            isCorrect: true,
            knowledgePoints: [
              { id: 'kf_003', name: '配方法求顶点' }
            ],
            analysis: '答案正确'
          }
        ],
        summary: {
          totalQuestions: 3,
          correctCount: 2,
          knowledgePoints: ['配方法求顶点', '二次函数图像']
        }
      }
    }
  });
}
