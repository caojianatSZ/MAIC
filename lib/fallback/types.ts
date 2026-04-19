// lib/fallback/types.ts
/**
 * Fallback 体系类型定义
 *
 * 核心概念：
 * - 多级降级策略：确保系统稳定性
 * - 智能决策：基于错误类型和上下文选择策略
 * - 监控学习：收集数据优化 fallback 策略
 */

/**
 * 批改上下文
 */
export interface GradingContext {
  /** 题目 ID */
  questionId: string;
  /** 题目内容 */
  questionContent: string;
  /** 题目类型 */
  questionType?: 'choice' | 'fill_blank' | 'essay';
  /** 图像数据（base64） */
  imageBase64?: string;
  /** OCR 文本 */
  ocrText?: string;
  /** 手写块 */
  handwritingBlocks?: Array<{
    text: string;
    bbox: number[];
    confidence?: number;
  }>;
  /** 已尝试的方法 */
  attemptedMethods: string[];
  /** 上一步的结果 */
  previousResult?: any;
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * Fallback 结果
 */
export interface FallbackResult {
  /** 是否成功 */
  success: boolean;
  /** 使用的策略 */
  strategy: FallbackStrategy;
  /** 结果数据 */
  result?: any;
  /** 错误信息（如果失败） */
  error?: string;
  /** 处理时间（毫秒） */
  processingTimeMs: number;
  /** 置信度 */
  confidence: number;
  /** 需要人工复核 */
  needsReview: boolean;
  /** 复核原因 */
  reviewReason?: string;
}

/**
 * Fallback 策略
 */
export type FallbackStrategy =
  | 'retry_same_model'           // 重试相同模型
  | 'switch_model'               // 切换模型
  | 'use_legacy_method'          // 使用传统方法
  | 'reduce_scope'               // 减小范围
  | 'use_cache'                  // 使用缓存
  | 'manual_review'              // 人工复核
  | 'skip_question'              // 跳过该题
  | 'simplified_pipeline';       // 简化流程

/**
 * 错误类型
 */
export enum ErrorType {
  /** 网络错误 */
  NETWORK = 'network',
  /** API 错误 */
  API = 'api',
  /** 超时 */
  TIMEOUT = 'timeout',
  /** 解析错误 */
  PARSE = 'parse',
  /** 数据不足 */
  INSUFFICIENT_DATA = 'insufficient_data',
  /** 模型错误 */
  MODEL = 'model',
  /** 未知错误 */
  UNKNOWN = 'unknown'
}

/**
 * Fallback 触发条件
 */
export interface FallbackTrigger {
  /** 错误类型 */
  errorType: ErrorType;
  /** 错误消息 */
  errorMessage?: string;
  /** 错误详情 */
  errorDetails?: any;
  /** 触发时的上下文 */
  context: GradingContext;
  /** 触发时间戳 */
  timestamp: number;
  /** 优先级 */
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Fallback 配置
 */
export interface FallbackConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 重试延迟（毫秒） */
  retryDelay: number;
  /** 超时时间（毫秒） */
  timeout: number;
  /** 是否启用缓存 */
  enableCache: boolean;
  /** 缓存过期时间（秒） */
  cacheExpirationSeconds: number;
  /** 是否启用监控 */
  enableMonitoring: boolean;
  /** 是否启用学习 */
  enableLearning: boolean;
}

/**
 * 策略执行结果
 */
export interface StrategyExecution {
  /** 策略名称 */
  strategy: FallbackStrategy;
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime: number;
  /** 成功与否 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 执行详情 */
  details?: Record<string, any>;
}

/**
 * Fallback 历史
 */
export interface FallbackHistory {
  /** 题目 ID */
  questionId: string;
  /** 触发条件 */
  trigger: FallbackTrigger;
  /** 尝试的策略 */
  attempts: StrategyExecution[];
  /** 最终结果 */
  finalResult: FallbackResult;
  /** 总耗时 */
  totalTimeMs: number;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 监控指标
 */
export interface FallbackMetrics {
  /** 总触发次数 */
  totalTriggers: number;
  /** 按策略类型统计 */
  byStrategy: Record<FallbackStrategy, number>;
  /** 按错误类型统计 */
  byErrorType: Record<ErrorType, number>;
  /** 成功率 */
  successRate: number;
  /** 平均处理时间 */
  avgProcessingTimeMs: number;
  /** 最常用策略 */
  mostUsedStrategy: FallbackStrategy;
  /** 最常见错误 */
  mostCommonError: ErrorType;
  /** 需要人工复核的数量 */
  manualReviewCount: number;
}

/**
 * 策略性能统计
 */
export interface StrategyPerformance {
  /** 策略名称 */
  strategy: FallbackStrategy;
  /** 使用次数 */
  usageCount: number;
  /** 成功次数 */
  successCount: number;
  /** 成功率 */
  successRate: number;
  /** 平均处理时间 */
  avgProcessingTimeMs: number;
  /** 最后使用时间 */
  lastUsedAt: number;
}

/**
 * 学习数据
 */
export interface LearningData {
  /** 错误类型到策略的映射 */
  errorToStrategy: Map<ErrorType, FallbackStrategy[]>;
  /** 策略成功率历史 */
  strategyHistory: Map<FallbackStrategy, number[]>;
  /** 上下文特征 */
  contextFeatures: Array<{
    context: GradingContext;
    strategy: FallbackStrategy;
    success: boolean;
    timestamp: number;
  }>;
}

/**
 * 缓存条目
 */
export interface CacheEntry {
  /** 题目 ID */
  questionId: string;
  /** 结果 */
  result: any;
  /** 置信度 */
  confidence: number;
  /** 创建时间 */
  createdAt: number;
  /** 过期时间 */
  expiresAt: number;
  /** 使用的策略 */
  strategy: FallbackStrategy;
}
