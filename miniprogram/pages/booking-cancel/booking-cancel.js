// 取消约课
const { getBaseUrl, getUserId } = require('../../utils/user');

Page({
  data: {
    bookingId: '',
    selectedReason: '',
    showCustomInput: false,
    customReason: '',
    reasons: [
      { value: 'student_unavailable', label: '学生时间冲突' },
      { value: 'teacher_unavailable', label: '老师时间冲突' },
      { value: 'emergency', label: '突发情况' },
      { value: 'other', label: '其他原因' }
    ]
  },

  onLoad(options) {
    this.setData({ bookingId: options.id });
  },

  onReasonChange(e) {
    const reason = e.detail.value;
    this.setData({
      selectedReason: reason,
      showCustomInput: reason === 'other'
    });
  },

  onInputChange(e) {
    this.setData({ customReason: e.detail.value });
  },

  async onConfirm() {
    const { selectedReason, customReason } = this.data;

    if (!selectedReason) {
      wx.showToast({ title: '请选择取消原因', icon: 'none' });
      return;
    }

    if (selectedReason === 'other' && !customReason) {
      wx.showToast({ title: '请输入取消原因', icon: 'none' });
      return;
    }

    try {
      const baseUrl = getBaseUrl();
      const reasonText = this.data.reasons.find(r => r.value === selectedReason)?.label;
      const finalReason = selectedReason === 'other' ? customReason : reasonText;

      await wx.request({
        url: `${baseUrl}/api/bookings/${this.data.bookingId}/cancel`,
        method: 'PUT',
        header: {
          'x-user-id': getUserId(),
          'content-type': 'application/json'
        },
        data: { reason: finalReason }
      });

      wx.showToast({ title: '已取消' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (error) {
      wx.showToast({ title: '取消失败', icon: 'none' });
    }
  },

  onCancel() {
    wx.navigateBack();
  }
});
