// pages/demo-library/demo-library.js
const { getBaseUrl } = require('../../utils/config')

Page({
  data: {
    topic: '',
    versions: [],
    loading: true
  },

  onLoad(options) {
    const { topic } = options
    this.setData({ topic: decodeURIComponent(topic) })
    this.loadLibrary()
  },

  async loadLibrary() {
    const { topic } = this.data

    try {
      const res = await wx.request({
        url: `${getBaseUrl()}/api/demo/library`,
        method: 'GET',
        data: { topic }
      })

      if (res.data.success) {
        this.setData({
          versions: res.data.data.versions,
          loading: false
        })
      }
    } catch (err) {
      console.error('加载课程库失败:', err)
      this.setData({ loading: false })
    }
  },

  onSelectVersion(e) {
    const { classroomId } = e.currentTarget.dataset

    wx.showModal({
      title: '播放课程',
      content: '播放功能开发中',
      showCancel: false
    })
  }
})
