// pages/diagnosis/diagnosis.js
const { getUserId } = require('../../utils/user')
const { getBaseUrl } = require('../../utils/config')
const { EVENT_TYPES, DEFAULTS, PAGE_MODES } = require('../../constants/eventTypes')

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
    // 解锁的成就
    unlockedAchievements: [],
    // 学习建议
    suggestionText: '',
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
    const baseUrl = getBaseUrl()
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
    const baseUrl = getBaseUrl()

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
            mode: 'result',
            current: this.data.questions.length
          })

          wx.showToast({
            title: '分析完成',
            icon: 'success',
            duration: DEFAULTS.TOAST_DURATION
          })

          // 触发成就检查
          this.checkAchievements(result)
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
  /**
   * 开始学习
   */
  startLearning() {
    // TODO: 添加学习行为埋点
    this.showLearningPath()
  },

  /**
   * 显示学习路径
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
      // 直接使用文件上传方式调用API
      const result = await this.uploadPhotoForDiagnosis(filePath)

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

      // 显示识别结果预览
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
   * 文件转Base64 (备用方法)
   */
  fileToBase64(filePath) {
    return new Promise((resolve, reject) => {
      console.log('开始读取文件:', filePath)

      // 先检查文件是否存在
      wx.getFileSystemManager().access({
        path: filePath,
        success: () => {
          console.log('文件存在，开始读取')
          // 文件存在，读取内容
          wx.getFileSystemManager().readFile({
            filePath,
            encoding: 'base64',
            success: (res) => {
              console.log('文件读取成功，base64长度:', res.data?.length)
              resolve('data:image/jpeg;base64,' + res.data)
            },
            fail: (err) => {
              console.error('readFile失败:', err)
              reject(new Error('图片读取失败'))
            }
          })
        },
        fail: (err) => {
          console.error('文件不存在:', err)
          // 尝试使用图片缓存
          wx.getImageInfo({
            src: filePath,
            success: (imgInfo) => {
              console.log('获取图片信息成功:', imgInfo.path)
              // 使用获取到的路径再尝试读取
              wx.getFileSystemManager().readFile({
                filePath: imgInfo.path,
                encoding: 'base64',
                success: (res) => {
                  console.log('通过图片信息读取成功，base64长度:', res.data?.length)
                  resolve('data:image/jpeg;base64,' + res.data)
                },
                fail: (err2) => {
                  console.error('通过图片信息读取也失败:', err2)
                  reject(new Error('图片读取失败'))
                }
              })
            },
            fail: (err2) => {
              console.error('获取图片信息失败:', err2)
              reject(new Error('图片处理失败'))
            }
          })
        }
      })
    })
  },

  /**
   * 上传照片进行诊断（使用文件上传方式）
   */
  uploadPhotoForDiagnosis(filePath) {
    const baseUrl = getBaseUrl()
    const url = `${baseUrl}/api/diagnosis/photo`

    console.log('拍照诊断上传URL:', url)
    console.log('文件路径:', filePath)

    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url,
        filePath,
        name: 'file',
        formData: {
          subject: 'math',
          grade: '初三'
        },
        timeout: 120000, // 2分钟超时
        success: (res) => {
          console.log('拍照诊断上传响应:', res)
          console.log('响应状态码:', res.statusCode)
          console.log('响应数据:', res.data)

          if (res.statusCode === 200) {
            try {
              const data = JSON.parse(res.data)
              if (data.success && data.data) {
                resolve(data.data)
              } else {
                reject(new Error(data.error || '分析失败'))
              }
            } catch (e) {
              reject(new Error('解析响应失败'))
            }
          } else {
            reject(new Error(`服务器错误: ${res.statusCode}`))
          }
        },
        fail: (err) => {
          console.error('文件上传失败:', err)
          console.error('错误详情:', JSON.stringify(err))
          reject(new Error(`网络请求失败: ${err.errMsg || '未知错误'}`))
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
  },

  /**
   * 检查成就
   */
  checkAchievements(diagnosisResult) {
    const userId = getUserId()
    const knowledgePointId = diagnosisResult.knowledgePoints?.[0]?.knowledgePointId || null

    // 触发成就事件
    wx.request({
      url: `${getBaseUrl()}/api/achievements/check`,
      method: 'POST',
      data: {
        userId,
        event: {
          type: EVENT_TYPES.QUIZ_FINISHED,
          subject: diagnosisResult.subject || DEFAULTS.SUBJECT,
          knowledgePointId,
          data: {
            score: diagnosisResult.totalScore,
            correctCount: diagnosisResult.correctCount,
            totalCount: diagnosisResult.totalCount
          }
        }
      },
      success: (res) => {
        if (res.data.success && res.data.data) {
          const { unlockedCount, unlockedAchievements } = res.data.data

          // 保存解锁的成就到页面数据
          if (unlockedAchievements?.length > 0) {
            this.setData({ unlockedAchievements })
            this.showAchievementUnlock(unlockedAchievements[0])
          }

          // 生成学习建议
          this.generateSuggestion(diagnosisResult, unlockedCount)
        }
      },
      fail: (err) => {
        console.error('成就检查失败:', err)
        // 即使成就检查失败，也生成学习建议
        this.generateSuggestion(diagnosisResult, 0)
      }
    })
  },

  /**
   * 生成学习建议
   */
  generateSuggestion(diagnosisResult, unlockedCount) {
    const score = diagnosisResult.totalScore || 0
    const accuracy = diagnosisResult.totalCount > 0
      ? Math.round((diagnosisResult.correctCount / diagnosisResult.totalCount) * 100)
      : 0

    let suggestion = ''

    // 根据得分生成建议
    if (score >= 90) {
      suggestion = `太棒了！你掌握得很好！正确率达到 ${accuracy}%，${unlockedCount > 0 ? `还解锁了 ${unlockedCount} 个成就！` : ''}建议继续挑战更高难度的题目，巩固学习成果。`
    } else if (score >= 70) {
      suggestion = `不错！你的正确率是 ${accuracy}%，${unlockedCount > 0 ? `解锁了 ${unlockedCount} 个成就。` : ''}建议重点学习薄弱知识点，多做一些练习题来提高熟练度。`
    } else if (score >= 60) {
      suggestion = `还需要努力哦！你的正确率是 ${accuracy}%。建议从基础概念开始学习，循序渐进地提高。我们的学习路径会帮助你系统学习。`
    } else {
      suggestion = `别灰心！这个知识点确实有难度。建议从基础开始学起，观看微课视频，然后通过练习巩固。学习是一个过程，慢慢来！`
    }

    // 根据薄弱知识点添加建议
    if (diagnosisResult.knowledgePoints?.length > 0) {
      const weakPointNames = diagnosisResult.knowledgePoints
        .filter(kp => kp.masteryLevel === 'weak')
        .map(kp => kp.knowledgePointName)
        .join('、')

      if (weakPointNames) {
        suggestion += `\n\n薄弱知识点：${weakPointNames}`
      }
    }

    this.setData({
      suggestionText: suggestion
    })
  },

  /**
   * 显示成就解锁
   */
  showAchievementUnlock(achievement) {
    wx.showModal({
      title: '🏆 成就解锁！',
      content: `恭喜你获得「${achievement.name}」成就！\n\n${achievement.description || ''}`,
      showCancel: false,
      confirmText: '太棒了',
      success: () => {
        // 可以添加庆祝动画或音效
      }
    })
  }
})
