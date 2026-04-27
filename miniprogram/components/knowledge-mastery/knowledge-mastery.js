// components/knowledge-mastery/knowledge-mastery.js
// 知识点掌握度组件

const { getUserId } = require('../../utils/user');
const { getBaseUrl } = require('../../utils/config');

Component({
  /**
   * 组件属性
   */
  properties: {
    userId: {
      type: String,
      value: ''
    }
  },

  /**
   * 组件数据
   */
  data: {
    expanded: false,
    loading: false,
    totalPoints: 0,
    weakCount: 0,
    partialCount: 0,
    masteredCount: 0,
    subjectData: [],
    // 科目名称映射
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

  /**
   * 组件生命周期
   */
  lifetimes: {
    attached() {
      // 组件加载时可以预加载数据
    }
  },

  /**
   * 组件方法
   */
  methods: {
    /**
     * 展开/收起
     */
    onExpandToggle() {
      const expanded = !this.data.expanded;
      this.setData({ expanded });

      // 首次展开时加载数据
      if (expanded && this.data.subjectData.length === 0) {
        this.loadMasteryData();
      }
    },

    /**
     * 加载掌握度数据
     */
    async loadMasteryData() {
      try {
        this.setData({ loading: true });

        const userId = this.properties.userId || getUserId();
        const baseUrl = getBaseUrl();

        wx.request({
          url: `${baseUrl}/api/wrong-questions/consolidated?userId=${encodeURIComponent(userId)}`,
          method: 'GET',
          success: (res) => {
            if (res.data.success) {
              const summary = res.data.summary || {};
              const consolidated = res.data.consolidated || [];

              // 构建科目分组数据
              const subjectMap = {};
              const bySubject = summary.bySubject || {};

              for (const subject in bySubject) {
                subjectMap[subject] = {
                  subject,
                  name: this.data.subjectNames[subject] || subject,
                  total: bySubject[subject].total || 0,
                  mastered: bySubject[subject].mastered || 0,
                  expanded: false,
                  points: []
                };
              }

              // 添加知识点到对应科目
              consolidated.forEach(item => {
                const subject = item.knowledgePoint.subject;
                if (subjectMap[subject]) {
                  subjectMap[subject].points.push({
                    uri: item.knowledgePoint.uri,
                    name: item.knowledgePoint.name,
                    accuracy: Math.round(item.knowledgePoint.accuracy * 100),
                    level: item.knowledgePoint.masteryLevel,
                    levelText: this.data.masteryLevelTexts[item.knowledgePoint.masteryLevel] || '未知'
                  });
                }
              });

              // 转换为数组
              const subjectData = Object.values(subjectMap);

              this.setData({
                subjectData,
                totalPoints: summary.totalKnowledgePoints || 0,
                weakCount: summary.weakCount || 0,
                partialCount: summary.partialCount || 0,
                masteredCount: summary.masteredCount || 0,
                loading: false
              });
            } else {
              this.setData({ loading: false });
            }
          },
          fail: (err) => {
            console.error('加载掌握度数据失败', err);
            this.setData({ loading: false });
          }
        });
      } catch (err) {
        console.error('加载掌握度数据失败', err);
        this.setData({ loading: false });
      }
    },

    /**
     * 展开/收起科目
     */
    onSubjectToggle(e) {
      const subject = e.currentTarget.dataset.subject;
      const subjectData = this.data.subjectData;
      const index = subjectData.findIndex(item => item.subject === subject);

      if (index !== -1) {
        const expanded = !subjectData[index].expanded;
        this.setData({
          [`subjectData[${index}].expanded`]: expanded
        });
      }
    },

    /**
     * 点击知识点
     */
    onKnowledgeTap(e) {
      const { uri, name } = e.currentTarget.dataset;
      // 跳转到练习推荐页面
      wx.navigateTo({
        url: `/pages/practice-recommend/practice-recommend?knowledgeUri=${encodeURIComponent(uri)}&knowledgeName=${encodeURIComponent(name)}`
      });
    },

    /**
     * 查看错题分析
     */
    onViewWrong() {
      wx.navigateTo({
        url: '/pages/wrong-consolidated/wrong-consolidated'
      });
    },

    /**
     * 开始针对性练习
     */
    onStartPractice() {
      // 跳转到练习推荐页面，默认弱项模式
      wx.navigateTo({
        url: '/pages/practice-recommend/practice-recommend'
      });
    }
  }
});
