// lib/aliyun/extract-option-images.ts
/**
 * 基于阿里云API坐标，从原图中提取选项图形
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('OptionImageExtractor');

interface Option {
  text: string;
  pos_list: number[][];
}

interface Question {
  pos_list: number[][];
  sub_images: string[];
  merged_image: string;
  info: {
    option: Option[];
    figure: Array<{ pos_list: number[][] }>;
  };
}

/**
 * 从题目图片中提取选项图形
 */
export async function extractOptionImages(
  question: Question,
  padding = 20 // 扩展像素，确保包含完整的选项图形
): Promise<Array<{
  optionLetter: string;
  imageUrl: string;
  bbox: number[];
  originalOption: Option;
}>> {
  const results: Array<{
    optionLetter: string;
    imageUrl: string;
    bbox: number[];
    originalOption: Option;
  }> = [];

  const options = question.info.option || [];
  const mergedImageUrl = question.merged_image;

  if (!mergedImageUrl || options.length === 0) {
    log.warn('无法提取选项图形', {
      hasMergedImage: !!mergedImageUrl,
      optionCount: options.length
    });
    return results;
  }

  log.info('开始提取选项图形', {
    optionCount: options.length,
    padding
  });

  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    const posList = option.pos_list[0];

    if (!posList || posList.length !== 8) {
      log.warn(`选项${i + 1}坐标无效`, { posList });
      continue;
    }

    const [x1, y1, x2, y2, x3, y3, x4, y4] = posList;

    // 计算边界框
    const minX = Math.min(x1, x2, x3, x4);
    const maxX = Math.max(x1, x2, x3, x4);
    const minY = Math.min(y1, y2, y3, y4);
    const maxY = Math.max(y1, y2, y3, y4);

    // 扩展边界框，包含完整的选项图形
    const expandedBbox = [
      Math.max(0, minX - padding),
      Math.max(0, minY - padding),
      maxX + padding,
      maxY + padding
    ];

    // 生成切割后的图片URL
    // 这里使用阿里云OSS的图片处理功能
    const croppedUrl = generateCroppedImageUrl(mergedImageUrl, expandedBbox as [number, number, number, number]);

    results.push({
      optionLetter: option.text.trim(),
      imageUrl: croppedUrl,
      bbox: expandedBbox,
      originalOption: option
    });
  }

  log.info('选项图形提取完成', {
    extractedCount: results.length
  });

  return results;
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

  // 使用阿里云OSS的imgparam参数进行图片切割
  // 文档: https://help.aliyun.com/document_detail/44688.html
  const cropParam = `${x1},${y1},${width},${height}`;

  // 在URL中添加裁剪参数
  const separator = originalUrl.includes('?') ? '&' : '?';
  return `${originalUrl}${separator}x-oss-process=image/crop,x_${x1},y_${y1},w_${width},h_${height}`;
}

/**
 * 将选项图形添加到题目数据中
 */
export function enrichQuestionWithOptions(
  question: Question
): Question & {
  optionImages?: Array<{
    optionLetter: string;
    imageUrl: string;
    bbox: number[];
  }>;
} {
  const options = question.info.option || [];

  // 为每个选项生成图片URL
  const optionImages = options.map((option, index) => {
    const posList = option.pos_list[0];
    if (!posList || posList.length !== 8) {
      return {
        optionLetter: option.text.trim(),
        imageUrl: '',
        bbox: [0, 0, 0, 0]
      };
    }

    const [x1, y1, x2, y2, x3, y3, x4, y4] = posList;
    const minX = Math.min(x1, x2, x3, x4);
    const maxX = Math.max(x1, x2, x3, x4);
    const minY = Math.min(y1, y2, y3, y4);
    const maxY = Math.max(y1, y2, y3, y4);

    // 扩展边界框
    const padding = 30;
    const bbox = [
      Math.max(0, minX - padding),
      Math.max(0, minY - padding),
      maxX + padding,
      maxY + padding
    ];

    return {
      optionLetter: option.text.trim(),
      imageUrl: generateCroppedImageUrl(question.merged_image, bbox as [number, number, number, number]),
      bbox
    };
  });

  return {
    ...question,
    optionImages
  };
}
