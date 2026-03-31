// pages/learning-path/learning-path.js
const app = getApp()

Page({
  /**
   * 页面的初始数据
   */
  data: {
    loading: true,
    // 统计数据
    masteredCount: 0,
    weakCount: 0,
    totalDuration: 0,
    // 学习路径
    learningPath: [],
    totalSteps: 0,
    completedSteps: 0,
    currentStep: null
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log('学习路径页面加载，参数:', options)

    // 解析参数
    let subject = options.subject || 'math'
    let targetKnowledgePoints = []
    let currentMastery = {}

    try {
      if (options.targetKnowledgePoints) {
        targetKnowledgePoints = JSON.parse(options.targetKnowledgePoints)
      }
      if (options.currentMastery) {
        currentMastery = JSON.parse(options.currentMastery)
      }
    } catch (e) {
      console.error('参数解析失败:', e)
    }

    // 如果没有参数，使用默认数据
    if (targetKnowledgePoints.length === 0) {
      this.loadDefaultPath()
    } else {
      // 调用 API 生成学习路径
      this.generateLearningPath(subject, targetKnowledgePoints, currentMastery)
    }
  },

  /**
   * 调用后端 API 生成学习路径
   */
  generateLearningPath(subject, targetKnowledgePoints, currentMastery) {
    const baseUrl = app.globalData.baseUrl || 'http://localhost:3000'

    wx.showLoading({
      title: '生成学习路径中...',
      mask: true
    })

    wx.request({
      url: `${baseUrl}/api/learning-path/generate`,
      method: 'POST',
      data: {
        subject: subject,
        targetKnowledgePoints: targetKnowledgePoints,
        currentMastery: currentMastery
      },
      success: (res) => {
        wx.hideLoading()
        console.log('学习路径生成成功:', res.data)

        if (res.data.success && res.data.data) {
          const pathData = res.data.data.path

          // 转换数据格式
          const learningPath = pathData.map((step, index) => ({
            step: index + 1,
            knowledgePointId: step.knowledgePointId,
            knowledgePointName: step.knowledgePointName,
            description: step.description,
            difficulty: step.difficulty,
            prerequisites: step.prerequisites,
            estimatedDuration: step.estimatedDuration,
            lessonCount: step.recommendedLessons ? step.recommendedLessons.length : 0,
            status: 'pending',
            recommendedLessons: step.recommendedLessons || []
          }))

          // 计算统计数据
          const masteredCount = targetKnowledgePoints.filter(id => {
            const mastery = currentMastery[id]
            return mastery && mastery >= 70
          }).length

          const weakCount = targetKnowledgePoints.length - masteredCount

          const totalDuration = learningPath.reduce((sum, item) => sum + item.estimatedDuration, 0)

          this.setData({
            loading: false,
            learningPath: learningPath,
            totalSteps: learningPath.length,
            totalDuration: totalDuration,
            masteredCount: masteredCount,
            weakCount: weakCount,
            completedSteps: 0,
            currentStep: learningPath[0]
          })

          wx.showToast({
            title: '学习路径生成成功',
            icon: 'success'
          })
        } else {
          this.showError('学习路径生成失败，请重试')
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('学习路径生成失败:', err)
        this.showError('网络错误，请检查开发服务器是否启动')
      }
    })
  },

  /**
   * 显示错误提示
   */
  showError(message) {
    wx.showModal({
      title: '错误',
      content: message,
      confirmText: '重试',
      cancelText: '返回',
      showCancel: true,
      success: (res) => {
        if (res.confirm) {
          // 重试
          const app = getApp()
          wx.navigateBack({
            success: () => {
              // 重新进入诊断页面
              setTimeout(() => {
                wx.navigateTo({
                  url: '/pages/diagnosis/diagnosis'
                })
              }, 100)
            }
          })
        } else {
          wx.navigateBack()
        }
      }
    })
  },

  /**
   * 加载默认学习路径（示例）
   */
  loadDefaultPath() {
    console.log('加载默认学习路径')

    const learningPath = [
      {
        step: 1,
        knowledgePointId: 'kf_003',
        knowledgePointName: '配方法求顶点',
        description: '通过配方法将二次函数化为顶点式',
        difficulty: 3,
        estimatedDuration: 3,
        lessonCount: 2,
        status: 'pending',
        recommendedLessons: ['lesson_001', 'lesson_002']
      },
      {
        step: 2,
        knowledgePointId: 'kf_002',
        knowledgePointName: '二次函数图像',
        description: '二次函数的图像是一条抛物线',
        difficulty: 2,
        estimatedDuration: 5,
        lessonCount: 3,
        status: 'pending',
        recommendedLessons: ['lesson_003', 'lesson_004', 'lesson_005']
      },
      {
        step: 3,
        knowledgePointId: 'kf_004',
        knowledgePointName: '图像平移变换',
        description: '二次函数图像的左右平移和上下平移规律',
        difficulty: 3,
        estimatedDuration: 4,
        lessonCount: 2,
        status: 'pending',
        recommendedLessons: ['lesson_006', 'lesson_007']
      },
      {
        step: 4,
        knowledgePointId: 'kf_005',
        knowledgePointName: '实际应用题',
        description: '利用二次函数解决实际生活中的最值问题',
        difficulty: 4,
        estimatedDuration: 6,
        lessonCount: 3,
        status: 'pending',
        recommendedLessons: ['lesson_008', 'lesson_009', 'lesson_010']
      }
    ]

    this.setData({
      loading: false,
      learningPath: learningPath,
      totalSteps: learningPath.length,
      totalDuration: learningPath.reduce((sum, item) => sum + item.estimatedDuration, 0),
      masteredCount: 1,
      weakCount: 3,
      completedSteps: 0,
      currentStep: learningPath[0]
    })
  },

  /**
   * 处理步骤点击
   */
  handleStepClick(e) {
    const step = e.currentTarget.dataset.step

    if (step.status === 'pending') {
      wx.showToast({
        title: '请先完成前置学习',
        icon: 'none'
      })
      return
    }

    if (step.status === 'in_progress') {
      // 跳转到课程学习页面
      this.startLearning()
    }
  },

  /**
   * 开始学习
   */
  startLearning() {
    const app = getApp()

    if (!app.isLoggedIn()) {
      wx.showModal({
        title: '提示',
        content: '登录后即可开始学习',
        confirmText: '去登录',
        success(res) {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/login/login'
            })
          }
        }
      })
      return
    }

    // 跳转到课程播放页面
    const currentStep = this.data.currentStep

    if (currentStep && currentStep.recommendedLessons && currentStep.recommendedLessons.length > 0) {
      const lessonId = currentStep.recommendedLessons[0]

      wx.navigateTo({
        url: `/pages/player/player?lessonId=${lessonId}&knowledgePoint=${currentStep.knowledgePointId}`
      })
    } else {
      wx.showToast({
        title: '课程准备中...',
        icon: 'none'
      })
    }
  },

  /**
   * 查看知识图谱
   */
  showKnowledgeGraph() {
    wx.navigateTo({
      url: '/pages/diagnosis/diagnosis?mode=graph'
    })
  },

  /**
   * 返回
   */
  goBack() {
    wx.navigateBack()
  }
})
