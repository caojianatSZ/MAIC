// pages/checkin/checkin.js
const app = getApp()

Page({
  data: {
    // 当前日期
    currentDate: new Date(),
    currentMonth: new Date().getMonth() + 1,
    currentYear: new Date().getFullYear(),

    // 星期标题
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],

    // 日历数据
    calendarDays: [],

    // 打卡状态
    checkedIn: false,
    checkinTime: null,

    // 统计数据
    streak: 0,
    monthCheckins: 0,
    totalCheckins: 0,

    // 打卡提醒
    reminderEnabled: false,

    // 相关成就
    streakAchievements: []
  },

  onLoad(options) {
    console.log('打卡页面加载', options)
    this.initCalendar()
    this.loadCheckinData()
    this.loadStreakAchievements()
  },

  onShow() {
    // 每次显示页面时刷新数据
    this.loadCheckinData()
  },

  /**
   * 初始化日历
   */
  initCalendar() {
    const now = this.data.currentDate
    const year = now.getFullYear()
    const month = now.getMonth()

    // 获取当月第一天和最后一天
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    // 获取第一天是星期几（0-6）
    const firstDayWeek = firstDay.getDay()

    // 生成日历数据
    const calendarDays = []

    // 填充月初空白
    for (let i = 0; i < firstDayWeek; i++) {
      calendarDays.push({
        day: '',
        date: '',
        isEmpty: true
      })
    }

    // 填充当月日期
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day)
      calendarDays.push({
        day,
        date: date.toISOString().split('T')[0],
        isEmpty: false,
        isToday: day === now.getDate(),
        checkedIn: false
      })
    }

    this.setData({
      calendarDays,
      currentMonth: month + 1,
      currentYear: year
    })
  },

  /**
   * 加载打卡数据
   */
  loadCheckinData() {
    const baseUrl = app.globalData.baseUrl || 'http://localhost:3000'
    const userId = app.globalData.userId || 'demo_user'

    wx.showLoading({
      title: '加载中...',
      mask: true
    })

    wx.request({
      url: `${baseUrl}/api/checkin`,
      method: 'GET',
      data: { userId },
      success: (res) => {
        wx.hideLoading()

        if (res.data.success) {
          const data = res.data.data

          // 更新打卡状态
          this.setData({
            checkedIn: data.checkedIn,
            checkinTime: data.checkinTime,
            streak: data.streak,
            monthCheckins: data.monthCheckins,
            totalCheckins: data.monthCheckins // 简化实现，实际应查询总次数
          })

          // 更新日历打卡状态
          this.updateCalendarCheckinStatus()
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('加载打卡数据失败:', err)
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        })
      }
    })
  },

  /**
   * 更新日历打卡状态
   */
  async updateCalendarCheckinStatus() {
    const baseUrl = app.globalData.baseUrl || 'http://localhost:3000'
    const userId = app.globalData.userId || 'demo_user'

    // 获取本月所有打卡记录
    const monthStart = new Date(this.data.currentYear, this.data.currentMonth - 1, 1)
    const monthEnd = new Date(this.data.currentYear, this.data.currentMonth, 0)

    // TODO: 调用API获取本月打卡日期
    // 临时实现：根据已打卡天数随机显示
    const calendarDays = this.data.calendarDays.map(day => {
      if (!day.isEmpty && day.day <= new Date().getDate()) {
        // 模拟：前几天的打卡状态
        const dayNum = day.day
        const today = new Date().getDate()
        const isPastDay = dayNum < today

        if (isPastDay && this.data.monthCheckins > 0) {
          // 简单模拟：随机一些天已打卡
          const randomCheckin = Math.random() < 0.6
          return { ...day, checkedIn: randomCheckin }
        }
      }
      return day
    })

    this.setData({ calendarDays })
  },

  /**
   * 加载打卡相关成就
   */
  loadStreakAchievements() {
    const baseUrl = app.globalData.baseUrl || 'http://localhost:3000'
    const userId = app.globalData.userId || 'demo_user'

    wx.request({
      url: `${baseUrl}/api/achievements`,
      method: 'GET',
      data: {
        userId,
        type: 'habit' // 只获取习惯类成就
      },
      success: (res) => {
        if (res.data.success) {
          // 筛选打卡相关成就
          const streakAchievements = res.data.data.achievements.filter(a =>
            a.name.includes('连续') || a.name.includes('打卡')
          ).slice(0, 3) // 只显示前3个

          this.setData({ streakAchievements })
        }
      }
    })
  },

  /**
   * 打卡
   */
  onCheckIn() {
    if (this.data.checkedIn) {
      return
    }

    const baseUrl = app.globalData.baseUrl || 'http://localhost:3000'
    const userId = app.globalData.userId || 'demo_user'

    wx.showLoading({
      title: '打卡中...',
      mask: true
    })

    wx.request({
      url: `${baseUrl}/api/checkin`,
      method: 'POST',
      data: { userId },
      success: (res) => {
        wx.hideLoading()

        if (res.data.success) {
          const data = res.data.data

          // 更新打卡状态
          this.setData({
            checkedIn: true,
            checkinTime: data.checkinTime,
            streak: data.streak
          })

          // 震动反馈
          wx.vibrateShort({ type: 'light' })

          // 显示成功提示
          wx.showToast({
            title: `打卡成功！连续${data.streak}天`,
            icon: 'success',
            duration: 2000
          })

          // 如果解锁了成就，显示成就
          if (data.unlockedAchievements && data.unlockedAchievements.length > 0) {
            setTimeout(() => {
              this.showAchievementUnlock(data.unlockedAchievements[0])
            }, 2000)
          }

          // 刷新日历
          this.updateCalendarCheckinStatus()
        } else {
          wx.showToast({
            title: res.data.error || '打卡失败',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('打卡失败:', err)
        wx.showToast({
          title: '打卡失败，请重试',
          icon: 'none'
        })
      }
    })
  },

  /**
   * 显示成就解锁
   */
  showAchievementUnlock(achievement) {
    wx.showModal({
      title: '🏆 成就解锁！',
      content: `恭喜你获得「${achievement.name}」成就！\n\n${achievement.description || ''}`,
      showCancel: false,
      confirmText: '太棒了'
    })
  },

  /**
   * 开启/关闭打卡提醒
   */
  onReminderChange(e) {
    const enabled = e.detail.value

    if (enabled) {
      wx.showToast({
        title: '提醒功能开发中',
        icon: 'none'
      })
      return
    }

    this.setData({
      reminderEnabled: enabled
    })
  },

  /**
   * 返回
   */
  goBack() {
    wx.navigateBack()
  }
})
