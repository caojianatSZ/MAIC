// pages/profile/profile.js
const app = getApp()
const { getUserId } = require('../../utils/user')
const { getBaseUrl } = require('../../utils/config')

Page({
  data: {
    userInfo: {},
    // 家长视角：孩子列表
    children: [],
    currentChild: {},
    childProfile: {},
    // 统计数据
    stats: {
      totalCount: 0,
      todayCount: 0,
      wrongCount: 0,
      weeklyCount: 0,
      studyMinutes: 0,
      streakDays: 0
    },
    // 成就数据
    achievements: [],
    // 知识数据
    knowledgeData: null,
    // 编辑弹窗
    showEditModal: false,
    showChildModal: false,
    period: 'week',
    // 表单数据
    formData: {
      name: '',
      grade: '',
      school: '',
      subjects: [],
      goal: ''
    },
    // 年级选项
    grades: ['小学一年级', '小学二年级', '小学三年级', '小学四年级', '小学五年级', '小学六年级',
            '初一', '初二', '初三', '高一', '高二', '高三'],
    gradeIndex: -1,
    // 学习目标选项
    goals: [
      { value: 'improve', label: '提升成绩' },
      { value: 'consolidate', label: '巩固基础' },
      { value: 'advance', label: '超前学习' },
      { value: 'exam', label: '应对考试' }
    ]
  },

  onLoad(options) {
    console.log('家长画像页面加载', options)
  },

  onShow() {
    console.log('家长画像页面显示')
    this.loadUserInfo()
    this.loadChildren()
    this.loadStats()
    this.loadAchievements()
    this.loadKnowledgeData()
  },

  /**
   * 加载家长用户信息
   */
  loadUserInfo() {
    const userInfo = app.globalData.userInfo || {}

    this.setData({
      userInfo: {
        nickName: userInfo.nickName || '家长',
        avatarUrl: userInfo.avatarUrl || ''
      }
    })
  },

  /**
   * 加载孩子列表
   */
  loadChildren() {
    const baseUrl = getBaseUrl()
    const userId = getUserId()

    wx.request({
      url: `${baseUrl}/api/parent/children`,
      method: 'GET',
      data: { parentId: userId },
      success: (res) => {
        if (res.data.success && res.data.data.children.length > 0) {
          const children = res.data.data.children
          this.setData({
            children,
            currentChild: children[0]
          })
          // 加载当前孩子的档案
          this.loadChildProfile(children[0].id)
          this.loadChildStats(children[0].id)
        } else {
          // 没有孩子，显示空状态
          this.setData({
            children: [],
            currentChild: { name: '添加孩子' }
          })
        }
      },
      fail: (err) => {
        console.error('加载孩子列表失败:', err)
        // 模拟数据用于开发测试
        this.setData({
          children: [
            { id: 'child_1', name: '小明', grade: '初三', avatar: '' }
          ],
          currentChild: { id: 'child_1', name: '小明', grade: '初三', avatar: '' }
        })
      }
    })
  },

  /**
   * 加载孩子学习档案
   */
  loadChildProfile(childId) {
    const baseUrl = getBaseUrl()
    const userId = getUserId()

    wx.request({
      url: `${baseUrl}/api/parent/child-profile`,
      method: 'GET',
      data: { parentId: userId, childId },
      success: (res) => {
        if (res.data.success) {
          this.setData({
            childProfile: res.data.data.profile || {}
          })
          // 初始化表单数据
          this.initFormData(res.data.data.profile || {})
        }
      },
      fail: (err) => {
        console.error('加载孩子档案失败:', err)
      }
    })
  },

  /**
   * 加载孩子统计数据
   */
  loadChildStats(childId) {
    const baseUrl = getBaseUrl()

    wx.request({
      url: `${baseUrl}/api/parent/child-stats`,
      method: 'GET',
      data: { childId },
      success: (res) => {
        if (res.data.success) {
          this.setData({
            stats: res.data.data.stats || {}
          })
        }
      },
      fail: (err) => {
        console.error('加载统计数据失败:', err)
      }
    })
  },

  /**
   * 加载统计数据
   */
  loadStats() {
    // 使用当前选中孩子的数据
    if (this.data.currentChild.id) {
      this.loadChildStats(this.data.currentChild.id)
    }
  },

  /**
   * 加载成就列表
   */
  loadAchievements() {
    const baseUrl = getBaseUrl()
    const childId = this.data.currentChild.id

    if (!childId) return

    wx.request({
      url: `${baseUrl}/api/achievements`,
      method: 'GET',
      data: { childId },
      success: (res) => {
        if (res.data.success) {
          this.setData({
            achievements: res.data.data.achievements || []
          })
        }
      },
      fail: (err) => {
        console.error('加载成就失败:', err)
      }
    })
  },

  /**
   * 加载知识数据
   */
  loadKnowledgeData() {
    const baseUrl = getBaseUrl()
    const childId = this.data.currentChild.id

    if (!childId) return

    wx.request({
      url: `${baseUrl}/api/parent/child-knowledge`,
      method: 'GET',
      data: { childId },
      success: (res) => {
        if (res.data.success) {
          this.setData({
            knowledgeData: res.data.data || {}
          })
        }
      },
      fail: (err) => {
        console.error('加载知识数据失败:', err)
      }
    })
  },

  /**
   * 初始化表单数据
   */
  initFormData(profile) {
    const gradeIndex = this.data.grades.indexOf(profile.grade || '')

    this.setData({
      formData: {
        name: profile.name || this.data.currentChild.name || '',
        grade: profile.grade || '',
        school: profile.school || '',
        subjects: profile.subjects || [],
        goal: profile.goal || ''
      },
      gradeIndex: gradeIndex >= 0 ? gradeIndex : -1
    })
  },

  /**
   * 点击编辑学习档案
   */
  onEditProfile() {
    // 重新加载最新档案数据
    this.initFormData(this.data.childProfile)
    this.setData({ showEditModal: true })
  },

  /**
   * 关闭编辑弹窗
   */
  onCloseEditModal() {
    this.setData({ showEditModal: false })
  },

  /**
   * 输入姓名
   */
  onNameInput(e) {
    this.setData({
      'formData.name': e.detail.value
    })
  },

  /**
   * 选择年级
   */
  onGradeChange(e) {
    const index = e.detail.value
    this.setData({
      gradeIndex: index,
      'formData.grade': this.data.grades[index]
    })
  },

  /**
   * 输入学校
   */
  onSchoolInput(e) {
    this.setData({
      'formData.school': e.detail.value
    })
  },

  /**
   * 切换科目选择
   */
  onToggleSubject(e) {
    const subject = e.currentTarget.dataset.subject
    const subjects = [...this.data.formData.subjects]
    const index = subjects.indexOf(subject)

    if (index > -1) {
      subjects.splice(index, 1)
    } else {
      subjects.push(subject)
    }

    this.setData({
      'formData.subjects': subjects
    })
  },

  /**
   * 选择学习目标
   */
  onGoalChange(e) {
    this.setData({
      'formData.goal': e.detail.value
    })
  },

  /**
   * 保存学习档案
   */
  onSaveProfile() {
    const { name, grade, subjects, goal } = this.data.formData

    // 验证必填项
    if (!name || !grade || subjects.length === 0) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      })
      return
    }

    const baseUrl = getBaseUrl()
    const userId = getUserId()
    const childId = this.data.currentChild.id

    wx.request({
      url: `${baseUrl}/api/parent/child-profile`,
      method: 'POST',
      data: {
        parentId: userId,
        childId,
        profile: {
          name,
          grade,
          school: this.data.formData.school,
          subjects,
          goal
        }
      },
      success: (res) => {
        if (res.data.success) {
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          })
          this.onCloseEditModal()
          // 重新加载数据
          this.loadChildProfile(childId)
        } else {
          wx.showToast({
            title: res.data.error || '保存失败',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        console.error('保存失败:', err)
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        })
      }
    })
  },

  /**
   * 选择孩子
   */
  onSelectChild() {
    if (this.data.children.length > 0) {
      this.setData({ showChildModal: true })
    } else {
      // 直接跳转到添加孩子
      this.onAddChild()
    }
  },

  /**
   * 关闭孩子选择弹窗
   */
  onCloseChildModal() {
    this.setData({ showChildModal: false })
  },

  /**
   * 选择某个孩子
   */
  onSelectChildItem(e) {
    const childId = e.currentTarget.dataset.id
    const child = this.data.children.find(c => c.id === childId)

    if (child) {
      this.setData({
        currentChild: child,
        showChildModal: false
      })
      // 重新加载该孩子的数据
      this.loadChildProfile(childId)
      this.loadChildStats(childId)
      this.loadAchievements()
      this.loadKnowledgeData()
    }
  },

  /**
   * 添加孩子
   */
  onAddChild() {
    this.onCloseChildModal()
    wx.showToast({
      title: '添加孩子功能开发中',
      icon: 'none'
    })
    // TODO: 跳转到添加孩子页面
  },

  /**
   * 切换周期
   */
  onPeriodChange(e) {
    const period = e.currentTarget.dataset.period
    this.setData({ period })
    this.loadStats()
  },

  /**
   * 分享成就
   */
  onShareAchievement(e) {
    const achievementId = e.currentTarget.dataset.id
    const achievement = this.data.achievements.find(a => a.id === achievementId)

    if (!achievement) return

    // 生成分享图片或显示分享选项
    wx.showActionSheet({
      itemList: ['生成分享图片', '发送给孩子', '保存到相册'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 生成分享图片
          this.generateShareImage(achievement)
        } else if (res.tapIndex === 1) {
          // 通过订阅消息发送给孩子
          this.sendToChild(achievement)
        } else if (res.tapIndex === 2) {
          // 保存到相册
          wx.showToast({
            title: '保存功能开发中',
            icon: 'none'
          })
        }
      }
    })
  },

  /**
   * 生成分享图片
   */
  generateShareImage(achievement) {
    wx.showToast({
      title: '正在生成分享图片...',
      icon: 'loading',
      duration: 2000
    })
    // TODO: 调用后端API生成成就分享图片
  },

  /**
   * 发送给孩子
   */
  sendToChild(achievement) {
    wx.showToast({
      title: '订阅消息功能开发中',
      icon: 'none'
    })
    // TODO: 通过订阅消息发送成就通知
  },

  /**
   * 查看全部成就
   */
  onViewAllAchievements() {
    wx.showToast({
      title: '全部成就页面开发中',
      icon: 'none'
    })
  },

  /**
   * 查看学习进度
   */
  onViewProgress() {
    wx.navigateTo({
      url: '/pages/progress/progress?childId=' + (this.data.currentChild.id || '')
    })
  },

  /**
   * 查看错题本（知识点汇总）
   */
  onViewWrongQuestions() {
    wx.navigateTo({
      url: '/pages/wrong-consolidated/wrong-consolidated?childId=' + (this.data.currentChild.id || '')
    })
  },

  /**
   * 查看学习报告
   */
  onViewReports() {
    wx.showToast({
      title: '学习报告功能开发中',
      icon: 'none'
    })
  }
})
