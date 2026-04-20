/**
 * 阿里云EduTutor - CutQuestions API客户端
 *
 * 文档: https://help.aliyun.com/zh/model-studio/api-edututor-2025-07-07-cutquestions
 *
 * 功能：
 * - 自动切分试卷题目
 * - 结构化识别（题干、选项、答案、插图）
 * - 返回每个题目的精确坐标
 * - 提供7天有效的临时图片链接
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('AliyunEduTutor');

interface CutQuestionsRequest {
  image: string; // 图片URL（需要先上传到OSS）
  struct: boolean; // 是否返回结构化信息
  extract_images: boolean; // 是否返回子图临时链接
}

interface CutQuestionsResponse {
  requestId: string;
  success: boolean;
  code: string;
  message: string;
  data: string; // JSON字符串
}

interface QuestionInfo {
  type: string; // 题目类型：选择题/填空题/判断题/问答题/作文题/其他
  stem: {
    text: string;
    pos_list: number[][]; // [[x1,y1,x2,y2,x3,y3,x4,y4]]
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
  pos_list: number[][]; // 题目坐标框（可能含有多个，用于多栏布局）
  sub_images: string[]; // 子图图片链接（7天有效）
  merged_image: string; // 完整题目图片链接（7天有效）
  info: QuestionInfo;
}

interface CutQuestionsData {
  questions: Question[];
}

/**
 * 调用阿里云CutQuestions API
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
    extract_images
  });

  try {
    const response = await fetch(
      `https://edututor-cn-beijing.aliyuncs.com/service/cutApi?workspaceId=${workspaceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-DashScope-DataInspection': 'enable'
        },
        body: JSON.stringify({
          image: imageUrl,
          parameters: {
            struct,
            extract_images
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`阿里云API调用失败: ${response.status} ${errorText}`);
    }

    const result: CutQuestionsResponse = await response.json();

    if (!result.success || result.code !== 'SUCCESS') {
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

    // 提取选项
    const options = info.option?.map((opt) => ({
      text: opt.text,
      bbox_2d: posListToBbox2d(opt.pos_list[0])
    })) || [];

    // 提取插图
    const figures = info.figure?.map((fig, figIndex) => ({
      bbox: posListToBbox2d(fig.pos_list[0]),
      label: `插图${figIndex + 1}`,
      url: sub_images[figIndex] || merged_image
    })) || [];

    // 提取题目bbox（使用第一个pos_list）
    const bbox_2d = pos_list[0] ? posListToBbox2d(pos_list[0]) : undefined;

    return {
      id: qId,
      content,
      type,
      options,
      images: figures.length > 0 ? figures : undefined,
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
