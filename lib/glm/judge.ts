// lib/glm/judge.ts

import { createLogger } from '@/lib/logger';
import type { QuestionForJudgment, BatchJudgmentResult } from './types';

const log = createLogger('GLMJudge');

const GLM_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

/**
 * 分层批改策略：根据 OCR 置信度选择模型
 *
 * 成本优化策略：
 * - OCR 高置信度（≥0.8）：使用 GLM-5/GLM-4.7 纯文本推理（快速、便宜）
 * - OCR 低置信度（<0.8）：使用 GLM-4V-Plus-0111 视觉校准（高精度）
 *
 * @param ocrConfidence TextIn OCR 识别置信度 (0-1)
 */
export async function judgeHandwrittenAnswers(
  imageBase64: string,
  ocrText: string,
  questions: QuestionForJudgment[],
  ocrConfidence: number = 0.8
): Promise<BatchJudgmentResult> {
  const apiKey = process.env.GLM_API_KEY;
  if (!apiKey) {
    throw new Error('GLM_API_KEY not configured');
  }

  try {
    // 根据置信度选择模型
    const useHighConfidencePath = ocrConfidence >= 0.8;
    const model = useHighConfidencePath
      ? (process.env.GLM_JUDGMENT_MODEL || 'glm-4.7')  // 高置信度用文本模型（glm-4.7 平衡速度和准确性）
      : 'glm-4v-plus-0111';                             // 低置信度用视觉模型

    log.info('批改开始', {
      questionCount: questions.length,
      ocrConfidence,
      model,
      strategy: useHighConfidencePath ? 'text-only' : 'visual-calibration'
    });

    const prompt = useHighConfidencePath
      ? buildTextOnlyPrompt(ocrText, questions)  // 文本模型：从 OCR 文本提取答案
      : buildVisualPrompt(ocrText, questions);   // 视觉模型：识别手写答案

    let requestBody: any;

    if (useHighConfidencePath) {
      // 高置信度路径：纯文本推理（快速、便宜）
      requestBody = {
        model,
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: 0.1,
        max_tokens: 8000  // 增加以避免截断
      };
      log.info('使用文本模型批改', { model });
    } else {
      // 低置信度路径：视觉校准（高精度）
      // GLM API 需要纯 base64 字符串，不包含 data:image 前缀
      const glmImageUrl = imageBase64.includes(',')
        ? imageBase64.split(',')[1]
        : imageBase64;

      log.info('GLM 图片信息', {
        originalPrefix: imageBase64.substring(0, 40),
        hasDataPrefix: imageBase64.includes(','),
        imageLength: imageBase64.length,
        glmUrlLength: glmImageUrl.length
      });

      requestBody = {
        model,
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
      log.info('使用视觉模型校准', { model });
    }

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
      log.error('GLM API 错误', { status: response.status, error: errorText });
      throw new Error(`GLM request failed: ${response.status}`);
    }

    // 先获取原始响应文本以处理可能的JSON解析错误
    const responseText = await response.text();
    log.info('GLM API 原始响应', {
      responseLength: responseText.length,
      responsePreview: responseText.substring(0, 500)
    });

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      log.error('GLM JSON 解析失败', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        responseText: responseText.substring(0, 1000)
      });
      throw new Error(`GLM API 返回无效的 JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    if (result.error) {
      log.error('GLM 业务错误', result.error);
      throw new Error(result.error.message);
    }

    // GLM-5 是推理模型，答案可能在 reasoning_content 或 content 中
    const message = result.choices?.[0]?.message;
    const content = message?.reasoning_content || message?.content;
    if (!content) {
      throw new Error('GLM 返回为空');
    }

    log.info('GLM 响应成功', {
      contentLength: content.length,
      model,
      hasReasoningContent: !!message?.reasoning_content
    });

    // 解析 JSON 响应
    const judgment = parseJudgmentResponse(content);

    log.info('批改完成', {
      questionCount: judgment.questions.length,
      correctCount: judgment.questions.filter(q => q.isCorrect).length,
      avgConfidence: calculateAvgConfidence(judgment.questions),
      strategy: useHighConfidencePath ? 'text-only' : 'visual-calibration'
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
 * 构建视觉批改 prompt（GLM-4V-Plus-0111）
 * 用于识别手写答案并判断对错
 */
function buildVisualPrompt(ocrText: string, questions: QuestionForJudgment[]): string {
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
 * 构建文本批改 prompt（GLM-5/GLM-4.7）
 * 用于从 OCR 文本中提取答案并判断对错
 *
 * 注意：这个 prompt 假设 OCR 文本中已经包含了学生的手写答案
 * TextIn OCR 应该能识别到图片中的所有文字内容（包括手写）
 */
function buildTextOnlyPrompt(ocrText: string, questions: QuestionForJudgment[]): string {
  const questionsList = questions.map(q => {
    let desc = `- 题目 ${q.id}: ${q.content}`;
    if (q.options && q.options.length > 0) {
      desc += `\n  选项: ${q.options.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`).join(' | ')}`;
    }
    return desc;
  }).join('\n');

  return `你是专业阅卷老师。从以下 OCR 文本中找出学生手写答案并判题。

【OCR 内容】
${ocrText}

【题目】
${questionsList}

【重要】直接返回 JSON，不要任何解释文字：
{"questions":[{"questionId":"1","studentAnswer":"答案","isCorrect":true,"correctAnswer":"正确答案","analysis":"解析","confidence":0.9}]}

规则：
1. 答案清晰→confidence 0.9-1.0
2. 答案模糊→confidence 0.7-0.9
3. 无答案→confidence 0, isCorrect false`;
}

/**
 * 解析批改响应
 * 处理推理模型的特殊情况
 */
function parseJudgmentResponse(content: string): BatchJudgmentResult {
  // 首先尝试直接解析（如果内容本身就是纯 JSON）
  try {
    const trimmed = content.trim();
    if (trimmed.startsWith('{')) {
      return JSON.parse(trimmed);
    }
  } catch {
    // 继续尝试其他方法
  }

  // 清理可能的 markdown 代码块
  const cleanContent = content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  // 提取 JSON 对象 - 使用更精确的模式匹配
  // 查找最后一个完整的 JSON 对象（推理模型可能在最后输出答案）
  const jsonMatches = cleanContent.match(/\{["\s]*questions["\s]*:[\s\S]*?\n\s*\}/g);
  if (jsonMatches && jsonMatches.length > 0) {
    // 取最后一个匹配（应该是最终答案）
    const lastMatch = jsonMatches[jsonMatches.length - 1];
    try {
      return JSON.parse(lastMatch);
    } catch (error) {
      log.error('JSON 解析失败（最后匹配）', { content: lastMatch.substring(0, 500) });
    }
  }

  // 尝试找到任何类似 JSON 的结构
  const simpleMatch = cleanContent.match(/\{[\s\S]*\}/);
  if (simpleMatch) {
    try {
      return JSON.parse(simpleMatch[0]);
    } catch (error) {
      log.error('JSON 解析失败（简单匹配）', { content: simpleMatch[0].substring(0, 500) });
    }
  }

  log.error('无法提取 JSON', { content: cleanContent.substring(0, 1000) });
  throw new Error('无法从响应中提取有效的 JSON');
}
