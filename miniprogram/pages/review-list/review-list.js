// pages/review-list/review-list.js
const { getUserId } = require('../../utils/user');
const { getBaseUrl } = require('../../utils/config');

Page({
  data: {
    questions: [],
    loading: true,
    empty: false,
    subjectFilter: 'all', // all, math, physics, chemistry, english, chinese
    subjects: ['all', 'math', 'physics', 'chemistry', 'english', 'chinese'],
    subjectNames: {
      all: '全部',
      math: '数学',
      physics: '物理',
      chemistry: '化学',
      english: '英语',
      chinese: '语文'
    }
  },

  onLoad(options) {
    this.loadReviewList();
  },

  onShow() {
    // 从复核详情页返回时重新加载列表
    if (this.data.questions.length > 0) {
      this.loadReviewList();
    }
  },

  async loadReviewList() {
    try {
      this.setData({ loading: true });

      const userId = getUserId();
      const baseUrl = getBaseUrl();
      const { subjectFilter } = this.data;

      // 构建请求URL
      let url = `${baseUrl}/api/wrong-questions?userId=${encodeURIComponent(userId)}&review=true`;
      if (subjectFilter !== 'all') {
        url += `&subject=${subjectFilter}`;
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
          console.error('加载复核列表失败', err);
          this.setData({ loading: false });
          wx.showToast({
            title: '加载失败',
            icon: 'none'
          });
        }
      });
    } catch (err) {
      console.error('加载复核列表失败', err);
      this.setData({ loading: false });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  // 切换科目筛选
  onSubjectChange(e) {
    const subject = e.currentTarget.dataset.subject;
    if (subject !== this.data.subjectFilter) {
      this.setData({ subjectFilter: subject });
      this.loadReviewList();
    }
  },

  // 点击题目进入复核详情
  onQuestionTap(e) {
    const { questionid, subject } = e.currentTarget.dataset;
    // 跳转到复核详情页面
    wx.navigateTo({
      url: `/pages/review-detail/review-detail?questionId=${questionid}&subject=${subject || ''}`
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadReviewList().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 格式化时间
  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();
    return `${month}月${day}日 ${hour}:${minute.toString().padStart(2, '0')}`;
  },

  // 获取置信度等级文本
  getConfidenceLevel(confidence) {
    if (confidence >= 0.8) return { text: '高', class: 'high' };
    if (confidence >= 0.5) return { text: '中', class: 'medium' };
    return { text: '低', class: 'low' };
  },

  // 获取置信度进度条颜色
  getConfidenceColor(confidence) {
    if (confidence >= 0.8) return '#10b981';
    if (confidence >= 0.5) return '#f59e0b';
    return '#ef4444';
  }
});
