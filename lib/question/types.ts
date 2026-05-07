// lib/question/types.ts
// 统一题目数据结构 —— 全系统题目建模的唯一真相源

// ============================================
// 类型枚举
// ============================================

/** 统一题目类型（归并所有现有类型字符串） */
export type QuestionType = 'choice' | 'fill_blank' | 'essay' | 'compound';

/** 选择题模式 */
export type ChoiceMode = 'single' | 'multiple';

/** 题目来源 */
export type QuestionSource = 'local' | 'edukg' | 'xkw' | 'aliyun';

/** 知识点掌握程度 */
export type MasteryLevel = 'weak' | 'partial' | 'mastered';

// ============================================
// 选项
// ============================================

export interface Option {
  /** 选项序号 A, B, C, D... */
  index: string;
  /** HTML 内容 */
  html: string;
  /** 纯文本（兼容旧前端） */
  text?: string;
  /** 选项内嵌图片 */
  images?: OptionImage[];
}

export interface OptionImage {
  url: string;
  label?: string;
  bbox?: number[];
}

// ============================================
// 答案
// ============================================

/**
 * 答案 = 一组 AnswerUnit
 * - 简单题：1 个 unit（选择题 "B"）或多 unit（多空填空题）
 * - 复合题：每个子题各自有 Answer
 */
export interface Answer {
  units: AnswerUnit[];
}

export interface AnswerUnit {
  /** 答案值文本 */
  text: string;
  /** HTML 版 */
  html?: string;
  /** 是否是选项字母（选择题答案） */
  isChoice?: boolean;
  /** 是否支持机阅（确定性答案） */
  isExact?: boolean;
  /** 可接受的替代答案 */
  alternatives?: string[];
}

// ============================================
// 解析
// ============================================

export interface Explanation {
  segments: ExplanationSegment[];
}

export interface ExplanationSegment {
  /** 片段名称："分析" / "详解" / "点睛" / "(1)题详解" */
  name: string;
  /** HTML 内容 */
  html: string;
}

// ============================================
// 知识点引用
// ============================================

export interface KnowledgePointRef {
  id: string;
  name: string;
  /** EduKG 实体 URI */
  uri?: string;
  /** 掌握程度（运行时填充） */
  masteryLevel?: MasteryLevel;
}

// ============================================
// 排版提示
// ============================================

export interface OptionLayout {
  /** 每行选项个数（来自原卷排版） */
  columns: number;
}

// ============================================
// 核心：统一 Question 接口
// ============================================

export interface Question {
  /** 题目唯一标识 */
  id: string;
  /** 科目 */
  subject: string;

  /** 统一题目类型 */
  type: QuestionType;
  /** 选择题模式：单选/多选（仅 type=choice 时有效） */
  choiceMode?: ChoiceMode;

  /** 题干（HTML） */
  stem: string;
  /** 选项（仅 type=choice 时） */
  options?: Option[];

  /** 子题列表（仅 type=compound 时） */
  subQuestions?: SubQuestion[];

  /** 正确答案 */
  answer?: Answer;
  /** 解析 */
  explanation?: Explanation;

  /** 关联知识点 */
  knowledgePoints: KnowledgePointRef[];

  // ---- 元数据 ----
  /** 难度 1-5 */
  difficulty: number;
  /** 年级 */
  grade?: string;
  /** 题目来源 */
  source?: QuestionSource;
  /** 原始数据（XKW HTML、阿里云原始响应等） */
  sourceData?: Record<string, unknown>;
  /** 选项排版提示 */
  optionLayout?: OptionLayout;

  // ---- 运行时状态（不持久化到题库表） ----
  /** 学生作答 */
  studentAnswer?: Answer;
  /** 是否正确 */
  isCorrect?: boolean;
  /** 置信度 */
  confidence?: number;
  /** 是否需要人工复核 */
  needsReview?: boolean;
  /** 警告信息 */
  warnings?: string[];
}

// ============================================
// 子题（仅 type=compound 时使用）
// ============================================

export interface SubQuestion {
  id: string;
  /** 子题类型（不能是 compound，仅限一层嵌套） */
  type: 'choice' | 'fill_blank' | 'essay';
  /** 子题题干（HTML） */
  stem: string;
  /** 选项（type=choice 时） */
  options?: Option[];
  /** 子题答案 */
  answer?: Answer;
  /** 在父题中的序号（从 0 开始） */
  sequence: number;
}

// ============================================
// 类型映射工具
// ============================================

/** 旧 type 字符串 → 统一 QuestionType */
export function normalizeQuestionType(
  type: string,
  options?: unknown[] | null
): QuestionType {
  // 中文类型映射
  const chineseMap: Record<string, QuestionType> = {
    '选择题': 'choice',
    '填空题': 'fill_blank',
    '解答题': 'essay',
    '复合题': 'compound',
    '判断题': 'choice',       // 判断题归入选择题
    '简答题': 'essay',
    '计算题': 'essay',
    '论述题': 'essay',
  };
  if (chineseMap[type]) return chineseMap[type];

  // 英文类型映射
  switch (type) {
    case 'choice':
    case 'single':
    case 'multiple':
      return 'choice';
    case 'fill_blank':
      return 'fill_blank';
    case 'essay':
    case 'text':
    case 'short_answer':
      return 'essay';
    case 'compound':
      return 'compound';
    default:
      // 兜底推断：有选项 → choice，否则 → essay
      return options && options.length > 0 ? 'choice' : 'essay';
  }
}

/** 统一 QuestionType → 旧 type 字符串（用于兼容旧 API） */
export function toLegacyType(qt: QuestionType, choiceMode?: ChoiceMode): string {
  if (qt === 'choice') return choiceMode === 'multiple' ? 'multiple' : 'single';
  if (qt === 'fill_blank') return 'text';   // fill_blank 在旧 quiz 系统中映射为 text
  if (qt === 'essay') return 'text';
  return 'text';  // compound 降级
}

/** 统一 QuestionType → 学科网中文类型 */
export function toXKWType(qt: QuestionType): string {
  switch (qt) {
    case 'choice': return '选择题';
    case 'fill_blank': return '填空题';
    case 'compound': return '复合题';
    case 'essay': return '填空题';  // 学科网没有解答题，归入填空题
  }
}

/** 统一 QuestionType → 批改管线类型 */
export function toJudgmentType(qt: QuestionType): 'choice' | 'fill_blank' | 'essay' {
  if (qt === 'compound') return 'essay';  // 复合题按解答题处理
  return qt;
}
