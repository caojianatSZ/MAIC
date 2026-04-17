// pages/wrong-questions/wrong-questions.js
const { getUserId } = require('../../utils/user');
const { getBaseUrl } = require('../../utils/config');

Page({
  data: {
    questions: [],
    loading: true,
    empty: false,
    currentTab: 'all',     // all / unmastered / mastered
    subjectFilter: 'all',
    subjects: ['all', 'math', 'physics', 'chemistry', 'english', 'chinese'],
    subjectNames: {
      all: '全部',
      math: '数学',
      physics: '物理',
      chemistry: '化学',
      english: '英语',
      chinese: '语文'
    },
    tabs: [
      { key: 'all', name: '全部' },
      { key: 'unmastered', name: '未掌握' },
      { key: 'mastered', name: '已掌握' }
    ],
    statistics: {
      total: 0,
      unmastered: 0,
      mastered: 0
    }
  },

  onLoad() {
    this.loadQuestions();
    this.loadStatistics();
  },

  onShow() {
    // 从其他页面返回时刷新列表
    if (this.data.questions.length > 0 || !this.data.loading) {
      this.loadQuestions();
      this.loadStatistics();
    }
  },

  /**
   * 加载错题列表
   */
  async loadQuestions() {
    try {
      this.setData({ loading: true });

      const userId = getUserId();
      const baseUrl = getBaseUrl();
      const { currentTab, subjectFilter } = this.data;

      // 构建请求URL
      let url = `${baseUrl}/api/wrong-questions?userId=${encodeURIComponent(userId)}`;

      if (subjectFilter !== 'all') {
        url += `&subject=${subjectFilter}`;
      }

      if (currentTab === 'unmastered') {
        url += `&mastered=false`;
      } else if (currentTab === 'mastered') {
        url += `&mastered=true`;
      }

      wx.request({
        url: url,
        method: 'GET',
        success: (res) => {
          if (res.data.success) {
            const questions = res.data.data.questions || [];
            this.setData({
              questions,
              loading: false,
              empty: questions.length === 0
            });
          } else {
            throw new Error(res.data.message || '加载失败');
          }
        },
        fail: (err) => {
          console.error('加载错题本失败', err);
          this.setData({ loading: false });
          wx.showToast({
            title: '加载失败',
            icon: 'none'
          });
        }
      });
    } catch (err) {
      console.error('加载错题本失败', err);
      this.setData({ loading: false });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  /**
   * 加载统计信息
   */
  async loadStatistics() {
    try {
      const userId = getUserId();
      const baseUrl = getBaseUrl();

      wx.request({
        url: `${baseUrl}/api/wrong-questions?userId=${encodeURIComponent(userId)}&stats=true`,
        method: 'GET',
        success: (res) => {
          if (res.data.success && res.data.data.statistics) {
            const stats = res.data.data.statistics;
            this.setData({
              'statistics.total': stats.total || 0,
              'statistics.unmastered': stats.unmastered || 0,
              'statistics.mastered': stats.mastered || 0
            });
          }
        },
        fail: (err) => {
          console.error('加载统计信息失败', err);
        }
      });
    } catch (err) {
      console.error('加载统计信息失败', err);
    }
  },

  /**
   * 切换 Tab（全部/未掌握/已掌握）
   */
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab !== this.data.currentTab) {
      this.setData({ currentTab: tab });
      this.loadQuestions();
    }
  },

  /**
   * 切换科目筛选
   */
  onSubjectChange(e) {
    const subject = e.currentTarget.dataset.subject;
    if (subject !== this.data.subjectFilter) {
      this.setData({ subjectFilter: subject });
      this.loadQuestions();
    }
  },

  /**
   * 标记为已掌握
   */
  markAsMastered(e) {
    const { questionid } = e.currentTarget.dataset;

    wx.showModal({
      title: '确认掌握',
      content: '标记为已掌握后，该题目将从未掌握列表中移除，确定吗？',
      confirmText: '确定',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.doMarkAsMastered(questionid);
        }
      }
    });
  },

  /**
   * 执行标记为已掌握
   */
  async doMarkAsMastered(questionId) {
    try {
      const userId = getUserId();
      const baseUrl = getBaseUrl();

      wx.request({
        url: `${baseUrl}/api/wrong-questions`,
        method: 'PATCH',
        data: {
          userId,
          questionId,
          action: 'mark_mastered'
        },
        success: (res) => {
          if (res.data.success) {
            wx.showToast({
              title: '已标记为掌握',
              icon: 'success'
            });
            this.loadQuestions();
            this.loadStatistics();
          } else {
            throw new Error(res.data.message || '操作失败');
          }
        },
        fail: (err) => {
          console.error('标记掌握失败', err);
          wx.showToast({
            title: '操作失败',
            icon: 'none'
          });
        }
      });
    } catch (err) {
      console.error('标记掌握失败', err);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
  },

  /**
   * 点击题目卡片
   */
  onQuestionTap(e) {
    const { questionid, subject } = e.currentTarget.dataset;
    // 可以跳转到题目详情页
    wx.navigateTo({
      url: `/pages/review-detail/review-detail?questionId=${questionid}&subject=${subject || ''}`
    });
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    Promise.all([
      this.loadQuestions(),
      this.loadStatistics()
    ]).then(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 格式化时间
   */
  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();
    return `${month}月${day}日 ${hour}:${minute.toString().padStart(2, '0')}`;
  },

  /**
   * 获取掌握状态文本
   */
  getMasteryStatusText(mastered) {
    return mastered ? '已掌握' : '练习中';
  },

  /**
   * 获取掌握状态样式类
   */
  getMasteryStatusClass(mastered) {
    return mastered ? 'mastered' : 'practicing';
  }
});
