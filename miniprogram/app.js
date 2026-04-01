// app.js
App({
  onLaunch() {
    console.log('小程序启动')

    // 检查更新
    this.checkUpdate()
  },

  onShow() {
    console.log('小程序显示')
  },

  onHide() {
    console.log('小程序隐藏')
  },

  /**
   * 检查小程序更新
   */
  checkUpdate() {
    if (wx.canIUse('getUpdateManager')) {
      const updateManager = wx.getUpdateManager()

      updateManager.onCheckForUpdate((res) => {
        console.log('检查更新结果:', res.hasUpdate)
      })

      updateManager.onUpdateReady(() => {
        wx.showModal({
          title: '更新提示',
          content: '新版本已准备好，是否重启应用？',
          success: (res) => {
            if (res.confirm) {
              updateManager.applyUpdate()
            }
          }
        })
      })

      updateManager.onUpdateFailed(() => {
        console.error('新版本下载失败')
      })
    }
  },

  /**
   * 检查登录状态
   */
  isLoggedIn() {
    return !!(this.globalData.userInfo && this.globalData.token)
  },

  /**
   * 获取用户信息
   */
  getUserInfo() {
    return this.globalData.userInfo
  },

  /**
   * 获取Token
   */
  getToken() {
    return this.globalData.token
  },

  /**
   * 设置用户信息
   */
  setUserInfo(userInfo) {
    this.globalData.userInfo = userInfo
  },

  /**
   * 设置Token
   */
  setToken(token) {
    this.globalData.token = token
  },

  /**
   * 清除用户信息和Token（退出登录）
   */
  clearUserInfo() {
    this.globalData.userInfo = null
    this.globalData.token = null
  },

  /**
   * 全局数据
   */
  globalData: {
    userInfo: null,
    token: null,
    userId: 'demo_user_id', // 测试用户 ID
    baseUrl: 'http://localhost:3000' // 开发环境 API 地址（不包含/api后缀）
  }
})
