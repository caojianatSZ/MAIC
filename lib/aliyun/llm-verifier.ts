/**
 * 使用GLM-4V-Plus视觉模型校验阿里云CutQuestions识别结果
 *
 * 核心思路：
 * 1. 阿里云CutQuestions快速切分题目（可能有遗漏）
 * 2. GLM-4V-Plus视觉检查，发现遗漏的题目
 * 3. 合并两部分结果，确保完整性
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('AliyunLLMVerifier');

interface Question {
  pos_list: number[][];
  sub_images: string[];
  merged_image: string;
  info: any;
}

interface VerificationRequest {
  originalImageUrl: string;
  aliyunQuestions: Question[];
  imageBase64: string;
}

interface VerificationResult {
  hasMissingQuestions: boolean;
  missingQuestionCount: number;
  totalQuestionCount: number;
  confidence: number;
  reason?: string;
}

/**
 * 使用GLM-4V-Plus视觉模型验证阿里云识别结果
 */
export async function verifyWithLLM(request: VerificationRequest): Promise<VerificationResult> {
  const { originalImageUrl, aliyunQuestions, imageBase64 } = request;
  const apiKey = process.env.GLM_API_KEY;

  if (!apiKey) {
    log.warn('GLM_API_KEY未配置，跳过LLM校验');
    return {
      hasMissingQuestions: false,
      missingQuestionCount: 0,
      totalQuestionCount: aliyunQuestions.length,
      confidence: 0.5,
      reason: 'GLM_API_KEY未配置，无法校验'
    };
  }

  const questionCount = aliyunQuestions.length;

  // 如果阿里云识别的题目数 >= 3，认为不太可能遗漏
  if (questionCount >= 3) {
    log.info('阿里云识别题目数较多，跳过LLM校验', { questionCount });
    return {
      hasMissingQuestions: false,
      missingQuestionCount: 0,
      totalQuestionCount: questionCount,
      confidence: 0.8,
      reason: '题目数较多，认为识别完整'
    };
  }

  // 如果题目数较少（1-2道），使用GLM-4V-Plus视觉检查
  log.info('使用GLM-4V-Plus视觉校验', { questionCount });

  try {
    // GLM API 需要纯 base64 字符串
    const glmImageUrl = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    const prompt = buildVerificationPrompt(aliyunQuestions);

    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'glm-4v-plus-0111',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: glmImageUrl
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }],
        temperature: 0.1,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('GLM API调用失败', {
        status: response.status,
        body: errorText
      });
      throw new Error(`GLM API调用失败: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content || '';

    log.info('GLM校验响应', { content });

    // 解析GLM的响应
    const analysis = parseGLMResponse(content);

    return {
      hasMissingQuestions: analysis.hasMissingQuestions,
      missingQuestionCount: analysis.missingQuestionCount,
      totalQuestionCount: analysis.totalQuestionCount,
      confidence: analysis.confidence,
      reason: analysis.reason
    };

  } catch (error) {
    log.error('LLM校验失败', {
      error: error instanceof Error ? error.message : String(error)
    });

    // 校验失败时，保守估计认为可能有遗漏
    return {
      hasMissingQuestions: questionCount < 2,
      missingQuestionCount: questionCount < 2 ? 1 : 0,
      totalQuestionCount: questionCount,
      confidence: 0.3,
      reason: 'LLM校验失败，保守估计'
    };
  }
}

/**
 * 构建校验Prompt
 */
function buildVerificationPrompt(aliyunQuestions: Question[]): string {
  const questionSummary = aliyunQuestions.map((q, idx) => {
    const num = idx + 1;
    const type = q.info?.type || '未知类型';
    const stem = q.info?.stem?.text || '';
    const stemPreview = stem.length > 50 ? stem.substring(0, 50) + '...' : stem;

    return `题目${num}: ${type} - ${stemPreview}`;
  }).join('\n');

  return `你是一个专业的试卷识别专家。请仔细检查这张试卷图片，确认阿里云API是否遗漏了题目。

当前阿里云API识别到的题目：
${questionSummary}

请回答以下问题（以JSON格式）：
1. 试卷中总共有多少道**独立的题目**？
2. 阿里云API是否遗漏了题目？如果遗漏了，遗漏了几道？
3. 你对判断的置信度有多高？（0-1之间的数字）
4. 简要说明你的理由

请严格按照以下JSON格式回复：
\`\`\`json
{
  "total_question_count": 数字,
  "has_missing_questions": true/false,
  "missing_question_count": 数字,
  "confidence": 0.0-1.0之间的数字,
  "reason": "简要说明理由"
}
\`\`\`

**重要说明：什么是"独立的题目"？**

✅ **算作独立题目**：
- 编号为"7"、"8"、"9"的题目（即使是不连续的题号）
- 子题如"7.(1)、7.(2)、7.(3)"（每个括号编号算1道题）
- 明显分开的题目段

❌ **不算作独立题目**：
- **选择题的选项（A、B、C、D）** - 这些只是1道选择题的组成部分，不是独立题目
- 填空题的多个空 - 仍然算1道填空题
- 题目的配图、插图 - 不是题目

**特别提醒**：
- 如果试卷上只有1道选择题（包含A、B、C、D四个选项），应该回答 total_question_count: 1
- 如果有子题编号如(1)、(2)、(3)，每个编号算1道独立题目
- 请特别关注图片边缘是否有被裁切的题目`;
}

/**
 * 解析GLM响应
 */
function parseGLMResponse(content: string): {
  totalQuestionCount: number;
  hasMissingQuestions: boolean;
  missingQuestionCount: number;
  confidence: number;
  reason: string;
} {
  try {
    // 尝试提取JSON块
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
                     content.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('无法找到JSON响应');
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonStr);

    return {
      totalQuestionCount: parsed.total_question_count || parsed.totalQuestionCount || 0,
      hasMissingQuestions: parsed.has_missing_questions ?? parsed.hasMissingQuestions ?? false,
      missingQuestionCount: parsed.missing_question_count ?? parsed.missingQuestionCount ?? 0,
      confidence: parsed.confidence ?? 0.5,
      reason: parsed.reason || ''
    };

  } catch (error) {
    log.error('解析GLM响应失败', {
      error: error instanceof Error ? error.message : String(error),
      content
    });

    // 解析失败时，使用正则表达式提取关键信息
    const totalCount = content.match(/总[题目]?.*?(\d+)/)?.[1];
    const missingCount = content.match(/遗漏.*?(\d+)/)?.[1];

    return {
      totalQuestionCount: parseInt(totalCount || '0'),
      hasMissingQuestions: !!missingCount,
      missingQuestionCount: parseInt(missingCount || '0'),
      confidence: 0.3,
      reason: '正则表达式提取，置信度较低'
    };
  }
}
