// pages/result/result.js
const app = getApp()

Page({
  data: {
    question: '',
    explanation: '',
    audioUrl: '',
    isPlaying: false,
    practiceQuestions: []
  },

  onLoad(options) {
    console.log('结果页加载', options)

    // TODO: 根据传入的 id 获取作业结果
    // const id = options.id
    // this.fetchResult(id)

    // 临时模拟数据
    this.setData({
      question: '1 + 1 = ?',
      explanation: '这是一道基础的加法题。1 + 1 表示将 1 和 1 相加，结果是 2。加法是最基本的数学运算之一。',
      audioUrl: '', // TODO: 从后端获取
      practiceQuestions: [
        {
          id: 1,
          questionNumber: 1,
          questionText: '2 + 2 = ?',
          options: ['3', '4', '5', '6'],
          correctAnswer: '4'
        },
        {
          id: 2,
          questionNumber: 2,
          questionText: '3 + 3 = ?',
          options: ['5', '6', '7', '8'],
          correctAnswer: '6'
        },
        {
          id: 3,
          questionNumber: 3,
          questionText: '4 + 4 = ?',
          options: ['7', '8', '9', '10'],
          correctAnswer: '8'
        }
      ]
    })
  },

  onShow() {
    console.log('结果页显示')
  },

  /**
   * 播放音频
   */
  onPlayAudio() {
    const audioContext = wx.createInnerAudioContext()

    if (this.data.isPlaying) {
      audioContext.pause()
      this.setData({
        isPlaying: false
      })
    } else {
      // TODO: 播放实际音频
      // audioContext.src = this.data.audioUrl
      // audioContext.play()

      this.setData({
        isPlaying: true
      })

      // 临时模拟
      wx.showToast({
        title: '音频播放中（模拟）',
        icon: 'none'
      })

      setTimeout(() => {
        this.setData({
          isPlaying: false
        })
      }, 2000)
    }
  },

  /**
   * 选择答案
   */
  onSelectOption(e) {
    const { questionIndex, optionIndex } = e.currentTarget.dataset
    const question = this.data.practiceQuestions[questionIndex]
    const selectedOption = question.options[optionIndex]

    console.log('选择答案:', questionIndex, optionIndex, selectedOption)

    // TODO: 验证答案并显示正确/错误提示
    const isCorrect = selectedOption === question.correctAnswer

    wx.showToast({
      title: isCorrect ? '✅ 回答正确' : '❌ 回答错误',
      icon: 'none'
    })
  },

  /**
   * 选项字母
   */
  optionLetter(index) {
    return String.fromCharCode(65 + index) // A, B, C, D...
  },

  /**
   * 重新生成
   */
  onRegenerate() {
    wx.showModal({
      title: '重新生成',
      content: '确定要重新生成讲解吗？',
      success: (res) => {
        if (res.confirm) {
          // TODO: 调用后端 API 重新生成
          wx.showToast({
            title: '重新生成中（模拟）',
            icon: 'loading'
          })
        }
      }
    })
  },

  /**
   * 返回首页
   */
  onBackHome() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  /**
   * 获取作业结果
   */
  fetchResult(id) {
    wx.showLoading({
      title: '加载中...',
      mask: true
    })

    wx.request({
      url: `${app.globalData.baseUrl}/homework/result/${id}`,
      method: 'GET',
      success: (res) => {
        wx.hideLoading()
        this.setData({
          question: res.data.question,
          explanation: res.data.explanation,
          audioUrl: res.data.audioUrl,
          practiceQuestions: res.data.practiceQuestions
        })
      },
      fail: (err) => {
        wx.hideLoading()
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        })
      }
    })
  }
})
