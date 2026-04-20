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
    // 拍照诊断 V2 数据
    ocrConfidence: 0,          // OCR整体置信度
    needsReview: false,         // 是否需要整卷复核
    reviewWarnings: [],         // 复核警告信息
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
      // 使用 V6 API 调用（阿里云EduTutor CutQuestions）
      const result = await this.submitPhotoV6(filePath)

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

      // 保存 V2 返回的复核数据
      this.setData({
        ocrConfidence: result.judgment?.ocrConfidence || 0,
        needsReview: result.summary?.needsReview || false,
        reviewWarnings: result.judgment?.warnings || []
      })

      // 检查是否需要整卷复核
      if (result.summary?.needsReview) {
        this.showReviewModal(result)
      } else {
        // 显示识别结果预览
        this.showPhotoResultPreview(result)
      }

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
              if (data.success) {
                // 服务器返回的数据格式: { success: true, ocrText, questions, summary }
                resolve(data)
              } else {
                reject(new Error(data.error || '分析失败'))
              }
            } catch (e) {
              console.error('解析响应失败:', e)
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
   * 提交照片进行诊断 V6（阿里云EduTutor CutQuestions）
   */
  submitPhotoV6(filePath) {
    const baseUrl = getBaseUrl()
    const url = `${baseUrl}/api/diagnosis/photo-aliyun`  // 使用阿里云EduTutor API

    console.log('拍照诊断V6（阿里云EduTutor）上传URL:', url)
    console.log('文件路径:', filePath)

    return new Promise((resolve, reject) => {
      // V6 API同步返回结果
      wx.getFileSystemManager().readFile({
        filePath,
        encoding: 'base64',
        success: (res) => {
          const base64Image = `data:image/jpeg;base64,${res.data}`

          wx.request({
            url,
            method: 'POST',
            data: {
              image: base64Image,
              subject: '数学',
              grade: '初三'
            },
            header: {
              'content-type': 'application/json'
            },
            timeout: 60000, // 60秒超时
            success: (response) => {
              console.log('V6 API响应:', response)

              if (response.statusCode === 200 && response.data.status === 'success') {
                resolve(response.data)
              } else {
                reject(new Error(response.data.error || 'V6识别失败'))
              }
            },
            fail: (err) => {
              console.error('V6 API调用失败:', err)
              reject(err)
            }
          })
        },
        fail: (err) => {
          console.error('读取文件失败:', err)
          reject(err)
        }
      })
    })
  },

  /**
   * 提交照片进行诊断 V5（GLM-OCR专业OCR）
   */
  submitPhotoV5(filePath) {
    const baseUrl = getBaseUrl()
    const url = `${baseUrl}/api/diagnosis/photo-latex`  // 使用GLM-OCR V5 API

    console.log('拍照诊断V5（GLM-OCR）上传URL:', url)
    console.log('文件路径:', filePath)

    return new Promise((resolve, reject) => {
      // V5 API同步返回结果，使用wx.request上传base64
      wx.getFileSystemManager().readFile({
        filePath,
        encoding: 'base64',
        success: (res) => {
          const base64Image = `data:image/jpeg;base64,${res.data}`

          wx.request({
            url,
            method: 'POST',
            data: {
              image: base64Image,
              subject: '数学',
              grade: '初三'
            },
            header: {
              'content-type': 'application/json'
            },
            timeout: 60000, // 60秒超时
            success: (response) => {
              console.log('V5 API响应:', response)
              if (response.statusCode === 200) {
                resolve(response.data)
              } else {
                reject(new Error(`API错误: ${response.statusCode}`))
              }
            },
            fail: (err) => {
              console.error('V5 API调用失败:', err)
              reject(err)
            }
          })
        },
        fail: (err) => {
          console.error('读取文件失败:', err)
          reject(err)
        }
      })
    })
  },

  /**
   * 轮询任务状态
   */
  pollTaskStatus(taskId, resolve, reject) {
    const baseUrl = getBaseUrl()
    const statusUrl = `${baseUrl}/api/diagnosis/photo-v2?taskId=${taskId}`
    const maxAttempts = 300 // 最多轮询 5 分钟（每秒一次）
    let attempts = 0

    const poll = () => {
      attempts++

      wx.request({
        url: statusUrl,
        method: 'GET',
        success: (res) => {
          if (res.statusCode === 200 && res.data) {
            const progress = res.data
            console.log('任务进度:', progress)

            // 更新进度提示
            if (progress.stepMessage) {
              wx.showLoading({
                title: progress.stepMessage,
                mask: true
              })
            }

            if (progress.status === 'completed' && progress.result) {
              wx.hideLoading()
              resolve(progress.result)
            } else if (progress.status === 'failed') {
              wx.hideLoading()
              reject(new Error(progress.error || '处理失败'))
            } else if (attempts < maxAttempts) {
              // 继续轮询
              setTimeout(poll, 1000)
            } else {
              wx.hideLoading()
              reject(new Error('处理超时，请重试'))
            }
          } else {
            // 请求失败，继续轮询
            if (attempts < maxAttempts) {
              setTimeout(poll, 1000)
            } else {
              wx.hideLoading()
              reject(new Error('处理超时，请重试'))
            }
          }
        },
        fail: (err) => {
          console.error('轮询状态失败:', err)
          // 继续尝试
          if (attempts < maxAttempts) {
            setTimeout(poll, 1000)
          } else {
            wx.hideLoading()
            reject(new Error('处理超时，请重试'))
          }
        }
      })
    }

    // 开始轮询
    poll()
  },

  /**
   * 显示复核提示对话框
   */
  showReviewModal(result) {
    const confidence = result.judgment?.ocrConfidence || 0
    const warnings = result.judgment?.warnings || []
    const needsManualConfirm = result.summary?.needsManualConfirm || false

    let message = `AI识别置信度: ${Math.round(confidence * 100)}%\n\n`

    if (warnings.length > 0) {
      message += '可能的问题:\n'
      warnings.forEach((w, i) => {
        message += `${i + 1}. ${w}\n`
      })
    }

    if (needsManualConfirm) {
      message += '\n建议逐题确认后再生成诊断。'
    }

    wx.showModal({
      title: '需要复核',
      content: message,
      confirmText: '查看详情',
      cancelText: '重新拍照',
      success: (res) => {
        if (res.confirm) {
          // 显示识别结果预览
          this.showPhotoResultPreview(result)
        } else {
          this.choosePhoto()
        }
      }
    })
  },

  /**
   * 清理OCR返回的文本格式
   * 移除HTML标签、Markdown标记等，将LaTeX公式转换为HTML或图片
   */
  cleanOcrText(text) {
    if (!text) return ''

    // 处理对象类型的选项（新数据结构）
    if (typeof text === 'object' && text.text) {
      return {
        ...text,
        text: this.cleanOcrTextString(text.text)
      }
    }

    // 处理字符串类型
    return this.cleanOcrTextString(text)
  },

  /**
   * 清理OCR返回的文本格式（内部方法，只处理字符串）
   */
  cleanOcrTextString(text) {
    if (!text) return ''

    let result = text

    // 移除不需要的HTML标签（保留下标上标标签）
    result = result.replace(/<(?!\/?sub|\/?sup)[^>]+>/g, '')

    // 移除Markdown标题
    result = result.replace(/^#{1,6}\s*/gm, '')

    // 移除图片标记
    result = result.replace(/!\[.*?\]\([^)]*\)/g, '')

    // 处理LaTeX公式（放在最后，避免被前面的替换影响）
    result = this.convertLatexFormulas(result)

    // 清理多余的空格
    result = result.replace(/\s+/g, ' ').trim()

    return result
  },

  /**
   * 转换LaTeX公式
   * 复杂公式转换为图片，简单公式转换为HTML
   * 支持格式: \(...\), \[...\], $...$
   */
  convertLatexFormulas(text) {
    // 首先处理 \(...\) 格式（行内公式）
    text = text.replace(/\\\(([^)]+?)\\\)/g, (match, formula) => {
      return this.processLatexFormula(formula)
    })

    // 然后处理 \[...\] 格式（行间公式）
    text = text.replace(/\\\[([^\]]+?)\\\]/g, (match, formula) => {
      return this.processLatexFormula(formula)
    })

    // 最后处理 $...$ 格式（非贪婪匹配，避免跨多个公式）
    text = text.replace(/\$([^$]+?)\$/g, (match, formula) => {
      return this.processLatexFormula(formula)
    })

    return text
  },

  /**
   * 处理单个LaTeX公式
   */
  processLatexFormula(formula) {
    let trimmed = formula.trim()

    // 移除可能存在的转义反斜杠（只处理特定字符）
    trimmed = trimmed.replace(/\\([{}$])/g, '$1')

    // 简化判断：只要包含反斜杠命令或下标上标，就用图片渲染
    // 这样可以确保所有LaTeX公式都被正确渲染
    const hasLatexCommand = /\\[a-zA-Z]/.test(trimmed)
    const hasSubscript = /[_\^]/.test(trimmed)

    const isComplex = hasLatexCommand || hasSubscript

    if (isComplex) {
      // 复杂公式转为图片URL（使用CodeCogs API）
      const encodedFormula = encodeURIComponent(trimmed)
      const imgTag = `<img src="https://latex.codecogs.com/png.latex?${encodedFormula}" style="display:inline;vertical-align:middle;max-height:1.8em;" />`
      console.log('LaTeX公式转换:', formula.substring(0, 50), '->', 'img')
      return imgTag
    } else {
      // 极简单的纯文本（不带任何格式）
      console.log('纯文本公式:', formula)
      return formula
    }
  },

  /**
   * 显示拍照识别结果预览
   */
  showPhotoResultPreview(data) {
    // 清理题目内容和选项的格式
    const cleanedQuestions = (data.questions || []).map(q => ({
      ...q,
      content: this.cleanOcrText(q.content),
      options: q.options ? q.options.map(opt => this.cleanOcrText(opt)) : [],
      // 添加图片坐标信息
      images: q.images || [],
      // V2 字段：置信度和复核标记
      confidence: q.confidence || 0,
      needsReview: q.needsReview || false,
      warnings: q.warnings || []
    }))

    // 处理原始图片和图片坐标
    let originalImageUrl = ''
    let imageCoordinates = data.imageCoordinates || []

    if (data.originalImage) {
      // 移除data:image前缀，保留base64数据
      const base64Data = data.originalImage.includes(',')
        ? data.originalImage.split(',')[1]
        : data.originalImage

      // 小程序临时路径（用于显示）
      originalImageUrl = `data:image/jpeg;base64,${base64Data}`

      // 保存base64数据用于canvas裁剪
      this.setData({
        originalImageBase64: base64Data
      })
    }

    this.setData({
      photoQuestions: cleanedQuestions,
      ocrText: this.cleanOcrText(data.ocrText || ''),
      originalImageUrl: originalImageUrl,
      imageCoordinates: imageCoordinates,  // 保存图片坐标
      mode: 'photo_result'
    })

    console.log('图片坐标信息:', {
      total: imageCoordinates.length,
      coordinates: imageCoordinates,
      questionsWithImages: cleanedQuestions.filter(q => q.images && q.images.length > 0).length
    })

    // 裁剪并显示题目图片（延迟更长时间确保canvas渲染完成）
    setTimeout(() => {
      console.log('=== 开始执行图片裁剪 ===')
      this.cropAndShowImages()
    }, 1000)
  },

  /**
   * 预览原始图片大图
   */
  previewOriginalImage() {
    const imageUrl = this.data.originalImageUrl
    if (!imageUrl) {
      wx.showToast({
        title: '图片不可用',
        icon: 'none'
      })
      return
    }

    wx.previewImage({
      urls: [imageUrl],
      current: imageUrl
    })
  },

  /**
   * 裁剪并显示题目图片
   */
  cropAndShowImages() {
    console.log('=== cropAndShowImages 开始 ===')
    const questions = this.data.photoQuestions || []
    const originalImageBase64 = this.data.originalImageBase64
    const imageCoordinates = this.data.imageCoordinates || []

    console.log('裁剪数据检查:', {
      questionsCount: questions.length,
      hasOriginalImage: !!originalImageBase64,
      originalImageLength: originalImageBase64 ? originalImageBase64.length : 0,
      imageCoordinatesCount: imageCoordinates.length
    })

    if (!originalImageBase64) {
      console.error('❌ 没有原始图片base64数据')
      wx.showToast({
        title: '没有原始图片数据',
        icon: 'none'
      })
      return
    }

    if (imageCoordinates.length === 0) {
      console.warn('⚠️ 没有图片坐标信息')
    }

    let totalImages = 0
    let processedImages = 0

    // 为每个题目创建裁剪后的图片
    questions.forEach((question, qIndex) => {
      // 处理题目图片
      if (!question.images || question.images.length === 0) {
        console.log(`题目${question.id}: 没有关联图片`)
      } else {
        console.log(`题目${question.id}: 有${question.images.length}张图片`)

        question.images.forEach((img, imgIndex) => {
          totalImages++
          const canvasId = `question-canvas-${question.id}-${imgIndex}`
          const bbox = img.bbox  // [x1, y1, x2, y2]

          console.log(`准备裁剪: 题目${question.id} 图片${imgIndex}`, {
            bbox,
            canvasId,
            label: img.label
          })

          processedImages++
          this.cropImageByBbox(originalImageBase64, bbox, canvasId, img.label)
        })
      }

      // 处理选项图片
      if (question.options && question.options.length > 0) {
        question.options.forEach((option, optIndex) => {
          // 兼容新旧数据格式：option 可能是字符串或对象
          const optionText = typeof option === 'string' ? option : option.text
          const optionImages = typeof option === 'string' ? null : option.images

          if (optionImages && optionImages.length > 0) {
            console.log(`题目${question.id} 选项${optIndex}: 有${optionImages.length}张图片`)

            optionImages.forEach((img, imgIndex) => {
              totalImages++
              const canvasId = `option-canvas-${question.id}-${optIndex}-${imgIndex}`
              const bbox = img.bbox

              console.log(`准备裁剪: 题目${question.id} 选项${optIndex} 图片${imgIndex}`, {
                bbox,
                canvasId,
                label: img.label
              })

              processedImages++
              this.cropImageByBbox(originalImageBase64, bbox, canvasId, img.label)
            })
          }
        })
      }
    })

    console.log(`=== 裁剪任务完成: 共${totalImages}张图片，已处理${processedImages}张 ===`)

    if (totalImages === 0) {
      wx.showToast({
        title: '没有找到需要裁剪的图片',
        icon: 'none'
      })
    }
  },

  /**
   * 根据bbox裁剪图片
   * @param {string} base64Data - 原始图片的base64数据
   * @param {Array<number>} bbox - 边界框坐标 [x1, y1, x2, y2]
   * @param {string} canvasId - Canvas组件的ID
   * @param {string} label - 图片标签（用于日志）
   */
  cropImageByBbox(base64Data, bbox, canvasId, label) {
    console.log('=== 开始裁剪图片 ===', { canvasId, bbox, label })

    const [x1, y1, x2, y2] = bbox
    const cropWidth = x2 - x1
    const cropHeight = y2 - y1

    // Canvas固定尺寸（与WXML中的定义一致，600rpx ≈ 300px）
    const canvasSize = 300

    console.log('裁剪参数:', {
      bbox: `${x1},${y1} → ${x2},${y2}`,
      裁剪尺寸: `${cropWidth}x${cropHeight}`
    })

    // 将base64数据写入临时文件
    const fs = wx.getFileSystemManager()
    const timestamp = Date.now()
    const tempImagePath = `${wx.env.USER_DATA_PATH}/temp_img_${timestamp}.jpg`

    try {
      // 移除base64前缀（如果有）
      const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '')

      console.log('写入临时文件:', tempImagePath)
      fs.writeFileSync(tempImagePath, base64Clean, 'base64')

      console.log('临时图片已创建，开始绘制...')

      // 创建canvas上下文
      const ctx = wx.createCanvasContext(canvasId, this)

      // 清空canvas
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, canvasSize, canvasSize)

      // 计算目标尺寸（保持宽高比，适应Canvas）
      let drawWidth = cropWidth
      let drawHeight = cropHeight
      const maxSize = canvasSize - 20

      // 如果裁剪区域太大，缩小；如果太小，放大
      if (drawWidth > maxSize || drawHeight > maxSize) {
        const scale = Math.min(maxSize / drawWidth, maxSize / drawHeight)
        drawWidth = Math.round(drawWidth * scale)
        drawHeight = Math.round(drawHeight * scale)
      } else if (drawWidth < maxSize * 0.5 && drawHeight < maxSize * 0.5) {
        // 如果图片太小，放大到Canvas的一半以上
        const scale = Math.min((maxSize * 0.8) / drawWidth, (maxSize * 0.8) / drawHeight)
        drawWidth = Math.round(drawWidth * scale)
        drawHeight = Math.round(drawHeight * scale)
      }

      // 计算居中位置
      const offsetX = Math.round((canvasSize - drawWidth) / 2)
      const offsetY = Math.round((canvasSize - drawHeight) / 2)

      console.log('绘制参数:', {
        原始裁剪区: `${cropWidth}x${cropHeight}`,
        目标尺寸: `${drawWidth}x${drawHeight}`,
        缩放比例: (drawWidth / cropWidth).toFixed(3),
        居中偏移: `(${offsetX}, ${offsetY})`
      })

      // 直接从原图裁剪并绘制
      ctx.drawImage(
        tempImagePath,
        x1, y1,  // 从原图的这个位置裁剪
        cropWidth, cropHeight,  // 裁剪这个尺寸
        offsetX, offsetY,  // 在Canvas的这个位置绘制
        drawWidth, drawHeight  // 绘制成这个尺寸
      )

      console.log('drawImage调用完成，执行ctx.draw()...')

      ctx.draw(false, () => {
        console.log(`✅ 图片裁剪完成: ${canvasId}, 显示尺寸: ${drawWidth}x${drawHeight}`)

        // 清理临时文件
        setTimeout(() => {
          try {
            fs.unlinkSync(tempImagePath)
          } catch (e) {
            console.warn('清理临时文件失败:', e)
          }
        }, 5000)
      })
    } catch (err) {
      console.error('❌ 图片裁剪失败:', err)
      wx.showToast({
        title: '图片裁剪失败: ' + err.message,
        icon: 'none',
        duration: 2000
      })
    }
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
