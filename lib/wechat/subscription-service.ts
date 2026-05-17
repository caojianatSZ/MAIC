/**
 * 微信订阅消息服务
 *
 * 用于发送小程序订阅消息
 */

import { prisma } from '@/lib/prisma'

export interface WechatSubscriptionMessage {
  touser: string // 用户 openid
  templateId: string // 模板ID
  page?: string // 点击跳转页面
  data: Record<string, {
    value: string
    color?: string
  }>
  miniprogramState?: 'developer' | 'trial' | 'formal'
  lang?: 'zh_CN' | 'en_US' | 'zh_HK' | 'zh_TW'
}

export interface SubscriptionTemplate {
  id: string
  name: string
  title: string
  templateId: string
  content: string
  example: string
}

// 订阅消息模板定义
const SUBSCRIPTION_TEMPLATES: Record<string, SubscriptionTemplate> = {
  BOOKING_REMINDER: {
    id: 'BOOKING_REMINDER',
    name: '课前提醒',
    title: '上课提醒',
    templateId: '', // 需要在微信小程序后台配置
    content: '上课时间：{{datetime1}}\n课程名称：{{thing2}}\n授课老师：{{thing3}}\n温馨提示：请提前5分钟进入教室',
    example: '上课时间：2024年1月1日 10:00\n课程名称：数学-二次函数\n授课老师：张老师\n温馨提示：请提前5分钟进入教室'
  },
  COURSE_COMPLETE: {
    id: 'COURSE_COMPLETE',
    name: '课程完成通知',
    title: '课程完成通知',
    templateId: '',
    content: '课程名称：{{thing1}}\n完成时间：{{datetime2}}\n学习时长：{{thing3}}\n课程评价：{{thing4}}',
    example: '课程名称：数学-二次函数\n完成时间：2024年1月1日 11:00\n学习时长：60分钟\n课程评价：优秀'
  },
  ACHIEVEMENT_UNLOCK: {
    id: 'ACHIEVEMENT_UNLOCK',
    name: '成就解锁通知',
    title: '恭喜获得新成就',
    templateId: '',
    content: '成就名称：{{thing1}}\n解锁时间：{{datetime2}}\n成就描述：{{thing3}}\n继续加油，解锁更多成就！',
    example: '成就名称：数学小能手\n解锁时间：2024年1月1日\n成就描述：完成10节数学课程\n继续加油，解锁更多成就！'
  },
  LEAD_UPDATE: {
    id: 'LEAD_UPDATE',
    name: '线索状态更新',
    title: '试课安排通知',
    templateId: '',
    content: '学生姓名：{{thing1}}\n试课时间：{{datetime2}}\n试课科目：{{thing3}}\n请及时确认并准备',
    example: '学生姓名：小明\n试课时间：2024年1月1日 14:00\n试课科目：数学\n请及时确认并准备'
  },
  PAYMENT_RECEIVED: {
    id: 'PAYMENT_RECEIVED',
    name: '支付到账通知',
    title: '收入到账提醒',
    templateId: '',
    content: '收入金额：{{amount1}}\n到账时间：{{datetime2}}\n课程信息：{{thing3}}\n已存入您的账户',
    example: '收入金额：180.00元\n到账时间：2024年1月1日\n课程信息：数学-二次函数\n已存入您的账户'
  },
  STUDY_REPORT_DAILY: {
    id: 'STUDY_REPORT_DAILY',
    name: '每日学习报告',
    title: '学习日报',
    templateId: '',
    content: '学习日期：{{datetime1}}\n学习时长：{{thing2}}\n完成课程：{{thing3}}\n今日表现：{{thing4}}',
    example: '学习日期：2024年1月1日\n学习时长：90分钟\n完成课程：2节\n今日表现：优秀'
  }
}

class WechatSubscriptionService {
  private accessToken: string | null = null
  private tokenExpiresAt: Date | null = null
  private readonly appId: string
  private readonly appSecret: string

  constructor() {
    this.appId = process.env.WECHAT_MINIPROGRAM_APPID || ''
    this.appSecret = process.env.WECHAT_MINIPROGRAM_SECRET || ''
  }

  /**
   * 获取 access_token
   */
  private async getAccessToken(): Promise<string> {
    // 如果 token 有效，直接返回
    if (this.accessToken && this.tokenExpiresAt && this.tokenExpiresAt > new Date()) {
      return this.accessToken
    }

    try {
      const response = await fetch(
        `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${this.appId}&secret=${this.appSecret}`
      )

      const data = await response.json()

      if (data.errcode) {
        throw new Error(`获取 access_token 失败: ${data.errmsg}`)
      }

      this.accessToken = data.access_token
      this.tokenExpiresAt = new Date(Date.now() + (data.expires_in - 300) * 1000) // 提前5分钟过期

      return this.accessToken!
    } catch (error) {
      console.error('[微信] 获取 access_token 失败:', error)
      throw error
    }
  }

  /**
   * 发送订阅消息
   */
  async send(message: WechatSubscriptionMessage): Promise<boolean> {
    try {
      const token = await this.getAccessToken()

      const response = await fetch(
        `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message)
        }
      )

      const result = await response.json()

      if (result.errcode === 0) {
        console.log(`[微信订阅消息] 发送成功: ${message.touser}`)
        return true
      } else if (result.errcode === 43101) {
        // 用户拒收了订阅消息
        console.warn(`[微信订阅消息] 用户拒收: ${message.touser}`)
        return false
      } else {
        console.error(`[微信订阅消息] 发送失败: ${result.errcode} - ${result.errmsg}`)
        return false
      }
    } catch (error) {
      console.error('[微信订阅消息] 发送异常:', error)
      return false
    }
  }

  /**
   * 获取用户的 openid
   */
  async getUserOpenId(userId: string): Promise<string | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { openid: true }
      })

      return user?.openid || null
    } catch (error) {
      console.error('[微信] 获取用户 openid 失败:', error)
      return null
    }
  }

  /**
   * 发送课前提醒
   */
  async sendBookingReminder(userId: string, bookingData: {
    datetime: Date
    courseName: string
    teacherName: string
  }): Promise<boolean> {
    const openId = await this.getUserOpenId(userId)
    if (!openId) {
      console.warn(`[微信] 用户 openid 不存在: ${userId}`)
      return false
    }

    const template = SUBSCRIPTION_TEMPLATES.BOOKING_REMINDER

    const message: WechatSubscriptionMessage = {
      touser: openId,
      templateId: template.templateId,
      page: `/pages/classroom/index?booking=${bookingData.datetime.getTime()}`,
      data: {
        datetime1: {
          value: this.formatDate(bookingData.datetime)
        },
        thing2: {
          value: this.truncate(bookingData.courseName, 20)
        },
        thing3: {
          value: this.truncate(bookingData.teacherName, 10)
        }
      }
    }

    return this.send(message)
  }

  /**
   * 发送课程完成通知
   */
  async sendCourseComplete(userId: string, courseData: {
    courseName: string
    completeTime: Date
    duration: number
    evaluation: string
  }): Promise<boolean> {
    const openId = await this.getUserOpenId(userId)
    if (!openId) return false

    const template = SUBSCRIPTION_TEMPLATES.COURSE_COMPLETE

    const message: WechatSubscriptionMessage = {
      touser: openId,
      templateId: template.templateId,
      data: {
        thing1: { value: this.truncate(courseData.courseName, 20) },
        datetime2: { value: this.formatDate(courseData.completeTime) },
        thing3: { value: `${courseData.duration}分钟` },
        thing4: { value: this.truncate(courseData.evaluation, 20) }
      }
    }

    return this.send(message)
  }

  /**
   * 发送成就解锁通知
   */
  async sendAchievementUnlock(userId: string, achievementData: {
    name: string
    unlockTime: Date
    description: string
  }): Promise<boolean> {
    const openId = await this.getUserOpenId(userId)
    if (!openId) return false

    const template = SUBSCRIPTION_TEMPLATES.ACHIEVEMENT_UNLOCK

    const message: WechatSubscriptionMessage = {
      touser: openId,
      templateId: template.templateId,
      page: '/pages/profile/achievements',
      data: {
        thing1: { value: this.truncate(achievementData.name, 20) },
        datetime2: { value: this.formatDate(achievementData.unlockTime) },
        thing3: { value: this.truncate(achievementData.description, 20) }
      }
    }

    return this.send(message)
  }

  /**
   * 发送支付到账通知
   */
  async sendPaymentReceived(userId: string, paymentData: {
    amount: number
    receivedAt: Date
    courseInfo: string
  }): Promise<boolean> {
    const openId = await this.getUserOpenId(userId)
    if (!openId) return false

    const template = SUBSCRIPTION_TEMPLATES.PAYMENT_RECEIVED

    const message: WechatSubscriptionMessage = {
      touser: openId,
      templateId: template.templateId,
      data: {
        amount1: { value: `¥${(paymentData.amount / 100).toFixed(2)}` },
        datetime2: { value: this.formatDate(paymentData.receivedAt) },
        thing3: { value: this.truncate(paymentData.courseInfo, 20) }
      }
    }

    return this.send(message)
  }

  /**
   * 批量发送每日学习报告
   */
  async sendDailyStudyReport(userIds: string[], reportData: {
    date: Date
    studyTime: number
    completedCourses: number
    performance: string
  }): Promise<{ success: number; failed: number }> {
    let success = 0
    let failed = 0

    for (const userId of userIds) {
      const openId = await this.getUserOpenId(userId)
      if (!openId) {
        failed++
        continue
      }

      const template = SUBSCRIPTION_TEMPLATES.STUDY_REPORT_DAILY

      const message: WechatSubscriptionMessage = {
        touser: openId,
        templateId: template.templateId,
        page: '/pages/profile/index',
        data: {
          datetime1: { value: this.formatDate(reportData.date) },
          thing2: { value: `${Math.floor(reportData.studyTime / 60)}分钟` },
          thing3: { value: `${reportData.completedCourses}节` },
          thing4: { value: this.truncate(reportData.performance, 20) }
        }
      }

      const result = await this.send(message)
      if (result) {
        success++
      } else {
        failed++
      }
    }

    return { success, failed }
  }

  /**
   * 获取模板列表
   */
  getTemplates(): SubscriptionTemplate[] {
    return Object.values(SUBSCRIPTION_TEMPLATES)
  }

  /**
   * 格式化日期
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')

    return `${year}年${month}月${day}日 ${hour}:${minute}`
  }

  /**
   * 截断字符串（微信字段有长度限制）
   */
  private truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
      return str
    }
    return str.substring(0, maxLength - 1) + '…'
  }
}

// 导出单例
export const wechatSubscriptionService = new WechatSubscriptionService()
