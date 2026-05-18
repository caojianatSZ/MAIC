// 约课详情
const { getBaseUrl, getUserId } = require('../../utils/user');

Page({
  data: {
    bookingId: '',
    booking: null,
    loading: true,
    statusLabels: {
      PENDING: '待确认',
      CONFIRMED: '已确认',
      COMPLETED: '已完成',
      CANCELLED: '已取消'
    },
    classTypeLabels: {
      ONE_V1: '1对1',
      ONE_V2: '1对2',
      ONE_V3: '1对3',
      ONE_V4: '1对4',
      ONE_VN: '1对多'
    }
  },

  onLoad(options) {
    this.setData({ bookingId: options.id });
    this.loadBookingDetail();
  },

  // 加载约课详情
  async loadBookingDetail() {
    this.setData({ loading: true });

    try {
      const baseUrl = getBaseUrl();
      const response = await wx.request({
        url: `${baseUrl}/api/bookings?teacherId=${getUserId()}`,
        method: 'GET',
        header: { 'x-user-id': getUserId() }
      });

      if (response.statusCode === 200) {
        const bookings = response.data.data;
        const booking = bookings.find(b => b.id === this.data.bookingId);

        if (booking) {
          this.setData({
            booking: {
              ...booking,
              scheduledAt: this.formatDateTime(booking.scheduledAt),
              classTypeLabel: this.data.classTypeLabels[booking.classType] || booking.classType
            },
            loading: false
          });
        } else {
          wx.showToast({ title: '约课不存在', icon: 'none' });
          setTimeout(() => wx.navigateBack(), 1500);
        }
      }
    } catch (error) {
      console.error('加载详情失败:', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  // 格式化日期时间
  formatDateTime(dateStr) {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdays[date.getDay()];

    return `${month}月${day}日 ${weekday} ${hours}:${minutes}`;
  },

  // 确认预约
  async onConfirm() {
    try {
      const baseUrl = getBaseUrl();
      await wx.request({
        url: `${baseUrl}/api/bookings/${this.data.bookingId}/confirm`,
        method: 'PUT',
        header: { 'x-user-id': getUserId() }
      });

      wx.showToast({ title: '已确认' });
      this.loadBookingDetail();
    } catch (error) {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 取消预约
  onCancel() {
    wx.navigateTo({
      url: `/pages/booking-cancel/booking-cancel?id=${this.data.bookingId}`
    });
  },

  // 开始上课
  onStart() {
    wx.showToast({ title: '上课功能开发中', icon: 'none' });
  },

  // 查看报告
  onViewReport() {
    wx.showToast({ title: '报告功能开发中', icon: 'none' });
  },

  // 点击学生
  onStudentTap() {
    if (this.data.booking?.student?.id) {
      wx.navigateTo({
        url: `/pages/student-detail/student-detail?id=${this.data.booking.student.id}`
      });
    }
  }
});
