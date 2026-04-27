// pages/wrong-consolidated/wrong-consolidated.js
// 错题合并视图 - 按知识点分组显示错题

const { getUserId } = require('../../utils/user');
const { getBaseUrl } = require('../../utils/config');

Page({
  data: {
    consolidatedList: [],
    summary: null,
    loading: true,
    subjectFilter: 'all',
    subjectList: [],
    masteryLevelTexts: {
      'weak': '薄弱',
      'partial': '部分掌握',
      'mastered': '已掌握'
    }
  },

  onLoad(options) {
    // 从个人中心或其他页面跳转过来时，可能带有科目筛选
    if (options.subject) {
      this.setData({ subjectFilter: options.subject });
    }
    this.loadConsolidatedData();
  },

  onShow() {
    // 从其他页面返回时刷新数据
    if (this.data.consolidatedList.length > 0 || !this.data.loading) {
      this.loadConsolidatedData();
    }
  },

  /**
   * 加载错题合并数据
   */
  async loadConsolidatedData() {
    try {
      this.setData({ loading: true });

      const userId = getUserId();
      const baseUrl = getBaseUrl();
      const { subjectFilter } = this.data;

      let url = `${baseUrl}/api/wrong-questions/consolidated?userId=${encodeURIComponent(userId)}`;
      if (subjectFilter !== 'all') {
        url += `&subject=${subjectFilter}`;
      }

      wx.request({
        url: url,
        method: 'GET',
        success: (res) => {
          if (res.data.success) {
            const consolidated = res.data.consolidated || [];
            const summary = res.data.summary || {};

            // 处理数据，添加显示所需字段
            const processedList = consolidated.map(item => ({
              ...item,
              expanded: false,  // 默认折叠
              masteryLevelText: this.data.masteryLevelTexts[item.knowledgePoint.masteryLevel] || '未知',
              accuracyText: this.formatAccuracy(item.knowledgePoint.accuracy),
              totalAttempts: item.knowledgePoint.totalAttempts || 0
            }));

            // 构建科目筛选列表
            const subjectList = this.buildSubjectList(summary.bySubject || {});

            this.setData({
              consolidatedList: processedList,
              summary,
              subjectList,
              loading: false
            });
          } else {
            throw new Error(res.data.error || '加载失败');
          }
        },
        fail: (err) => {
          console.error('加载错题合并数据失败', err);
          this.setData({ loading: false });
          wx.showToast({
            title: '加载失败',
            icon: 'none'
          });
        }
      });
    } catch (err) {
      console.error('加载错题合并数据失败', err);
      this.setData({ loading: false });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  /**
   * 构建科目筛选列表
   */
  buildSubjectList(bySubject) {
    const subjectNames = {
      'math': '数学',
      'physics': '物理',
      'chemistry': '化学',
      'english': '英语',
      'chinese': '语文'
    };

    const list = [
      { key: 'all', name: '全部', count: 0 }
    ];

    let totalCount = 0;
    for (const subject in bySubject) {
      totalCount += bySubject[subject].total || 0;
    }
    list[0].count = totalCount;

    for (const subject in bySubject) {
      list.push({
        key: subject,
        name: subjectNames[subject] || subject,
        count: bySubject[subject].total || 0
      });
    }

    return list;
  },

  /**
   * 格式化正确率
   */
  formatAccuracy(accuracy) {
    if (typeof accuracy !== 'number') return '0%';
    return Math.round(accuracy * 100) + '%';
  },

  /**
   * 切换科目筛选
   */
  onSubjectChange(e) {
    const subject = e.currentTarget.dataset.subject;
    if (subject !== this.data.subjectFilter) {
      this.setData({ subjectFilter: subject });
      this.loadConsolidatedData();
    }
  },

  /**
   * 展开/折叠知识点
   */
  onKnowledgeToggle(e) {
    const uri = e.currentTarget.dataset.uri;
    const list = this.data.consolidatedList;
    const index = list.findIndex(item => item.uri === uri);

    if (index !== -1) {
      const expanded = !list[index].expanded;
      this.setData({
        [`consolidatedList[${index}].expanded`]: expanded
      });
    }
  },

  /**
   * 点击错题项
   */
  onQuestionTap(e) {
    const id = e.currentTarget.dataset.id;
    // 跳转到错题详情页
    wx.navigateTo({
      url: `/pages/review-detail/review-detail?id=${id}`
    });
  },

  /**
   * 查看解析
   */
  onViewSolution(e) {
    const { id, content } = e.currentTarget.dataset;
    // 跳转到解析页面或显示弹窗
    wx.navigateTo({
      url: `/pages/review-detail/review-detail?id=${id}&showSolution=true`
    });
  },

  /**
   * 开始针对性练习
   */
  onStartPractice(e) {
    const { uri, name } = e.currentTarget.dataset;
    // 跳转到练习推荐页面
    wx.navigateTo({
      url: `/pages/practice-recommend/practice-recommend?knowledgeUri=${encodeURIComponent(uri)}&knowledgeName=${encodeURIComponent(name)}`
    });
  },

  /**
   * 查看掌握分析
   */
  onViewAnalysis(e) {
    const { uri, name } = e.currentTarget.dataset;
    // 可以跳转到知识点详情页或显示分析图表
    wx.showModal({
      title: name,
      content: '知识点掌握分析功能开发中，敬请期待',
      showCancel: false
    });
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadConsolidatedData().then(() => {
      wx.stopPullDownRefresh();
    });
  }
});
