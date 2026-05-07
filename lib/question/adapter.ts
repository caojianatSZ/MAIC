// lib/question/adapter.ts
// 统一 Question 结构 ↔ 各种旧格式 / XKW 格式 的转换层

import type {
  Question, Option, Answer,
  QuestionType, ChoiceMode,
} from './types';
import { normalizeQuestionType } from './types';

// ============================================
// 旧格式的输入/输出类型
// ============================================

/** 旧 quiz API 返回的题目格式 */
export interface LegacyQuizQuestion {
  id: string;
  question: string;
  options: string[];
  answer: string;
  explanation?: string;
  knowledgePointId: string;
  knowledgePoint: string;
  difficulty?: number;
}

/** 旧 photo API 返回的题目格式 */
export interface LegacyPhotoQuestion {
  id: string;
  content: string;
  type: 'choice' | 'fill_blank' | 'essay';
  options?: Array<string | { text: string; images?: Array<{ url: string; label?: string; bbox?: number[] }> }>;
  studentAnswer?: string;
  isCorrect?: boolean;
  confidence?: number;
  needsReview?: boolean;
  warnings?: string[];
  knowledgePoints?: Array<{ id: string; name: string; uri?: string; masteryLevel?: string }>;
  images?: Array<{ url: string; label?: string; bbox?: number[] }>;
}

/** Prisma Question 记录的类型 */
export interface PrismaQuestionRecord {
  id: string;
  identifier: string;
  subject: string;
  type: string;
  questionType: string;
  choiceMode: string | null;
  parentId: string | null;
  sequence: number;
  question: string;
  options: string[];
  stemHtml: string | null;
  answer: string;
  explanation: string | null;
  source: string | null;
  sourceData: unknown;
  optionLayout: unknown;
  knowledgePointIds: string[];
  difficulty: number;
  isActive: boolean;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// 统一 → 旧 quiz 格式
// ============================================

export function toLegacyQuizFormat(q: Question): LegacyQuizQuestion {
  const primaryKp = q.knowledgePoints[0];
  return {
    id: q.id,
    question: q.stem,
    options: optionsToPlainStrings(q.options),
    answer: answerToSimpleString(q.answer),
    explanation: q.explanation?.segments.map(s => s.html).join('\n'),
    knowledgePointId: primaryKp?.id ?? '',
    knowledgePoint: primaryKp?.name ?? '知识点',
    difficulty: q.difficulty,
  };
}

/** 批量转换 */
export function toLegacyQuizFormatList(questions: Question[]): LegacyQuizQuestion[] {
  return questions.map(toLegacyQuizFormat);
}

// ============================================
// 统一 → 旧 photo 格式
// ============================================

export function toLegacyPhotoFormat(q: Question): LegacyPhotoQuestion {
  return {
    id: q.id,
    content: q.stem,
    type: q.type === 'compound' ? 'essay' : q.type as 'choice' | 'fill_blank' | 'essay',
    options: q.options?.map(opt => ({
      text: opt.html,
      images: opt.images,
    })),
    studentAnswer: q.studentAnswer ? answerToSimpleString(q.studentAnswer) : undefined,
    isCorrect: q.isCorrect,
    confidence: q.confidence,
    needsReview: q.needsReview,
    warnings: q.warnings,
    knowledgePoints: q.knowledgePoints.map(kp => ({
      id: kp.id,
      name: kp.name,
      uri: kp.uri,
      masteryLevel: kp.masteryLevel,
    })),
  };
}

// ============================================
// 旧 Question 表记录 → 统一 Question
// ============================================

export function fromLegacyRecord(record: PrismaQuestionRecord): Question {
  const type = normalizeQuestionType(
    record.questionType || record.type,
    record.options
  );

  const question: Question = {
    id: record.id,
    subject: record.subject,
    type,
    choiceMode: (record.choiceMode as ChoiceMode) ?? (record.type === 'multiple' ? 'multiple' : 'single'),
    stem: record.stemHtml || record.question,
    options: record.options.length > 0
      ? record.options.map((opt, i) => plainStringToOption(opt, i))
      : undefined,
    answer: simpleStringToAnswer(record.answer),
    explanation: record.explanation
      ? { segments: [{ name: '详解', html: record.explanation }] }
      : undefined,
    knowledgePoints: record.knowledgePointIds.map(id => ({ id, name: id })),
    difficulty: record.difficulty,
    source: record.source as Question['source'],
    sourceData: record.sourceData as Record<string, unknown> | undefined,
    optionLayout: record.optionLayout as { columns: number } | undefined,
  };

  return question;
}

// ============================================
// 学科网（XKW）SDK 输出 → 统一 Question
// ============================================

/** XKW SDK splitStem 返回的 Stem 结构 */
interface XKWStem {
  html: string;
  type: string;
  sqIdMode?: number;
  sqBlankCount?: number;
  og?: {
    cols: number;
    ogOps: Array<{ index: string; html: string }>;
  } | null;
  sqs?: XKWStem[];
}

/** XKW SDK splitAnswer 返回的 Answer 结构 */
interface XKWAnswer {
  anSqs: Array<{
    ans: Array<{
      html: string;
      op: boolean;
      exact: boolean;
    }>;
  }>;
}

/** XKW SDK splitExplanation 返回的 Explanation 结构 */
interface XKWExplanation {
  explanationSegs: Array<{
    name: string;
    html: string;
  }>;
}

/** XKW 原始数据（三部分 HTML） */
interface XKWSourceData {
  stemHtml: string;
  answerHtml: string;
  explanationHtml: string;
}

/**
 * 将学科网 SDK 解析结果转换为统一 Question
 * @param stem SDK splitStem 结果
 * @param answer SDK splitAnswer 结果
 * @param explanation SDK splitExplanation 结果（可选）
 * @param sourceData XKW 原始 HTML（保留用于 SDK 重新解析）
 * @param subject 科目
 */
export function fromXKW(
  stem: XKWStem,
  answer: XKWAnswer,
  explanation?: XKWExplanation,
  sourceData?: XKWSourceData,
  subject: string = 'unknown',
): Question {
  const type = xkwTypeToQuestionType(stem.type);

  // 复合题
  if (type === 'compound' && stem.sqs && stem.sqs.length > 0) {
    return {
      id: '',  // 由调用方分配
      subject,
      type: 'compound',
      stem: stem.html,
      subQuestions: stem.sqs.map((sq, i) => {
        const sqType = xkwTypeToQuestionType(sq.type) as 'choice' | 'fill_blank' | 'essay';
        const subQuestion: import('./types').SubQuestion = {
          id: '',  // 由调用方分配
          type: sqType,
          stem: sq.html,
          sequence: i,
        };

        // 选项
        if (sq.og?.ogOps && sq.og.ogOps.length > 0) {
          subQuestion.options = sq.og.ogOps.map(op => ({
            index: op.index,
            html: op.html,
            text: stripHtml(op.html),
          }));
        }

        // 答案（anSqs[i] 对应第 i 个子题）
        if (answer.anSqs[i]?.ans) {
          subQuestion.answer = {
            units: answer.anSqs[i].ans.map(a => ({
              text: stripHtml(a.html),
              html: a.html,
              isChoice: a.op,
              isExact: a.exact,
            })),
          };
        }

        return subQuestion;
      }),
      answer: undefined,  // 复合题的答案分散在子题中
      knowledgePoints: [],
      difficulty: 1,
      source: 'xkw',
      sourceData: sourceData as unknown as Record<string, unknown>,
    };
  }

  // 简单题
  const question: Question = {
    id: '',
    subject,
    type,
    choiceMode: 'single',
    stem: stem.html,
    knowledgePoints: [],
    difficulty: 1,
    source: 'xkw',
    sourceData: sourceData as unknown as Record<string, unknown>,
  };

  // 选项
  if (stem.og?.ogOps && stem.og.ogOps.length > 0) {
    question.options = stem.og.ogOps.map(op => ({
      index: op.index,
      html: op.html,
      text: stripHtml(op.html),
    }));
    question.optionLayout = { columns: stem.og.cols };
  }

  // 答案（简单题取 anSqs[0]）
  if (answer.anSqs[0]?.ans) {
    question.answer = {
      units: answer.anSqs[0].ans.map(a => ({
        text: stripHtml(a.html),
        html: a.html,
        isChoice: a.op,
        isExact: a.exact,
      })),
    };
  }

  // 解析
  if (explanation?.explanationSegs) {
    question.explanation = {
      segments: explanation.explanationSegs.map(seg => ({
        name: seg.name,
        html: seg.html,
      })),
    };
  }

  return question;
}

// ============================================
// 内部工具函数
// ============================================

function xkwTypeToQuestionType(xkwType: string): QuestionType {
  switch (xkwType) {
    case '选择题': return 'choice';
    case '填空题': return 'fill_blank';
    case '复合题': return 'compound';
    default: return 'essay';
  }
}

function optionsToPlainStrings(options?: Option[]): string[] {
  if (!options) return [];
  return options.map(o => o.text || stripHtml(o.html));
}

function answerToSimpleString(answer?: Answer): string {
  if (!answer?.units?.length) return '';
  return answer.units.map(u => u.text).join('##');
}

function simpleStringToAnswer(s: string): Answer {
  if (!s) return { units: [] };
  // 检查是否是多空答案（用 ## 分隔）
  if (s.includes('##')) {
    return {
      units: s.split('##').map(text => ({ text: text.trim() })),
    };
  }
  return { units: [{ text: s }] };
}

function plainStringToOption(text: string, index: number): Option {
  return {
    index: String.fromCharCode(65 + index),  // A, B, C, D...
    html: escapeHtml(text),
    text,
  };
}

// ============================================
// Photo-v2 QuestionJudgment → 统一 Question
// ============================================

/** QuestionJudgment 的最小接口（不依赖 photo-v2 schema 的具体路径） */
export interface JudgmentLike {
  id: string;
  content: string;
  type: 'choice' | 'fill_blank' | 'essay';
  options?: string[];
  studentAnswer?: string;
  judgment: {
    isCorrect: boolean;
    correctAnswer: string;
    analysis: string;
    confidence: number;
    needsReview: boolean;
    warnings: string[];
  };
  knowledgePoints: Array<{
    id: string;
    name: string;
    masteryLevel?: string;
  }>;
}

/**
 * 将 photo-v2 的 QuestionJudgment 转换为统一 Question
 */
export function questionJudgmentToUnified(
  j: JudgmentLike,
  subject: string = 'unknown',
): Question {
  const unifiedType = j.type === 'essay' ? 'essay' :
    j.type === 'fill_blank' ? 'fill_blank' : 'choice';

  return {
    id: j.id,
    subject,
    type: unifiedType,
    choiceMode: unifiedType === 'choice' ? 'single' : undefined,
    stem: j.content,
    options: j.options?.map((opt, i) => ({
      index: String.fromCharCode(65 + i),
      html: opt,
      text: opt,
    })),
    answer: j.judgment.correctAnswer
      ? { units: [{ text: j.judgment.correctAnswer }] }
      : undefined,
    explanation: j.judgment.analysis
      ? { segments: [{ name: '详解', html: j.judgment.analysis }] }
      : undefined,
    knowledgePoints: j.knowledgePoints.map(kp => ({
      id: kp.id,
      name: kp.name,
      masteryLevel: kp.masteryLevel as 'weak' | 'partial' | 'mastered' | undefined,
    })),
    difficulty: 1,
    studentAnswer: j.studentAnswer
      ? { units: [{ text: j.studentAnswer }] }
      : undefined,
    isCorrect: j.judgment.isCorrect,
    confidence: j.judgment.confidence,
    needsReview: j.judgment.needsReview,
    warnings: j.judgment.warnings,
  };
}

// ============================================
// 内部工具函数
// ============================================

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
