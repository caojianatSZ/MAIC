/**
 * 题目格式工具 — 统一小程序端题目和选项的渲染格式
 *
 * 后端统一 Question 接口:
 *   Option { index, html, text?, images? }
 *   Question { id, subject, type, stem, options?, subQuestions?, answer?, ... }
 *
 * 本工具提供:
 *   1. normalizeOptions — 将任何选项格式转为统一显示格式
 *   2. normalizeQuestionForDisplay — 将后端 Question 转为前端渲染格式
 *   3. normalizePhotoQuestion — 将拍照结果转为前端渲染格式
 */

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

/**
 * 将任意选项格式标准化
 *
 * 输入格式（兼容所有现有形状）:
 *   - 字符串数组: ['选项A', '选项B']
 *   - 带文本的对象: [{ text: 'A' }, { text: 'B' }]
 *   - 带 value/label: [{ value: 'A', label: '...' }]
 *   - 统一格式: [{ index: 'A', html: '...', text: '...' }]
 *
 * 输出格式（统一显示格式）:
 *   [{ index: 'A', text: '选项内容', images?: [] }]
 */
function normalizeOptions(options, optType) {
  if (!options || !Array.isArray(options) || options.length === 0) {
    return [];
  }

  // 检测输入格式
  const first = options[0];

  // 情况1: 已经是统一格式 { index, html, text? }
  if (first && typeof first === 'object' && first.index && (first.html || first.text)) {
    return options.map(function (opt) {
      return {
        index: opt.index,
        text: opt.text || stripHtml(opt.html || ''),
        images: opt.images || [],
      };
    });
  }

  // 情况2: value/label 格式 { value, label }
  if (first && typeof first === 'object' && first.value && first.label) {
    return options.map(function (opt) {
      return {
        index: opt.value,
        text: opt.label,
        images: [],
      };
    });
  }

  // 情况3: text/images 格式 { text, images? }
  if (first && typeof first === 'object' && first.text) {
    return options.map(function (opt, idx) {
      return {
        index: OPTION_LABELS[idx] || String(idx),
        text: opt.text,
        images: opt.images || [],
      };
    });
  }

  // 情况4: 纯字符串数组
  if (typeof first === 'string') {
    return options.map(function (opt, idx) {
      return {
        index: OPTION_LABELS[idx] || String(idx),
        text: opt,
        images: [],
      };
    });
  }

  // 情况5: 兜底 — 尝试转换为字符串
  return options.map(function (opt, idx) {
    return {
      index: OPTION_LABELS[idx] || String(idx),
      text: typeof opt === 'string' ? opt : String(opt),
      images: [],
    };
  });
}

/**
 * 从统一 Question 提取前端渲染所需字段
 *
 * @param {Object} q - 后端统一 Question
 * @param {Object} opts - 可选配置
 * @param {string} opts.mode - 'quiz' | 'photo' | 'practice'
 * @returns {Object} 前端渲染格式
 */
function normalizeQuestionForDisplay(q, opts) {
  opts = opts || {};
  var mode = opts.mode || 'quiz';

  var display = {
    id: q.id,
    // quiz 模式用 question 字段，photo 模式用 content 字段
    question: q.stem || q.question || q.content || '',
    content: q.stem || q.content || q.question || '',
    type: q.type || 'choice',
    options: normalizeOptions(q.options),
    difficulty: q.difficulty || 1,
    knowledgePoints: (q.knowledgePoints || []).map(function (kp) {
      return {
        id: kp.id,
        name: kp.name,
        uri: kp.uri,
        masteryLevel: kp.masteryLevel,
      };
    }),
  };

  // 运行时状态字段（仅在 photo/practice 模式有）
  if (mode === 'photo' || mode === 'practice') {
    display.studentAnswer = q.studentAnswer
      ? answerToString(q.studentAnswer)
      : undefined;
    display.isCorrect = q.isCorrect;
    display.confidence = q.confidence || 0;
    display.needsReview = q.needsReview || false;
    display.warnings = q.warnings || [];
  }

  // 正确答案（practice 模式需要）
  if (mode === 'practice') {
    display.answer = q.answer ? answerToString(q.answer) : '';
    display.analysis = q.explanation
      ? explanationToString(q.explanation)
      : '';
  }

  // 复合题子题（未来使用）
  if (q.subQuestions && q.subQuestions.length > 0) {
    display.subQuestions = q.subQuestions.map(function (sq) {
      return {
        id: sq.id,
        question: sq.stem,
        content: sq.stem,
        type: sq.type,
        options: normalizeOptions(sq.options),
        answer: sq.answer ? answerToString(sq.answer) : '',
        sequence: sq.sequence,
      };
    });
  }

  return display;
}

/**
 * 将拍照结果的 QuestionJudgment 转为前端渲染格式
 * 同时支持旧格式（content/options string）和新格式（unifiedQuestions）
 *
 * @param {Object} apiData - API 返回的 data
 * @returns {Array} 前端渲染用的题目数组
 */
function normalizePhotoQuestions(apiData) {
  // 优先使用 unifiedQuestions（新格式）
  if (apiData.unifiedQuestions && Array.isArray(apiData.unifiedQuestions)) {
    return apiData.unifiedQuestions.map(function (q) {
      return normalizeQuestionForDisplay(q, { mode: 'photo' });
    });
  }

  // 兼容旧格式：apiData.questions (QuestionJudgment[])
  if (apiData.questions && Array.isArray(apiData.questions)) {
    return apiData.questions.map(function (q) {
      return {
        id: q.id,
        content: q.content || '',
        question: q.content || '',
        type: q.type || 'choice',
        options: normalizeOptions(q.options),
        images: q.images || [],
        confidence: (q.judgment && q.judgment.confidence) || q.confidence || 0,
        needsReview: (q.judgment && q.judgment.needsReview) || q.needsReview || false,
        warnings: (q.judgment && q.judgment.warnings) || q.warnings || [],
        studentAnswer: q.studentAnswer,
        isCorrect: (q.judgment && q.judgment.isCorrect) || q.isCorrect,
        knowledgePoints: (q.knowledgePoints || []).map(function (kp) {
          return {
            id: kp.id,
            name: kp.name,
            masteryLevel: kp.masteryLevel,
          };
        }),
      };
    });
  }

  return [];
}

/**
 * 将统一 Answer 转为简单字符串
 * @param {Object} answer - { units: [{ text }] }
 * @returns {string}
 */
function answerToString(answer) {
  if (!answer || !answer.units || answer.units.length === 0) return '';
  return answer.units.map(function (u) { return u.text; }).join('; ');
}

/**
 * 将统一 Explanation 转为简单字符串
 * @param {Object} explanation - { segments: [{ name, html }] }
 * @returns {string}
 */
function explanationToString(explanation) {
  if (!explanation || !explanation.segments || explanation.segments.length === 0) return '';
  return explanation.segments.map(function (s) { return s.html; }).join('\n');
}

/**
 * 简单的 HTML 标签剥离
 */
function stripHtml(html) {
  if (!html) return '';
  return String(html).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

module.exports = {
  normalizeOptions: normalizeOptions,
  normalizeQuestionForDisplay: normalizeQuestionForDisplay,
  normalizePhotoQuestions: normalizePhotoQuestions,
  answerToString: answerToString,
  explanationToString: explanationToString,
  OPTION_LABELS: OPTION_LABELS,
};
