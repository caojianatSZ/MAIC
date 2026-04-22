/**
 * 图像预处理模块
 *
 * 功能：
 * 1. 自动旋转校正 - 检测并修正图片倾斜
 * 2. 对比度增强 - 让文字更清晰
 * 3. 去噪 - 去除背景杂点
 * 4. 二值化 - 黑白化，提高OCR准确率
 * 5. 分辨率标准化 - 确保DPI足够
 */

import { createLogger } from '@/lib/logger';
import sharp from 'sharp';

const log = createLogger('ImagePreprocessing');

export interface PreprocessOptions {
  autoRotate?: boolean;        // 自动旋转
  enhanceContrast?: boolean;    // 增强对比度
  denoise?: boolean;            // 去噪
  binarize?: boolean;           // 二值化
  minDPI?: number;             // 最小DPI
  quality?: number;            // JPEG质量 (1-100)
}

export interface PreprocessResult {
  processedImage: string;       // 处理后的base64图片
  operations: string[];        // 执行的操作
  metrics: {
    originalSize: number;
    processedSize: number;
    compressionRatio: number;
  };
}

const DEFAULT_OPTIONS: PreprocessOptions = {
  autoRotate: true,
  enhanceContrast: true,
  denoise: false,  // OpenCV依赖太重，暂时禁用
  binarize: false,  // 二值化会损失信息，谨慎使用
  minDPI: 150,     // 150 DPI已足够
  quality: 95      // 高质量JPEG
};

/**
 * 图像预处理主函数
 */
export async function preprocessImage(
  imageBase64: string,
  options: PreprocessOptions = {}
): Promise<PreprocessResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const operations: string[] = [];

  log.info('开始图像预处理', { opts });

  try {
    // 1. 提取Buffer
    const buffer = bufferFromBase64(imageBase64);
    const originalSize = buffer.length;

    let image = sharp(buffer);

    // 2. 自动旋转校正（基于EXIF信息）
    if (opts.autoRotate) {
      image = image.rotate();  // sharp会自动读取EXIF并校正
      operations.push('autoRotate');
    }

    // 3. 对比度增强（使用modulate）
    if (opts.enhanceContrast) {
      image = image.modulate({
        brightness: 1.05,  // 轻微提亮
        saturation: 1.1    // 增加饱和度
      });
      operations.push('enhanceContrast');
    }

    // 4. 锐化（让文字边缘更清晰）
    image = image.sharpen(
      3,    // sigma (高斯矩阵)
      0.5,  // flat (平坦锐化)
      1     // jagged (锯齿锐化)
    );
    operations.push('sharpen');

    // 5. 调整大小（确保分辨率足够）
    const metadata = await image.metadata();
    const currentDPI = (metadata.width || 0) / 8; // 粗略估算

    if (opts.minDPI && currentDPI < opts.minDPI) {
      const scaleFactor = opts.minDPI / currentDPI;
      image = image.resize(
        Math.round((metadata.width || 0) * scaleFactor),
        Math.round((metadata.height || 0) * scaleFactor),
        {
          kernel: sharp.kernel.lanczos3,  // 高质量缩放
          fit: 'inside'
        }
      );
      operations.push(`resizeTo${opts.minDPI}DPI`);
    }

    // 6. 可选：二值化（谨慎使用）
    if (opts.binarize) {
      image = image.threshold(128);  // 简单阈值二值化
      operations.push('binarize');
    }

    // 7. 输出为JPEG（压缩）
    const processedBuffer = await image
      .jpeg({ quality: opts.quality })
      .toBuffer();

    const processedSize = processedBuffer.length;
    const compressionRatio = originalSize / processedSize;

    log.info('图像预处理完成', {
      operations,
      originalSize,
      processedSize,
      compressionRatio: compressionRatio.toFixed(2)
    });

    return {
      processedImage: `data:image/jpeg;base64,${processedBuffer.toString('base64')}`,
      operations,
      metrics: {
        originalSize,
        processedSize,
        compressionRatio
      }
    };

  } catch (error) {
    log.error('图像预处理失败', {
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * 从Base64提取Buffer
 */
function bufferFromBase64(base64: string): Buffer {
  // 移除data:image前缀
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

/**
 * 快速预处理（仅执行必要的操作）
 */
export async function quickPreprocess(
  imageBase64: string
): Promise<string> {
  const result = await preprocessImage(imageBase64, {
    autoRotate: true,
    enhanceContrast: true,
    denoise: false,
    binarize: false,
    quality: 92
  });

  return result.processedImage;
}

/**
 * 强预处理（用于质量差的图片）
 */
export async function aggressivePreprocess(
  imageBase64: string
): Promise<string> {
  const result = await preprocessImage(imageBase64, {
    autoRotate: true,
    enhanceContrast: true,
    denoise: true,
    binarize: false,
    minDPI: 200,
    quality: 98
  });

  return result.processedImage;
}

/**
 * 检测图片是否需要预处理
 */
export async function needsPreprocessing(
  imageBase64: string
): Promise<{
  needs: boolean;
  reason: string;
  suggestions: PreprocessOptions;
}> {
  const buffer = bufferFromBase64(imageBase64);
  const metadata = await sharp(buffer).metadata();

  const issues: string[] = [];
  const suggestions: PreprocessOptions = {};

  // 检查分辨率
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  if (width < 1000 || height < 1000) {
    issues.push('分辨率过低');
    suggestions.minDPI = 200;
  }

  // 检查是否有EXIF旋转信息
  if (metadata.orientation && metadata.orientation > 1) {
    issues.push('图片可能需要旋转');
    suggestions.autoRotate = true;
  }

  // 检查文件大小（过小可能质量差）
  if (buffer.length < 50000) {  // < 50KB
    issues.push('图片文件过小，可能质量差');
    suggestions.enhanceContrast = true;
    suggestions.quality = 98;
  }

  return {
    needs: issues.length > 0,
    reason: issues.join('; ') || '图片质量良好',
    suggestions: issues.length > 0 ? suggestions : {}
  };
}
