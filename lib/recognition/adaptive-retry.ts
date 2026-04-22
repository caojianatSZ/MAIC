/**
 * 自适应重试策略
 *
 * 根据识别结果自动选择最佳的重试策略：
 * - 0题：图像预处理 + 重试
 * - 1-2题：分区域识别
 * - 连续性问题：LLM验证
 * - 选项缺失：AnswerSSE验证
 */

import { createLogger } from '@/lib/logger';
import { quickPreprocess, aggressivePreprocess, needsPreprocessing } from '@/lib/image/preprocessing';
import { quickValidate, validateQuestionContinuity } from '@/lib/validation/continuity';
import { cutQuestions } from '@/lib/aliyun/edututor-client';

const log = createLogger('AdaptiveRetry');

export interface RetryConfig {
  maxRetries: number;
  enablePreprocessing: boolean;
  enableRegionSplit: boolean;
  enableLLMVerification: boolean;
}

export interface RetryResult {
  success: boolean;
  questions: any[];
  attempts: number;
  strategy: string;
  reason: string;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  enablePreprocessing: true,
  enableRegionSplit: true,
  enableLLMVerification: false  // 暂时禁用，成本高
};

/**
 * 自适应重试主函数
 */
export async function adaptiveRecognize(
  imageBase64: string,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult> {
  const cfg: RetryConfig = {
    maxRetries: config.maxRetries ?? DEFAULT_CONFIG.maxRetries,
    enablePreprocessing: config.enablePreprocessing ?? DEFAULT_CONFIG.enablePreprocessing,
    enableRegionSplit: config.enableRegionSplit ?? DEFAULT_CONFIG.enableRegionSplit,
    enableLLMVerification: config.enableLLMVerification ?? DEFAULT_CONFIG.enableLLMVerification
  };

  log.info('开始自适应识别', { config: cfg });

  let result = await cutQuestionsFromImage(imageBase64);
  let attempts = 1;
  let strategy = 'initial';

  // 尝试重试
  while (shouldRetry(result, attempts, cfg) && attempts <= cfg.maxRetries) {
    const retryStrategy = selectRetryStrategy(result, attempts, cfg);
    log.info(`第${attempts}次重试，策略：${retryStrategy}`);

    attempts++;
    strategy = retryStrategy;

    try {
      switch (retryStrategy) {
        case 'preprocess':
          result = await retryWithPreprocessing(imageBase64, cfg);
          break;

        case 'aggressive_preprocess':
          result = await retryWithAggressivePreprocessing(imageBase64, cfg);
          break;

        case 'region_split':
          result = await retryWithRegionSplit(imageBase64, result);
          break;

        case 'llm_verify':
          result = await retryWithLLMVerification(imageBase64, result);
          break;

        default:
          log.warn('未知重试策略', { strategy: retryStrategy });
          break;
      }

      // 如果成功，跳出循环
      if (isSuccessfulResult(result)) {
        break;
      }

    } catch (error) {
      log.error(`重试失败（策略：${retryStrategy}）`, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const success = isSuccessfulResult(result);
  const reason = success
    ? `识别成功（${attempts}次尝试）`
    : `识别未达到预期（${attempts}次尝试）`;

  log.info('自适应识别完成', {
    success,
    attempts,
    strategy,
    questionCount: result.questions?.length || 0
  });

  return {
    success,
    questions: result.questions || [],
    attempts,
    strategy,
    reason
  };
}

/**
 * 判断是否需要重试
 */
function shouldRetry(
  result: any,
  attempts: number,
  config: RetryConfig
): boolean {
  // 超过最大重试次数
  if (attempts > config.maxRetries) {
    return false;
  }

  const questionCount = result.questions?.length || 0;

  // 0题：必须重试
  if (questionCount === 0) {
    return true;
  }

  // 1-2题：可能需要重试
  if (questionCount < 3 && attempts < 2) {
    return true;
  }

  // 快速验证不通过
  const quickValidation = quickValidate(normalizeQuestions(result.questions));
  if (!quickValidation.isValid && attempts < 2) {
    return true;
  }

  return false;
}

/**
 * 选择重试策略
 */
function selectRetryStrategy(
  result: any,
  attempts: number,
  config: RetryConfig
): string {
  const questionCount = result.questions?.length || 0;

  // 第1次重试
  if (attempts === 1) {
    // 0题：尝试预处理
    if (questionCount === 0 && config.enablePreprocessing) {
      return 'preprocess';
    }

    // 1-2题：尝试分区域识别
    if (questionCount < 3 && config.enableRegionSplit) {
      return 'region_split';
    }
  }

  // 第2次重试
  if (attempts === 2) {
    // 0题：尝试强力预处理
    if (questionCount === 0 && config.enablePreprocessing) {
      return 'aggressive_preprocess';
    }

    // 题目数少：尝试LLM验证
    if (questionCount < 3 && config.enableLLMVerification) {
      return 'llm_verify';
    }
  }

  // 第3次重试：使用最激进的策略
  if (attempts === 3) {
    if (config.enablePreprocessing) {
      return 'aggressive_preprocess';
    }
  }

  return 'preprocess';
}

/**
 * 策略：使用预处理重试
 */
async function retryWithPreprocessing(
  imageBase64: string,
  config: RetryConfig
): Promise<any> {
  log.info('使用预处理重试');

  const preprocessed = await quickPreprocess(imageBase64);
  return await cutQuestionsFromImage(preprocessed);
}

/**
 * 策略：使用强力预处理重试
 */
async function retryWithAggressivePreprocessing(
  imageBase64: string,
  config: RetryConfig
): Promise<any> {
  log.info('使用强力预处理重试');

  const preprocessed = await aggressivePreprocess(imageBase64);
  return await cutQuestionsFromImage(preprocessed);
}

/**
 * 策略：分区域识别
 */
async function retryWithRegionSplit(
  imageBase64: string,
  originalResult: any
): Promise<any> {
  log.info('使用分区域识别重试');

  // TODO: 实现分区域识别
  // 暂时返回原始结果
  return originalResult;
}

/**
 * 策略：LLM验证
 */
async function retryWithLLMVerification(
  imageBase64: string,
  originalResult: any
): Promise<any> {
  log.info('使用LLM验证重试');

  // TODO: 实现LLM验证
  // 暂时返回原始结果
  return originalResult;
}

/**
 * 调用CutQuestions API
 */
async function cutQuestionsFromImage(imageBase64: string): Promise<any> {
  // 创建临时文件URL
  const tempImageUrl = await createTempImageUrl(imageBase64);

  try {
    const result = await cutQuestions(tempImageUrl, {
      struct: true,
      extract_images: true
    });

    return result;
  } finally {
    // 清理临时文件
    // TODO: 实现清理逻辑
  }
}

/**
 * 创建临时图片URL
 */
async function createTempImageUrl(imageBase64: string): Promise<string> {
  // TODO: 复用 photo-aliyun route.ts 中的逻辑
  // 暂时返回base64（实际需要URL）
  return imageBase64;
}

/**
 * 判断结果是否成功
 */
function isSuccessfulResult(result: any): boolean {
  const questionCount = result.questions?.length || 0;

  // 至少识别到3道题
  if (questionCount >= 3) {
    return true;
  }

  // 或者通过快速验证
  const validation = quickValidate(normalizeQuestions(result.questions));
  return validation.isValid;
}

/**
 * 标准化题目格式
 */
function normalizeQuestions(questions: any[]): any[] {
  return questions.map(q => ({
    id: String(q.id || q.questionId || ''),
    content: q.content || q.stem || '',
    type: q.type || 'essay',
    options: q.options || []
  }));
}

/**
 * 一次性识别（带自动检测是否需要预处理）
 */
export async function smartRecognize(
  imageBase64: string
): Promise<RetryResult> {
  log.info('智能识别：检测是否需要预处理');

  // 检测是否需要预处理
  const check = await needsPreprocessing(imageBase64);

  if (check.needs) {
    log.info('图片需要预处理', { reason: check.reason });
    const preprocessed = await quickPreprocess(imageBase64);
    return await adaptiveRecognize(preprocessed);
  }

  log.info('图片质量良好，直接识别');
  return await adaptiveRecognize(imageBase64);
}
