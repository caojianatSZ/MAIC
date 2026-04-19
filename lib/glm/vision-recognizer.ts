// lib/glm/vision-recognizer.ts
/**
 * GLM-4V 视觉理解 - 直接从图像理解版面并输出结构化题目
 *
 * 核心理念：让多模态模型做"版面理解"，而不是"OCR后重建"
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('VisionRecognizer');

export interface VisionQuestion {
  id: string;
  content: string;
  type: 'choice' | 'fill_blank' | 'essay';
  options?: string[];
  student_answer?: string;
  bbox?: {
    question: number[];
    answer?: number[];
  };
  confidence: number;
}

export interface VisionRecognitionResult {
  questions: VisionQuestion[];
  ocr_confidence: number;
  warnings: string[];
  metadata: {
    total_questions: number;
    has_handwriting: boolean;
    layout_type: 'single_column' | 'multi_column' | 'complex';
  };
}

/**
 * 使用 GLM-4V 直接理解试卷版面
 */
export async function recognizePaperFromImage(
  imageBase64: string,
  options: {
    subject?: string;
    grade?: string;
    maxRetries?: number;
  } = {}
): Promise<VisionRecognitionResult> {
  const { subject = '数学', grade = '初中', maxRetries = 2 } = options;

  log.info('开始 GLM-4V 版面理解', { subject, grade });

  const prompt = buildVisionPrompt(subject, grade);

  let retries = 0;
  while (retries < maxRetries) {
    try {
      const result = await callGLM4V(imageBase64, prompt);
      const parsed = parseVisionResult(result);

      log.info('GLM-4V 识别成功', {
        questionCount: parsed.questions.length,
        avgConfidence: parsed.questions.reduce((sum, q) => sum + q.confidence, 0) / parsed.questions.length,
        layoutType: parsed.metadata.layout_type
      });

      return parsed;
    } catch (error) {
      retries++;
      log.warn(`GLM-4V 识别失败，重试 ${retries}/${maxRetries}`, error);

      if (retries >= maxRetries) {
        throw error;
      }
    }
  }

  throw new Error('GLM-4V 识别失败，超过最大重试次数');
}

/**
 * 构建版面理解 Prompt
 */
function buildVisionPrompt(subject: string, grade: string): string {
  return `你是专业的试卷识别专家。请仔细观察这张${subject}试卷图像（${grade}），识别出所有题目。

**重要要求**：
1. **整体理解版面**：不要逐字识别，而是理解题目的完整结构
2. **保留空间关系**：注意题目和选项的相对位置
3. **准确提取答案**：识别学生手写答案的位置和内容
4. **输出JSON格式**：严格按照以下格式输出

**输出格式**：
\`\`\`json
{
  "questions": [
    {
      "id": "1",
      "content": "题目完整内容（包括题干）",
      "type": "choice|fill_blank|essay",
      "options": ["A. 选项内容", "B. 选项内容", "C. 选项内容", "D. 选项内容"],
      "student_answer": "学生答案（如果没有则为空字符串）",
      "confidence": 0.95
    }
  ],
  "metadata": {
    "total_questions": 题目总数,
    "has_handwriting": true/false,
    "layout_type": "single_column|multi_column|complex"
  }
}
\`\`\`

**注意事项**：
- 题目编号要准确（1、2、3... 或 （1）（2）（3））
- 公式要保持可读性（可以用 LaTeX 或 Unicode）
- 手写答案要准确提取
- 如果有图片或图表，在content中标注"如图X-X所示"
- confidence表示识别置信度（0-1）

现在开始识别：`;
}

/**
 * 调用 GLM-4V API
 */
async function callGLM4V(imageBase64: string, prompt: string): Promise<string> {
  const GLM_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
  const apiKey = process.env.GLM_API_KEY;

  if (!apiKey) {
    throw new Error('GLM_API_KEY not configured');
  }

  // GLM API 需要纯 base64 字符串，不包含 data:image 前缀
  const glmImageUrl = imageBase64.includes(',')
    ? imageBase64.split(',')[1]
    : imageBase64;

  const requestBody = {
    model: 'glm-4v-plus-0111',
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: glmImageUrl }
        },
        {
          type: 'text',
          text: prompt
        }
      ]
    }],
    temperature: 0.1,
    max_tokens: 8000
  };

  log.info('GLM-4V API 请求', {
    model: requestBody.model,
    promptLength: prompt.length,
    imageSize: glmImageUrl.length
  });

  const response = await fetch(GLM_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    log.error('GLM-4V API 错误', { status: response.status, error: errorText });
    throw new Error(`GLM-4V request failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error('GLM-4V API 返回空响应');
  }

  const content = data.choices[0].message?.content;

  if (!content) {
    throw new Error('GLM-4V API 返回空内容');
  }

  log.info('GLM-4V API 响应', {
    contentLength: content.length,
    preview: content.substring(0, 200)
  });

  return content;
}

/**
 * 解析 GLM-4V 输出结果
 */
function parseVisionResult(result: string): VisionRecognitionResult {
  try {
    // 提取 JSON（可能被包裹在 ```json ... ``` 中）
    const jsonMatch = result.match(/```json\s*([\s\S]*?)\s*```/) ||
                     result.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('无法从GLM-4V输出中提取JSON');
    }

    const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);

    // 验证格式
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('GLM-4V输出格式错误：缺少questions数组');
    }

    return {
      questions: parsed.questions.map((q: any) => ({
        id: String(q.id || ''),
        content: String(q.content || ''),
        type: q.type || 'essay',
        options: q.options || undefined,
        student_answer: q.student_answer || '',
        bbox: q.bbox || undefined,
        confidence: Number(q.confidence || 0.8)
      })),
      ocr_confidence: 0.85, // GLM-4V的OCR置信度
      warnings: [],
      metadata: {
        total_questions: Number(parsed.metadata?.total_questions || parsed.questions.length),
        has_handwriting: Boolean(parsed.metadata?.has_handwriting ?? true),
        layout_type: parsed.metadata?.layout_type || 'single_column'
      }
    };
  } catch (error) {
    log.error('解析GLM-4V输出失败', { result, error });
    throw new Error(`解析GLM-4V输出失败: ${error}`);
  }
}

/**
 * 校验识别结果
 */
export function validateVisionResult(result: VisionRecognitionResult): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  // 检查题目数量
  if (result.questions.length === 0) {
    errors.push('没有识别到任何题目');
  }

  if (result.metadata.total_questions !== result.questions.length) {
    warnings.push(`识别到的题目数量(${result.questions.length})与声明总数(${result.metadata.total_questions})不一致`);
  }

  // 检查每个题目
  result.questions.forEach((q, index) => {
    if (!q.id) {
      warnings.push(`题目${index + 1}缺少编号`);
    }

    if (!q.content || q.content.length < 5) {
      warnings.push(`题目${q.id || index + 1}内容过短`);
    }

    if (q.type === 'choice' && (!q.options || q.options.length === 0)) {
      warnings.push(`题目${q.id || index + 1}声明为选择题但缺少选项`);
    }

    if (q.confidence < 0.7) {
      warnings.push(`题目${q.id || index + 1}识别置信度较低: ${q.confidence}`);
    }
  });

  // 检查是否有手写答案
  const answeredCount = result.questions.filter(q => q.student_answer).length;
  if (result.metadata.has_handwriting && answeredCount === 0) {
    warnings.push('声明有手写但未识别到任何答案');
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors
  };
}
