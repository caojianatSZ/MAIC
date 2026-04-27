// pages/review-detail/review-detail.js
// 错题详情页 - 包含标准答案解析

const { getUserId } = require('../../utils/user');
const { getBaseUrl } = require('../../utils/config');

Page({
  data: {
    question: {},
    knowledgePoints: [],
    // 解析相关
    solutionExpanded: false,
    solutionData: null,
    solutionLoading: false,
    solutionLoadTried: false,
    sections: {
      examPoints: true,
      methodGuide: true,
      detailedAnalysis: true
    },
    // 科目名称
    subjectNames: {
      'math': '数学',
      'physics': '物理',
      'chemistry': '化学',
      'english': '英语',
      'chinese': '语文'
    },
    // 掌握等级文本
    masteryLevelTexts: {
      'weak': '薄弱',
      'partial': '部分掌握',
      'mastered': '已掌握'
    }
  },

  onLoad(options) {
    const { id, questionId, showSolution } = options;

    if (id) {
      this.loadQuestionDetail(id);
      // 如果带有 showSolution 参数，自动展开解析
      if (showSolution === 'true') {
        this.setData({ solutionExpanded: true });
        this.loadSolutionData(id);
      }
    } else if (questionId) {
      // 根据 questionId 查找题目
      this.loadQuestionByQuestionId(questionId);
    }
  },

  /**
   * 加载题目详情
   */
  async loadQuestionDetail(id) {
    try {
      const userId = getUserId();
      const baseUrl = getBaseUrl();

      wx.request({
        url: `${baseUrl}/api/wrong-questions?userId=${encodeURIComponent(userId)}&id=${id}`,
        method: 'GET',
        success: (res) => {
          if (res.data.success && res.data.data) {
            const question = res.data.data;
            this.setData({
              question: {
                ...question,
                masteryLevelText: this.data.masteryLevelTexts[question.masteryLevel] || '薄弱'
              },
              knowledgePoints: question.knowledgePoints || []
            });
          }
        },
        fail: (err) => {
          console.error('加载题目详情失败', err);
        }
      });
    } catch (err) {
      console.error('加载题目详情失败', err);
    }
  },

  /**
   * 根据 questionId 查找题目
   */
  async loadQuestionByQuestionId(questionId) {
    try {
      const userId = getUserId();
      const baseUrl = getBaseUrl();

      wx.request({
        url: `${baseUrl}/api/wrong-questions?userId=${encodeURIComponent(userId)}&questionId=${questionId}`,
        method: 'GET',
        success: (res) => {
          if (res.data.success && res.data.data && res.data.data.length > 0) {
            const question = res.data.data[0];
            this.setData({
              question: {
                ...question,
                masteryLevelText: this.data.masteryLevelTexts[question.masteryLevel] || '薄弱'
              },
              knowledgePoints: question.knowledgePoints || []
            });
          } else {
            wx.showModal({
              title: '提示',
              content: '未找到该题目',
              showCancel: false,
              success: () => {
                wx.navigateBack();
              }
            });
          }
        },
        fail: (err) => {
          console.error('查找题目失败', err);
          wx.showToast({
            title: '加载失败',
            icon: 'none'
          });
        }
      });
    } catch (err) {
      console.error('查找题目失败', err);
    }
  },

  /**
   * 展开/收起解析
   */
  onToggleSolution() {
    const expanded = !this.data.solutionExpanded;
    this.setData({ solutionExpanded: expanded });

    // 如果首次展开且还没有加载数据，则加载
    if (expanded && !this.data.solutionData && !this.data.solutionLoadTried) {
      this.loadSolutionData(this.data.question.id);
    }
  },

  /**
   * 加载标准答案解析
   */
  async loadSolutionData(questionId) {
    try {
      this.setData({
        solutionLoading: true,
        solutionLoadTried: false
      });

      const userId = getUserId();
      const baseUrl = getBaseUrl();

      wx.request({
        url: `${baseUrl}/api/solution`,
        method: 'POST',
        data: {
          questionId: questionId,
          questionContent: this.data.question.questionContent,
          subject: this.data.question.subject || 'math',
          grade: '初二'
        },
        success: (res) => {
          if (res.data.success) {
            this.setData({
              solutionData: {
                examPoints: res.data.examPoints || '',
                methodGuide: res.data.methodGuide || '',
                detailedAnalysis: res.data.detailedAnalysis || '',
                standardAnswer: res.data.standardAnswer || ''
              },
              solutionLoading: false,
              solutionLoadTried: true
            });
          } else {
            this.setData({
              solutionLoading: false,
              solutionLoadTried: true
            });
            wx.showToast({
              title: res.data.error || '加载解析失败',
              icon: 'none'
            });
          }
        },
        fail: (err) => {
          console.error('加载解析失败', err);
          this.setData({
            solutionLoading: false,
            solutionLoadTried: true
          });
          wx.showToast({
            title: '加载解析失败',
            icon: 'none'
          });
        }
      });
    } catch (err) {
      console.error('加载解析失败', err);
      this.setData({
        solutionLoading: false,
        solutionLoadTried: true
      });
    }
  },

  /**
   * 展开/收起解析部分
   */
  onToggleSection(e) {
    const section = e.currentTarget.dataset.section;
    this.setData({
      [`sections.${section}`]: !this.data.sections[section]
    });
  },

  /**
   * 点击知识点标签
   */
  onKnowledgeTap(e) {
    const uri = e.currentTarget.dataset.uri;
    // 跳转到练习推荐页面
    wx.navigateTo({
      url: `/pages/practice-recommend/practice-recommend?knowledgeUri=${encodeURIComponent(uri)}`
    });
  },

  /**
   * 开始针对性练习
   */
  onStartPractice() {
    if (this.data.knowledgePoints.length > 0) {
      const mainKnowledge = this.data.knowledgePoints[0];
      wx.navigateTo({
        url: `/pages/practice-recommend/practice-recommend?knowledgeUri=${encodeURIComponent(mainKnowledge.uri)}&knowledgeName=${encodeURIComponent(mainKnowledge.name)}`
      });
    }
  },

  /**
   * 标记为已掌握
   */
  onMarkMastered() {
    wx.showModal({
      title: '确认掌握',
      content: '标记为已掌握后，该题目将从未掌握列表中移除，确定吗？',
      confirmText: '确定',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.doMarkAsMastered();
        }
      }
    });
  },

  /**
   * 执行标记掌握
   */
  async doMarkAsMastered() {
    try {
      const userId = getUserId();
      const baseUrl = getBaseUrl();
      const questionId = this.data.question.questionId;

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
            // 更新本地状态
            this.setData({
              'question.mastered': true,
              'question.masteryLevelText': '已掌握'
            });
            // 触发成就检查
            this.checkAchievement();
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
   * 检查成就
   */
  checkAchievement() {
    // TODO: 调用成就检查API
    console.log('检查成就: 错题掌握');
  },

  /**
   * 分享题目
   */
  onShareAppMessage() {
    return {
      title: '这道题你会做吗？',
      path: `/pages/review-detail/review-detail?id=${this.data.question.id}`,
      imageUrl: ''
    };
  }
});
