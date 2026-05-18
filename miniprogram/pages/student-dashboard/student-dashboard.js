// pages/student-dashboard/student-dashboard.js
const { getUserId } = require('../../utils/user');
const { getBaseUrl } = require('../../utils/config');

Page({
  data: {
    loading: true,
    // 统计周期
    period: 'week',
    periodOptions: [
      { key: 'week', label: '本周' },
      { key: 'month', label: '本月' },
      { key: 'all', label: '全部' }
    ],
    // 学习概览统计
    stats: {
      studyMinutes: 0,
      accuracy: 0,
      masteredPoints: 0,
      streakDays: 0
    },
    // 知识点掌握度
    knowledgeMastery: {
      totalPoints: 0,
      masteredPoints: 0,
      masteryRate: 0,
      bySubject: []
    },
    // 待巩固知识点
    weakPoints: [],
    // 近期学习记录
    recentRecords: [],
    // 最新成就
    recentAchievements: [],
    // 空状态
    isEmpty: false
  },

  onLoad(options) {
    console.log('学生仪表盘加载', options);
    this.loadDashboardData();
  },

  onShow() {
    // 每次显示时刷新数据
    if (!this.data.loading) {
      this.loadDashboardData();
    }
  },

  onPullDownRefresh() {
    this.loadDashboardData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 加载仪表盘数据
   */
  async loadDashboardData() {
    try {
      this.setData({ loading: true });

      const userId = getUserId();
      const baseUrl = getBaseUrl();
      const { period } = this.data;

      wx.request({
        url: `${baseUrl}/api/student/dashboard?userId=${encodeURIComponent(userId)}&period=${period}`,
        method: 'GET',
        success: (res) => {
          if (res.data.success) {
            const data = res.data.data;

            // 检查是否真正没有任何数据
            const hasAnyData = (data.stats && data.stats.studyMinutes > 0) ||
                               (data.knowledgeMastery && data.knowledgeMastery.totalPoints > 0) ||
                               (data.weakPoints && data.weakPoints.length > 0) ||
                               (data.recentRecords && data.recentRecords.length > 0) ||
                               (data.recentAchievements && data.recentAchievements.length > 0);

            // 如果没有任何数据，使用 mock 数据进行演示
            if (!hasAnyData) {
              console.log('暂无学习数据，使用演示数据');
              this.loadMockData();
            } else {
              this.setData({
                stats: data.stats || {},
                knowledgeMastery: data.knowledgeMastery || {},
                weakPoints: data.weakPoints || [],
                recentRecords: data.recentRecords || [],
                recentAchievements: data.recentAchievements || [],
                isEmpty: false,
                loading: false
              });
            }
          } else {
            throw new Error(res.data.error || '加载失败');
          }
        },
        fail: (err) => {
          console.error('加载仪表盘数据失败:', err);
          // 使用模拟数据进行开发测试
          this.loadMockData();
        }
      });
    } catch (err) {
      console.error('加载仪表盘数据失败:', err);
      this.loadMockData();
    }
  },

  /**
   * 加载模拟数据（开发测试用）
   */
  loadMockData() {
    this.setData({
      stats: {
        studyMinutes: 180,
        accuracy: 85,
        masteredPoints: 8,
        streakDays: 7
      },
      knowledgeMastery: {
        totalPoints: 12,
        masteredPoints: 8,
        masteryRate: 67,
        bySubject: [
          { subject: '数学', total: 4, mastered: 3, rate: 75 },
          { subject: '语文', total: 3, mastered: 2, rate: 67 },
          { subject: '英语', total: 3, mastered: 2, rate: 67 },
          { subject: '科学', total: 2, mastered: 1, rate: 50 }
        ]
      },
      weakPoints: [
        {
          uri: 'kp_quadratic_vertex',
          name: '二次函数顶点',
          subject: 'math',
          masteryLevel: 'weak',
          wrongCount: 3,
          accuracy: 40
        },
        {
          uri: 'kp_factorization',
          name: '因式分解',
          subject: 'math',
          masteryLevel: 'weak',
          wrongCount: 2,
          accuracy: 50
        },
        {
          uri: 'kp_fraction',
          name: '分式运算',
          subject: 'math',
          masteryLevel: 'partial',
          wrongCount: 1,
          accuracy: 65
        }
      ],
      recentRecords: [
        {
          id: 'record_1',
          title: '分数的认识',
          subject: '数学',
          completedAt: '今天',
          accuracy: 100,
          duration: 10
        },
        {
          id: 'record_2',
          title: '几何图形识别',
          subject: '数学',
          completedAt: '昨天',
          accuracy: 80,
          duration: 8
        }
      ],
      recentAchievements: [
        { id: 'ach_1', name: '初学者', icon: '🎯', unlockedAt: '今天' },
        { id: 'ach_2', name: '勤奋学生', icon: '📚', unlockedAt: '本周' },
        { id: 'ach_3', name: '学霸', icon: '⭐', unlockedAt: '本周' }
      ],
      isEmpty: false,
      loading: false
    });
  },

  /**
   * 切换统计周期
   */
  onPeriodChange(e) {
    const period = e.currentTarget.dataset.period;
    if (period !== this.data.period) {
      this.setData({ period });
      this.loadDashboardData();
    }
  },

  /**
   * 点击知识点详情
   */
  onViewKnowledgeDetail() {
    wx.navigateTo({
      url: '/pages/progress/progress'
    });
  },

  /**
   * 点击待巩固知识点
   */
  onWeakPointTap(e) {
    const { uri, name, subject } = e.currentTarget.dataset;
    // 跳转到练习页面
    wx.navigateTo({
      url: `/pages/practice-recommend/practice-recommend?knowledgeUri=${encodeURIComponent(uri)}&knowledgeName=${encodeURIComponent(name)}&subject=${subject}`
    });
  },

  /**
   * 开始练习
   */
  onStartPractice() {
    // 跳转到最薄弱的知识点练习
    if (this.data.weakPoints.length > 0) {
      const weakest = this.data.weakPoints[0];
      this.onWeakPointTap({
        currentTarget: {
          dataset: weakest
        }
      });
    } else {
      wx.navigateTo({
        url: '/pages/practice-recommend/practice-recommend'
      });
    }
  },

  /**
   * 查看学习记录
   */
  onViewRecord(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/player/player?recordId=${id}`
    });
  },

  /**
   * 查看全部成就
   */
  onViewAllAchievements() {
    wx.navigateTo({
      url: '/pages/profile/profile'
    });
  },

  /**
   * 查看学习报告
   */
  onViewReport() {
    wx.navigateTo({
      url: '/pages/learning-report/learning-report'
    });
  },

  /**
   * 开始诊断
   */
  onStartDiagnosis() {
    wx.navigateTo({
      url: '/pages/diagnosis/diagnosis'
    });
  }
});
