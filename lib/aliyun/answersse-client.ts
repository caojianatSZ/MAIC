/**
 * 阿里云 AnswerSSE API 客户端
 *
 * 文档: https://help.aliyun.com/zh/model-studio/api-edututor-2025-07-07-answersse
 *
 * 功能：流式答题解析接口，输入题目文本或图片，返回详细解答内容
 *
 * 返回格式：
 * - 【考点分析】
 * - 【方法点拨】
 * - 【详细解析】
 * - 【最终答案】
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('AliyunAnswerSSE');

interface AnswerSSERequest {
  messages: Array<{
    role: string;
    content: Array<{ text?: string; image?: string }>;
  }>;
  parameters: {
    grade: number;      // 0-学前, 1-六年级, 7-初三, 10-高一, etc.
    subject: string;    // chinese, english, math, physics, chemistry, etc.
    stage?: string;     // 学段（可选）
  };
}

interface AnswerSSEResponse {
  requestId?: string;
  success?: boolean;
  code?: string;
  message?: string;
  data?: string;  // JSON 字符串，包含 message 数组
  finish_reason?: string;
}

interface AnswerContent {
  text: string;  // 包含【考点分析】【方法点拨】【详细解析】【最终答案】的完整解析
}

interface ParsedSolution {
  examPoints: string;      // 考点分析
  methodGuide: string;     // 方法点拨
  detailedAnalysis: string; // 详细解析
  standardAnswer: string;   // 最终答案
}

/**
 * 年级参数映射
 */
const GRADE_MAP: Record<string, number> = {
  '学前': 0,
  '一年级': 1,
  '二年级': 2,
  '三年级': 3,
  '四年级': 4,
  '五年级': 5,
  '六年级': 6,
  '七年级': 7,
  '初一年级': 7,
  '初一': 7,
  '八年级': 8,
  '初二年级': 8,
  '初二': 8,
  '九年级': 9,
  '初三年级': 9,
  '初三': 9,
  '高一': 10,
  '高二': 11,
  '高三': 12,
  '大学一年级': 14,
  '大学二年级': 15,
  '大学三年级': 16,
  '大学四年级': 17,
};

/**
 * 学科参数映射
 */
const SUBJECT_MAP: Record<string, string> = {
  'chinese': 'chinese',
  'english': 'english',
  'math': 'math',
  'physics': 'physics',
  'chemistry': 'chemistry',
  'biology': 'biology',
  'history': 'history',
  'geo': 'geo',
  'geography': 'geo',
  'politics': 'politics',
};

/**
 * 从年级字符串转换为数字
 */
function parseGrade(gradeStr: string): number {
  // 直接匹配
  if (GRADE_MAP[gradeStr] !== undefined) {
    return GRADE_MAP[gradeStr];
  }

  // 提取数字（如 "七年级" -> 7）
  const match = gradeStr.match(/(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }

  // 默认初二
  return 8;
}

/**
 * 调用 AnswerSSE API 获取标准答案和解析
 *
 * @param questionText 题目文本
 * @param options 选项
 * @returns 解析结果
 */
export async function getSolution(
  questionText: string,
  options: {
    subject: string;
    grade: string;
    imageUrl?: string;  // 可选的图片URL
  }
): Promise<ParsedSolution> {
  const {
    subject,
    grade,
    imageUrl
  } = options;

  // 认证配置
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET;
  const apiKey = process.env.ALIYUN_API_KEY;
  const workspaceId = process.env.ALIYUN_WORKSPACE_ID;

  if (!workspaceId) {
    throw new Error('缺少阿里云配置: ALIYUN_WORKSPACE_ID');
  }

  if (!accessKeyId && !apiKey) {
    throw new Error('缺少阿里云配置: 需要ALIYUN_ACCESS_KEY_ID/SECRET或ALIYUN_API_KEY');
  }

  const gradeNum = parseGrade(grade);
  const subjectParam = SUBJECT_MAP[subject] || subject;

  log.info('调用 AnswerSSE API', {
    subject,
    grade,
    gradeNum,
    subjectParam,
    workspaceId,
    hasImage: !!imageUrl
  });

  try {
    const baseUrl = 'https://edututor.cn-hangzhou.aliyuncs.com';
    const urlPath = '/service/answerSSE';
    const queryParams = `workspaceId=${workspaceId}`;
    const url = `${baseUrl}${urlPath}?${queryParams}`;
    const date = new Date().toUTCString();

    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Date': date
    };

    // 使用签名认证或 API Key
    if (accessKeyId && accessKeySecret) {
      const crypto = await import('crypto');
      const method = 'POST';
      const accept = '*/*';
      const contentType = 'application/json';
      const stringToSign = `${method}\n${accept}\n\n${contentType}\n${date}\n${urlPath}?${queryParams}`;
      const signature = crypto.createHmac('sha1', accessKeySecret)
        .update(stringToSign)
        .digest('base64');

      headers['Authorization'] = `acs ${accessKeyId}:${signature}`;
      headers['Accept'] = accept;

      log.info('使用 RAM Access Key 签名认证');
    } else if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['X-DashScope-DataInspection'] = 'enable';
      log.info('使用 API Key Bearer token 认证');
    }

    // 构建请求内容
    const content: Array<{ text?: string; image?: string }> = [
      { text: questionText }
    ];

    // 如果有图片，添加图片内容
    if (imageUrl) {
      content.unshift({ image: imageUrl });
    }

    const requestBody: AnswerSSERequest = {
      messages: [
        {
          role: 'user',
          content
        }
      ],
      parameters: {
        grade: gradeNum,
        subject: subjectParam
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('AnswerSSE API HTTP 错误', {
        status: response.status,
        body: errorText
      });
      throw new Error(`AnswerSSE API 调用失败: ${response.status} ${errorText}`);
    }

    const responseText = await response.text();
    let result: AnswerSSEResponse;

    // 解析响应
    if (responseText.trim().startsWith('<?xml')) {
      // XML 格式 - 提取 CDATA
      const cdataStart = responseText.indexOf('<![CDATA[');
      const cdataEnd = responseText.indexOf(']]>');

      if (cdataStart === -1 || cdataEnd === -1) {
        log.error('无法从 XML 响应中提取 CDATA');
        throw new Error('AnswerSSE 响应格式错误');
      }

      const cdataContent = responseText.substring(cdataStart + 9, cdataEnd);
      result = JSON.parse(cdataContent);
    } else {
      result = JSON.parse(responseText);
    }

    // 检查业务状态
    if (result.code !== 'SUCCESS' && result.code !== '0') {
      log.error('AnswerSSE 业务错误', {
        code: result.code,
        message: result.message
      });
      throw new Error(`AnswerSSE 返回错误: ${result.code} - ${result.message}`);
    }

    // 解析数据
    let answerText = '';

    if (result.data) {
      // data 是 JSON 字符串
      const dataObj = JSON.parse(result.data);
      if (dataObj.message && dataObj.message[0] && dataObj.message[0].content) {
        const contentArray = dataObj.message[0].content;
        if (Array.isArray(contentArray) && contentArray[0] && contentArray[0].text) {
          answerText = contentArray[0].text;
        }
      }
    }

    if (!answerText) {
      log.warn('AnswerSSE 未返回解析内容');
      throw new Error('AnswerSSE 未返回解析内容');
    }

    // 解析结构化内容
    const parsed = parseSolutionContent(answerText);

    log.info('AnswerSSE 调用成功', {
      hasExamPoints: !!parsed.examPoints,
      hasMethodGuide: !!parsed.methodGuide,
      hasDetailedAnalysis: !!parsed.detailedAnalysis,
      hasStandardAnswer: !!parsed.standardAnswer
    });

    return parsed;

  } catch (error) {
    log.error('AnswerSSE 调用失败', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * 解析 AnswerSSE 返回的结构化内容
 *
 * 输入格式：
 * ### 【考点分析】：
 * 本题涉及...
 *
 * ### 【方法点拨】：
 * 1. ...
 *
 * ### 【详细解析】：
 * #### 第一步：...
 *
 * ### 【最终答案】：
 * xxx
 */
function parseSolutionContent(text: string): ParsedSolution {
  const result: ParsedSolution = {
    examPoints: '',
    methodGuide: '',
    detailedAnalysis: '',
    standardAnswer: ''
  };

  // 提取各个部分
  const patterns = {
    examPoints: /### 【考点分析】[：:]\s*([\s\S]*?)(?=### 【|$)/,
    methodGuide: /### 【方法点拨】[：:]\s*([\s\S]*?)(?=### 【|$)/,
    detailedAnalysis: /### 【详细解析】[：:]\s*([\s\S]*?)(?=### 【|$)/,
    standardAnswer: /### 【最终答案】[：:]\s*([\s\S]*?)(?=### 【|$)/
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // 清理 markdown 格式
      result[key as keyof ParsedSolution] = match[1]
        .replace(/#{3,}/g, '')       // 移除标题标记
        .replace(/\*\*/g, '')        // 移除粗体标记
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // 移除链接但保留文本
        .trim();
    }
  }

  // 如果没有详细解析但有方法点拨，把方法点拨作为详细解析
  if (!result.detailedAnalysis && result.methodGuide) {
    result.detailedAnalysis = result.methodGuide;
  }

  log.info('解析结构化内容', {
    hasExamPoints: !!result.examPoints,
    hasMethodGuide: !!result.methodGuide,
    hasDetailedAnalysis: !!result.detailedAnalysis,
    hasStandardAnswer: !!result.standardAnswer
  });

  return result;
}

/**
 * 生成缓存键
 */
export function generateSolutionCacheKey(
  questionId: string,
  subject: string
): string {
  return `solution:${questionId}:${subject}`;
}

/**
 * 缓存解析结果（可选实现）
 */
const solutionCache = new Map<string, { solution: ParsedSolution; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时

export function cacheSolution(
  questionId: string,
  subject: string,
  solution: ParsedSolution
): void {
  const key = generateSolutionCacheKey(questionId, subject);
  solutionCache.set(key, {
    solution,
    timestamp: Date.now()
  });
}

export function getCachedSolution(
  questionId: string,
  subject: string
): ParsedSolution | null {
  const key = generateSolutionCacheKey(questionId, subject);
  const cached = solutionCache.get(key);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.solution;
  }

  // 清理过期缓存
  if (cached) {
    solutionCache.delete(key);
  }

  return null;
}
