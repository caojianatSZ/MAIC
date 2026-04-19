// lib/rerank/prompts.ts
/**
 * Prompt 模板管理 - LLM Rerank 的 prompt 模板
 *
 * 核心功能：
 * 1. 管理各种 rerank 场景的 prompt 模板
 * 2. 支持变量插值
 * 3. 优化 prompt 效果
 */

import type { PromptTemplate, PromptVariables } from './types';

/**
 * Prompt 模板定义
 */
const PROMPT_TEMPLATES: Record<PromptTemplate, string> = {
  /**
   * 问答排序 prompt（语义 rerank）
   * 用于基于语义理解重新排序候选答案
   */
  question_answer_ranking: `你是一个专业的试卷批改助手。你的任务是为给定的题目选择最合适的答案。

# 题目信息
题目类型：{{questionType}}
题目内容：{{question}}

# 候选答案
{{#each candidates}}
候选 {{index}}：{{answer}}
- 初始置信度：{{confidence}}
{{#if features}}
- 空间特征：{{features}}
{{/if}}
{{/each}}

# 任务要求
1. 分析题目的要求，理解题目在问什么
2. 评估每个候选答案是否是针对该题目的有效回答
3. 考虑答案的完整性和相关性
4. 重新对候选答案进行排序（最合适的排在第一位）

# 输出格式
请以 JSON 格式输出，包含以下字段：
{
  "ranking": [候选索引按从好到差排序],
  "reasoning": "排序理由说明",
  "confidence": 0-1的置信度分数
}

注意：
- 如果所有候选都不合适，将 ranking 设为空数组
- reasoning 字段要简洁明确，说明排序依据
- confidence 表示你对最终选择的置信度`,

  /**
   * 视觉答案验证 prompt（视觉 rerank）
   * 用于结合图像信息验证答案的正确性
   */
  visual_answer_verification: `你是一个专业的试卷批改助手，具备视觉理解能力。你的任务是通过分析试卷图像，为题目选择最正确的答案。

# 题目信息
题目类型：{{questionType}}
题目内容：{{question}}

# 候选答案（从 OCR 识别）
{{#each candidates}}
候选 {{index}}：{{answer}}
- OCR 置信度：{{confidence}}
{{#if features}}
- 空间位置：{{features}}
{{/if}}
{{/each}}

# 图像信息
{{#if hasImage}}
我已经看到了试卷的图像。请结合图像信息进行判断：
1. 检查手写答案的实际位置
2. 验证答案是否确实属于该题目
3. 识别答案与题目的空间关系（右侧、下方、跨列等）
4. 判断是否有其他内容干扰识别
{{/if}}

# 任务要求
1. 优先使用视觉信息验证答案的有效性
2. 检查答案是否在题目的合理答案区域内
3. 排除明显属于其他题目或无关内容的候选
4. 重新对候选答案进行排序

# 输出格式
请以 JSON 格式输出：
{
  "ranking": [候选索引按从好到差排序],
  "visual_analysis": "视觉分析说明，包括答案位置、空间关系等",
  "confidence": 0-1的置信度分数
}

注意：
- 充分利用视觉信息进行验证
- 如果某个答案明显不属于该题目（如跨列、距离过远），将其排在后面
- visual_analysis 要详细说明你观察到的视觉信息`,

  /**
   * 混合 rerank prompt（语义 + 视觉）
   * 综合语义理解和视觉信息进行 rerank
   */
  hybrid_reranking: `你是一个专业的试卷批改助手，具备语言理解和视觉分析双重能力。你的任务是综合语义和视觉信息，为题目选择最正确的答案。

# 题目信息
题目类型：{{questionType}}
题目内容：{{question}}

# 候选答案
{{#each candidates}}
候选 {{index}}：{{answer}}
- 初始置信度：{{confidence}}
{{#if features}}
- 特征：{{features}}
{{/if}}
{{/each}}

# 分析要求
请从以下三个维度综合评估：

1. **语义理解**：答案内容是否符合题目的要求？
   - 答案是否针对题目的问题
   - 答案的完整性和相关性
   - 答案的合理性

2. **视觉验证**：答案在试卷上的位置是否合理？
   - 答案是否在题目的答案区域内
   - 空间关系（右侧、下方、同列等）
   - 是否跨列或距离过远
   - 是否有其他题目干扰

3. **置信度融合**：综合考虑语义和视觉证据
   - 语义和视觉证据是否一致
   - 如果不一致，哪个更可靠？
   - 给出最终的综合判断

# 输出格式
请以 JSON 格式输出：
{
  "ranking": [候选索引按从好到差排序],
  "semantic_analysis": "语义分析说明",
  "visual_analysis": "视觉分析说明",
  "fusion_reasoning": "综合判断理由",
  "confidence": 0-1的最终置信度
}

注意：
- semantic_analysis 说明对答案内容的理解
- visual_analysis 说明对答案位置的验证
- fusion_reasoning 说明如何综合两方面信息得出结论
- 如果某个候选在语义或视觉上明显不合适，将其排在后面`,

  /**
   * 置信度校准 prompt
   * 用于校准和调整匹配置信度
   */
  confidence_calibration: `你是一个专业的试卷批改助手。你的任务是评估当前匹配置信度的可靠性，并进行校准。

# 题目信息
题目类型：{{questionType}}
题目内容：{{question}}

# 候选答案
{{#each candidates}}
候选 {{index}}：{{answer}}
- 当前置信度：{{confidence}}
{{/each}}

# 当前匹配置信度：{{topConfidence}}

# 评估维度
请从以下方面评估当前置信度的可靠性：

1. **候选质量**：候选答案的数量和质量是否足够？
2. **得分分布**：候选之间的得分差距是否合理？
3. **空间合理性**：答案的空间位置是否合理？
4. **语义合理性**：答案内容是否符合题目要求？

# 输出格式
请以 JSON 格式输出：
{
  "calibrated_confidence": 0-1的校准后置信度,
  "adjustment_reason": "调整理由",
  "reliability_assessment": "对当前置信度可靠性的评估（高/中/低）",
  "suggestions": "改进建议"
}

注意：
- calibrated_confidence 应该反映你对匹配置信度的真实评估
- 如果当前置信度偏高或偏低，请进行校准
- adjustment_reason 要说明为什么需要调整
- suggestions 可以提出改进匹配算法的建议`
};

/**
 * 渲染 prompt 模板
 */
export function renderPrompt(
  template: PromptTemplate,
  variables: PromptVariables
): string {
  const templateStr = PROMPT_TEMPLATES[template];

  // 简单的变量替换（handlebars 风格）
  let result = templateStr;

  // 替换简单变量
  result = result.replace(/\{\{question\}\}/g, variables.question);
  result = result.replace(/\{\{questionType\}\}/g, variables.questionType || '未知');
  result = result.replace(/\{\{hasImage\}\}/g, String(variables.context?.hasImage || false));

  // 替换 candidates 循环
  const candidatesBlock = result.match(/\{\{#each candidates\}\}([\s\S]*?)\{\{\/each\}\}/);
  if (candidatesBlock && variables.candidates) {
    const [fullMatch, template] = candidatesBlock;
    const rendered = variables.candidates.map(c => {
      let item = template;
      item = item.replace(/\{\{index\}\}/g, String(c.index));
      item = item.replace(/\{\{answer\}\}/g, c.answer);
      item = item.replace(/\{\{confidence\}\}/g, c.confidence.toFixed(2));
      item = item.replace(/\{\{features\}\}/g, c.features || '无');
      return item;
    }).join('\n');

    result = result.replace(fullMatch, rendered);
  }

  // 处理条件语句
  result = result.replace(/\{\{#if features\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, content) => {
    const hasFeatures = variables.candidates?.some(c => c.features && c.features.length > 0);
    return hasFeatures ? content : '';
  });

  result = result.replace(/\{\{#if hasImage\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, content) => {
    return variables.context?.hasImage ? content : '';
  });

  return result;
}

/**
 * 获取 prompt 模板
 */
export function getPromptTemplate(template: PromptTemplate): string {
  return PROMPT_TEMPLATES[template];
}

/**
 * 创建问答排序的 prompt
 */
export function createQuestionAnswerRankingPrompt(
  question: string,
  questionType: string,
  candidates: Array<{
    index: number;
    answer: string;
    confidence: number;
    features?: string;
  }>
): string {
  return renderPrompt('question_answer_ranking', {
    question,
    questionType,
    candidates
  });
}

/**
 * 创建视觉验证的 prompt
 */
export function createVisualVerificationPrompt(
  question: string,
  questionType: string,
  candidates: Array<{
    index: number;
    answer: string;
    confidence: number;
    features?: string;
  }>,
  hasImage: boolean
): string {
  return renderPrompt('visual_answer_verification', {
    question,
    questionType,
    candidates,
    context: { hasImage }
  });
}

/**
 * 创建混合 rerank 的 prompt
 */
export function createHybridRerankPrompt(
  question: string,
  questionType: string,
  candidates: Array<{
    index: number;
    answer: string;
    confidence: number;
    features?: string;
  }>
): string {
  return renderPrompt('hybrid_reranking', {
    question,
    questionType,
    candidates
  });
}

/**
 * 创建置信度校准的 prompt
 */
export function createConfidenceCalibrationPrompt(
  question: string,
  questionType: string,
  candidates: Array<{
    index: number;
    answer: string;
    confidence: number;
  }>,
  topConfidence: number
): string {
  const prompt = renderPrompt('confidence_calibration', {
    question,
    questionType,
    candidates
  });

  return prompt.replace('{{topConfidence}}', topConfidence.toFixed(2));
}

/**
 * 优化 prompt（添加示例）
 */
export function enhancePromptWithExamples(
  basePrompt: string,
  examples: Array<{
    question: string;
    candidates: string[];
    correctRanking: number[];
    reasoning: string;
  }>
): string {
  const examplesSection = examples.map((ex, i) => `
# 示例 ${i + 1}
题目：${ex.question}
候选答案：${ex.candidates.map((c, j) => `${j + 1}. ${c}`).join('\n')}
正确排序：${ex.correctRanking.join(', ')}
理由：${ex.reasoning}
`).join('\n');

  return basePrompt + '\n\n' + examplesSection;
}
