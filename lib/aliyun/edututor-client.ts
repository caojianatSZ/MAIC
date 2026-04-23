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
  requestId?: string;
  success?: boolean;
  code?: string;
  message?: string;
  data?: string; // JSON字符串
  questions?: Question[]; // 直接返回格式
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

  // 优先使用RAM Access Key认证，降级到API Key
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

  log.info('调用阿里云CutQuestions API', {
    imageUrl,
    struct,
    extract_images,
    workspaceId,
    authMethod: accessKeyId ? 'RAM_ACCESS_KEY' : 'API_KEY'
  });

  try {
    const baseUrl = 'https://edututor.cn-hangzhou.aliyuncs.com';
    const urlPath = '/service/cutApi';
    const queryParams = `workspaceId=${workspaceId}`;
    const url = `${baseUrl}${urlPath}?${queryParams}`;
    const date = new Date().toUTCString();

    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Date': date
    };

    // 如果有RAM Access Key，使用签名认证
    if (accessKeyId && accessKeySecret) {
      const crypto = await import('crypto');
      const method = 'POST';
      const accept = '*/*'; // 阿里云API期望的Accept header
      const contentType = 'application/json';

      // 构建签名字符串（格式：Method\nAccept\nContent-Type\nDate\nPath）
      const stringToSign = `${method}\n${accept}\n\n${contentType}\n${date}\n${urlPath}?${queryParams}`;
      const signature = crypto.createHmac('sha1', accessKeySecret)
        .update(stringToSign)
        .digest('base64');

      headers['Authorization'] = `acs ${accessKeyId}:${signature}`;
      headers['Accept'] = accept; // 设置Accept header

      log.info('使用RAM Access Key签名认证', {
        stringToSign: stringToSign.substring(0, 100) + '...',
        signature: signature.substring(0, 20) + '...'
      });
    } else if (apiKey) {
      // 降级到API Key Bearer token认证
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['X-DashScope-DataInspection'] = 'enable';
      log.info('使用API Key Bearer token认证');
    }

    log.info('发送请求到阿里云', { url, date });

    const response = await fetch(url, {
      method: 'POST',
      headers,
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

    // 阿里云API返回XML格式，需要解析CDATA中的JSON
    const responseText = await response.text();

    let result: CutQuestionsResponse;

    if (responseText.trim().startsWith('<?xml')) {
      // XML格式响应 - 提取CDATA中的JSON
      log.info('阿里云API返回XML格式，解析CDATA');

      // 使用更简单的CDATA提取方式
      const cdataStart = responseText.indexOf('<![CDATA[');
      const cdataEnd = responseText.indexOf(']]>');

      if (cdataStart === -1 || cdataEnd === -1) {
        log.error('无法从XML响应中提取CDATA', {
          responsePreview: responseText.substring(0, 200)
        });
        throw new Error('阿里云API响应格式错误：无法找到CDATA');
      }

      const cdataContent = responseText.substring(cdataStart + 9, cdataEnd);

      try {
        result = JSON.parse(cdataContent);
        log.info('阿里云API响应解析成功', {
          hasResult: !!result,
          success: result?.success,
          code: result?.code,
          hasData: !!result?.data,
          dataType: typeof result?.data,
          keys: result ? Object.keys(result) : 'no result'
        });
      } catch (parseError) {
        log.error('解析CDATA中的JSON失败', {
          cdataContent: cdataContent.substring(0, 200),
          error: parseError instanceof Error ? parseError.message : String(parseError)
        });
        throw new Error('阿里云API响应解析失败');
      }
    } else {
      // JSON格式响应（降级情况）
      log.info('阿里云API返回JSON格式');
      result = JSON.parse(responseText);
    }

    // 判断返回格式
    let data: CutQuestionsData;

    if (result.questions && Array.isArray(result.questions)) {
      // 直接返回格式：{questions: [...]}
      log.info('阿里云API直接返回题目数据');
      data = { questions: result.questions };
    } else if (result.data) {
      // 包装格式：{success: true, code: "SUCCESS", data: "{...}"}
      if (!result.success && result.code !== 'SUCCESS') {
        log.error('阿里云API业务错误', {
          code: result.code,
          message: result.message,
          requestId: result.requestId
        });
        throw new Error(`阿里云API返回错误: ${result.code} - ${result.message}`);
      }
      data = JSON.parse(result.data);
    } else {
      log.error('阿里云API响应格式不匹配', {
        hasQuestions: !!result?.questions,
        hasData: !!result?.data,
        hasSuccess: !!result?.success,
        hasCode: !!result?.code,
        rawKeys: result ? Object.keys(result) : 'no result'
      });
      throw new Error('阿里云API响应格式错误：无法找到题目数据');
    }

    log.info('阿里云CutQuestions API调用成功', {
      questionCount: data.questions.length,
      requestId: result.requestId || 'unknown'
    });

    // 调试日志：查看第一道题的图片数据
    if (data.questions.length > 0) {
      const firstQuestion = data.questions[0];
      log.info('阿里云API返回的图片数据（第1题）', {
        hasSubImages: 'sub_images' in firstQuestion,
        subImagesType: typeof firstQuestion.sub_images,
        subImages: firstQuestion.sub_images,
        hasMergedImage: 'merged_image' in firstQuestion,
        mergedImage: firstQuestion.merged_image?.substring(0, 100) + '...',
        hasInfo: 'info' in firstQuestion,
        hasFigures: !!firstQuestion.info?.figure,
        figuresCount: Array.isArray(firstQuestion.info?.figure) ? firstQuestion.info.figure.length : 0
      });
    }

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

    // 检查是否有错误
    if ((result.success === false || result.code !== 'SUCCESS') && !result.questions) {
      return {
        success: false,
        message: `API错误: ${result.code} - ${result.message}`,
        data: result
      };
    }

    // 解析数据（支持两种格式）
    let data: CutQuestionsData;
    if (result.questions) {
      data = { questions: result.questions };
    } else if (result.data) {
      data = JSON.parse(result.data);
    } else {
      return {
        success: false,
        message: 'API响应格式错误：无法找到题目数据',
        data: result
      };
    }

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
 * 生成切割后的图片URL
 * 使用阿里云OSS的图片处理功能
 */
function generateCroppedImageUrl(
  originalUrl: string,
  bbox: [number, number, number, number]
): string {
  const [x1, y1, x2, y2] = bbox;
  const width = x2 - x1;
  const height = y2 - y1;

  // 在URL中添加裁剪参数
  const separator = originalUrl.includes('?') ? '&' : '?';
  return `${originalUrl}${separator}x-oss-process=image/crop,x_${x1},y_${y1},w_${width},h_${height}`;
}

/**
 * 将阿里云格式转换为我们的题目格式
 */
export function convertAliyunQuestionsToOurFormat(
  aliyunQuestions: Question[],
  originalImageUrl?: string  // 添加原始图片URL参数
): Array<{
  id: string;
  content: string;
  type: 'choice' | 'fill_blank' | 'essay';
  options?: Array<{
    text: string;
    bbox_2d?: number[];
    croppedImage?: string;
    images?: Array<{ bbox: number[]; label?: string; url?: string }>;
  }>;
  images?: Array<{ bbox: number[]; label?: string; url?: string }>;
  bbox_2d?: number[];
  aliyunData?: Question;
}> {
  return aliyunQuestions.map((question, index) => {
    const qId = String(index + 1);
    const { info, sub_images, merged_image, pos_list } = question;

    // 调试日志：查看阿里云API返回的图片数据
    log.info(`题目${index + 1}图片数据`, {
      hasSubImages: !!sub_images,
      subImagesCount: Array.isArray(sub_images) ? sub_images.length : 0,
      subImages: sub_images,
      hasMergedImage: !!merged_image,
      mergedImage: merged_image?.substring(0, 50) + '...',
      hasFigures: Array.isArray(info?.figure),
      figuresCount: Array.isArray(info?.figure) ? info.figure.length : 0
    });

    // 确定题目类型
    let type: 'choice' | 'fill_blank' | 'essay' = 'essay';
    if (info.type === '选择题') type = 'choice';
    else if (info.type === '填空题') type = 'fill_blank';

    // 提取题干文本
    const content = info.stem?.text || '';

    // 提取选项（包含坐标信息和裁剪图片）
    const options = (Array.isArray(info.option) ? info.option : []).map((opt) => {
      const bbox = posListToBbox2d(opt?.pos_list?.[0]);

      // 必须使用原始图片URL生成裁剪URL
      // 阿里云OSS临时URL会签名失效，导致403错误
      if (!originalImageUrl) {
        console.warn('缺少原始图片URL，无法生成选项裁剪图片');
        return {
          text: opt?.text || '',
          bbox_2d: bbox,
          croppedImage: ''  // 无裁剪图片
        };
      }

      // 为选项生成裁剪图片URL（扩展30px确保完整显示）
      const paddedBbox = [
        Math.max(0, (bbox || [0, 0, 0, 0])[0] - 30),
        Math.max(0, (bbox || [0, 0, 0, 0])[1] - 30),
        (bbox || [0, 0, 0, 0])[2] + 30,
        (bbox || [0, 0, 0, 0])[3] + 30
      ];
      const croppedUrl = generateCroppedImageUrl(originalImageUrl, paddedBbox as [number, number, number, number]);

      return {
        text: opt?.text || '',
        bbox_2d: bbox,
        croppedImage: croppedUrl  // 添加裁剪图片URL
      };
    });

    // 提取插图（包含URL）
    // 只显示真正的图形，过滤掉纯文字区域
    const figures = (Array.isArray(info.figure) ? info.figure : [])
      .map((fig, figIndex) => {
        const bbox = posListToBbox2d(fig?.pos_list?.[0]);

        // 计算图形面积，过滤掉太小的可能是噪声的区域
        const width = (bbox?.[2] || 0) - (bbox?.[0] || 0);
        const height = (bbox?.[3] || 0) - (bbox?.[1] || 0);
        const area = width * height;

        // 面积阈值：小于10000像素平方的可能是文字或噪声，不显示
        const MIN_FIGURE_AREA = 10000;
        if (area < MIN_FIGURE_AREA) {
          log.info(`过滤小面积图形${figIndex + 1}`, { area, width, height });
          return null;
        }

        // 优先使用sub_images中的URL（已切割的子图）
        if (sub_images && Array.isArray(sub_images) && sub_images[figIndex]) {
          const httpsUrl = sub_images[figIndex].replace(/^http:\/\//, 'https://');

          // 调试日志
          if (figIndex === 0) {
            log.info('插图URL转换', {
              原始URL: sub_images[figIndex].substring(0, 80) + '...',
              转换后URL: httpsUrl.substring(0, 80) + '...'
            });
          }

          return {
            bbox: bbox,
            label: `插图${figIndex + 1}`,
            url: httpsUrl  // 替换为HTTPS
          };
        }

        // 降级：使用merged_image
        if (merged_image) {
          return {
            bbox: bbox,
            label: `插图${figIndex + 1}`,
            url: merged_image.replace(/^http:\/\//, 'https://')  // 替换为HTTPS
          };
        }

        // 最后降级：使用原始图片URL
        if (originalImageUrl) {
          return {
            bbox: bbox,
            label: `插图${figIndex + 1}`,
            url: originalImageUrl.replace(/^http:\/\//, 'https://')  // 确保HTTPS
          };
        }

        return {
          bbox: bbox,
          label: `插图${figIndex + 1}`,
          url: ''
        };
      })
      .filter(fig => fig !== null); // 过滤掉null值

    // 如果没有单独的插图URL，使用merged_image
    const images = figures.length > 0 ? figures : undefined;

    // 调试日志：查看返回的图片数据
    if (qId === '1') {
      log.info('题目1图片数据准备返回', {
        imagesCount: figures.length,
        images: figures.map(f => ({
          hasUrl: !!f.url,
          urlLength: f.url?.length || 0,
          urlPreview: f.url ? f.url.substring(0, 60) + '...' : '空URL',
          label: f.label
        }))
      });
    }

    // 提取题目bbox（使用第一个pos_list）
    const bbox_2d = (pos_list && Array.isArray(pos_list) && pos_list[0])
      ? posListToBbox2d(pos_list[0])
      : undefined;

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
