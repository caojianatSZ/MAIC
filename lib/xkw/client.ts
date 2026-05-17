// 学科网开放平台 API 客户端
// 文档: https://www.xkw.com/open/doc

import type {
  XkwPushQuestionsRequest,
  XkwPushQuestionsData,
  XkwSearchQuestionsRequest,
  XkwGetPaperRequest,
  XkwQuestion,
  XkwPaper
} from './types'
import { generateSignature, generateTimestamp, generateNonce } from './signature'

const XKW_BASE_URL = process.env.XKW_BASE_URL || 'https://open.xkw.com'
const XKW_APP_ID = process.env.XKW_APP_ID || ''
const XKW_APP_SECRET = process.env.XKW_APP_SECRET || ''

export class XkwClient {
  private baseUrl: string
  private appId: string
  private appSecret: string

  constructor(config?: { baseUrl?: string; appId?: string; appSecret?: string }) {
    this.baseUrl = config?.baseUrl || XKW_BASE_URL
    this.appId = config?.appId || XKW_APP_ID
    this.appSecret = config?.appSecret || XKW_APP_SECRET

    if (!this.appId || !this.appSecret) {
      throw new Error('XKW_APP_ID and XKW_APP_SECRET must be configured')
    }
  }

  /**
   * 构建带签名的请求参数
   */
  private buildParams(params: Record<string, any>): Record<string, string> {
    const timestamp = generateTimestamp()
    const nonce = generateNonce()

    const signParams = {
      ...params,
      appId: this.appId,
      timestamp: String(timestamp),
      nonce
    }

    const signature = generateSignature(signParams, this.appSecret)

    return {
      ...signParams,
      sign: signature
    }
  }

  /**
   * 发送 API 请求
   */
  private async request<T>(
    endpoint: string,
    params: Record<string, any>
  ): Promise<T> {
    const signedParams = this.buildParams(params)
    const url = new URL(endpoint, this.baseUrl)

    Object.entries(signedParams).forEach(([key, value]) => {
      url.searchParams.append(key, String(value))
    })

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`XKW API request failed: ${response.status} ${response.statusText}`)
    }

    const data: XkwApiResponse<T> = await response.json()

    if (data.code !== 0) {
      throw new Error(`XKW API error: ${data.message}`)
    }

    return data.data
  }

  /**
   * 推题 - 按条件筛选题目
   */
  async pushQuestions(request: XkwPushQuestionsRequest): Promise<XkwQuestion[]> {
    const params = {
      course_id: request.course_id,
      grade_id: request.grade_id,
      volume_id: request.volume_id,
      chapter_id: request.chapter_id,
      section_id: request.section_id,
      knowledge_point_ids: request.knowledge_point_ids?.join(','),
      difficulty: request.difficulty?.join(','),
      question_type_ids: request.question_type_ids?.join(','),
      paper_type_ids: request.paper_type_ids?.join(','),
      year: request.year?.join(','),
      area_id: request.area_id?.join(','),
      count: request.count
    }

    return this.request<XkwPushQuestionsData>('/api/v1/push/question', params).then(
      (data) => data.questions
    )
  }

  /**
   * 搜题 - 按内容或图片搜题
   */
  async searchQuestions(request: XkwSearchQuestionsRequest): Promise<XkwQuestion[]> {
    const params = {
      course_id: request.course_id,
      content: request.content,
      image: request.image,
      count: request.count || 10
    }

    return this.request<XkwPushQuestionsData>('/api/v1/search/question', params).then(
      (data) => data.questions
    )
  }

  /**
   * 获取试卷详情
   */
  async getPaper(request: XkwGetPaperRequest): Promise<XkwPaper> {
    const params = {
      paper_id: request.paper_id
    }

    return this.request<XkwPaper>('/api/v1/paper/detail', params)
  }

  /**
   * 获取题目详情（如果推题返回的是摘要）
   */
  async getQuestionDetail(questionId: string): Promise<XkwQuestion> {
    const params = {
      question_id: questionId
    }

    return this.request<XkwQuestion>('/api/v1/question/detail', params)
  }
}

// 单例实例
let xkwClientInstance: XkwClient | null = null

export function getXkwClient(): XkwClient {
  if (!xkwClientInstance) {
    xkwClientInstance = new XkwClient()
  }
  return xkwClientInstance
}

// API 响应基础类型
interface XkwApiResponse<T = any> {
  code: number
  message: string
  data: T
}
