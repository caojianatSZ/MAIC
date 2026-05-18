// 创建试课线索
const { getBaseUrl, getUserId } = require('../../utils/user');

Page({
  data: {
    grades: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三'],
    gradeIndex: -1,
    sources: ['微信推广', '朋友介绍', '线下活动', '电话咨询', '其他'],
    sourceIndex: -1,
    minDate: new Date().toISOString().split('T')[0],
    form: {
      studentName: '',
      parentName: '',
      phoneNumber: '',
      grade: '',
      scheduledTime: '',
      sourceChannel: '',
      sourceNotes: ''
    },
    submitting: false
  },

  onLoad(options) {
    // 如果从学生档案创建，预填学生信息
    if (options.studentId) {
      this.loadStudentInfo(options.studentId);
    }
  },

  // 输入变化
  onInputChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`form.${field}`]: value
    });
  },

  // 年级选择
  onGradeChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      gradeIndex: index,
      'form.grade': this.data.grades[index]
    });
  },

  // 日期选择
  onDateChange(e) {
    this.setData({
      'form.scheduledTime': e.detail.value
    });
  },

  // 来源选择
  onSourceChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      sourceIndex: index,
      'form.sourceChannel': this.data.sources[index]
    });
  },

  // 提交表单
  async onSubmit(e) {
    const formData = e.detail.value;

    // 验证必填字段
    if (!this.validateForm(formData)) {
      return;
    }

    this.setData({ submitting: true });

    try {
      const baseUrl = getBaseUrl();
      const response = await wx.request({
        url: `${baseUrl}/api/trial-leads`,
        method: 'POST',
        header: {
          'x-user-id': getUserId(),
          'content-type': 'application/json'
        },
        data: {
          ...formData,
          cityId: wx.getStorageSync('userCityId') || 'default',
          cityPartnerId: getUserId()
        }
      });

      if (response.statusCode === 201) {
        wx.showToast({
          title: '创建成功',
          icon: 'success'
        });

        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else if (response.statusCode === 409) {
        wx.showModal({
          title: '线索已存在',
          content: '该手机号在此城市已有线索记录',
          showCancel: false
        });
      } else {
        throw new Error(response.data.error || '创建失败');
      }
    } catch (error) {
      console.error('创建线索失败:', error);
      wx.showToast({
        title: error.message || '创建失败',
        icon: 'none'
      });
    } finally {
      this.setData({ submitting: false });
    }
  },

  // 表单验证
  validateForm(data) {
    if (!data.studentName || !data.studentName.trim()) {
      wx.showToast({ title: '请输入学生姓名', icon: 'none' });
      return false;
    }

    if (!data.phoneNumber || !data.phoneNumber.trim()) {
      wx.showToast({ title: '请输入联系电话', icon: 'none' });
      return false;
    }

    if (!/^1[3-9]\d{9}$/.test(data.phoneNumber)) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' });
      return false;
    }

    return true;
  },

  // 取消
  onCancel() {
    wx.showModal({
      title: '确认取消',
      content: '放弃当前编辑内容？',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack();
        }
      }
    });
  },

  // 加载学生信息（从现有学生）
  async loadStudentInfo(studentId) {
    try {
      const baseUrl = getBaseUrl();
      const response = await wx.request({
        url: `${baseUrl}/api/students/${studentId}`,
        method: 'GET',
        header: { 'x-user-id': getUserId() }
      });

      if (response.statusCode === 200) {
        const student = response.data;
        this.setData({
          'form.studentName': student.nickname || student.realName || '',
          'form.phoneNumber': student.phoneNumber || ''
        });
      }
    } catch (error) {
      console.error('加载学生信息失败:', error);
    }
  }
});
