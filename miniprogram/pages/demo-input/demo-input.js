// pages/demo-input/demo-input.js
const { getBaseUrl } = require('../../utils/config')

Page({
  data: {
    selectedGrade: '初三',
    selectedSubject: '数学',
    gradeOptions: ['初一', '初二', '初三', '高一', '高二', '高三'],
    subjectOptions: ['数学', '物理', '化学', '生物', '语文', '英语', '历史', '地理', '政治'],
    recommendations: [],
    loadingRecommendations: false,
    inputTopic: '',
    generating: false
  },

  onLoad() {
    this.loadRecommendations()
  },

  onSelectGrade(e) {
    const grade = e.currentTarget.dataset.grade
    this.setData({ selectedGrade: grade })
    this.loadRecommendations()
  },

  onSelectSubject(e) {
    const subject = e.currentTarget.dataset.subject
    this.setData({ selectedSubject: subject })
    this.loadRecommendations()
  },

  async loadRecommendations() {
    const { selectedGrade, selectedSubject } = this.data
    this.setData({ loadingRecommendations: true })

    try {
      const res = await wx.request({
        url: `${getBaseUrl()}/api/demo/recommendations`,
        method: 'GET',
        data: { grade: selectedGrade, subject: selectedSubject, limit: 8 }
      })

      if (res.data.success) {
        this.setData({ recommendations: res.data.data.recommendations })
      }
    } catch (err) {
      console.error('加载推荐失败:', err)
    } finally {
      this.setData({ loadingRecommendations: false })
    }
  },

  onSelectRecommendation(e) {
    const topic = e.currentTarget.dataset.topic
    this.setData({ inputTopic: topic })
  },

  onInputChange(e) {
    this.setData({ inputTopic: e.detail.value })
  },

  onStartGeneration() {
    const { inputTopic, selectedGrade, selectedSubject } = this.data
    if (!inputTopic) {
      wx.showToast({ title: '请输入或选择主题', icon: 'none' })
      return
    }

    wx.navigateTo({
      url: `/pages/demo-generating/demo-generating?topic=${encodeURIComponent(inputTopic)}&grade=${selectedGrade}&subject=${selectedSubject}`
    })
  }
})
