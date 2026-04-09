/**
 * 成就系统类型定义
 */

// 成就等级
export type AchievementLevel = 'bronze' | 'silver' | 'gold' | 'diamond' | 'king'

// 成就类型
export type AchievementType = 'habit' | 'progress' | 'behavior'

// 事件类型
export type EventType = 'quiz_completed' | 'lesson_learned' | 'diagnosis_finished' | 'streak'

// 知识点掌握等级
export type MasteryLevel = 'mastered' | 'partial' | 'weak'

// 成就事件
export interface AchievementEvent {
  type: EventType
  userId: string
  subject?: string
  knowledgePointId?: string
  data: {
    score?: number
    correctCount?: number
    totalCount?: number
    timeSpent?: number
    isCorrect?: boolean
    streak?: number
    [key: string]: any  // 允许其他自定义字段
  }
  timestamp: Date
}

// 成就条件
export interface AchievementCondition {
  type: string
  accuracy_threshold?: number
  min_questions?: number
  streak_days?: number
  [key: string]: any
}

// 成就进度
export interface AchievementProgress {
  achievementId: string
  level: AchievementLevel
  progress: number  // 0-100
  unlocked: boolean
  unlockedAt?: Date
}

// 成就定义
export interface AchievementDefinition {
  id: string
  identifier: string
  type: AchievementType
  subject?: string
  knowledgePointId?: string
  level: AchievementLevel
  name: string
  description?: string
  iconUrl?: string
  condition: AchievementCondition
  points: number
}

// 成就结果
export interface AchievementResult {
  achievementId: string
  level: AchievementLevel
  name: string
  description: string
  icon?: string
  progress: number
  unlocked: boolean
  previousLevel?: AchievementLevel
}

// 知识点统计
export interface KnowledgePointStats {
  knowledgePointId: string
  knowledgePointName: string
  totalAttempts: number
  correctAttempts: number
  accuracy: number
  firstLearnedAt?: Date
  lastPracticedAt?: Date
}

// 学习风格分析
export interface LearningStyle {
  visual: number      // 0-1
  auditory: number    // 0-1
  kinesthetic: number // 0-1
}

// 学习统计
export interface StudyStats {
  totalStudyTime: number      // 分钟
  questionsCompleted: number
  lessonsLearned: number
  currentStreak: number
  longestStreak: number
}
