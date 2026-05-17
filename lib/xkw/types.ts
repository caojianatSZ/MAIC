// 学科网开放平台类型定义

// 学科映射
export const XKW_COURSES = {
  MATH: 1,
  CHINESE: 2,
  ENGLISH: 3,
  PHYSICS: 4,
  CHEMISTRY: 5,
  BIOLOGY: 6,
  HISTORY: 7,
  GEOGRAPHY: 8,
  POLITICS: 9
} as const

export type XkwCourse = typeof XKW_COURSES[keyof typeof XKW_COURSES]

// 年级映射
export const XKW_GRADES = {
  PRIMARY_1: 1,
  PRIMARY_2: 2,
  PRIMARY_3: 3,
  PRIMARY_4: 4,
  PRIMARY_5: 5,
  PRIMARY_6: 6,
  MIDDLE_1: 7,
  MIDDLE_2: 8,
  MIDDLE_3: 9,
  HIGH_1: 10,
  HIGH_2: 11,
  HIGH_3: 12
} as const

export type XkwGrade = typeof XKW_GRADES[keyof typeof XKW_GRADES]

// 题型映射
export const XKW_QUESTION_TYPES = {
  SINGLE_CHOICE: 1,
  MULTIPLE_CHOICE: 2,
  FILL_BLANK: 3,
  ESSAY: 4,
  JUDGE: 5,
  CALCULATION: 6
} as const

export type XkwQuestionType = typeof XKW_QUESTION_TYPES[keyof typeof XKW_QUESTION_TYPES]

// 难度映射
export const XKW_DIFFICULTIES = {
  EASY: 1,
  MEDIUM_EASY: 2,
  MEDIUM: 3,
  MEDIUM_HARD: 4,
  HARD: 5
} as const

export type XkwDifficulty = typeof XKW_DIFFICULTIES[keyof typeof XKW_DIFFICULTIES]

// 推题请求参数
export interface XkwPushQuestionsRequest {
  course_id: number
  grade_id: number
  volume_id?: number
  chapter_id?: number
  section_id?: number
  knowledge_point_ids?: number[]
  difficulty?: number[]
  question_type_ids?: number[]
  paper_type_ids?: number[]
  year?: number[]
  area_id?: number[]
  count: number
}

// 学科网题目响应
export interface XkwQuestion {
  id: string
  course_id: number
  grade_id: number
  type: number
  question_type: number
  content: string
  options?: string[]
  answer: string
  analysis?: string
  difficulty: number
  knowledge_points?: Array<{
    id: number
    name: string
  }>
  source_info?: {
    paper_name?: string
    year?: number
    area?: string
  }
}

// 推题响应
export interface XkwPushQuestionsResponse {
  code: number
  message: string
  data: {
    total: number
    questions: XkwQuestion[]
  }
}

// 搜题请求
export interface XkwSearchQuestionsRequest {
  course_id: number
  content: string
  image?: string
  count?: number
}

// 试卷详情请求
export interface XkwGetPaperRequest {
  paper_id: string
}

// 学科网试卷
export interface XkwPaper {
  id: string
  title: string
  course_id: number
  grade_id: number
  paper_type: string
  year: number
  area: string
  school?: string
  questions: Array<{
    id: string
    content: string
    options?: string[]
    answer: string
    analysis?: string
    difficulty: number
    points?: number
  }>
}

// API 响应基础类型
export interface XkwApiResponse<T = any> {
  code: number
  message: string
  data: T
}

// 错误类型
export class XkwApiError extends Error {
  constructor(
    public code: number,
    public message: string,
    public details?: any
  ) {
    super(message)
    this.name = 'XkwApiError'
  }
}
