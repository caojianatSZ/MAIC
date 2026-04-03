// pages/demo-generating/demo-generating.js
const { getBaseUrl } = require('../../utils/config')

Page({
  data: {
    topic: '',
    grade: '',
    subject: '',
    progress: 0,
    scenes: [],
    totalScenes: 0,
    partialCourse: null,
    canPlay: false
  },

  onLoad(options) {
    this.setData({
      topic: decodeURIComponent(options.topic),
      grade: decodeURIComponent(options.grade),
      subject: decodeURIComponent(options.subject)
    })
    this.startGeneration()
  },

  async startGeneration() {
    const { topic, grade, subject } = this.data
    wx.showLoading({ title: '生成中...', mask: true })

    try {
      const res = await wx.request({
        url: `${getBaseUrl()}/api/demo/generate-course`,
        method: 'POST',
        data: {
          topic,
          grade,
          subject,
          difficulty: 'standard',
          style: 'basic'
        }
      })

      wx.hideLoading()

      if (res.statusCode === 200) {
        const course = res.data

        this.setData({
          partialCourse: course,
          scenes: course.scenes || [],
          totalScenes: course.sceneCount || course.scenes?.length || 0,
          canPlay: true,
          progress: 100
        })

        wx.showToast({
          title: '生成完成！',
          icon: 'success'
        })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('生成失败:', err)

      wx.showModal({
        title: '生成失败',
        content: '课程生成失败，请重试',
        confirmText: '重试',
        cancelText: '返回',
        success: (res) => {
          if (res.confirm) {
            this.startGeneration()
          } else {
            wx.navigateBack()
          }
        }
      })
    }
  },

  onPlayNow() {
    const { partialCourse } = this.data

    if (!partialCourse) {
      wx.showToast({
        title: '课程尚未就绪',
        icon: 'none'
      })
      return
    }

    wx.showToast({
      title: '播放功能开发中',
      icon: 'none'
    })
  }
})
