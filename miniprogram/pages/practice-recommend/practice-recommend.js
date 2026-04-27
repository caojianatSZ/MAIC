// pages/practice-recommend/practice-recommend.js
// 练习题推荐页面

const { getUserId } = require('../../utils/user');
const { getBaseUrl } = require('../../utils/config');

Page({
  data: {
    currentMode: 'weak',  // weak / knowledge
    loading: false,
    // 弱项相关
    weakPoints: [],
    selectedWeakIndex: -1,
    currentKnowledgeName: '',
    practiceQuestions: [],
    // 知识点选择相关
    subjectList: [
      { key: 'all', name: '全部' },
      { key: 'math', name: '数学' },
      { key: 'physics', name: '物理' },
      { key: 'chemistry', name: '化学' },
      { key: 'english', name: '英语' }
    ],
    subjectFilter: 'all',
    knowledgeList: [],
    // 答案弹窗
    showAnswerModal: false,
    currentQuestion: null,
    solutionData: null,
    solutionSections: {
      examPoints: true,
      methodGuide: true,
      detailedAnalysis: true
    },
    // 难度文本映射
    difficultyTexts: {
      1: '简单',
      2: '较易',
      3: '中等',
      4: '较难',
      5: '困难'
    },
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

  onLoad(options) {
    // 支持从其他页面跳转时指定知识点
    if (options.knowledgeUri && options.knowledgeName) {
      this.setData({
        currentMode: 'knowledge',
        specifiedKnowledge: {
          uri: decodeURIComponent(options.knowledgeUri),
          name: decodeURIComponent(options.knowledgeName)
        }
      });
    }

    this.initPage();
  },

  onShow() {
    // 返回时刷新数据
    if (!this.data.loading) {
      if (this.data.currentMode === 'weak') {
        this.loadWeakPoints();
      }
    }
  },

  /**
   * 初始化页面
   */
  async initPage() {
    if (this.data.currentMode === 'weak') {
      await this.loadWeakPoints();
    } else {
      await this.loadKnowledgeList();
    }
  },

  /**
   * 切换模式
   */
  onModeChange(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode !== this.data.currentMode) {
      this.setData({
        currentMode: mode,
        selectedWeakIndex: -1,
        practiceQuestions: []
      });

      if (mode === 'weak') {
        this.loadWeakPoints();
      } else {
        this.loadKnowledgeList();
      }
    }
  },

  /**
   * 加载弱项知识点
   */
  async loadWeakPoints() {
    try {
      this.setData({ loading: true });

      const userId = getUserId();
      const baseUrl = getBaseUrl();

      wx.request({
        url: `${baseUrl}/api/wrong-questions/consolidated?userId=${encodeURIComponent(userId)}`,
        method: 'GET',
        success: (res) => {
          if (res.data.success) {
            const consolidated = res.data.consolidated || [];

            // 提取薄弱知识点
            const weakPoints = consolidated
              .filter(item => item.knowledgePoint.masteryLevel === 'weak')
              .map(item => ({
                uri: item.knowledgePoint.uri,
                name: item.knowledgePoint.name,
                subject: item.knowledgePoint.subject,
                subjectName: this.data.subjectNames[item.knowledgePoint.subject] || item.knowledgePoint.subject,
                totalWrongQuestions: item.totalWrongQuestions,
                accuracy: item.knowledgePoint.accuracy
              }));

            this.setData({
              weakPoints,
              loading: false
            });

            // 自动选择第一个弱项
            if (weakPoints.length > 0 && this.data.selectedWeakIndex < 0) {
              this.onWeakPointSelect({ currentTarget: { dataset: { index: 0 } } });
            }
          } else {
            throw new Error(res.data.error || '加载失败');
          }
        },
        fail: (err) => {
          console.error('加载弱项知识点失败', err);
          this.setData({ loading: false });
          wx.showToast({
            title: '加载失败',
            icon: 'none'
          });
        }
      });
    } catch (err) {
      console.error('加载弱项知识点失败', err);
      this.setData({ loading: false });
    }
  },

  /**
   * 选择弱项知识点
   */
  async onWeakPointSelect(e) {
    const index = e.currentTarget.dataset.index;
    if (index === this.data.selectedWeakIndex) return;

    const weakPoint = this.data.weakPoints[index];
    this.setData({
      selectedWeakIndex: index,
      currentKnowledgeName: weakPoint.name,
      practiceQuestions: []
    });

    await this.loadPracticeQuestions(weakPoint.name, weakPoint.subject);
  },

  /**
   * 加载练习题
   */
  async loadPracticeQuestions(knowledgeName, subject) {
    try {
      this.setData({ loading: true });

      const userId = getUserId();
      const baseUrl = getBaseUrl();

      wx.request({
        url: `${baseUrl}/api/practice/recommend?userId=${encodeURIComponent(userId)}&mode=single&knowledgeName=${encodeURIComponent(knowledgeName)}&subject=${subject || ''}`,
        method: 'GET',
        success: (res) => {
          if (res.data.success) {
            const questions = res.data.questions || [];
            // 添加默认难度
            const processedQuestions = questions.map(q => ({
              ...q,
              difficulty: q.difficulty || 1
            }));
            this.setData({
              practiceQuestions: processedQuestions,
              loading: false
            });
          } else {
            this.setData({ loading: false });
            wx.showToast({
              title: res.data.error || '暂无练习题',
              icon: 'none'
            });
          }
        },
        fail: (err) => {
          console.error('加载练习题失败', err);
          this.setData({ loading: false });
          wx.showToast({
            title: '加载失败',
            icon: 'none'
          });
        }
      });
    } catch (err) {
      console.error('加载练习题失败', err);
      this.setData({ loading: false });
    }
  },

  /**
   * 加载知识点列表
   */
  async loadKnowledgeList() {
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

            const knowledgeList = consolidated.map(item => ({
              uri: item.knowledgePoint.uri,
              name: item.knowledgePoint.name,
              subject: item.knowledgePoint.subject,
              subjectName: this.data.subjectNames[item.knowledgePoint.subject] || item.knowledgePoint.subject,
              masteryLevel: item.knowledgePoint.masteryLevel,
              masteryLevelText: this.data.masteryLevelTexts[item.knowledgePoint.masteryLevel] || '未知'
            }));

            this.setData({
              knowledgeList,
              loading: false
            });
          } else {
            this.setData({ loading: false });
          }
        },
        fail: (err) => {
          console.error('加载知识点列表失败', err);
          this.setData({ loading: false });
        }
      });
    } catch (err) {
      console.error('加载知识点列表失败', err);
      this.setData({ loading: false });
    }
  },

  /**
   * 科目筛选
   */
  onSubjectFilterChange(e) {
    const subject = e.currentTarget.dataset.subject;
    if (subject !== this.data.subjectFilter) {
      this.setData({ subjectFilter: subject });
      this.loadKnowledgeList();
    }
  },

  /**
   * 选择知识点
   */
  async onKnowledgeSelect(e) {
    const knowledge = e.currentTarget.dataset.knowledge;
    this.setData({
      currentKnowledgeName: knowledge.name,
      selectedWeakIndex: 0  // 设置为选中状态
    });
    await this.loadPracticeQuestions(knowledge.name, knowledge.subject);
  },

  /**
   * 点击题目
   */
  onQuestionTap(e) {
    const question = e.currentTarget.dataset.question;
    this.setData({
      currentQuestion: question,
      showAnswerModal: true,
      solutionData: null,
      solutionSections: {
        examPoints: true,
        methodGuide: true,
        detailedAnalysis: true
      }
    });

    // 如果有题目ID，尝试获取标准答案解析
    if (question.id) {
      this.loadSolutionData(question.id, question.question || '');
    }
  },

  /**
   * 加载标准答案解析
   */
  async loadSolutionData(questionId, questionContent) {
    try {
      const baseUrl = getBaseUrl();

      wx.request({
        url: `${baseUrl}/api/solution`,
        method: 'POST',
        data: {
          questionId,
          questionContent,
          subject: 'math',
          grade: '初二'
        },
        success: (res) => {
          if (res.data.success) {
            this.setData({
              solutionData: {
                examPoints: res.data.examPoints || '',
                methodGuide: res.data.methodGuide || '',
                detailedAnalysis: res.data.detailedAnalysis || ''
              }
            });
          }
        },
        fail: (err) => {
          console.error('加载解析失败', err);
        }
      });
    } catch (err) {
      console.error('加载解析失败', err);
    }
  },

  /**
   * 切换解析区域展开/折叠
   */
  onToggleSolutionSection(e) {
    const section = e.currentTarget.dataset.section;
    this.setData({
      [`solutionSections.${section}`]: !this.data.solutionSections[section]
    });
  },

  /**
   * 关闭答案弹窗
   */
  onCloseAnswerModal() {
    this.setData({
      showAnswerModal: false,
      currentQuestion: null
    });
  },

  /**
   * 标记已掌握
   */
  onMarkMastered() {
    wx.showToast({
      title: '已标记为掌握',
      icon: 'success'
    });
    this.onCloseAnswerModal();
    // TODO: 调用后端API记录掌握状态
  },

  /**
   * 浏览所有知识点
   */
  onBrowseAll() {
    this.setData({ currentMode: 'knowledge' });
    this.loadKnowledgeList();
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    const initMethod = this.data.currentMode === 'weak'
      ? this.loadWeakPoints()
      : this.loadKnowledgeList();

    initMethod.then(() => {
      wx.stopPullDownRefresh();
    });
  }
});
