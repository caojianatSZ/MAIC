// pages/profile/profile.js
const app = getApp()

Page({
  data: {
    userInfo: {},
    stats: {
      totalCount: 0,
      todayCount: 0
    },
    historyList: []
  },

  onLoad(options) {
    console.log('个人中心加载', options)
  },

  onShow() {
    console.log('个人中心显示')
    this.loadUserInfo()
    this.loadStats()
    this.loadHistory()
  },

  /**
   * 加载用户信息
   */
  loadUserInfo() {
    // TODO: 从全局状态或后端获取用户信息
    const userInfo = app.globalData.userInfo || {}

    this.setData({
      userInfo: {
        nickName: userInfo.nickName || '微信用户',
        avatarUrl: userInfo.avatarUrl || ''
      }
    })
  },

  /**
   * 加载统计数据
   */
  loadStats() {
    // TODO: 调用后端 API 获取统计数据
    // wx.request({
    //   url: `${app.globalData.baseUrl}/user/stats`,
    //   method: 'GET',
    //   success: (res) => {
    //     this.setData({
    //       stats: res.data
    //     })
    //   }
    // })

    // 临时模拟数据
    this.setData({
      stats: {
        totalCount: 12,
        todayCount: 3
      }
    })
  },

  /**
   * 加载历史记录
   */
  loadHistory() {
    // TODO: 调用后端 API 获取历史记录
    // wx.request({
    //   url: `${app.globalData.baseUrl}/user/history`,
    //   method: 'GET',
    //   success: (res) => {
    //     this.setData({
    //       historyList: res.data
    //     })
    //   }
    // })

    // 临时模拟数据
    this.setData({
      historyList: [
        {
          id: 1,
          question: '1 + 1 = ?',
          createdAt: '今天 10:30'
        },
        {
          id: 2,
          question: '2 + 2 = ?',
          createdAt: '昨天 15:20'
        },
        {
          id: 3,
          question: '3 + 3 = ?',
          createdAt: '3天前'
        }
      ]
    })
  },

  /**
   * 查看历史记录详情
   */
  onViewHistory(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/result/result?id=${id}`
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
