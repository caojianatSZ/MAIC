// pages/demo-home/demo-home.js
Page({
  /**
   * 页面的初始数据
   */
  data: {},

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    console.log('Demo首页加载')

    // 检查登录状态
    const app = getApp()
    if (app.isLoggedIn()) {
      // 已登录，跳转到正常首页
      wx.switchTab({
        url: '/pages/index/index'
      })
    }
  },

  /**
   * 跳转到诊断页面
   */
  goToDiagnosis() {
    wx.navigateTo({
      url: '/pages/diagnosis/diagnosis'
    })
  },

  /**
   * 显示效果对比
   */
  showComparison() {
    // 跳转到对比页面
    wx.navigateTo({
      url: '/pages/comparison/comparison'
    })
  },

  /**
   * 体验完整学习流程
   */
  showFullDemo() {
    wx.showModal({
      title: '体验完整学习流程',
      content: '我们将引导你完成：\n\n1. 智能诊断 - 发现薄弱知识点\n2. 查看知识图谱 - 可视化学习路径\n3. 生成学习路径 - 个性化推荐\n4. 学习课程 - AI生成的微课',
      confirmText: '开始体验',
      cancelText: '稍后',
      success: (res) => {
        if (res.confirm) {
          // 跳转到诊断页面，并标记为完整体验模式
          wx.navigateTo({
            url: '/pages/diagnosis/diagnosis?mode=full_demo'
          })
        }
      }
    })
  },

  /**
   * AI 生成课程演示
   */
  generateAICourse() {
    wx.showModal({
      title: 'AI 生成课程',
      content: '选择一个主题，AI 将在 2 秒内生成完整的微课课程',
      confirmText: '开始生成',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.showCourseTopics()
        }
      }
    })
  },

  /**
   * 显示课程主题选择
   */
  showCourseTopics() {
    const app = getApp()
    const baseUrl = app.globalData.baseUrl || 'http://localhost:3000'

    wx.showActionSheet({
      itemList: ['配方法求顶点', '二次函数图像', '二次函数应用题'],
      success: (res) => {
        const topics = ['配方法求顶点', '二次函数图像', '二次函数应用题']
        const selectedTopic = topics[res.tapIndex]
        this.callGenerateAPI(selectedTopic, baseUrl)
      }
    })
  },

  /**
   * 调用课程生成 API
   */
  callGenerateAPI(topic, baseUrl) {
    wx.showLoading({
      title: 'AI 生成中...',
      mask: true
    })

    wx.request({
      url: `${baseUrl}/api/demo/generate-course-sync`,
      method: 'POST',
      data: {
        topic: topic,
        subject: 'math',
        grade: '初三',
        difficulty: 'standard',
        style: 'basic'
      },
      success: (res) => {
        wx.hideLoading()
        console.log('课程生成API响应:', res)
        console.log('响应状态码:', res.statusCode)
        console.log('响应数据:', res.data)

        // 微信小程序的 res.data 已经是解析后的对象
        const responseData = res.data

        console.log('完整响应数据:', responseData)

        if (responseData && responseData.success) {
          // 课程数据在 responseData.data 中
          const course = responseData.data
          console.log('提取的课程数据:', course)

          if (!course || !course.courseId) {
            console.error('课程数据无效，完整响应:', responseData)
            wx.showToast({
              title: '课程数据无效',
              icon: 'none'
            })
            return
          }

          this.showGeneratedCourse(course)
        } else {
          console.error('API返回失败:', responseData)
          wx.showToast({
            title: '生成失败，请重试',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('课程生成失败:', err)
        wx.showToast({
          title: '网络错误',
          icon: 'none'
        })
      }
    })
  },

  /**
   * 显示生成的课程
   */
  showGeneratedCourse(course) {
    console.log('显示课程，课程数据:', course)

    if (!course) {
      console.error('课程数据为空')
      wx.showToast({
        title: '课程数据为空',
        icon: 'none'
      })
      return
    }

    const process = course.generationProcess || {
      totalDuration: '约2-3分钟',
      step1: '分析学习需求 ✓',
      step2: '生成课程大纲 ✓',
      step3: '生成所有场景 ✓'
    }

    // 使用 topic 而不是 title（课程数据中使用 topic 字段）
    const title = course.topic || course.title || '未知课程'
    const duration = course.duration || 720  // 默认12分钟
    const sceneCount = course.totalScenes || course.sceneCount || course.scenes?.length || 5

    wx.showModal({
      title: '✅ 课程生成完成！',
      content: `📚 主题：${title}\n⏱️ 时长：${Math.floor(duration / 60)}分钟\n🎬 场景数：${sceneCount}个\n\n⚡ 生成用时：${process.totalDuration}`,
      confirmText: '查看详情',
      cancelText: '返回',
      success: (res) => {
        if (res.confirm) {
          // 跳转到播放器，使用生成的课程数据
          const courseData = JSON.stringify(course)
          wx.navigateTo({
            url: `/pages/player/player?mode=demo&courseData=${encodeURIComponent(courseData)}`
          })
        }
      }
    })
  },

  /**
   * 跳转到登录
   */
  goToLogin() {
    wx.navigateTo({
      url: '/pages/login/login'
    })
  }
})
