// lib/grading/config.ts
/**
 * 批改系统配置管理
 *
 * 核心功能：
 * 1. 统一管理所有模块的配置
 * 2. 提供默认配置和自定义配置
 * 3. 配置验证和热更新
 */

import type { TopKMatcherOptions } from '@/lib/matching/types';
import type { RerankConfig } from '@/lib/rerank/types';
import type { FusionConfig } from '@/lib/confidence/types';
import type { FallbackConfig } from '@/lib/fallback/types';

/**
 * 批改系统完整配置
 */
export interface GradingSystemConfig {
  /** Top-K 匹配配置 */
  topK: TopKMatcherOptions & {
    enabled: boolean;
  };
  /** Rerank 配置 */
  rerank: RerankConfig;
  /** 置信度融合配置 */
  fusion: FusionConfig;
  /** Fallback 配置 */
  fallback: FallbackConfig;
  /** 系统级配置 */
  system: {
    /** 调试模式 */
    debug: boolean;
    /** 最大并发批改数 */
    maxConcurrency: number;
    /** 总超时时间（毫秒） */
    totalTimeout: number;
    /** 是否启用性能监控 */
    enablePerformanceMonitoring: boolean;
    /** 是否启用成本追踪 */
    enableCostTracking: boolean;
  };
}

/**
 * 默认配置
 */
export const DEFAULT_GRADING_CONFIG: GradingSystemConfig = {
  topK: {
    enabled: true,
    k: 3,
    maxDistance: 500,
    debug: false
  },
  rerank: {
    defaultModel: 'glm-4v-plus',
    visionModel: 'glm-4v-plus',
    maxConcurrentRequests: 3,
    requestTimeout: 10000,
    enableCache: true,
    cacheExpirationSeconds: 300,
    triggerThresholds: {
      lowConfidence: 0.75,
      closeScores: 0.15,
      fewCandidates: 2,
      highVariance: 0.3
    }
  },
  fusion: {
    defaultMethod: 'adaptive',
    defaultWeights: {
      ocr: 0.15,
      graph: 0.20,
      llm: 0.25,
      topK: 0.15,
      rerank: 0.15,
      historical: 0.05,
      antiHallucination: 0.05
    },
    minConfidenceThreshold: 0.5,
    consistencyThreshold: 0.7,
    enableAdaptiveWeights: true,
    enableCalibration: false
  },
  fallback: {
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 30000,
    enableCache: true,
    cacheExpirationSeconds: 300,
    enableMonitoring: true,
    enableLearning: true
  },
  system: {
    debug: false,
    maxConcurrency: 5,
    totalTimeout: 60000,
    enablePerformanceMonitoring: true,
    enableCostTracking: true
  }
};

/**
 * 配置预设
 */
export const CONFIG_PRESETS: Record<string, Partial<GradingSystemConfig>> = {
  /**
   * 快速模式：优先速度，降低准确率要求
   */
  fast: {
    topK: {
      enabled: true,
      k: 2,
      maxDistance: 400,
      debug: false
    },
    rerank: {
      ...DEFAULT_GRADING_CONFIG.rerank,
      triggerThresholds: {
        lowConfidence: 0.65,
        closeScores: 0.2,
        fewCandidates: 1,
        highVariance: 0.4
      }
    },
    fallback: {
      ...DEFAULT_GRADING_CONFIG.fallback,
      maxRetries: 1
    },
    system: {
      ...DEFAULT_GRADING_CONFIG.system,
      maxConcurrency: 10,
      totalTimeout: 30000
    }
  },

  /**
   * 精确模式：优先准确率，降低速度要求
   */
  accurate: {
    topK: {
      enabled: true,
      k: 5,
      maxDistance: 600,
      debug: false
    },
    rerank: {
      ...DEFAULT_GRADING_CONFIG.rerank,
      triggerThresholds: {
        lowConfidence: 0.85,
        closeScores: 0.1,
        fewCandidates: 3,
        highVariance: 0.2
      }
    },
    fusion: {
      ...DEFAULT_GRADING_CONFIG.fusion,
      enableCalibration: true
    },
    fallback: {
      ...DEFAULT_GRADING_CONFIG.fallback,
      maxRetries: 5,
      enableMonitoring: true
    },
    system: {
      ...DEFAULT_GRADING_CONFIG.system,
      maxConcurrency: 3,
      totalTimeout: 120000
    }
  },

  /**
   * 平衡模式：速度和准确率的平衡
   */
  balanced: {
    // 使用默认配置即可
  },

  /**
   * 开发模式：启用调试和详细日志
   */
  development: {
    topK: {
      enabled: true,
      k: 3,
      maxDistance: 500,
      debug: true
    },
    rerank: {
      ...DEFAULT_GRADING_CONFIG.rerank,
      enableCache: false
    },
    system: {
      ...DEFAULT_GRADING_CONFIG.system,
      debug: true,
      enablePerformanceMonitoring: true,
      enableCostTracking: true
    }
  },

  /**
   * 生产模式：优化性能和成本
   */
  production: {
    topK: {
      enabled: true,
      k: 3,
      maxDistance: 500,
      debug: false
    },
    rerank: {
      ...DEFAULT_GRADING_CONFIG.rerank,
      enableCache: true,
      cacheExpirationSeconds: 600
    },
    fallback: {
      ...DEFAULT_GRADING_CONFIG.fallback,
      enableCache: true
    },
    system: {
      ...DEFAULT_GRADING_CONFIG.system,
      debug: false,
      maxConcurrency: 8,
      enablePerformanceMonitoring: true,
      enableCostTracking: true
    }
  }
};

/**
 * 配置管理器
 */
export class GradingConfigManager {
  private config: GradingSystemConfig;

  constructor(customConfig?: Partial<GradingSystemConfig>) {
    this.config = this.mergeConfig(DEFAULT_GRADING_CONFIG, customConfig);
  }

  /**
   * 获取完整配置
   */
  getConfig(): GradingSystemConfig {
    return { ...this.config };
  }

  /**
   * 获取部分配置
   */
  getSection<K extends keyof GradingSystemConfig>(
    section: K
  ): GradingSystemConfig[K] {
    return { ...this.config[section] };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<GradingSystemConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
  }

  /**
   * 加载预设
   */
  loadPreset(presetName: string): void {
    const preset = CONFIG_PRESETS[presetName];
    if (!preset) {
      throw new Error(`未找到预设配置: ${presetName}`);
    }

    this.config = this.mergeConfig(DEFAULT_GRADING_CONFIG, preset);
  }

  /**
   * 验证配置
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证 Top-K 配置
    if (this.config.topK.enabled && this.config.topK.k! < 1) {
      errors.push('topK.k 必须 >= 1');
    }

    // 验证 Rerank 配置
    if (this.config.rerank.maxConcurrentRequests < 1) {
      errors.push('rerank.maxConcurrentRequests 必须 >= 1');
    }

    // 验证 Fallback 配置
    if (this.config.fallback.maxRetries < 0) {
      errors.push('fallback.maxRetries 必须 >= 0');
    }

    // 验证系统配置
    if (this.config.system.maxConcurrency < 1) {
      errors.push('system.maxConcurrency 必须 >= 1');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 导出配置（用于保存或日志）
   */
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * 从 JSON 导入配置
   */
  importConfig(jsonConfig: string): void {
    try {
      const parsed = JSON.parse(jsonConfig);
      this.config = this.mergeConfig(DEFAULT_GRADING_CONFIG, parsed);
    } catch (error) {
      throw new Error(`配置导入失败: ${error}`);
    }
  }

  /**
   * 合并配置
   */
  private mergeConfig(
    base: GradingSystemConfig,
    updates?: Partial<GradingSystemConfig>
  ): GradingSystemConfig {
    if (!updates) {
      return { ...base };
    }

    return {
      topK: { ...base.topK, ...updates.topK },
      rerank: { ...base.rerank, ...updates.rerank },
      fusion: { ...base.fusion, ...updates.fusion },
      fallback: { ...base.fallback, ...updates.fallback },
      system: { ...base.system, ...updates.system }
    };
  }
}

/**
 * 全局配置管理器实例
 */
let globalConfigManager: GradingConfigManager | null = null;

/**
 * 获取全局配置管理器实例
 */
export function getGradingConfigManager(
  customConfig?: Partial<GradingSystemConfig>
): GradingConfigManager {
  if (!globalConfigManager) {
    globalConfigManager = new GradingConfigManager(customConfig);
  } else if (customConfig) {
    globalConfigManager.updateConfig(customConfig);
  }
  return globalConfigManager;
}

/**
 * 快捷方法：获取当前配置
 */
export function getGradingConfig(): GradingSystemConfig {
  return getGradingConfigManager().getConfig();
}

/**
 * 快捷方法：加载预设配置
 */
export function loadGradingPreset(presetName: string): void {
  getGradingConfigManager().loadPreset(presetName);
}
