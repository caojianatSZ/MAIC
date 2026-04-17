// lib/glm/judge.ts

import { createLogger } from '@/lib/logger';
import type { QuestionForJudgment, BatchJudgmentResult } from './types';

const log = createLogger('GLMJudge');

const GLM_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

/**
 * 使用 GLM-4V-Plus 进行手写答案识别和批改
 */
export async function judgeHandwrittenAnswers(
  imageBase64: string,
  ocrText: string,
  questions: QuestionForJudgment[]
): Promise<BatchJudgmentResult> {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    throw new Error('GLM_API_KEY not configured');
  }

  try {
    log.info('GLM-4V-Plus 批改开始', { questionCount: questions.length });

    const prompt = buildJudgmentPrompt(ocrText, questions);

    const response = await fetch(GLM_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'glm-4v-plus',
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
      log.error('GLM API 错误', { status: response.status, error: errorText });
      throw new Error(`GLM request failed: ${response.status}`);
    }

    const result = await response.json();

    if (result.error) {
      log.error('GLM 业务错误', result.error);
      throw new Error(result.error.message);
    }

    const content = result.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('GLM 返回为空');
    }

    log.info('GLM 响应成功', { contentLength: content.length });

    // 解析 JSON 响应
    const judgment = parseJudgmentResponse(content);

    log.info('GLM 批改完成', {
      questionCount: judgment.questions.length,
      correctCount: judgment.questions.filter(q => q.isCorrect).length,
      avgConfidence: calculateAvgConfidence(judgment.questions)
    });

    return judgment;

  } catch (error) {
    log.error('GLM 批改失败', error);
    throw error;
  }
}

/**
 * 计算平均置信度
 */
function calculateAvgConfidence(questions: { confidence: number }[]): number {
  if (questions.length === 0) return 0;
  const sum = questions.reduce((acc, q) => acc + q.confidence, 0);
  return sum / questions.length;
}

/**
 * 构建批改 prompt（强调置信度评估）
 */
function buildJudgmentPrompt(ocrText: string, questions: QuestionForJudgment[]): string {
  const questionsList = questions.map(q => {
    let desc = `- 题目 ${q.id}: ${q.content}`;
    if (q.options && q.options.length > 0) {
      desc += `\n  选项: ${q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(' | ')}`;
    }
    return desc;
  }).join('\n');

  return `你是一个专业的阅卷老师。以下是试卷的 OCR 识别结果：

【OCR 识别的题目内容】
${ocrText}

【题目列表】
${questionsList}

请识别学生在试卷上的手写答案，并判断对错。

返回 JSON 格式（必须是有效的 JSON，不要有 markdown 代码块标记）：
{
  "questions": [
    {
      "questionId": "题目编号",
      "studentAnswer": "识别的学生手写答案",
      "isCorrect": true/false,
      "correctAnswer": "正确答案",
      "analysis": "简要解析（100字以内）",
      "confidence": 0.95
    }
  ]
}

注意事项：
1. studentAnswer 要准确识别手写内容
2. isCorrect 基于题目内容和答案判断
3. **confidence 非常重要**：
   - 如果手写答案清晰、判断确定，confidence 设为 0.9-1.0
   - 如果手写较模糊但能判断，confidence 设为 0.7-0.9
   - 如果手写模糊或不确定，confidence 设为 0.5-0.7
   - 如果完全无法识别或判断，confidence 设为 0.5 以下
4. 如果某个题目无法识别学生答案，isCorrect 设为 false，studentAnswer 为空字符串，confidence 设为 0
5. 只返回纯 JSON，不要有其他说明文字`;
}

/**
 * 解析批改响应
 */
function parseJudgmentResponse(content: string): BatchJudgmentResult {
  // 清理可能的 markdown 代码块
  let cleanContent = content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  // 提取 JSON 对象
  const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('无法从响应中提取 JSON');
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    log.error('JSON 解析失败', { content: cleanContent.substring(0, 500) });
    throw new Error('批改响应 JSON 解析失败');
  }
}
