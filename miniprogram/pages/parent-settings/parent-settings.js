// pages/parent-settings/parent-settings.js
const app = getApp()

Page({
  data: {
    // 家长绑定状态
    parentBound: false,
    parentInfo: null,

    // 通知设置
    notificationSettings: {
      achievement: false,
      dailyReminder: false,
      weeklyReport: false
    }
  },

  onLoad(options) {
    console.log('家长设置页面加载', options)
    this.loadParentInfo()
    this.loadNotificationSettings()
  },

  /**
   * 加载家长绑定信息
   */
  loadParentInfo() {
    // TODO: 从后端API获取家长绑定信息
    // 临时模拟数据
    const parentBound = false // 假设未绑定

    this.setData({
      parentBound,
      parentInfo: parentBound ? {
        nickname: '家长昵称',
        avatarUrl: ''
      } : null
    })
  },

  /**
   * 加载通知设置
   */
  loadNotificationSettings() {
    // TODO: 从后端API获取通知设置
    // 临时使用本地存储
    const settings = wx.getStorageSync('notificationSettings') || {
      achievement: false,
      dailyReminder: false,
      weeklyReport: false
    }

    this.setData({
      notificationSettings: settings
    })
  },

  /**
   * 绑定家长
   */
  bindParent() {
    wx.showModal({
      title: '绑定家长账号',
      content: '请确保使用家长的微信账号进行绑定，以便接收学习通知',
      confirmText: '继续',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.requestSubscriptionAndBind()
        }
      }
    })
  },

  /**
   * 请求订阅消息权限并绑定
   */
  async requestSubscriptionAndBind() {
    // 请求订阅消息权限
    const tmplId = 'YOUR_TEMPLATE_ID' // 替换为实际的模板ID

    try {
      const authorized = await this.requestSubscribeMessage(tmplId)

      if (!authorized) {
        wx.showModal({
          title: '提示',
          content: '您拒绝了订阅消息授权，将无法接收学习通知。是否重新授权？',
          confirmText: '重新授权',
          cancelText: '暂不开启',
          success: (res) => {
            if (res.confirm) {
              this.requestSubscriptionAndBind()
            }
          }
        })
        return
      }

      // TODO: 调用后端API绑定家长账号
      this.mockBindParent()

    } catch (error) {
      console.error('绑定失败:', error)
      wx.showToast({
        title: '绑定失败',
        icon: 'none'
      })
    }
  },

  /**
   * 请求订阅消息
   */
  requestSubscribeMessage(tmplId) {
    return new Promise((resolve) => {
      wx.requestSubscribeMessage({
        tmplIds: [tmplId],
        success: (res) => {
          if (res[tmplId] === 'accept') {
            resolve(true)
          } else {
            resolve(false)
          }
        },
        fail: (err) => {
          console.error('请求订阅消息失败:', err)
          resolve(false)
        }
      })
    })
  },

  /**
   * 模拟绑定家长（实际应该调用后端API）
   */
  mockBindParent() {
    // 模拟绑定成功
    setTimeout(() => {
      this.setData({
        parentBound: true,
        parentInfo: {
          nickname: '家长',
          avatarUrl: ''
        }
      })

      wx.showToast({
        title: '绑定成功',
        icon: 'success'
      })
    }, 500)
  },

  /**
   * 解绑家长
   */
  unbindParent() {
    wx.showModal({
      title: '解绑家长账号',
      content: '解绑后将无法接收学习通知，确认解绑？',
      confirmText: '确认解绑',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          // TODO: 调用后端API解绑
          this.setData({
            parentBound: false,
            parentInfo: null
          })

          wx.showToast({
            title: '已解绑',
            icon: 'success'
          })
        }
      }
    })
  },

  /**
   * 成就通知开关
   */
  onAchievementNotificationChange(e) {
    const enabled = e.detail.value
    this.updateNotificationSetting('achievement', enabled)
  },

  /**
   * 每日提醒开关
   */
  onDailyReminderChange(e) {
    const enabled = e.detail.value
    this.updateNotificationSetting('dailyReminder', enabled)
  },

  /**
   * 周报开关
   */
  onWeeklyReportChange(e) {
    const enabled = e.detail.value
    this.updateNotificationSetting('weeklyReport', enabled)
  },

  /**
   * 更新通知设置
   */
  updateNotificationSetting(key, value) {
    const settings = {
      ...this.data.notificationSettings,
      [key]: value
    }

    this.setData({
      notificationSettings: settings
    })

    // 保存到本地存储
    wx.setStorageSync('notificationSettings', settings)

    // TODO: 同步到后端
    if (value) {
      wx.showToast({
        title: '已开启',
        icon: 'success'
      })
    } else {
      wx.showToast({
        title: '已关闭',
        icon: 'none'
      })
    }
  },

  /**
   * 返回
   */
  goBack() {
    wx.navigateBack()
  }
})
