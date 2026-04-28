// pages/login/login.js
const { getApiUrl } = require('../../utils/config')

Page({
  /**
   * 页面的初始数据
   */
  data: {
    agreed: false
  },

  /**
   * 用户协议勾选
   */
  onAgreementChange(e) {
    this.setData({
      agreed: e.detail.value.includes('agree')
    })
  },

  /**
   * 微信登录
   */
  wechatLogin() {
    if (!this.data.agreed) {
      wx.showToast({
        title: '请先同意用户协议',
        icon: 'none'
      })
      return
    }

    wx.showLoading({
      title: '登录中...'
    })

    // 获取微信登录code
    wx.login({
      success: (res) => {
        if (res.code) {
          // 调用后端登录API
          this.callLoginAPI(res.code)
        } else {
          wx.hideLoading()
          wx.showToast({
            title: '获取登录信息失败',
            icon: 'none'
          })
        }
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({
          title: '微信登录失败',
          icon: 'none'
        })
      }
    })
  },

  /**
   * 调用后端登录API
   */
  callLoginAPI(code) {
    const app = getApp()
    const url = getApiUrl('auth/login')

    wx.request({
      url: url,
      method: 'POST',
      header: {
        'content-type': 'application/json'
      },
      data: {
        code: code
      },
      success: (res) => {
        wx.hideLoading()

        if (res.data.success) {
          const { token, userId, isNewUser } = res.data.data

          // 保存用户信息和Token
          app.setUserInfo({
            id: userId,
            isNewUser
          })
          app.setToken(token)

          wx.showToast({
            title: isNewUser ? '欢迎加入OpenMAIC！' : '登录成功！',
            icon: 'success',
            duration: 1500
          })

          // 登录成功后跳转到首页
          setTimeout(() => {
            wx.switchTab({
              url: '/pages/index/index'
            })
          }, 1500)
        } else {
          wx.showToast({
            title: res.data.error || '登录失败',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('登录API调用失败:', err)
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        })
      }
    })
  },

  /**
   * 手机号登录
   */
  phoneLogin() {
    if (!this.data.agreed) {
      wx.showToast({
        title: '请先同意用户协议',
        icon: 'none'
      })
      return
    }

    wx.showToast({
      title: '手机号登录开发中',
      icon: 'none'
    })
  },

  /**
   * 返回
   */
  goBack() {
    wx.navigateBack()
  }
})
