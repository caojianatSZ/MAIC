// 组卷页面
const app = getApp()
const { getBaseUrl, getUserId } = require('../../utils/user')

// 学科映射
const SUBJECTS = [
  { id: 1, name: '数学' },
  { id: 2, name: '语文' },
  { id: 3, name: '英语' },
  { id: 4, name: '物理' },
  { id: 5, name: '化学' },
  { id: 6, name: '生物' }
]

// 年级映射
const GRADES = [
  { id: 7, name: '初一' },
  { id: 8, name: '初二' },
  { id: 9, name: '初三' },
  { id: 10, name: '高一' },
  { id: 11, name: '高二' },
  { id: 12, name: '高三' }
]

// 题型映射
const QUESTION_TYPES = [
  { id: 1, name: '单选题' },
  { id: 2, name: '多选题' },
  { id: 3, name: '填空题' },
  { id: 4, name: '解答题' }
]

Page({
  data: {
    // 试卷信息
    paperTitle: '',
    paperId: null,

    // 来源选择
    source: 'xkw', // xkw | local

    // 筛选条件
    subjects: SUBJECTS,
    grades: GRADES,
    questionTypes: QUESTION_TYPES,
    subjectIndex: 0,
    gradeIndex: 6, // 默认高一
    typeIndex: -1,

    // 题目列表
    questions: [],
    loading: false,
    hasMore: true,
    page: 1,

    // 已选题目
    selectedQuestions: [],
    selectedCount: 0,

    // 本地题目
    localQuestions: []
  },

  onLoad(options) {
    // 如果有试卷ID，则是编辑模式
    if (options.id) {
      this.setData({ paperId: options.id })
      this.loadPaper(options.id)
    }
  },

  // 加载试卷详情（编辑模式）
  async loadPaper(paperId) {
    wx.showLoading({ title: '加载中...' })

    try {
      const res = await wx.request({
        url: getBaseUrl() + '/api/papers/' + paperId,
        method: 'GET'
      })

      if (res.data.code === 0) {
        const paper = res.data.data
        this.setData({
          paperTitle: paper.title,
          selectedQuestions: paper.questions.map(q => ({
            ...q.question,
            paperQuestionId: q.id,
            points: q.points
          })),
          selectedCount: paper.questions.length
        })
      }
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  // 输入试卷标题
  onTitleInput(e) {
    this.setData({ paperTitle: e.detail.value })
  },

  // 切换来源
  switchSource(e) {
    const source = e.currentTarget.dataset.source
    this.setData({
      source,
      questions: [],
      page: 1
    })

    if (source === 'local') {
      this.loadLocalQuestions()
    }
  },

  // 切换学科
  onSubjectChange(e) {
    this.setData({ subjectIndex: e.detail.value })
  },

  // 切换年级
  onGradeChange(e) {
    this.setData({ gradeIndex: e.detail.value })
  },

  // 切换题型
  onTypeChange(e) {
    this.setData({ typeIndex: e.detail.value })
  },

  // 加载学科网题目
  async loadQuestions() {
    if (this.data.loading) return

    this.setData({ loading: true })

    const { subjectIndex, gradeIndex, typeIndex, page } = this.data
    const subject = SUBJECTS[subjectIndex]
    const grade = GRADES[gradeIndex]

    const params = {
      course_id: subject.id,
      grade_id: grade.id,
      count: 20
    }

    if (typeIndex >= 0) {
      params.question_type_ids = [QUESTION_TYPES[typeIndex].id]
    }

    try {
      wx.showLoading({ title: '加载中...' })

      const res = await wx.request({
        url: getBaseUrl() + '/api/xkw/browse/push',
        method: 'POST',
        data: params
      })

      wx.hideLoading()

      if (res.data.code === 0) {
        const newQuestions = res.data.data.questions || []

        // 检查是否已选择
        const questionsWithStatus = newQuestions.map(q => ({
          ...q,
          selected: this.data.selectedQuestions.some(sq => sq.sourceId === q.id || sq.localId === q.id)
        }))

        this.setData({
          questions: page === 1 ? questionsWithStatus : [...this.data.questions, ...questionsWithStatus],
          hasMore: newQuestions.length >= 20,
          loading: false
        })
      } else {
        wx.showToast({ title: res.data.message, icon: 'none' })
        this.setData({ loading: false })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  // 加载本地题目
  async loadLocalQuestions() {
    wx.showLoading({ title: '加载中...' })

    try {
      const { subjectIndex } = this.data
      const subject = SUBJECTS[subjectIndex]

      const res = await wx.request({
        url: getBaseUrl() + '/api/questions',
        method: 'GET',
        data: {
          subject: subject.name,
          page: 1,
          limit: 50
        }
      })

      wx.hideLoading()

      if (res.data.code === 0) {
        this.setData({
          localQuestions: res.data.data.questions || []
        })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // 选择题目
  async selectQuestion(e) {
    const question = e.currentTarget.dataset.question

    // 已选择的直接跳过
    if (this.data.selectedQuestions.some(sq => sq.id === question.id || sq.sourceId === question.id)) {
      wx.showToast({ title: '已添加', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })

    try {
      // 先创建或获取试卷ID
      let paperId = this.data.paperId

      if (!paperId) {
        const createRes = await wx.request({
          url: getBaseUrl() + '/api/papers',
          method: 'POST',
          data: {
            title: this.data.paperTitle || '未命名试卷',
            userId: getUserId()
          }
        })

        if (createRes.data.code === 0) {
          paperId = createRes.data.data.id
          this.setData({ paperId })
        } else {
          throw new Error(createRes.data.message)
        }
      }

      // 选择并保存题目
      const selectRes = await wx.request({
        url: getBaseUrl() + '/api/questions/select',
        method: 'POST',
        data: {
          xkwQuestionId: question.id,
          paperId
        }
      })

      wx.hideLoading()

      if (selectRes.data.code === 0) {
        const isNew = selectRes.data.isNew

        if (isNew) {
          wx.showToast({ title: '已保存到题库', icon: 'success' })
        }

        // 更新已选列表
        const selectedQuestions = [...this.data.selectedQuestions, {
          ...question,
          paperQuestionId: selectRes.data.questionId,
          selected: true
        }]

        this.setData({
          selectedQuestions,
          selectedCount: selectedQuestions.length
        })

        // 更新题目列表中的选中状态
        const questions = this.data.questions.map(q =>
          q.id === question.id ? { ...q, selected: true } : q
        )
        this.setData({ questions })
      } else {
        wx.showToast({ title: selectRes.data.message, icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  // 移除已选题目
  removeQuestion(e) {
    const index = e.currentTarget.dataset.index
    const question = this.data.selectedQuestions[index]

    const selectedQuestions = this.data.selectedQuestions.filter((_, i) => i !== index)

    this.setData({
      selectedQuestions,
      selectedCount: selectedQuestions.length
    })

    // 更新题目列表中的选中状态
    const questions = this.data.questions.map(q =>
      q.id === question.id ? { ...q, selected: false } : q
    )
    this.setData({ questions })
  },

  // 保存试卷
  async savePaper() {
    if (!this.data.paperTitle.trim()) {
      wx.showToast({ title: '请输入试卷标题', icon: 'none' })
      return
    }

    if (this.data.selectedCount === 0) {
      wx.showToast({ title: '请选择题目', icon: 'none' })
      return
    }

    wx.showLoading({ title: '保存中...' })

    try {
      const url = this.data.paperId
        ? getBaseUrl() + '/api/papers/' + this.data.paperId
        : getBaseUrl() + '/api/papers'

      const method = this.data.paperId ? 'PUT' : 'POST'

      const res = await wx.request({
        url,
        method,
        data: {
          title: this.data.paperTitle,
          userId: getUserId()
        }
      })

      wx.hideLoading()

      if (res.data.code === 0) {
        wx.showToast({ title: '保存成功', icon: 'success' })

        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        wx.showToast({ title: res.data.message, icon: 'none' })
      }
    } catch (e) {
      wx.hideLoading()
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({ page: 1, questions: [] })
    this.loadQuestions()
    wx.stopPullDownRefresh()
  },

  // 上拉加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading && this.data.source === 'xkw') {
      this.setData({ page: this.data.page + 1 })
      this.loadQuestions()
    }
  }
})
