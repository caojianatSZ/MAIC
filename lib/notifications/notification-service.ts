/**
 * 通知服务
 *
 * 支持多种通知渠道：微信订阅消息、站内消息、短信等
 */

export interface NotificationMessage {
  title: string
  content: string
  data?: Record<string, any>
}

export interface NotificationRecipient {
  userId: string
  channels: ('wechat' | 'sms' | 'email' | 'inapp')[]
}

export interface NotificationTemplate {
  id: string
  name: string
  type: 'booking_reminder' | 'course_complete' | 'achievement_unlock' | 'lead_update' | 'payment_received'
  templateId: string // 微信订阅消息模板ID
}

// 通知模板定义
const NOTIFICATION_TEMPLATES: Record<string, NotificationTemplate> = {
  BOOKING_REMINDER: {
    id: 'BOOKING_REMINDER',
    name: '课前提醒',
    type: 'booking_reminder',
    templateId: 'xxx' // 需要配置实际的微信模板ID
  },
  COURSE_COMPLETE: {
    id: 'COURSE_COMPLETE',
    name: '课程完成',
    type: 'course_complete',
    templateId: 'xxx'
  },
  ACHIEVEMENT_UNLOCK: {
    id: 'ACHIEVEMENT_UNLOCK',
    name: '成就解锁',
    type: 'achievement_unlock',
    templateId: 'xxx'
  },
  LEAD_UPDATE: {
    id: 'LEAD_UPDATE',
    name: '线索更新',
    type: 'lead_update',
    templateId: 'xxx'
  },
  PAYMENT_RECEIVED: {
    id: 'PAYMENT_RECEIVED',
    name: '支付到账',
    type: 'payment_received',
    templateId: 'xxx'
  }
}

class NotificationService {
  /**
   * 发送通知
   */
  async send(
    recipient: NotificationRecipient,
    template: string,
    message: NotificationMessage
  ): Promise<boolean> {
    const templateInfo = NOTIFICATION_TEMPLATES[template]
    if (!templateInfo) {
      console.error(`[通知] 模板不存在: ${template}`)
      return false
    }

    let success = false

    for (const channel of recipient.channels) {
      try {
        switch (channel) {
          case 'wechat':
            success = await this.sendWechatNotification(recipient.userId, templateInfo, message)
            break
          case 'inapp':
            success = await this.sendInAppNotification(recipient.userId, message)
            break
          case 'sms':
            success = await this.sendSMSNotification(recipient.userId, message)
            break
          default:
            console.warn(`[通知] 不支持的渠道: ${channel}`)
        }

        if (success) {
          console.log(`[通知] ${channel} 发送成功: ${message.title}`)
        }
      } catch (error) {
        console.error(`[通知] ${channel} 发送失败:`, error)
      }
    }

    return success
  }

  /**
   * 发送微信订阅消息
   */
  private async sendWechatNotification(
    userId: string,
    template: NotificationTemplate,
    message: NotificationMessage
  ): Promise<boolean> {
    try {
      // TODO: 调用微信订阅消息 API
      // 1. 获取用户的 openid
      // 2. 调用微信接口发送订阅消息

      console.log(`[微信通知] ${userId}: ${message.title}`)

      // 模拟发送成功
      return true
    } catch (error) {
      console.error('[微信通知] 发送失败:', error)
      return false
    }
  }

  /**
   * 发送站内消息
   */
  private async sendInAppNotification(
    userId: string,
    message: NotificationMessage
  ): Promise<boolean> {
    try {
      // 保存到数据库或缓存
      // TODO: 实现 Notification 模型和存储

      console.log(`[站内通知] ${userId}: ${message.title}`)
      return true
    } catch (error) {
      console.error('[站内通知] 发送失败:', error)
      return false
    }
  }

  /**
   * 发送短信通知
   */
  private async sendSMSNotification(
    userId: string,
    message: NotificationMessage
  ): Promise<boolean> {
    try {
      // TODO: 调用短信服务 API
      console.log(`[短信通知] ${userId}: ${message.title}`)
      return true
    } catch (error) {
      console.error('[短信通知] 发送失败:', error)
      return false
    }
  }

  /**
   * 批量发送通知
   */
  async sendBatch(
    recipients: NotificationRecipient[],
    template: string,
    message: NotificationMessage
  ): Promise<{ success: number; failed: number }> {
    let success = 0
    let failed = 0

    for (const recipient of recipients) {
      const result = await this.send(recipient, template, message)
      if (result) {
        success++
      } else {
        failed++
      }
    }

    return { success, failed }
  }

  /**
   * 获取可用模板列表
   */
  getTemplates(): NotificationTemplate[] {
    return Object.values(NOTIFICATION_TEMPLATES)
  }

  /**
   * 根据用户偏好获取通知渠道
   */
  async getUserChannels(userId: string): Promise<NotificationRecipient['channels']> {
    // TODO: 从用户设置中获取偏好
    return ['inapp'] // 默认只使用站内通知
  }
}

// 导出单例
export const notificationService = new NotificationService()

// 便捷方法
export async function sendNotification(
  userId: string,
  template: string,
  message: NotificationMessage
): Promise<boolean> {
  const channels = await notificationService.getUserChannels(userId)
  return notificationService.send(
    { userId, channels },
    template,
    message
  )
}

export async function sendNotificationBatch(
  userIds: string[],
  template: string,
  message: NotificationMessage
): Promise<{ success: number; failed: number }> {
  const recipients = await Promise.all(
    userIds.map(async (userId) => ({
      userId,
      channels: await notificationService.getUserChannels(userId)
    }))
  )

  return notificationService.sendBatch(recipients, template, message)
}
