// 教师时间段设置
const { getBaseUrl, getUserId } = require('../../utils/user');

Page({
  data: {
    currentDay: '1',
    currentDayLabel: '周一',
    weekDays: [],
    currentSlots: [],
    allSlots: {},
    showSlotModal: false,
    editingSlot: null,
    classTypes: [
      { value: 'ONE_V1', label: '1对1' },
      { value: 'ONE_V2', label: '1对2' },
      { value: 'ONE_V3', label: '1对3' },
      { value: 'ONE_V4', label: '1对4' },
      { value: 'ONE_VN', label: '1对多' }
    ],
    slotForm: {
      startTime: '',
      endTime: '',
      classTypes: ['ONE_V1']
    }
  },

  onLoad() {
    this.initWeekDays();
    this.loadSlots();
  },

  // 初始化周日期
  initWeekDays() {
    const today = new Date();
    const weekDays = [];
    const dayLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - today.getDay() + i);

      weekDays.push({
        value: i.toString(),
        label: dayLabels[i],
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        hasSlots: false
      });
    }

    this.setData({
      weekDays,
      currentDay: today.getDay().toString(),
      currentDayLabel: dayLabels[today.getDay()]
    });
  },

  // 加载时间段
  async loadSlots() {
    try {
      const baseUrl = getBaseUrl();
      const response = await wx.request({
        url: `${baseUrl}/api/teacher/slots?teacherId=${getUserId()}`,
        method: 'GET',
        header: { 'x-user-id': getUserId() }
      });

      if (response.statusCode === 200) {
        const slots = response.data.data || [];
        const allSlots = {};
        const weekDays = this.data.weekDays;

        // 按星期分组
        slots.forEach(slot => {
          const day = slot.dayOfWeek.toString();
          if (!allSlots[day]) {
            allSlots[day] = [];
          }
          allSlots[day].push(slot);
        });

        // 更新是否有时间段的标记
        weekDays.forEach(day => {
          day.hasSlots = allSlots[day.value] && allSlots[day.value].length > 0;
        });

        this.setData({
          allSlots,
          weekDays,
          currentSlots: allSlots[this.data.currentDay] || []
        });
      }
    } catch (error) {
      console.error('加载时间段失败:', error);
    }
  },

  // 选择日期
  onDaySelect(e) {
    const day = e.currentTarget.dataset.day;
    const dayLabel = this.data.weekDays.find(d => d.value === day)?.label;

    this.setData({
      currentDay: day,
      currentDayLabel: dayLabel,
      currentSlots: this.data.allSlots[day] || []
    });
  },

  // 添加时间段
  onAddSlot() {
    this.setData({
      showSlotModal: true,
      editingSlot: null,
      slotForm: {
        startTime: '',
        endTime: '',
        classTypes: ['ONE_V1']
      }
    });
  },

  // 编辑时间段
  onEditSlot(e) {
    const slot = e.currentTarget.dataset.slot;
    this.setData({
      showSlotModal: true,
      editingSlot: slot,
      slotForm: {
        startTime: slot.startTime,
        endTime: slot.endTime,
        classTypes: slot.classTypes || ['ONE_V1']
      }
    });
  },

  // 删除时间段
  async onDeleteSlot(e) {
    const id = e.currentTarget.dataset.id;

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个时间段吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const baseUrl = getBaseUrl();
            await wx.request({
              url: `${baseUrl}/api/teacher/slots/${id}`,
              method: 'DELETE',
              header: { 'x-user-id': getUserId() }
            });

            wx.showToast({ title: '已删除' });
            this.loadSlots();
          } catch (error) {
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 开始时间变化
  onStartTimeChange(e) {
    this.setData({
      'slotForm.startTime': e.detail.value
    });
  },

  // 结束时间变化
  onEndTimeChange(e) {
    this.setData({
      'slotForm.endTime': e.detail.value
    });
  },

  // 班型切换
  onClassTypeToggle(e) {
    const value = e.currentTarget.dataset.value;
    let classTypes = [...this.data.slotForm.classTypes];
    const index = classTypes.indexOf(value);

    if (index > -1) {
      classTypes.splice(index, 1);
    } else {
      classTypes.push(value);
    }

    this.setData({
      'slotForm.classTypes': classTypes
    });
  },

  // 保存时间段
  async onSaveSlot() {
    const { startTime, endTime, classTypes } = this.data.slotForm;

    if (!startTime || !endTime) {
      wx.showToast({ title: '请选择时间', icon: 'none' });
      return;
    }

    if (classTypes.length === 0) {
      wx.showToast({ title: '请选择班型', icon: 'none' });
      return;
    }

    try {
      const baseUrl = getBaseUrl();
      const data = {
        teacherId: getUserId(),
        dayOfWeek: parseInt(this.data.currentDay),
        startTime,
        endTime,
        classTypes,
        isAvailable: true
      };

      let response;
      if (this.data.editingSlot) {
        response = await wx.request({
          url: `${baseUrl}/api/teacher/slots/${this.data.editingSlot.id}`,
          method: 'PUT',
          header: {
            'x-user-id': getUserId(),
            'content-type': 'application/json'
          },
          data
        });
      } else {
        response = await wx.request({
          url: `${baseUrl}/api/teacher/slots`,
          method: 'POST',
          header: {
            'x-user-id': getUserId(),
            'content-type': 'application/json'
          },
          data
        });
      }

      if (response.statusCode === 200 || response.statusCode === 201) {
        wx.showToast({ title: '保存成功' });
        this.onCloseModal();
        this.loadSlots();
      }
    } catch (error) {
      console.error('保存失败:', error);
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  // 关闭弹窗
  onCloseModal() {
    this.setData({ showSlotModal: false });
  },

  // 阻止冒泡
  stopPropagation() {},

  // 复制到其他周
  onCopyWeek() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
  },

  // 清空本周
  async onClearAll() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空本周所有时间段吗？',
      confirmColor: '#EF4444',
      success: async (res) => {
        if (res.confirm) {
          try {
            const baseUrl = getBaseUrl();
            const slots = this.data.currentSlots;

            for (const slot of slots) {
              await wx.request({
                url: `${baseUrl}/api/teacher/slots/${slot.id}`,
                method: 'DELETE',
                header: { 'x-user-id': getUserId() }
              });
            }

            wx.showToast({ title: '已清空' });
            this.loadSlots();
          } catch (error) {
            wx.showToast({ title: '操作失败', icon: 'none' });
          }
        }
      }
    });
  }
});
