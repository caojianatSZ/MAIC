// pages/profile/profile.js
const app = getApp()

Page({
  data: {
    userInfo: {},
    // 学生画像数据
    studentProfile: null,
    // 成就数据
    achievements: [],
    // 雷达图数据
    radarData: null,
    // 成长曲线数据
    growthData: null,
    // 标签数据
    strongPoints: [],
    weakPoints: [],
    // 加载状态
    loading: true
  },

  onLoad(options) {
    console.log('学生画像页面加载', options)
  },

  onShow() {
    console.log('学生画像页面显示')
    this.loadUserInfo()
    this.loadStudentProfile()
    this.loadAchievements()
    this.loadRadarData()
    this.loadGrowthData()
  },

  /**
   * 加载用户信息
   */
  loadUserInfo() {
    const userInfo = app.globalData.userInfo || {}

    this.setData({
      userInfo: {
        nickName: userInfo.nickName || '微信用户',
        avatarUrl: userInfo.avatarUrl || ''
      }
    })
  },

  /**
   * 加载学生画像
   */
  loadStudentProfile() {
    const baseUrl = app.globalData.baseUrl || 'http://localhost:3000'
    const userId = app.globalData.userId || 'demo_user'

    wx.request({
      url: `${baseUrl}/api/student/profile`,
      method: 'GET',
      data: { userId },
      success: (res) => {
        if (res.data.success) {
          const profile = res.data.data
          this.setData({
            studentProfile: profile,
            strongPoints: profile.strongPoints || [],
            weakPoints: profile.weakPoints || []
          })
        }
      },
      fail: (err) => {
        console.error('加载学生画像失败:', err)
      }
    })
  },

  /**
   * 加载成就列表
   */
  loadAchievements() {
    const baseUrl = app.globalData.baseUrl || 'http://localhost:3000'
    const userId = app.globalData.userId || 'demo_user'

    wx.request({
      url: `${baseUrl}/api/achievements`,
      method: 'GET',
      data: { userId },
      success: (res) => {
        if (res.data.success) {
          this.setData({
            achievements: res.data.data.achievements
          })
        }
      },
      fail: (err) => {
        console.error('加载成就失败:', err)
      },
      complete: () => {
        this.setData({ loading: false })
      }
    })
  },

  /**
   * 加载雷达图数据
   */
  loadRadarData() {
    const baseUrl = app.globalData.baseUrl || 'http://localhost:3000'
    const userId = app.globalData.userId || 'demo_user'

    wx.request({
      url: `${baseUrl}/api/student/radar`,
      method: 'GET',
      data: { userId, subject: 'math' },
      success: (res) => {
        if (res.data.success) {
          this.setData({
            radarData: res.data.data
          })
        }
      },
      fail: (err) => {
        console.error('加载雷达图数据失败:', err)
      }
    })
  },

  /**
   * 加载成长曲线数据（模拟）
   */
  loadGrowthData() {
    // TODO: 从后端获取真实数据
    this.setData({
      growthData: {
        dates: ['1周前', '6天前', '5天前', '4天前', '3天前', '2天前', '昨天', '今天'],
        mastery: [45, 48, 52, 55, 58, 62, 65, 70]
      }
    })
  },

  /**
   * 点击成就
   */
  onAchievementTap(e) {
    const { level, name, unlocked } = e.detail

    if (unlocked) {
      wx.showModal({
        title: name,
        content: `恭喜你解锁了${level}级成就！\n\n继续保持，解锁更多成就！`,
        showCancel: false
      })
    } else {
      wx.showToast({
        title: '继续努力！',
        icon: 'none'
      })
    }
  },

  /**
   * 查看更多成就
   */
  onViewMoreAchievements() {
    wx.showToast({
      title: '更多成就即将上线',
      icon: 'none'
    })
  },

  /**
   * 关于我们
   */
  onAbout() {
    wx.showModal({
      title: '关于我们',
      content: '作业辅导助手\n\n版本：1.0.0\n\n一款帮助家长辅导孩子作业的智能工具',
      showCancel: false
    })
  },

  /**
   * 意见反馈
   */
  onFeedback() {
    wx.showModal({
      title: '意见反馈',
      content: '感谢您的反馈！\n\n请通过以下方式联系我们：\n\n邮箱：feedback@example.com',
      showCancel: false
    })
  },

  /**
   * 使用帮助
   */
  onHelp() {
    wx.showModal({
      title: '使用帮助',
      content: '如何使用：\n\n1. 拍照或输入作业题目\n2. 提交后获取智能讲解\n3. 查看语音和文字讲解\n4. 完成练习题巩固知识',
      showCancel: false
    })
  }
})
