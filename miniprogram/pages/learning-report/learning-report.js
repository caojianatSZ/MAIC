// pages/learning-report/learning-report.js
const { getUserId } = require('../../utils/user');
const { getBaseUrl } = require('../../utils/config');

Page({
  data: {
    loading: true,
    currentPeriod: 'week',
    periodOptions: [
      { key: 'week', label: '本周' },
      { key: 'month', label: '本月' }
    ],
    // 报告数据
    reportData: {
      summary: {},
      trendData: [],
      weakPoints: [],
      suggestions: [],
      nextPlan: []
    }
  },

  onLoad(options) {
    const period = options.period || 'week';
    this.setData({ currentPeriod: period });
    this.loadReportData();
  },

  /**
   * 加载报告数据
   */
  async loadReportData() {
    try {
      this.setData({ loading: true });

      const userId = getUserId();
      const baseUrl = getBaseUrl();
      const { currentPeriod } = this.data;

      wx.request({
        url: `${baseUrl}/api/student/report?userId=${encodeURIComponent(userId)}&period=${currentPeriod}`,
        method: 'GET',
        success: (res) => {
          if (res.data.success) {
            this.setData({
              reportData: res.data.data,
              loading: false
            });
          } else {
            throw new Error(res.data.error || '加载失败');
          }
        },
        fail: (err) => {
          console.error('加载报告数据失败:', err);
          this.loadMockReport();
        }
      });
    } catch (err) {
      console.error('加载报告数据失败:', err);
      this.loadMockReport();
    }
  },

  /**
   * 加载模拟报告数据
   */
  loadMockReport() {
    this.setData({
      reportData: {
        summary: {
          studyMinutes: 210,
          studyMinutesChange: 20,
          completedLessons: 5,
          accuracy: 82,
          accuracyChange: 5
        },
        trendData: [
          { date: '周一', mastery: 55, accuracy: 72 },
          { date: '周二', mastery: 58, accuracy: 75 },
          { date: '周三', mastery: 60, accuracy: 78 },
          { date: '周四', mastery: 62, accuracy: 80 },
          { date: '周五', mastery: 65, accuracy: 82 },
          { date: '周六', mastery: 67, accuracy: 85 },
          { date: '周日', mastery: 67, accuracy: 85 }
        ],
        weakPoints: [
          {
            name: '二次函数顶点',
            subject: 'math',
            wrongCount: 3,
            masteryLevel: 'weak',
            suggestion: '复习配方法求顶点课程，重点理解顶点坐标公式'
          },
          {
            name: '因式分解',
            subject: 'math',
            wrongCount: 2,
            masteryLevel: 'partial',
            suggestion: '完成3道靶向练习，掌握提公因式法和公式法'
          }
        ],
        suggestions: [
          '本周学习表现良好，掌握度提升了12%',
          '建议重点巩固二次函数相关知识点',
          '继续保持每天练习的习惯'
        ],
        nextPlan: [
          { task: '复习二次函数顶点', priority: 'high' },
          { task: '完成因式分解练习', priority: 'high' },
          { task: '学习新课程: 图像平移', priority: 'medium' }
        ]
      },
      loading: false
    });
  },

  /**
   * 切换周期
   */
  onPeriodChange(e) {
    const period = e.currentTarget.dataset.period;
    if (period !== this.data.currentPeriod) {
      this.setData({ currentPeriod: period });
      this.loadReportData();
    }
  },

  /**
   * 分享报告
   */
  onShareReport() {
    wx.showActionSheet({
      itemList: ['生成分享图片', '发送给家长', '保存到相册'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.generateShareImage();
        } else if (res.tapIndex === 1) {
          this.sendToParent();
        } else if (res.tapIndex === 2) {
          this.saveToAlbum();
        }
      }
    });
  },

  /**
   * 生成分享图片
   */
  generateShareImage() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    });
  },

  /**
   * 发送给家长
   */
  sendToParent() {
    wx.showToast({
      title: '订阅消息功能开发中',
      icon: 'none'
    });
  },

  /**
   * 保存到相册
   */
  saveToAlbum() {
    wx.showToast({
      title: '保存功能开发中',
      icon: 'none'
    });
  },

  /**
   * 点击薄弱知识点
   */
  onWeakPointTap(e) {
    const { name, subject } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/practice-recommend/practice-recommend?knowledgeName=${encodeURIComponent(name)}&subject=${subject}`
    });
  },

  /**
   * 返回
   */
  onGoBack() {
    wx.navigateBack();
  }
});
