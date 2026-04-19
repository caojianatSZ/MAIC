// lib/grading/__tests__/integration.test.ts
/**
 * 端到端集成测试
 *
 * 测试完整的批改流程：
 * 1. OCR 输入 → 结构重建 → Top-K 匹配 → Rerank → 置信度融合
 * 2. 各模块协同工作
 * 3. Fallback 机制
 * 4. 配置管理
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { gradeExamPaper, quickGrade } from '../orchestrator';
import { getGradingConfigManager } from '../config';
import type { Question, OCRBlock } from '@/lib/structure/builder';

describe('批改系统集成测试', () => {
  // 模拟 OCR 结果
  const mockOCRResult = {
    questions: [
      {
        question_id: '1',
        question: '1. 计算 2 + 3 = ?',
        question_blocks: [
          {
            text: '1. 计算 2 + 3 = ?',
            bbox: [100, 100, 400, 130],
            type: 'print',
            confidence: 0.95
          }
        ],
        answer_blocks: [],
        answer_bbox: undefined,
        question_bbox: [100, 100, 400, 130]
      },
      {
        question_id: '2',
        question: '2. 填空：中国的首都是____',
        question_blocks: [
          {
            text: '2. 填空：中国的首都是____',
            bbox: [100, 200, 450, 230],
            type: 'print',
            confidence: 0.92
          }
        ],
        answer_blocks: [],
        answer_bbox: undefined,
        question_bbox: [100, 200, 450, 230]
      }
    ],
    handwritingBlocks: [
      {
        text: '5',
        bbox: [420, 105, 450, 125],
        type: 'handwriting',
        confidence: 0.88
      },
      {
        text: '北京',
        bbox: [460, 205, 510, 225],
        type: 'handwriting',
        confidence: 0.91
      }
    ]
  };

  const mockImageBase64 = 'mock_image_base64_string';

  describe('配置管理测试', () => {
    it('应该加载默认配置', () => {
      const config = getGradingConfigManager().getConfig();

      expect(config.topK.enabled).toBe(true);
      expect(config.topK.k).toBe(3);
      expect(config.rerank.defaultModel).toBe('glm-4v-plus');
      expect(config.system.maxConcurrency).toBe(5);
    });

    it('应该加载快速模式预设', () => {
      const manager = getGradingConfigManager();
      manager.loadPreset('fast');
      const config = manager.getConfig();

      expect(config.topK.k).toBe(2);
      expect(config.rerank.triggerThresholds.lowConfidence).toBe(0.65);
    });

    it('应该验证配置', () => {
      const manager = getGradingConfigManager();
      const validation = manager.validateConfig();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('应该导出和导入配置', () => {
      const manager = getGradingConfigManager();
      const exported = manager.exportConfig();

      expect(exported).toContain('topK');
      expect(exported).toContain('rerank');
      expect(exported).toContain('fusion');

      // 测试导入
      const importedConfig = JSON.parse(exported);
      expect(importedConfig.topK).toBeDefined();
    });
  });

  describe('快速批改测试', () => {
    it('应该执行快速批改', async () => {
      const result = await quickGrade(
        mockOCRResult.questions,
        mockOCRResult.handwritingBlocks
      );

      expect(result).toHaveLength(2);
      expect(result[0].answer_blocks.length).toBeGreaterThan(0);
      expect(result[0].student_answer).toBe('5');
      expect(result[1].student_answer).toBe('北京');
    });
  });

  describe('完整批改流程测试', () => {
    it('应该执行完整的批改流程', async () => {
      const result = await gradeExamPaper(
        mockImageBase64,
        mockOCRResult,
        { config: 'development' }
      );

      // 验证基本结构
      expect(result.questions).toHaveLength(2);
      expect(result.topKResults).toBeDefined();
      expect(result.rerankResults).toBeDefined();
      expect(result.fusedConfidences).toBeDefined();

      // 验证匹配合规
      expect(result.stats.matchedQuestions).toBe(2);
      expect(result.stats.avgConfidence).toBeGreaterThan(0);

      // 验证性能指标
      expect(result.performance.totalTimeMs).toBeGreaterThan(0);
      expect(result.performance.matchingTimeMs).toBeGreaterThan(0);

      // 验证答案
      expect(result.questions[0].student_answer).toBeTruthy();
      expect(result.questions[1].student_answer).toBeTruthy();
    }, 30000); // 30 秒超时

    it('应该使用平衡模式配置', async () => {
      const result = await gradeExamPaper(
        mockImageBase64,
        mockOCRResult,
        { config: 'balanced' }
      );

      expect(result.stats.matchedQuestions).toBeGreaterThan(0);
    }, 30000);
  });

  describe('错误处理测试', () => {
    it('应该处理空的题目列表', async () => {
      const result = await gradeExamPaper(
        mockImageBase64,
        { questions: [], handwritingBlocks: [] }
      );

      expect(result.questions).toHaveLength(0);
      expect(result.stats.totalQuestions).toBe(0);
    });

    it('应该处理没有答案的情况', async () => {
      const result = await gradeExamPaper(
        mockImageBase64,
        {
          questions: mockOCRResult.questions,
          handwritingBlocks: []
        }
      );

      expect(result.stats.matchedQuestions).toBe(0);
      expect(result.stats.avgConfidence).toBe(0);
    });
  });

  describe('性能和成本测试', () => {
    it('应该追踪 LLM 调用次数', async () => {
      const result = await gradeExamPaper(
        mockImageBase64,
        mockOCRResult,
        { config: 'fast' }
      );

      expect(result.cost.llmCalls).toBeGreaterThanOrEqual(0);
      expect(result.cost.estimatedCost).toBeGreaterThanOrEqual(0);
    });

    it('应该在合理时间内完成', async () => {
      const startTime = Date.now();

      await gradeExamPaper(
        mockImageBase64,
        mockOCRResult,
        { config: 'fast' }
      );

      const duration = Date.now() - startTime;

      // 快速模式应该在 5 秒内完成
      expect(duration).toBeLessThan(5000);
    }, 10000);
  });

  describe('报告生成测试', () => {
    it('应该生成批改报告', async () => {
      const { generateGradingReport } = await import('../orchestrator');
      const result = await gradeExamPaper(
        mockImageBase64,
        mockOCRResult
      );

      const report = generateGradingReport(result);

      expect(report).toContain('试卷批改报告');
      expect(report).toContain('统计信息');
      expect(report).toContain('性能指标');
      expect(report).toContain('题目详情');
    });
  });
});

/**
 * 运行测试：
 * npx tsx lib/grading/__tests__/integration.test.ts
 */
