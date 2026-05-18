// 创建约课
const { getBaseUrl, getUserId } = require('../../utils/user');

Page({
  data: {
    selectedStudent: null,
    subjects: ['数学', '语文', '英语', '物理', '化学'],
    grades: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '初一', '初二', '初三', '高一', '高二', '高三'],
    subjectIndex: -1,
    gradeIndex: -1,
    classTypes: [
      { value: 'ONE_V1', label: '1对1', desc: '单人' },
      { value: 'ONE_V2', label: '1对2', desc: '2人' },
      { value: 'ONE_V3', label: '1对3', desc: '3人' },
      { value: 'ONE_V4', label: '1对4', desc: '4人' },
      { value: 'ONE_VN', label: '1对多', desc: '不限' }
    ],
    durations: [45, 60, 90, 120],
    minDate: new Date().toISOString().split('T')[0],
    form: {
      subject: '',
      grade: '',
      topic: '',
      classType: 'ONE_V1',
      date: '',
      time: '',
      duration: 60
    },
    submitting: false
  },

  onLoad(options) {
    if (options.studentId) {
      this.loadStudent(options.studentId);
    }
    if (options.leadId) {
      this.loadLead(options.leadId);
    }
  },

  // 加载学生
  async loadStudent(studentId) {
    try {
      const baseUrl = getBaseUrl();
      const response = await wx.request({
        url: `${baseUrl}/api/students/${studentId}`,
        method: 'GET',
        header: { 'x-user-id': getUserId() }
      });

      if (response.statusCode === 200) {
        this.setData({ selectedStudent: response.data });
      }
    } catch (error) {
      console.error('加载学生失败:', error);
    }
  },

  // 加载线索
  async loadLead(leadId) {
    try {
      const baseUrl = getBaseUrl();
      const response = await wx.request({
        url: `${baseUrl}/api/trial-leads/${leadId}`,
        method: 'GET',
        header: { 'x-user-id': getUserId() }
      });

      if (response.statusCode === 200) {
        const lead = response.data;
        this.setData({
          selectedStudent: {
            id: lead.id,
            nickname: lead.studentName,
            phoneNumber: lead.phoneNumber
          }
        });
      }
    } catch (error) {
      console.error('加载线索失败:', error);
    }
  },

  // 选择学生
  onSelectStudent() {
    wx.navigateTo({
      url: '/pages/student-select/student-select?callback=onStudentSelected'
    });
  },

  // 学科选择
  onSubjectChange(e) {
    const index = parseInt(e.detail.value);
    this.setData({
      subjectIndex: index,
      'form.subject': this.data.subjects[index]
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

  // 输入变化
  onInputChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`form.${field}`]: value
    });
  },

  // 班型选择
  onClassTypeSelect(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      'form.classType': type
    });
  },

  // 日期选择
  onDateChange(e) {
    this.setData({
      'form.date': e.detail.value
    });
  },

  // 时间选择
  onTimeChange(e) {
    this.setData({
      'form.time': e.detail.value
    });
  },

  // 时长选择
  onDurationSelect(e) {
    const duration = e.currentTarget.dataset.duration;
    this.setData({
      'form.duration': duration
    });
  },

  // 提交
  async onSubmit() {
    const { selectedStudent, form } = this.data;

    if (!selectedStudent) {
      wx.showToast({ title: '请选择学生', icon: 'none' });
      return;
    }

    if (!form.subject || !form.date || !form.time) {
      wx.showToast({ title: '请填写必填项', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    try {
      const baseUrl = getBaseUrl();
      const scheduledAt = new Date(`${form.date}T${form.time}`);

      const response = await wx.request({
        url: `${baseUrl}/api/bookings`,
        method: 'POST',
        header: {
          'x-user-id': getUserId(),
          'content-type': 'application/json'
        },
        data: {
          studentId: selectedStudent.id,
          teacherId: getUserId(),
          cityId: wx.getStorageSync('userCityId') || 'default',
          cityPartnerId: getUserId(),
          classType: form.classType,
          subject: form.subject,
          topic: form.topic,
          grade: form.grade,
          scheduledAt: scheduledAt.toISOString(),
          duration: form.duration
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
      } else {
        throw new Error(response.data.error || '创建失败');
      }
    } catch (error) {
      console.error('创建约课失败:', error);
      wx.showToast({
        title: error.message || '创建失败',
        icon: 'none'
      });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
