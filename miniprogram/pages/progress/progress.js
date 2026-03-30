// pages/progress/progress.js
const app = getApp()

Page({
  data: {
    // 统计数据
    stats: {
      totalCourses: 0,
      totalScenes: 0,
      studyMinutes: 0,
      weeklyCount: 0
    },

    // 本周数据
    weeklyData: [
      { day: '周一', count: 2, percentage: 40 },
      { day: '周二', count: 3, percentage: 60 },
      { day: '周三', count: 1, percentage: 20 },
      { day: '周四', count: 4, percentage: 80 },
      { day: '周五', count: 2, percentage: 40 },
      { day: '周六', count: 5, percentage: 100 },
      { day: '周日', count: 0, percentage: 0 }
    ],

    // 学习历史
    learningHistory: [],

    // 错题
    wrongQuestions: [],

    // 知识点数据
    knowledgeData: {
      totalPoints: 0,
      masteredPoints: 0,
      categories: [
        { name: '数学', count: 8, mastered: 5, color: '#6366F1' },
        { name: '语文', count: 5, mastered: 3, color: '#EC4899' },
        { name: '英语', count: 4, mastered: 2, color: '#10B981' },
        { name: '科学', count: 3, mastered: 1, color: '#F59E0B' }
      ],
      hotPoints: [
        { name: '分数', mastered: true, studyCount: 5 },
        { name: '几何', mastered: false, studyCount: 3 },
        { name: '代数', mastered: true, studyCount: 4 },
        { name: '阅读理解', mastered: false, studyCount: 2 },
        { name: '写作', mastered: true, studyCount: 6 },
        { name: '听力', mastered: false, studyCount: 2 }
      ]
    },

    // 知识图谱展示模式
    knowledgeViewMode: 'grid', // 'grid' 或 'graph'

    // 成就
    achievements: [
      {
        id: 1,
        icon: '🎯',
        title: '初学者',
        description: '完成第一道题',
        unlocked: true
      },
      {
        id: 2,
        icon: '📚',
        title: '勤奋学生',
        description: '学习7天',
        unlocked: false
      },
      {
        id: 3,
        icon: '⭐',
        title: '学霸',
        description: '完成10道题',
        unlocked: false
      },
      {
        id: 4,
        icon: '🏆',
        title: '知识大师',
        description: '掌握50个知识点',
        unlocked: false
      },
      {
        id: 5,
        icon: '🔥',
        title: '连续学习',
        description: '连续30天',
        unlocked: false
      },
      {
        id: 6,
        icon: '💯',
        title: '完美主义',
        description: '正确率100%',
        unlocked: false
      }
    ]
  },

  onLoad(options) {
    console.log('进度页面加载', options)
    this.loadProgressData()
  },

  onShow() {
    // 每次显示时刷新数据
    this.loadProgressData()
  },

  /**
   * 加载进度数据
   */
  async loadProgressData() {
    wx.showLoading({
      title: '加载中...',
      mask: true
    })

    try {
      // TODO: 从API加载数据
      // const baseUrl = app.globalData.baseUrl || 'http://localhost:3000'
      // const token = wx.getStorageSync('token')

      // 加载学习统计
      // const statsRes = await wx.request({
      //   url: `${baseUrl}/api/miniprogram/progress/stats`,
      //   header: { 'Authorization': `Bearer ${token}` }
      // })

      // 加载学习历史
      // const historyRes = await wx.request({
      //   url: `${baseUrl}/api/miniprogram/learning-records`,
      //   header: { 'Authorization': `Bearer ${token}` }
      // })

      // 加载错题
      // const wrongRes = await wx.request({
      //   url: `${baseUrl}/api/miniprogram/wrong-questions`,
      //   header: { 'Authorization': `Bearer ${token}` }
      // })

      // 临时模拟数据
      setTimeout(() => {
        this.setData({
          stats: {
            totalCourses: 5,
            totalScenes: 12,
            studyMinutes: 45,
            weeklyCount: 17
          },
          knowledgeData: {
            totalPoints: 20,
            masteredPoints: 11,
            categories: [
              { name: '数学', count: 8, mastered: 5, color: '#6366F1' },
              { name: '语文', count: 5, mastered: 3, color: '#EC4899' },
              { name: '英语', count: 4, mastered: 2, color: '#10B981' },
              { name: '科学', count: 3, mastered: 1, color: '#F59E0B' }
            ],
            hotPoints: [
              { name: '分数', mastered: true, studyCount: 5 },
              { name: '几何', mastered: false, studyCount: 3 },
              { name: '代数', mastered: true, studyCount: 4 },
              { name: '阅读理解', mastered: false, studyCount: 2 },
              { name: '写作', mastered: true, studyCount: 6 },
              { name: '听力', mastered: false, studyCount: 2 }
            ]
          },
          learningHistory: [
            {
              id: '1',
              shareToken: 'bFEo1sP83BfDFw_Q',
              title: '测试课程：分数的认识',
              description: '学习分数的基本概念和加减运算',
              subject: '数学',
              grade: '三年级',
              progress: 100,
              completed: true,
              duration: '10分钟',
              lastStudyTime: '今天',
              poster: '',
              knowledgePoints: ['分数', '加法', '数学']
            },
            {
              id: '2',
              shareToken: 'LN8AAtymomhkFFJR',
              title: '未命名课程',
              description: '课程描述',
              subject: '数学',
              grade: '四年级',
              progress: 60,
              completed: false,
              duration: '8分钟',
              lastStudyTime: '昨天',
              poster: '',
              knowledgePoints: ['几何']
            }
          ],
          wrongQuestions: [
            {
              id: 'w1',
              title: '1/2 + 1/3 = ?',
              subject: '数学',
              wrongCount: 3
            },
            {
              id: 'w2',
              title: '计算 2/3 + 1/3',
              subject: '数学',
              wrongCount: 1
            }
          ],
          achievements: [
            {
              id: 1,
              icon: '🎯',
              title: '初学者',
              description: '完成第一道题',
              unlocked: true
            },
            {
              id: 2,
              icon: '📚',
              title: '勤奋学生',
              description: '学习7天',
              unlocked: true
            },
            {
              id: 3,
              icon: '⭐',
              title: '学霸',
              description: '完成10道题',
              unlocked: false
            },
            {
              id: 4,
              icon: '🏆',
              title: '知识大师',
              description: '掌握50个知识点',
              unlocked: false
            },
            {
              id: 5,
              icon: '🔥',
              title: '连续学习',
              description: '连续30天',
              unlocked: false
            },
            {
              id: 6,
              icon: '💯',
              title: '完美主义',
              description: '正确率100%',
              unlocked: false
            }
          ]
        })

        wx.hideLoading()
      }, 1000)
    } catch (error) {
      console.error('加载数据失败:', error)
      wx.hideLoading()
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  /**
   * 课程详情
   */
  onCourseDetail(e) {
    const { token } = e.currentTarget.dataset

    wx.navigateTo({
      url: `/pages/player/player?shareToken=${token}`
    })
  },

  /**
   * 筛选
   */
  onFilter() {
    const items = ['全部', '数学', '语文', '英语', '未完成', '已完成']

    wx.showActionSheet({
      itemList: items,
      success: (res) => {
        const selected = items[res.tapIndex]
        wx.showToast({
          title: `筛选：${selected}`,
          icon: 'none'
        })
        // TODO: 实际筛选逻辑
      }
    })
  },

  /**
   * 查看全部错题
   */
  onViewWrongQuestions() {
    wx.showToast({
      title: '跳转到错题本',
      icon: 'none'
    })
    // TODO: 跳转到错题本页面
  },

  /**
   * 错题详情
   */
  onWrongQuestionDetail(e) {
    const { id } = e.currentTarget.dataset
    wx.showToast({
      title: '查看错题详情',
      icon: 'none'
    })
    // TODO: 跳转到错题详情
  },

  /**
   * 返回首页
   */
  onGoHome() {
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadProgressData()
    setTimeout(() => {
      wx.stopPullDownRefresh()
    }, 1000)
  },

  /**
   * 切换知识点视图
   */
  onToggleKnowledgeView() {
    const newMode = this.data.knowledgeViewMode === 'grid' ? 'graph' : 'grid'
    this.setData({
      knowledgeViewMode: newMode
    })
    wx.showToast({
      title: newMode === 'grid' ? '网格视图' : '图谱视图',
      icon: 'none'
    })
    // TODO: 实现图谱视图
    if (newMode === 'graph') {
      wx.showToast({
        title: '图谱视图开发中',
        icon: 'none'
      })
    }
  }
})
