/**
 * 事件类型常量
 */
const EVENT_TYPES = {
  QUIZ_FINISHED: 'quiz_finished',
  QUIZ_COMPLETED: 'quiz_completed',
  DIAGNOSIS_FINISHED: 'diagnosis_finished',
  LESSON_COMPLETED: 'lesson_completed',
  LESSON_LEARNED: 'lesson_learned',
  STREAK: 'streak',
  // 批改相关事件
  CORRECTION_FINISHED: 'correction_finished',
  PERFECT_SCORE: 'perfect_score',
  HIGH_SCORE: 'high_score'
}

/**
 * 成就等级常量
 */
const ACHIEVEMENT_LEVELS = {
  BRONZE: 'bronze',
  SILVER: 'silver',
  GOLD: 'gold',
  DIAMOND: 'diamond',
  KING: 'king'
}

/**
 * 学科常量
 */
const SUBJECTS = {
  MATH: 'math',
  ENGLISH: 'english',
  PHYSICS: 'physics',
  CHEMISTRY: 'chemistry',
  BIOLOGY: 'biology'
}

/**
 * 知识点掌握等级常量
 */
const MASTERY_LEVELS = {
  MASTERED: 'mastered',
  PARTIAL: 'partial',
  WEAK: 'weak'
}

/**
 * 默认配置常量
 */
const DEFAULTS = {
  SUBJECT: SUBJECTS.MATH,
  DEMO_USER_ID: 'demo_user_id',
  TOAST_DURATION: 1500,
  GRADE: '初三',
  TOPIC: '二次函数'
}

/**
 * 页面模式常量
 */
const PAGE_MODES = {
  ENTRY: 'entry',
  SETUP: 'setup',
  QUIZ: 'quiz',
  PHOTO: 'photo',
  RESULT: 'result',
  PHOTO_RESULT: 'photo_result'
}

module.exports = {
  EVENT_TYPES,
  ACHIEVEMENT_LEVELS,
  SUBJECTS,
  MASTERY_LEVELS,
  DEFAULTS,
  PAGE_MODES
}
