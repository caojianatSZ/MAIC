// pages/player/player.js
const app = getApp()

Page({
  data: {
    // 课程信息
    classroomInfo: {},

    // 场景列表
    scenes: [],
    currentSceneIndex: 0,
    currentScene: {},
    allCompleted: false,
    mode: null,
    showCompleteModal: false,

    // 统计
    completedCount: 0,

    // 传入参数
    classroomId: null,
    shareToken: null
  },

  onLoad(options) {
    console.log('播放页面加载', options)

    const { classroomId, shareToken, mode, courseData } = options

    // Demo 模式：直接使用传入的课程数据
    if (mode === 'demo' && courseData) {
      try {
        const course = JSON.parse(decodeURIComponent(courseData))
        console.log('Demo 模式加载课程:', course)

        // 初始化测验状态
        const scenesWithState = (course.scenes || []).map(scene => ({
          ...scene,
          completed: false,
          quizCompleted: false
        }))

        // 如果场景包含问题，初始化问题状态
        scenesWithState.forEach(scene => {
          // 处理幻灯片内容 - 提取 HTML 用于 rich-text
          if (scene.type === 'slide' && scene.content && scene.content.elements) {
            scene.htmlContent = this.extractHtmlFromElements(scene.content.elements)
          }

          // 处理测验问题
          if (scene.type === 'quiz' && scene.content && scene.content.questions) {
            scene.content.questions = scene.content.questions.map(q => ({
              ...q,
              selectedAnswer: null,
              selectedAnswers: [],
              showAnswer: false,
              isCorrect: false
            }))
          }
        })

        this.setData({
          mode: 'demo',
          classroomInfo: {
            id: course.courseId,
            title: course.topic || course.title,
            description: course.description,
            subject: course.subject,
            grade: course.grade
          },
          scenes: scenesWithState,
          currentSceneIndex: 0,
          currentScene: scenesWithState[0] || {}
        })

        wx.showToast({
          title: '课程加载成功',
          icon: 'success',
          duration: 1500
        })

        return
      } catch (e) {
        console.error('Demo 课程数据解析失败:', e)
        wx.showToast({
          title: '课程数据加载失败',
          icon: 'none'
        })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
        return
      }
    }

    // 正常模式：从服务器加载
    if (!classroomId && !shareToken) {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }

    this.setData({ classroomId, shareToken })
    this.loadClassroomData()
  },

  /**
   * 从元素数组中提取 HTML 字符串
   */
  extractHtmlFromElements(elements) {
    if (!elements || !Array.isArray(elements)) {
      return ''
    }

    return elements.map(el => {
      if (el.type === 'text' && el.content) {
        return el.content
      }
      return ''
    }).join('')
  },

  /**
   * 加载课程数据
   */
  async loadClassroomData() {
    wx.showLoading({
      title: '加载中...',
      mask: true
    })

    try {
      // TODO: 从API加载课程数据
      setTimeout(() => {
        wx.hideLoading()
      }, 1000)
    } catch (error) {
      console.error('加载失败:', error)
      wx.hideLoading()
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  /**
   * 返回
   */
  onGoBack() {
    wx.navigateBack()
  },

  /**
   * 上一节
   */
  onPrevScene() {
    const { currentSceneIndex, scenes } = this.data

    if (currentSceneIndex <= 0) {
      return
    }

    this.changeScene(currentSceneIndex - 1)
  },

  /**
   * 下一节
   */
  onNextScene() {
    const { currentSceneIndex, scenes } = this.data

    if (currentSceneIndex >= scenes.length - 1) {
      // 最后一节了，显示完成弹窗
      this.onShowCompleteModal()
      return
    }

    // 标记当前场景为已完成
    const updatedScenes = [...scenes]
    updatedScenes[currentSceneIndex].completed = true

    const completedCount = updatedScenes.filter(s => s.completed).length

    this.setData({
      scenes: updatedScenes,
      completedCount
    })

    this.changeScene(currentSceneIndex + 1)
  },

  /**
   * 切换场景
   */
  changeScene(index) {
    const { scenes } = this.data

    if (index < 0 || index >= scenes.length) {
      return
    }

    this.setData({
      currentSceneIndex: index,
      currentScene: scenes[index]
    })
  },

  /**
   * 选择单选答案
   */
  onSelectOption(e) {
    const { qIndex, value } = e.currentTarget.dataset
    const { scenes, currentSceneIndex } = this.data

    const updatedScenes = [...scenes]
    const question = updatedScenes[currentSceneIndex].content.questions[qIndex]

    question.selectedAnswer = value
    question.showAnswer = false

    this.setData({
      scenes: updatedScenes,
      currentScene: updatedScenes[currentSceneIndex]
    })
  },

  /**
   * 提交测验答案
   */
  onSubmitQuiz() {
    const { scenes, currentSceneIndex } = this.data
    const scene = scenes[currentSceneIndex]

    if (!scene.content || !scene.content.questions) {
      return
    }

    const questions = scene.content.questions
    let allAnswered = true
    let correctCount = 0

    questions.forEach(q => {
      // 检查是否已回答
      if (q.type === 'single' && !q.selectedAnswer) {
        allAnswered = false
      }

      // 判断答案是否正确
      if (q.type === 'single') {
        q.isCorrect = q.answer && q.answer.indexOf(q.selectedAnswer) !== -1
      }

      q.showAnswer = true

      if (q.isCorrect) {
        correctCount++
      }
    })

    if (!allAnswered) {
      wx.showToast({
        title: '请回答所有问题',
        icon: 'none'
      })
      return
    }

    // 标记测验完成
    const updatedScenes = [...scenes]
    updatedScenes[currentSceneIndex].quizCompleted = true
    updatedScenes[currentSceneIndex].completed = true

    const completedCount = updatedScenes.filter(s => s.completed).length

    this.setData({
      scenes: updatedScenes,
      currentScene: updatedScenes[currentSceneIndex],
      completedCount
    })

    // 显示结果
    const score = Math.round((correctCount / questions.length) * 100)
    wx.showToast({
      title: `得分: ${score}分`,
      icon: score >= 60 ? 'success' : 'none'
    })
  },

  /**
   * 显示完成弹窗
   */
  onShowCompleteModal() {
    const { scenes } = this.data
    const completedCount = scenes.filter(s => s.completed).length

    this.setData({
      showCompleteModal: true,
      completedCount
    })
  },

  /**
   * 关闭完成弹窗
   */
  onCloseCompleteModal() {
    this.setData({
      showCompleteModal: false
    })

    // 如果所有场景都完成了，返回上一页
    const { scenes } = this.data
    const allCompleted = scenes.every(s => s.completed)

    if (allCompleted) {
      setTimeout(() => {
        wx.navigateBack()
      }, 300)
    }
  },

  /**
   * 分享课程
   */
  onShareAppMessage() {
    return {
      title: this.data.classroomInfo.title || '精彩课程',
      path: `/pages/player/player?shareToken=${this.data.shareToken}`,
      imageUrl: ''
    }
  }
})
