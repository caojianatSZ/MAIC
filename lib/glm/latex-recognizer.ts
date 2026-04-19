// lib/glm/latex-recognizer.ts
/**
 * GLM-4V LaTeX试卷识别
 *
 * 核心理念：让GLM-4V直接输出包含LaTeX的结构化题目
 * 目标：可计算、可验证、可判题
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('LatexRecognizer');

export interface LatexQuestion {
  question_id: string;
  question: string;  // 包含 $LaTeX$
  student_answer?: string;  // 包含 $LaTeX$
  type: 'choice' | 'fill_blank' | 'essay';
  options?: string[];  // 包含 $LaTeX$
  formulas: FormulaInfo[];
  uncertain: boolean;
}

export interface FormulaInfo {
  latex: string;  // LaTeX格式（用$...$包裹）
  raw: string;  // 原始文本
  location: 'question' | 'answer' | 'option';
  confidence: number;
  uncertain?: boolean;
}

export interface LatexRecognitionResult {
  questions: LatexQuestion[];
  warnings: string[];
  metadata: {
    total_questions: number;
    total_formulas: number;
    avg_confidence: number;
    layout_type: 'single_column' | 'multi_column' | 'complex';
  };
}

/**
 * 使用GLM-4V识别试卷并输出LaTeX格式
 */
export async function recognizePaperWithLatex(
  imageBase64: string,
  options: {
    subject?: string;
    grade?: string;
    maxRetries?: number;
  } = {}
): Promise<LatexRecognitionResult> {
  const { subject = '数学', grade = '初中', maxRetries = 2 } = options;

  log.info('开始 GLM-4V LaTeX 识别', { subject, grade });

  const prompt = buildLatexPrompt(subject, grade);

  let retries = 0;
  while (retries < maxRetries) {
    try {
      const result = await callGLM4VWithLatexPrompt(imageBase64, prompt);
      const parsed = parseLatexResult(result);

      // 校验LaTeX语法
      await validateLatexInQuestions(parsed.questions);

      log.info('GLM-4V LaTeX 识别成功', {
        questionCount: parsed.questions.length,
        totalFormulas: parsed.metadata.total_formulas,
        avgConfidence: parsed.metadata.avg_confidence
      });

      return parsed;
    } catch (error) {
      retries++;
      log.warn(`GLM-4V LaTeX 识别失败，重试 ${retries}/${maxRetries}`, error);

      if (retries >= maxRetries) {
        throw error;
      }
    }
  }

  throw new Error('GLM-4V LaTeX 识别失败，超过最大重试次数');
}

/**
 * 构建LaTeX识别Prompt（按照专业方案）
 */
function buildLatexPrompt(subject: string, grade: string): string {
  return `你是专业的试卷解析系统，擅长识别${subject}公式。

请从试卷图片中提取题目和学生答案，并识别所有数学公式。

【任务】
1. 提取题目和学生答案
2. 识别所有数学公式
3. 将公式转换为标准 LaTeX 格式

【公式规则】
- 所有数学公式必须用 $...$ 包裹
- 必须使用标准 LaTeX（如 \\\\frac, \\\\sqrt, ^, _）
- 不允许使用自然语言描述公式
- 不完整公式标记为 uncertain=true

【LaTeX示例】
- 错误：x的平方加2x等于3
- 正确：$x^2 + 2x = 3$
- 分数：$\\\\frac{1}{2}$
- 根号：$\\\\sqrt{3}$
- 下标：$v_1$、$F_2$
- 上标：$x^2$、$10^{-3}$

【重要约束】
- 不要漏掉公式
- 不要将普通文本误识别为公式
- 保证题目和答案对应关系正确
- 手写答案也要转换为LaTeX

【输出格式】
严格按以下JSON格式输出：
\`\`\`json
{
  "questions": [
    {
      "question_id": "1",
      "question": "题目完整内容（包含 $公式$）",
      "student_answer": "学生答案（包含 $公式$，如果没有则为空字符串）",
      "type": "choice|fill_blank|essay",
      "options": ["A. $选项内容$", "B. $选项内容$", ...],
      "formulas": [
        {
          "latex": "x^2 + 2x = 3",
          "raw": "原始文本",
          "location": "question|answer|option",
          "confidence": 0.95,
          "uncertain": false
        }
      ],
      "uncertain": false
    }
  ],
  "metadata": {
    "total_questions": 题目总数,
    "total_formulas": 公式总数,
    "layout_type": "single_column|multi_column|complex"
  }
}
\`\`\`

现在开始识别这张${grade}${subject}试卷：`;
}

/**
 * 调用 GLM-4V API
 */
async function callGLM4VWithLatexPrompt(
  imageBase64: string,
  prompt: string
): Promise<string> {
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

  log.info('GLM-4V LaTeX API 请求', {
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
 * 解析GLM-4V输出结果
 */
function parseLatexResult(result: string): LatexRecognitionResult {
  try {
    // 提取 JSON（可能被包裹在 ```json ... ``` 中）
    const jsonMatch = result.match(/```json\\s*([\\s\\S]*?)\\s*```/) ||
                     result.match(/\\{[\\s\\S]*\\}/);

    if (!jsonMatch) {
      throw new Error('无法从GLM-4V输出中提取JSON');
    }

    const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);

    // 验证格式
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('GLM-4V输出格式错误：缺少questions数组');
    }

    const questions: LatexQuestion[] = parsed.questions.map((q: any) => ({
      question_id: String(q.question_id || ''),
      question: String(q.question || ''),
      student_answer: q.student_answer || undefined,
      type: q.type || 'essay',
      options: q.options || undefined,
      formulas: q.formulas || [],
      uncertain: Boolean(q.uncertain || false)
    }));

    // 计算统计数据
    const totalFormulas = questions.reduce((sum, q) => sum + (q.formulas?.length || 0), 0);
    const avgConfidence = totalFormulas > 0
      ? questions.reduce((sum, q) =>
          sum + (q.formulas?.reduce((s, f) => s + (f.confidence || 0.8), 0) || 0), 0
        ) / totalFormulas
      : 0.8;

    return {
      questions,
      warnings: [],
      metadata: {
        total_questions: questions.length,
        total_formulas: totalFormulas,
        avg_confidence: avgConfidence,
        layout_type: parsed.metadata?.layout_type || 'single_column'
      }
    };
  } catch (error) {
    log.error('解析GLM-4V输出失败', { result, error });
    throw new Error(`解析GLM-4V输出失败: ${error}`);
  }
}

/**
 * 校验LaTeX语法
 */
async function validateLatexInQuestions(questions: LatexQuestion[]): Promise<void> {
  const warnings: string[] = [];

  for (const q of questions) {
    // 检查题目中的LaTeX
    const questionFormulas = extractLatexFormulas(q.question);
    for (const formula of questionFormulas) {
      if (!isValidLatex(formula)) {
        warnings.push(`题目${q.question_id}中的LaTeX可能无效: ${formula}`);
        q.uncertain = true;
      }
    }

    // 检查答案中的LaTeX
    if (q.student_answer) {
      const answerFormulas = extractLatexFormulas(q.student_answer);
      for (const formula of answerFormulas) {
        if (!isValidLatex(formula)) {
          warnings.push(`题目${q.question_id}的答案中的LaTeX可能无效: ${formula}`);
          q.uncertain = true;
        }
      }
    }

    // 检查选项中的LaTeX
    if (q.options) {
      for (const option of q.options) {
        const optionFormulas = extractLatexFormulas(option);
        for (const formula of optionFormulas) {
          if (!isValidLatex(formula)) {
            warnings.push(`题目${q.question_id}的选项中的LaTeX可能无效: ${formula}`);
            q.uncertain = true;
          }
        }
      }
    }
  }

  if (warnings.length > 0) {
    log.warn('LaTeX校验发现警告', { warnings });
  }
}

/**
 * 从文本中提取LaTeX公式
 */
function extractLatexFormulas(text: string): string[] {
  const formulas: string[] = [];
  const regex = /\$([^$\n]+)\$/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    formulas.push(match[1]);
  }

  return formulas;
}

/**
 * 简单的LaTeX语法校验
 * 注意：这是基础校验，生产环境建议使用KaTeX/MathJax parser
 */
function isValidLatex(latex: string): boolean {
  // 基础检查：不能为空
  if (!latex || latex.trim().length === 0) {
    return false;
  }

  // 检查常见的语法错误
  const errors = [
    /\\\\frac\{[^}]*\}(?!\{)/,  // \frac{...} 但缺少第二个参数
    /\\\\sqrt\{[^}]*\}\{[^}]*\}/,  // \sqrt{...}{...} 错误语法
    /\{[^}]*$/,  // 未闭合的括号
    /^\$|\$$/,  // 开头或结尾有单独的$
  ];

  for (const error of errors) {
    if (error.test(latex)) {
      return false;
    }
  }

  return true;
}
