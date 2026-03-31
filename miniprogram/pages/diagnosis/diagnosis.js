// pages/diagnosis/diagnosis.js
const app = getApp()

Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 诊断模式: 'entry' (入口选择) | 'setup' (年级知识点选择) | 'quiz' (答题诊断) | 'photo' (拍照诊断) | 'result' (结果展示)
    mode: 'entry',
    current: 0,
    selectedAnswer: null,
    progress: 0,
    loading: true,
    quizId: null,
    questions: [],
    optionLabels: ['A', 'B', 'C', 'D'],
    answers: [],
    // 诊断结果
    diagnosisResult: null,
    // 知识图谱数据
    knowledgeNodes: [],
    // 拍照诊断数据
    photoImage: null,
    photoAnalyzing: false,
    photoQuestions: [],
    // 诊断设置
    selectedGrade: '初三',  // 默认初三
    selectedTopic: '二次函数',  // 默认二次函数
    // 选项数据
    gradeOptions: ['初一', '初二', '初三'],
    topicOptions: ['二次函数', '一次函数', '几何图形', '代数基础', '概率统计']
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log('诊断页面加载', options)

    // 检查是否直接进入某种模式
    if (options.mode) {
      if (options.mode === 'full_demo') {
        // 完整体验模式：显示引导，然后自动进入设置
        this.setData({ mode: 'full_demo_intro' })
      } else if (options.mode === 'quiz') {
        this.setData({ mode: 'quiz' })
        this.loadQuiz()
      } else {
        this.setData({ mode: options.mode })
      }
    }
    // 默认显示入口选择
  },

  /**
   * 从后端 API 加载诊断题目
   */
  loadQuiz() {
    const baseUrl = app.globalData.baseUrl || 'http://localhost:3000'
    const { selectedGrade, selectedTopic } = this.data

    wx.showLoading({
      title: '加载中...',
      mask: true
    })

    console.log('加载诊断题目:', { grade: selectedGrade, topic: selectedTopic })

    wx.request({
      url: `${baseUrl}/api/diagnosis/quiz`,
      method: 'GET',
      data: {
        grade: selectedGrade,
        topic: selectedTopic
      },
      success: (res) => {
        wx.hideLoading()
        console.log('题目加载成功:', res.data)

        if (res.data.success && res.data.data) {
          const quizData = res.data.data

          // 转换题目格式
          const questions = quizData.questions.map(q => ({
            id: q.id,
            question: q.question,
            options: q.options,
            knowledgePointId: q.knowledgePointId,
            knowledgePoint: q.knowledgePoint || '知识点'
          }))

          this.setData({
            loading: false,
            quizId: quizData.quizId,
            questions: questions,
            progress: 0
          })
        } else {
          this.showError('题目加载失败，请重试')
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('题目加载失败:', err)
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
      success: (res) => {
        if (res.confirm) {
          this.loadQuiz()
        } else {
          wx.navigateBack()
        }
      }
    })
  },

  /**
   * 选择答案
   */
  selectAnswer(e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      selectedAnswer: index
    })
  },

  /**
   * 上一题
   */
  prevQuestion() {
    if (this.data.current > 0) {
      const prev = this.data.current - 1
      this.setData({
        current: prev,
        selectedAnswer: this.data.answers[prev] || null,
        progress: (prev / this.data.questions.length) * 100
      })
    }
  },

  /**
   * 下一题
   */
  nextQuestion() {
    if (this.data.selectedAnswer === null) {
      wx.showToast({
        title: '请选择一个答案',
        icon: 'none'
      })
      return
    }

    // 保存答案
    const answers = this.data.answers
    answers[this.data.current] = this.data.selectedAnswer

    // 判断是否是最后一题
    if (this.data.current < this.data.questions.length - 1) {
      const next = this.data.current + 1
      this.setData({
        current: next,
        selectedAnswer: answers[next] || null,
        answers: answers,
        progress: ((next + 1) / this.data.questions.length) * 100
      })
    } else {
      // 提交答案
      this.submitDiagnosis()
    }
  },

  /**
   * 提交诊断
   */
  submitDiagnosis() {
    const baseUrl = app.globalData.baseUrl || 'http://localhost:3000'

    wx.showLoading({
      title: '分析中...',
      mask: true
    })

    // 构建包含完整信息的题目数据
    const questionsWithAnswers = this.data.questions.map((q, index) => ({
      id: q.id,
      question: q.question,
      options: q.options,
      answer: q.answer,  // 正确答案
      userAnswer: this.data.answers[index],  // 用户答案
      knowledgePointId: q.knowledgePointId,
      knowledgePoint: q.knowledgePoint || '知识点'
    }))

    console.log('提交诊断数据:', {
      quizId: this.data.quizId,
      questionsCount: questionsWithAnswers.length
    })

    wx.request({
      url: `${baseUrl}/api/diagnosis/analyze`,
      method: 'POST',
      data: {
        quizId: this.data.quizId,
        questions: questionsWithAnswers
      },
      success: (res) => {
        wx.hideLoading()
        console.log('诊断分析成功:', res.data)

        if (res.data.success && res.data.data) {
          const result = res.data.data
          console.log('诊断分析结果:', result)
          console.log('知识点数据:', result.knowledgePoints)

          // 转换知识图谱数据
          const knowledgeNodes = result.knowledgePoints.map(kp => ({
            id: kp.knowledgePointId,
            name: kp.knowledgePointName,
            level: kp.level || 0,
            masteryLevel: kp.masteryLevel, // mastered, partial, weak
            description: kp.description || '',
            parents: kp.prerequisites || []
          }))

          console.log('转换后的知识图谱节点:', knowledgeNodes)

          this.setData({
            diagnosisResult: result,
            knowledgeNodes: knowledgeNodes,
            current: this.data.questions.length // 触发结果显示
          }, () => {
            console.log('setData 回调执行，当前状态:', {
              current: this.data.current,
              questionsLength: this.data.questions.length,
              knowledgeNodesLength: this.data.knowledgeNodes.length
            })
          })

          wx.showToast({
            title: '分析完成',
            icon: 'success'
          })
        } else {
          this.showError('分析失败，请重试')
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('诊断分析失败:', err)
        this.showError('分析失败，请检查网络连接')
      }
    })
  },

  /**
   * 学习节点事件
   */
  onLearnNode(e) {
    console.log('学习节点:', e.detail.node)
  },

  /**
   * 查看学习路径
   */
  showLearningPath() {
    if (!this.data.diagnosisResult) {
      wx.showToast({
        title: '请先完成诊断',
        icon: 'none'
      })
      return
    }

    // 将诊断结果传递给学习路径页面
    const result = this.data.diagnosisResult

    // 构建参数
    const params = {
      subject: result.subject || 'math',
      targetKnowledgePoints: result.knowledgePoints.map(kp => kp.knowledgePointId),
      currentMastery: {}
    }

    // 构建当前掌握度映射
    result.knowledgePoints.forEach(kp => {
      const masteryMap = {
        'mastered': 90,
        'partial': 50,
        'weak': 20
      }
      params.currentMastery[kp.knowledgePointId] = masteryMap[kp.masteryLevel] || 50
    })

    // 跳转到学习路径页面
    const queryString = Object.keys(params)
      .map(key => {
        if (key === 'currentMastery') {
          return `${key}=${JSON.stringify(params[key])}`
        }
        if (Array.isArray(params[key])) {
          return `${key}=${JSON.stringify(params[key])}`
        }
        return `${key}=${params[key]}`
      })
      .join('&')

    wx.navigateTo({
      url: `/pages/learning-path/learning-path?${queryString}`
    })
  },

  /**
   * 重新诊断
   */
  retryDiagnosis() {
    this.setData({
      current: 0,
      selectedAnswer: null,
      progress: 0,
      answers: [],
      diagnosisResult: null,
      knowledgeNodes: []
    })
    this.loadQuiz()
  },

  /**
   * 选择答题诊断模式
   */
  startQuizDiagnosis() {
    this.setData({ mode: 'setup' })
  },

  /**
   * 开始完整体验流程
   */
  startFullDemo() {
    this.setData({ mode: 'setup' })
  },

  /**
   * 选择年级
   */
  selectGrade(e) {
    const grade = e.currentTarget.dataset.grade
    this.setData({ selectedGrade: grade })
  },

  /**
   * 选择知识点
   */
  selectTopic(e) {
    const topic = e.currentTarget.dataset.topic
    this.setData({ selectedTopic: topic })
  },

  /**
   * 确认设置并开始诊断
   */
  confirmSetup() {
    this.setData({ mode: 'quiz' })
    this.loadQuiz()
  },

  /**
   * 选择拍照诊断模式
   */
  startPhotoDiagnosis() {
    this.setData({ mode: 'photo' })
    this.choosePhoto()
  },

  /**
   * 选择照片（拍照或相册）
   */
  choosePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        this.setData({
          photoImage: tempFilePath
        })
        this.analyzePhoto(tempFilePath)
      },
      fail: (err) => {
        console.error('选择图片失败', err)
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        })
      }
    })
  },

  /**
   * 分析照片
   */
  async analyzePhoto(filePath) {
    this.setData({ photoAnalyzing: true })

    wx.showLoading({
      title: '分析中...',
      mask: true
    })

    try {
      // 1. 转换图片为Base64
      const imageBase64 = await this.fileToBase64(filePath)

      // 2. 调用拍照诊断API
      const result = await this.callPhotoDiagnosisAPI(imageBase64)

      wx.hideLoading()

      if (!result || !result.questions || result.questions.length === 0) {
        wx.showModal({
          title: '识别失败',
          content: '未能识别到题目，请确保照片清晰，题目完整',
          confirmText: '重新拍照',
          cancelText: '返回',
          success: (res) => {
            if (res.confirm) {
              this.choosePhoto()
            } else {
              this.setData({ mode: 'entry', photoImage: null })
            }
          }
        })
        return
      }

      // 3. 显示识别结果预览
      this.showPhotoResultPreview(result)

    } catch (err) {
      wx.hideLoading()
      console.error('照片分析失败', err)

      wx.showModal({
        title: '分析失败',
        content: err.message || '照片分析失败，请重试',
        confirmText: '重新拍照',
        cancelText: '返回',
        success: (res) => {
          if (res.confirm) {
            this.choosePhoto()
          } else {
            this.setData({ mode: 'entry', photoImage: null })
          }
        }
      })
    } finally {
      this.setData({ photoAnalyzing: false })
    }
  },

  /**
   * 文件转Base64
   */
  fileToBase64(filePath) {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath,
        encoding: 'base64',
        success: (res) => {
          resolve('data:image/jpeg;base64,' + res.data)
        },
        fail: (err) => {
          console.error('文件读取失败', err)
          reject(new Error('图片读取失败'))
        }
      })
    })
  },

  /**
   * 调用拍照诊断API
   */
  callPhotoDiagnosisAPI(imageBase64) {
    const baseUrl = app.globalData.baseUrl || 'http://localhost:3000'

    return new Promise((resolve, reject) => {
      wx.request({
        url: `${baseUrl}/api/diagnosis/photo`,
        method: 'POST',
        data: {
          imageBase64,
          subject: 'math',
          grade: '初三'
        },
        success: (res) => {
          console.log('拍照诊断API响应:', res)
          if (res.data.success && res.data.data) {
            resolve(res.data.data)
          } else {
            reject(new Error(res.data.error || '分析失败'))
          }
        },
        fail: (err) => {
          console.error('API请求失败', err)
          reject(new Error('网络请求失败'))
        }
      })
    })
  },

  /**
   * 显示拍照识别结果预览
   */
  showPhotoResultPreview(data) {
    this.setData({
      photoQuestions: data.questions,
      ocrText: data.ocrText,
      mode: 'photo_result'
    })
  },

  /**
   * 确认拍照识别结果并生成诊断
   */
  confirmPhotoResult() {
    const questions = this.data.photoQuestions

    // 转换为诊断格式
    const knowledgePointsMap = new Map()

    questions.forEach(q => {
      q.knowledgePoints.forEach(kp => {
        if (!knowledgePointsMap.has(kp.id)) {
          knowledgePointsMap.set(kp.id, {
            knowledgePointId: kp.id,
            knowledgePointName: kp.name,
            masteryLevel: q.isCorrect ? 'mastered' : 'weak',
            description: '',
            prerequisites: []
          })
        } else {
          // 如果有答案且正确，更新掌握度
          if (q.isCorrect) {
            const existing = knowledgePointsMap.get(kp.id)
            existing.masteryLevel = 'mastered'
          }
        }
      })
    })

    const knowledgePoints = Array.from(knowledgePointsMap.values())

    // 计算总分
    const correctCount = questions.filter(q => q.isCorrect === true).length
    const totalScore = Math.round((correctCount / questions.length) * 100)

    const diagnosisResult = {
      subject: 'math',
      totalScore,
      correctCount,
      totalCount: questions.length,
      knowledgePoints
    }

    // 转换知识图谱数据
    const knowledgeNodes = knowledgePoints.map(kp => ({
      id: kp.knowledgePointId,
      name: kp.knowledgePointName,
      level: 0, // 暂时设为0，可以根据实际情况调整
      masteryLevel: kp.masteryLevel,
      description: kp.description || '',
      parents: kp.prerequisites || []
    }))

    console.log('拍照诊断结果:', diagnosisResult)
    console.log('知识图谱节点:', knowledgeNodes)

    this.setData({
      diagnosisResult,
      knowledgeNodes,
      mode: 'result'
    })
  },

  /**
   * 重新拍照
   */
  retakePhoto() {
    this.setData({
      photoImage: null,
      photoQuestions: [],
      ocrText: ''
    })
    this.choosePhoto()
  },

  /**
   * 返回入口
   */
  backToEntry() {
    this.setData({
      mode: 'entry',
      photoImage: null,
      photoQuestions: [],
      ocrText: '',
      diagnosisResult: null,
      knowledgeNodes: [],
      current: 0,
      selectedAnswer: null,
      progress: 0,
      answers: []
    })
  },

  /**
   * 返回
   */
  goBack() {
    if (this.data.mode !== 'entry') {
      this.backToEntry()
    } else {
      wx.navigateBack()
    }
  }
})
