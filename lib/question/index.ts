// lib/question/index.ts
// 统一题目模块 —— 桶导出

export type {
  Question, SubQuestion, Option, OptionImage,
  Answer, AnswerUnit,
  Explanation, ExplanationSegment,
  KnowledgePointRef, OptionLayout,
  QuestionType, ChoiceMode, QuestionSource, MasteryLevel,
} from './types';

export {
  normalizeQuestionType,
  toLegacyType,
  toXKWType,
  toJudgmentType,
} from './types';

export type {
  LegacyQuizQuestion,
  LegacyPhotoQuestion,
  PrismaQuestionRecord,
} from './adapter';

export {
  toLegacyQuizFormat,
  toLegacyQuizFormatList,
  toLegacyPhotoFormat,
  fromLegacyRecord,
  fromXKW,
  questionJudgmentToUnified,
} from './adapter';

export type {
  JudgmentLike,
} from './adapter';
