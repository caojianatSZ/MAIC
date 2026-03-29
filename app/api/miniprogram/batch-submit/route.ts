/**
 * 微信小程序批量作业提交API
 *
 * 功能：
 * - 接收多个题目（文字或图片）
 * - 并行处理多个题目
 * - 返回job ID供查询进度
 * - 支持异步查询结果
 */

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { homeworkSubmissions, homeworkResults, practiceQuestions } from '@/drizzle/schema';
import jwt from 'jsonwebtoken';
import { callLLM } from '@/lib/ai/llm';
import { createLogger } from '@/lib/logger';
import { resolveModel } from '@/lib/server/resolve-model';

const log = createLogger('Batch Submit API');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export const maxDuration = 120; // 2分钟超时（批量处理）

// 存储批处理任务的内存缓存（生产环境应使用Redis）
const batchJobs = new Map<string, BatchJob>();

interface BatchJob {
  id: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalQuestions: number;
  processedQuestions: number;
  results: Array<{
    questionText: string;
    questionImageUrl?: string;
    explanation?: string;
    audioUrl?: string;
    practiceQuestions?: any[];
    error?: string;
  }>;
  createdAt: number;
  updatedAt: number;
}

/**
 * POST /api/miniprogram/batch-submit
 *
 * 请求体：
 * {
 *   "questions": Array<{
 *     "questionText": string,
 *     "questionImageUrl": string,
 *     "grade": string,
 *     "subject": string
 *   }>,
 *   "grade": string,  // 全局年级（可选）
 *   "subject": string  // 全局科目（可选）
 * }
 *
 * 响应：
 * {
 *   "success": true,
 *   "data": {
 *     "jobId": string,
 *     "totalQuestions": number,
 *     "status": "processing"
 *   }
 * }
 */
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
    const { questions, grade, subject } = body;

    // 验证参数
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_QUESTIONS',
            message: '请提供题目列表'
          }
        },
        { status: 400 }
      );
    }

    if (questions.length > 9) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TOO_MANY_QUESTIONS',
            message: '最多支持9个题目'
          }
        },
        { status: 400 }
      );
    }

    // 3. 创建批处理任务
    const jobId = nanoid(16);
    const batchJob: BatchJob = {
      id: jobId,
      userId: decoded.userId,
      status: 'pending',
      totalQuestions: questions.length,
      processedQuestions: 0,
      results: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    batchJobs.set(jobId, batchJob);

    log.info('批处理任务已创建', { jobId, totalQuestions: questions.length });

    // 4. 异步处理题目（不阻塞响应）
    processBatchJob(jobId, decoded.userId, questions, grade, subject).catch((error) => {
      log.error('批处理任务执行失败', { jobId, error });
      const job = batchJobs.get(jobId);
      if (job) {
        job.status = 'failed';
        job.updatedAt = Date.now();
      }
    });

    // 5. 立即返回任务ID
    return NextResponse.json({
      success: true,
      data: {
        jobId,
        totalQuestions: questions.length,
        status: 'processing',
      },
    });
  } catch (error) {
    log.error('批处理提交失败', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '批处理提交失败，请稍后重试'
        }
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/miniprogram/batch-submit?jobId={jobId}
 *
 * 查询批处理任务进度
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_JOB_ID',
            message: '缺少任务ID'
          }
        },
        { status: 400 }
      );
    }

    const job = batchJobs.get(jobId);

    if (!job) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'JOB_NOT_FOUND',
            message: '任务不存在或已过期'
          }
        },
        { status: 404 }
      );
    }

    // 返回任务状态和已处理的结果
    return NextResponse.json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        totalQuestions: job.totalQuestions,
        processedQuestions: job.processedQuestions,
        progress: Math.floor((job.processedQuestions / job.totalQuestions) * 100),
        results: job.results,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      },
    });
  } catch (error) {
    log.error('查询批处理任务失败', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '查询任务失败'
        }
      },
      { status: 500 }
    );
  }
}

/**
 * 异步处理批处理任务
 */
async function processBatchJob(
  jobId: string,
  userId: string,
  questions: Array<{
    questionText: string;
    questionImageUrl: string;
    grade?: string;
    subject?: string;
  }>,
  globalGrade?: string,
  globalSubject?: string
): Promise<void> {
  const job = batchJobs.get(jobId);
  if (!job) return;

  job.status = 'processing';
  job.updatedAt = Date.now();

  // 并行处理所有题目
  const processingPromises = questions.map(async (question, index) => {
    try {
      const grade = question.grade || globalGrade;
      const subject = question.subject || globalSubject;
      const questionText = question.questionText || '';

      // 1. 创建作业提交记录
      const [submission] = await db
        .insert(homeworkSubmissions)
        .values({
          userId,
          questionText,
          questionImageUrl: question.questionImageUrl || null,
          grade: grade || null,
          subject: subject || null,
        })
        .returning();

      // 2. 生成讲解内容
      const explanation = await generateExplanation(questionText, grade, subject);

      // 3. 创建作业结果记录
      const [result] = await db
        .insert(homeworkResults)
        .values({
          submissionId: submission.id,
          explanationText: explanation,
          explanationAudioUrl: null, // TODO: TTS功能暂时禁用
        })
        .returning();

      // 5. 生成练习题
      const generatedQuestions = await generatePracticeQuestions(questionText, grade, subject);

      // 6. 存储练习题
      const questionsToInsert = generatedQuestions.map((q, i) => ({
        resultId: result.id,
        questionText: q.questionText,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        questionNumber: i + 1,
      }));

      await db.insert(practiceQuestions).values(questionsToInsert);

      // 7. 更新任务结果
      const jobResult = {
        questionText,
        questionImageUrl: question.questionImageUrl,
        explanation,
        audioUrl: undefined,
        practiceQuestions: generatedQuestions,
        submissionId: submission.id,
        resultId: result.id,
      };

      // 更新内存缓存
      const currentJob = batchJobs.get(jobId);
      if (currentJob) {
        currentJob.results[index] = jobResult;
        currentJob.processedQuestions += 1;
        currentJob.updatedAt = Date.now();
      }

      log.info('题目处理完成', { jobId, index, submissionId: submission.id });
    } catch (error) {
      log.error('题目处理失败', { jobId, index, error });

      // 记录错误但不中断整个批次
      const currentJob = batchJobs.get(jobId);
      if (currentJob) {
        currentJob.results[index] = {
          questionText: question.questionText || '',
          questionImageUrl: question.questionImageUrl,
          error: error instanceof Error ? error.message : '处理失败',
        };
        currentJob.processedQuestions += 1;
        currentJob.updatedAt = Date.now();
      }
    }
  });

  // 等待所有题目处理完成
  await Promise.all(processingPromises);

  // 更新任务状态为完成
  const finalJob = batchJobs.get(jobId);
  if (finalJob) {
    finalJob.status = 'completed';
    finalJob.updatedAt = Date.now();
  }

  log.info('批处理任务完成', { jobId, totalQuestions: questions.length });

  // 30分钟后清理内存缓存（生产环境应使用Redis）
  setTimeout(() => {
    batchJobs.delete(jobId);
  }, 30 * 60 * 1000);
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

  const { model } = resolveModel({});
  const response = await callLLM(
    {
      model,
      messages: [
        { role: 'system', content: '你是一位经验丰富的小学老师，擅长用简单易懂的语言讲解题目。' },
        { role: 'user', content: prompt },
      ],
    },
    'homework-explanation',
    undefined,
    undefined,
  );

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
}

interface PracticeQuestion {
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

/**
 * 生成练习题
 */
async function generatePracticeQuestions(
  questionText: string,
  grade?: string,
  subject?: string
): Promise<PracticeQuestion[]> {
  const prompt = `根据以下题目，生成3道相似的练习题（单选题）：

原题：${questionText}
${grade ? `年级：${grade}` : ''}
${subject ? `科目：${subject}` : ''}

请返回JSON格式的练习题数组，每个练习题包含：
{
  "questionText": "题目内容",
  "options": ["A选项", "B选项", "C选项", "D选项"],
  "correctAnswer": "A",
  "explanation": "解析"
}

要求：
- 难度与原题相近
- 考察相同的知识点
- 题目表述清晰
- 选项具有干扰性

返回纯JSON，不要包含其他说明文字。`;

  const { model } = resolveModel({});
  const response = await callLLM(
    {
      model,
      messages: [
        { role: 'system', content: '你是一位教育专家，擅长设计高质量的练习题。' },
        { role: 'user', content: prompt },
      ],
    },
    'homework-practice-questions',
    undefined,
    undefined,
  );

  // response.content 是 ContentPart[] 类型，需要转换
  let text = '';
  const content = response.content;
  if (Array.isArray(content) && content.length > 0) {
    const firstContent = content[0];
    if (typeof firstContent === 'string') {
      text = firstContent;
    } else if (firstContent && typeof firstContent === 'object' && 'text' in firstContent) {
      text = firstContent.text;
    }
  }

  // 解析JSON响应
  let jsonText = text.trim();

  // 移除可能的代码块标记
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\s*|\s*```$/g, '');
  }

  const questions = JSON.parse(jsonText) as PracticeQuestion[];

  return questions;
}

// 支持 OPTIONS 请求（预检）
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
