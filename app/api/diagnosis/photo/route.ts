import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import { edukgAdapter } from '@/lib/edukg/adapter';
import { createLogger } from '@/lib/logger';

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
 * 工具函数：File转Base64
 */
async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return `data:${file.type};base64,${buffer.toString('base64')}`;
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
 * 步骤1: OCR识别题目
 */
async function performOCR(imageSource: string): Promise<string> {
  const ZHIPU_OCR_URL = 'https://open.bigmodel.cn/api/paas/v4/files/ocr';
  const ZHIPU_API_KEY = process.env.GLM_API_KEY;

  if (!ZHIPU_API_KEY) {
    throw new Error('OCR服务未配置，请设置GLM_API_KEY');
  }

  try {
    // 如果是Base64，转换为文件
    let imageBody: string | File;

    if (imageSource.startsWith('data:image')) {
      // 直接使用Base64
      imageBody = imageSource;
    } else {
      // 如果是URL，先下载图片
      const imageResponse = await fetch(imageSource);
      if (!imageResponse.ok) {
        throw new Error('图片下载失败');
      }
      const blob = await imageResponse.blob();
      // 将Blob转换为Base64
      imageBody = await blobToBase64(blob);
    }

    // 准备FormData（智谱OCR需要multipart/form-data）
    // 注意：这里需要将Base64转换为实际的文件上传
    // 简化处理：直接调用 /api/ocr 接口
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const ocrResponse = await fetch(`${baseUrl}/api/ocr`, {
      method: 'POST',
      body: JSON.stringify({ text: imageBody }),
      headers: { 'Content-Type': 'application/json' }
    });

    if (!ocrResponse.ok) {
      throw new Error('OCR请求失败');
    }

    const ocrResult = await ocrResponse.json();

    if (!ocrResult.success) {
      throw new Error(ocrResult.error || 'OCR识别失败');
    }

    // 智谱OCR返回格式：{ data: { text: string, words_result: [...] } }
    return ocrResult.data?.text || '';

  } catch (error) {
    log.error('OCR识别失败', error);
    throw new Error('OCR识别失败，请检查图片是否清晰');
  }
}

/**
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

  const prompt = `你是一个专业的数学题目分析专家。请从以下OCR识别的文本中提取数学题目。

文本内容：
${ocrText}

请分析并返回JSON格式：
{
  "questions": [
    {
      "id": "题目编号（如1、2、(1)等）",
      "content": "题目完整内容",
      "type": "题目类型（choice选择题/fill_blank填空题/essay解答题/unknown未知）",
      "options": ["选项A内容", "选项B内容", "选项C内容", "选项D内容"],  // 仅选择题有
      "studentAnswer": "学生填写的答案（如果识别到）"  // 可选
    }
  ]
}

注意：
1. 题目编号可以是数字、括号数字等
2. 选择题要提取所有选项
3. 如果能识别出学生填写的答案（如打了勾、填写的字母等），请包含studentAnswer字段
4. 填空题的答案可能是横线后的内容
5. 解答题可能没有标准答案格式
6. 只返回有效的题目，忽略无法识别的内容`;

  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GLM_API_KEY}`
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000
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

    // 解析JSON响应
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('无法解析AI返回的JSON');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const questions: Question[] = parsed.questions || [];

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
