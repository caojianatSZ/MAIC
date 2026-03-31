// pages/comparison/comparison.js
Page({
  /**
   * 页面的初始数据
   */
  data: {},

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log('对比页面加载')
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack()
  },

  /**
   * 开始体验
   */
  startExperience() {
    // 跳转到诊断页面
    wx.navigateTo({
      url: '/pages/diagnosis/diagnosis'
    })
  }
})
