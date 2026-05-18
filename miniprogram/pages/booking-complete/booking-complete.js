// 完成约课
const { getBaseUrl, getUserId } = require('../../utils/user');

Page({
  data: {
    bookingId: '',
    submitting: false,
    performance: 'GOOD',
    ratings: [
      { value: 'EXCELLENT', label: '优秀' },
      { value: 'GOOD', label: '良好' },
      { value: 'AVERAGE', label: '一般' },
      { value: 'POOR', label: '需改进' }
    ]
  },

  onLoad(options) {
    this.setData({ bookingId: options.id });
  },

  onRatingSelect(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({ performance: value });
  },

  async onSubmit(e) {
    const formData = e.detail.value;

    this.setData({ submitting: true });

    try {
      const baseUrl = getBaseUrl();

      await wx.request({
        url: `${baseUrl}/api/bookings/${this.data.bookingId}/complete`,
        method: 'PUT',
        header: {
          'x-user-id': getUserId(),
          'content-type': 'application/json'
        },
        data: {
          attendance: formData.attendance,
          notes: {
            performance: this.data.performance,
            content: formData.content,
            homework: formData.homework
          }
        }
      });

      wx.showToast({
        title: '已完成',
        icon: 'success'
      });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (error) {
      console.error('完成失败:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
