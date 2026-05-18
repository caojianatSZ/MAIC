// 选择学生
const { getBaseUrl, getUserId } = require('../../utils/user');

Page({
  data: {
    keyword: '',
    students: [],
    loading: false
  },

  onLoad() {
    this.loadStudents();
  },

  // 加载学生列表
  async loadStudents() {
    this.setData({ loading: true });

    try {
      const baseUrl = getBaseUrl();
      const response = await wx.request({
        url: `${baseUrl}/api/students?limit=100`,
        method: 'GET',
        header: { 'x-user-id': getUserId() }
      });

      if (response.statusCode === 200) {
        const students = response.data.data || [];
        this.setData({ students, loading: false });
      }
    } catch (error) {
      console.error('加载学生失败:', error);
      this.setData({ loading: false });
    }
  },

  // 搜索输入
  onSearchInput(e) {
    const keyword = e.detail.value;
    this.setData({ keyword });

    if (keyword) {
      this.filterStudents(keyword);
    } else {
      this.loadStudents();
    }
  },

  // 筛选学生
  async filterStudents(keyword) {
    try {
      const baseUrl = getBaseUrl();
      const response = await wx.request({
        url: `${baseUrl}/api/students?keyword=${keyword}&limit=20`,
        method: 'GET',
        header: { 'x-user-id': getUserId() }
      });

      if (response.statusCode === 200) {
        this.setData({ students: response.data.data || [] });
      }
    } catch (error) {
      console.error('搜索失败:', error);
    }
  },

  // 清除搜索
  onClearSearch() {
    this.setData({ keyword: '' });
    this.loadStudents();
  },

  // 选择学生
  onSelectStudent(e) {
    const student = e.currentTarget.dataset.student;

    // 通知上一个页面
    const pages = getCurrentPages();
    const prevPage = pages[pages.length - 2];

    if (prevPage && prevPage.onStudentSelected) {
      prevPage.onStudentSelected(student);
    }

    wx.navigateBack();
  }
});
