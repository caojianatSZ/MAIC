// pages/index/index.js
const app = getApp()

Page({
  data: {
    questionText: ''
  },

  onLoad(options) {
    console.log('首页加载', options)
  },

  onShow() {
    console.log('首页显示')
  },

  /**
   * 拍照上传
   */
  onTakePhoto() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0]
        console.log('拍照成功:', tempFilePath)

        // TODO: 调用 OCR API 识别图片
        this.recognizeImage(tempFilePath)
      },
      fail: (err) => {
        console.error('拍照失败:', err)
        wx.showToast({
          title: '拍照失败',
          icon: 'none'
        })
      }
    })
  },

  /**
   * 识别图片（OCR）
   */
  recognizeImage(imagePath) {
    wx.showLoading({
      title: '识别中...',
      mask: true
    })

    // TODO: 调用后端 OCR API
    // wx.request({
    //   url: `${app.globalData.baseUrl}/homework/ocr`,
    //   method: 'POST',
    //   data: {
    //     image: imagePath
    //   },
    //   success: (res) => {
    //     this.setData({
    //       questionText: res.data.text
    //     })
    //     wx.hideLoading()
    //   },
    //   fail: (err) => {
    //     wx.hideLoading()
    //     wx.showToast({
    //       title: '识别失败，请手动输入',
    //       icon: 'none'
    //     })
    //   }
    // })

    // 临时模拟
    setTimeout(() => {
      this.setData({
        questionText: '模拟识别结果：1+1=2 是多少？'
      })
      wx.hideLoading()
    }, 1000)
  },

  /**
   * 输入框变化
   */
  onInputChange(e) {
    this.setData({
      questionText: e.detail.value
    })
  },

  /**
   * 提交题目
   */
  onSubmit() {
    if (!this.data.questionText.trim()) {
      wx.showToast({
        title: '请输入作业题目',
        icon: 'none'
      })
      return
    }

    wx.showLoading({
      title: '提交中...',
      mask: true
    })

    // TODO: 调用后端 API 提交作业
    // wx.request({
    //   url: `${app.globalData.baseUrl}/homework/submit`,
    //   method: 'POST',
    //   data: {
    //     question: this.data.questionText
    //   },
    //   success: (res) => {
    //     wx.hideLoading()
    //     wx.navigateTo({
    //       url: `/pages/result/result?id=${res.data.id}`
    //     })
    //   },
    //   fail: (err) => {
    //     wx.hideLoading()
    //     wx.showToast({
    //       title: '提交失败，请重试',
    //       icon: 'none'
    //     })
    //   }
    // })

    // 临时模拟
    setTimeout(() => {
      wx.hideLoading()
      wx.showToast({
        title: '提交成功（模拟）',
        icon: 'success'
      })
    }, 1000)
  }
})
