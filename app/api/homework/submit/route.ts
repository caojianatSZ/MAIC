/**
 * 作业提交 API
 *
 * 功能：
 * 1. 接收作业题目（文字或图片）
 * 2. 调用 AI 生成讲解内容
 * 3. 生成 TTS 音频
 * 4. 生成练习题
 * 5. 返回 submission_id
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { homeworkSubmissions, homeworkResults, practiceQuestions } from '@/drizzle/schema';
import jwt from 'jsonwebtoken';
import { callLLM } from '@/lib/ai/llm';
import { generateTTS } from '@/lib/audio/tts-providers';
import { createLogger } from '@/lib/logger';

const log = createLogger('Homework Submit API');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export const maxDuration = 60; // 60 秒超时

interface PracticeQuestion {
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

interface GeneratePracticeQuestionsResult {
  questions: PracticeQuestion[];
}

export async function POST(request: NextRequest) {
  try {
    // 1. 验证 JWT token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '未授权访问'
          }
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { userId: string; openid: string };
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Token 无效'
          }
        },
        { status: 401 }
      );
    }

    // 2. 解析请求体
    const body = await request.json();
    const { questionText, questionImageUrl, grade, subject } = body;

    // 验证参数
    if (!questionText && !questionImageUrl) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_QUESTION',
            message: '请提供题目内容或图片'
          }
        },
        { status: 400 }
      );
    }

    // 3. 创建作业提交记录
    const [submission] = await db
      .insert(homeworkSubmissions)
      .values({
        userId: decoded.userId,
        questionText: questionText || '',
        questionImageUrl: questionImageUrl || null,
        grade: grade || null,
        subject: subject || null
      })
      .returning();

    log.info('作业提交记录已创建', { submissionId: submission.id });

    // 4. 生成讲解内容（调用 LLM）
    const explanation = await generateExplanation(questionText, grade, subject);

    // 5. 生成 TTS 音频
    let audioUrl: string | null = null;
    try {
      audioUrl = await generateExplanationAudio(explanation);
      log.info('TTS 音频生成成功', { audioUrl });
    } catch (error) {
      log.error('TTS 音频生成失败', error);
      // 失败时继续执行，不阻塞流程
    }

    // 6. 创建作业结果记录
    const [result] = await db
      .insert(homeworkResults)
      .values({
        submissionId: submission.id,
        explanationText: explanation,
        explanationAudioUrl: audioUrl
      })
      .returning();

    log.info('作业结果记录已创建', { resultId: result.id });

    // 7. 生成练习题
    const generatedPracticeQuestions = await generatePracticeQuestions(questionText, grade, subject);

    // 8. 存储练习题
    const questionsToInsert = generatedPracticeQuestions.map((q, index) => ({
      resultId: result.id,
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      explanation: q.explanation,
      questionNumber: index + 1
    }));

    await db.insert(practiceQuestions).values(questionsToInsert);

    log.info('练习题已生成', { count: generatedPracticeQuestions.length });

    // 9. 返回成功响应
    return NextResponse.json({
      success: true,
      data: {
        submissionId: submission.id,
        resultId: result.id,
        explanation,
        audioUrl,
        practiceQuestions
      }
    });

  } catch (error) {
    log.error('作业提交失败', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '提交失败，请稍后重试'
        }
      },
      { status: 500 }
    );
  }
}

/**
 * 生成讲解内容
 */
async function generateExplanation(
  questionText: string,
  grade?: string,
  subject?: string
): Promise<string> {
  const prompt = `你是一位经验丰富的小学老师。请为以下题目提供详细的讲解：

题目：${questionText}
${grade ? `年级：${grade}` : ''}
${subject ? `科目：${subject}` : ''}

请提供：
1. 题目分析
2. 解题步骤
3. 答案
4. 易错点提醒

要求：
- 语言简单易懂，适合小学生理解
- 讲解详细但不过于冗长
- 使用鼓励性的语气
- 避免使用过于专业的术语`;

  try {
    const response = await callLLM({
      model: 'glm-4-flash', // 使用 GLM-4-Flash（快速且便宜）
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    }, 'homework-submit', undefined, undefined);

    // response.content 是 ContentPart[] 类型，需要转换
    const content = response.content;
    if (Array.isArray(content) && content.length > 0) {
      const firstContent = content[0];
      if (typeof firstContent === 'string') {
        return firstContent || '讲解生成失败，请重试';
      } else if (firstContent && typeof firstContent === 'object' && 'text' in firstContent) {
        return firstContent.text || '讲解生成失败，请重试';
      }
    }

    return '讲解生成失败，请重试';
  } catch (error) {
    log.error('LLM 生成讲解失败', error);
    throw error;
  }
}

/**
 * 生成讲解音频
 */
async function generateExplanationAudio(text: string): Promise<string> {
  try {
    const audioResult = await generateTTS(
      {
        providerId: 'openai-tts', // 使用 OpenAI TTS
        apiKey: process.env.OPENAI_API_KEY || '',
        voice: 'alloy'
      },
      text
    );

    // TODO: 上传音频到 CDN 并返回 URL
    // 目前暂时返回 base64 数据
    return audioResult.audio ? Buffer.from(audioResult.audio).toString('base64') : '';
  } catch (error) {
    log.error('TTS 生成失败', error);
    throw error;
  }
}

/**
 * 生成练习题
 */
async function generatePracticeQuestions(
  questionText: string,
  grade?: string,
  subject?: string
): Promise<PracticeQuestion[]> {
  const prompt = `根据以下题目，生成 3 道类似的练习题：

原题：${questionText}
${grade ? `年级：${grade}` : ''}
${subject ? `科目：${subject}` : ''}

请生成 3 道练习题，每题包含：
1. 题目内容
2. 4 个选项（A, B, C, D）
3. 正确答案
4. 简短解析

要求：
- 难度与原题相当
- 考察相同的知识点
- 选项设置合理，避免明显错误
- 解析简洁明了

请以 JSON 格式返回，格式如下：
{
  "questions": [
    {
      "questionText": "题目内容",
      "options": ["选项A", "选项B", "选项C", "选项D"],
      "correctAnswer": "A",
      "explanation": "解析内容"
    }
  ]
}`;

  try {
    const response = await callLLM({
      model: 'glm-4-flash',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    }, 'homework-submit', undefined, undefined);

    // 解析 LLM 返回的 JSON
    const content = response.content;
    let contentStr = '';

    if (Array.isArray(content) && content.length > 0) {
      const firstContent = content[0];
      if (typeof firstContent === 'string') {
        contentStr = firstContent;
      } else if (firstContent && typeof firstContent === 'object' && 'text' in firstContent) {
        contentStr = firstContent.text || '';
      }
    }

    if (!contentStr) {
      throw new Error('LLM 返回内容为空');
    }

    const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('LLM 返回格式错误');
    }

    const parsed = JSON.parse(jsonMatch[0]) as GeneratePracticeQuestionsResult;
    return parsed.questions || [];
  } catch (error) {
    log.error('LLM 生成练习题失败', error);
    // 返回空数组，不阻塞流程
    return [];
  }
}

// 支持 OPTIONS 请求
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
