// pages/index/index.js
const app = getApp()

Page({
  data: {
    questionText: '',
    showInput: false
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

        // 显示输入框并识别图片
        this.setData({ showInput: true })
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
   * 手动输入
   */
  onManualInput() {
    this.setData({
      showInput: true
    })
  },

  /**
   * 识别图片（OCR）
   */
  recognizeImage(imagePath) {
    wx.showLoading({
      title: '🔍 识别中...',
      mask: true
    })

    // 调用后端 OCR API
    const baseUrl = app.globalData.baseUrl || 'http://localhost:3000'

    wx.uploadFile({
      url: `${baseUrl}/api/ocr`,
      filePath: imagePath,
      name: 'file',
      formData: {
        language_type: 'CHN_ENG',
        probability: 'false'
      },
      success: (res) => {
        console.log('OCR识别响应:', res)

        try {
          const data = JSON.parse(res.data)

          if (data.success && data.data) {
            // 识别成功
            this.setData({
              questionText: data.data.text || ''
            })
            wx.hideLoading()
            wx.showToast({
              title: '✅ 识别成功',
              icon: 'success'
            })
          } else {
            throw new Error(data.error || '识别失败')
          }
        } catch (err) {
          console.error('解析OCR响应失败:', err)
          wx.hideLoading()
          wx.showToast({
            title: '识别失败，请手动输入',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        console.error('OCR请求失败:', err)
        wx.hideLoading()
        wx.showToast({
          title: '识别失败，请手动输入',
          icon: 'none'
        })
      }
    })
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
   * 清空输入
   */
  onClearInput() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空已输入的内容吗？',
      confirmText: '清空',
      confirmColor: '#EF4444',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            questionText: ''
          })
          wx.showToast({
            title: '已清空',
            icon: 'success'
          })
        }
      }
    })
  },

  /**
   * 粘贴内容
   */
  onPaste() {
    wx.getClipboardData({
      success: (res) => {
        const text = res.data
        if (text && text.trim()) {
          this.setData({
            questionText: this.data.questionText + text
          })
          wx.showToast({
            title: '✅ 已粘贴',
            icon: 'success'
          })
        } else {
          wx.showToast({
            title: '剪贴板为空',
            icon: 'none'
          })
        }
      }
    })
  },

  /**
   * 提交题目
   */
  onSubmit() {
    if (!this.data.questionText.trim()) {
      wx.showToast({
        title: '⚠️ 请输入作业题目',
        icon: 'none'
      })
      return
    }

    wx.showLoading({
      title: '🚀 生成中...',
      mask: true
    })

    // TODO: 调用后端 API 提交作业
    // const baseUrl = app.globalData.baseUrl || 'http://localhost:3000'
    // wx.request({
    //   url: `${baseUrl}/api/miniprogram/batch-submit`,
    //   method: 'POST',
    //   data: {
    //     questions: [{ text: this.data.questionText }]
    //   },
    //   header: {
    //     'Authorization': `Bearer ${wx.getStorageSync('token')}`
    //   },
    //   success: (res) => {
    //     wx.hideLoading()
    //     if (res.data.success) {
    //       const jobId = res.data.jobId
    //       // 跳转到结果页面
    //       wx.navigateTo({
    //         url: `/pages/result/result?jobId=${jobId}`
    //       })
    //     } else {
    //       throw new Error(res.data.message || '提交失败')
    //     }
    //   },
    //   fail: (err) => {
    //     wx.hideLoading()
    //     wx.showToast({
    //       title: '❌ 提交失败，请重试',
    //       icon: 'none'
    //     })
    //   }
    // })

    // 临时模拟 - 直接跳转
    setTimeout(() => {
      wx.hideLoading()
      wx.navigateTo({
        url: `/pages/result/result?question=${encodeURIComponent(this.data.questionText)}`
      })
    }, 1000)
  }
})
