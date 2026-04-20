/**
 * 阿里云EduTutor - CutQuestions API客户端
 *
 * 文档: https://help.aliyun.com/zh/model-studio/api-edututor-2025-07-07-cutquestions
 *
 * 认证方式: 百炼API Key (Bearer token)
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('AliyunEduTutor');

interface CutQuestionsRequest {
  image: string;
  parameters: {
    struct: boolean;
    extract_images: boolean;
  };
}

interface CutQuestionsResponse {
  requestId: string;
  success: boolean;
  code: string;
  message: string;
  data: string; // JSON字符串
}

interface QuestionInfo {
  type: string;
  stem: {
    text: string;
    pos_list: number[][];
  };
  option: Array<{
    text: string;
    pos_list: number[][];
  }>;
  figure: Array<{
    pos_list: number[][];
  }>;
  answer: Array<{
    text: string;
    pos_list: number[][];
  }>;
  subquestion: any[];
}

interface Question {
  pos_list: number[][];
  sub_images: string[];
  merged_image: string;
  info: QuestionInfo;
}

interface CutQuestionsData {
  questions: Question[];
}

/**
 * 调用阿里云CutQuestions API（使用百炼API Key）
 */
export async function cutQuestions(
  imageUrl: string,
  options: {
    struct?: boolean;
    extract_images?: boolean;
  } = {}
): Promise<CutQuestionsData> {
  const {
    struct = true,
    extract_images = true
  } = options;

  const apiKey = process.env.ALIYUN_API_KEY;
  const workspaceId = process.env.ALIYUN_WORKSPACE_ID;

  if (!apiKey || !workspaceId) {
    throw new Error('缺少阿里云配置: ALIYUN_API_KEY 和 ALIYUN_WORKSPACE_ID');
  }

  log.info('调用阿里云CutQuestions API', {
    imageUrl,
    struct,
    extract_images,
    apiKey: apiKey.substring(0, 15) + '...',
    workspaceId
  });

  try {
    const url = `https://edututor.cn-hangzhou.aliyuncs.com/service/cutApi?workspaceId=${workspaceId}`;
    const date = new Date().toUTCString();

    log.info('发送请求到阿里云', {
      url,
      date
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Date': date,
        'X-DashScope-DataInspection': 'enable'
      },
      body: JSON.stringify({
        image: imageUrl,
        parameters: {
          struct,
          extract_images
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      log.error('阿里云API HTTP错误', {
        status: response.status,
        body: errorText
      });
      throw new Error(`阿里云API调用失败: ${response.status} ${errorText}`);
    }

    const result: CutQuestionsResponse = await response.json();

    if (!result.success || result.code !== 'SUCCESS') {
      log.error('阿里云API业务错误', {
        code: result.code,
        message: result.message,
        requestId: result.requestId
      });
      throw new Error(`阿里云API返回错误: ${result.code} - ${result.message}`);
    }

    // 解析data字段（JSON字符串）
    const data: CutQuestionsData = JSON.parse(result.data);

    log.info('阿里云CutQuestions API调用成功', {
      questionCount: data.questions.length,
      requestId: result.requestId
    });

    return data;
  } catch (error) {
    log.error('阿里云CutQuestions API调用失败', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * 测试阿里云API认证
 */
export async function testAuthentication(imageUrl: string): Promise<{
  success: boolean;
  message: string;
  data?: any;
}> {
  try {
    const apiKey = process.env.ALIYUN_API_KEY;
    const workspaceId = process.env.ALIYUN_WORKSPACE_ID;

    if (!apiKey || !workspaceId) {
      return {
        success: false,
        message: '缺少环境变量: ALIYUN_API_KEY 或 ALIYUN_WORKSPACE_ID'
      };
    }

    log.info('测试阿里云API认证', {
      imageUrl,
      apiKey: apiKey.substring(0, 15) + '...',
      workspaceId
    });

    const url = `https://edututor.cn-hangzhou.aliyuncs.com/service/cutApi?workspaceId=${workspaceId}`;
    const date = new Date().toUTCString();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Date': date,
        'X-DashScope-DataInspection': 'enable'
      },
      body: JSON.stringify({
        image: imageUrl,
        parameters: {
          struct: true,
          extract_images: true
        }
      })
    });

    const responseText = await response.text();

    if (!response.ok) {
      return {
        success: false,
        message: `HTTP ${response.status}: ${responseText}`,
        data: { status: response.status, body: responseText }
      };
    }

    const result: CutQuestionsResponse = JSON.parse(responseText);

    if (!result.success || result.code !== 'SUCCESS') {
      return {
        success: false,
        message: `API错误: ${result.code} - ${result.message}`,
        data: result
      };
    }

    const data = JSON.parse(result.data);

    return {
      success: true,
      message: '认证成功',
      data: {
        requestId: result.requestId,
        questionCount: data.questions?.length || 0
      }
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 将阿里云格式转换为我们的题目格式
 */
export function convertAliyunQuestionsToOurFormat(
  aliyunQuestions: Question[]
): Array<{
  id: string;
  content: string;
  type: 'choice' | 'fill_blank' | 'essay';
  options?: Array<{
    text: string;
    bbox_2d?: number[];
    images?: Array<{ bbox: number[]; label?: string; url?: string }>;
  }>;
  images?: Array<{ bbox: number[]; label?: string; url?: string }>;
  bbox_2d?: number[];
  aliyunData?: Question;
}> {
  return aliyunQuestions.map((question, index) => {
    const qId = String(index + 1);
    const { info, sub_images, merged_image, pos_list } = question;

    // 确定题目类型
    let type: 'choice' | 'fill_blank' | 'essay' = 'essay';
    if (info.type === '选择题') type = 'choice';
    else if (info.type === '填空题') type = 'fill_blank';

    // 提取题干文本
    const content = info.stem?.text || '';

    // 提取选项（包含坐标信息）
    const options = info.option?.map((opt) => ({
      text: opt.text,
      bbox_2d: posListToBbox2d(opt.pos_list[0])
    })) || [];

    // 提取插图（包含URL）
    const figures = info.figure?.map((fig, figIndex) => ({
      bbox: posListToBbox2d(fig.pos_list[0]),
      label: `插图${figIndex + 1}`,
      url: sub_images[figIndex] || merged_image
    })) || [];

    // 如果没有单独的插图URL，使用merged_image
    const images = figures.length > 0 ? figures : undefined;

    // 提取题目bbox（使用第一个pos_list）
    const bbox_2d = pos_list[0] ? posListToBbox2d(pos_list[0]) : undefined;

    return {
      id: qId,
      content,
      type,
      options,
      images,
      bbox_2d,
      aliyunData: question
    };
  });
}

/**
 * 将阿里云的pos_list格式转换为bbox_2d格式
 * pos_list: [[x1,y1,x2,y2,x3,y3,x4,y4]] (4个点)
 * bbox_2d: [x1, y1, x2, y2] (左上角和右下角)
 */
function posListToBbox2d(posList: number[]): number[] {
  if (posList.length !== 8) {
    return [0, 0, 0, 0];
  }

  const [x1, y1, x2, y2, x3, y3, x4, y4] = posList;

  // 找出最小和最大的x、y值
  const minX = Math.min(x1, x2, x3, x4);
  const maxX = Math.max(x1, x2, x3, x4);
  const minY = Math.min(y1, y2, y3, y4);
  const maxY = Math.max(y1, y2, y3, y4);

  return [minX, minY, maxX, maxY];
}
