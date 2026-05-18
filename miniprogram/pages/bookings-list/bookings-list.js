// 约课列表
const { getBaseUrl, getUserId } = require('../../utils/user');
const { formatDate } = require('../../utils/config');

Page({
  data: {
    statusTabs: [
      { key: '', label: '全部' },
      { key: 'PENDING', label: '待确认' },
      { key: 'CONFIRMED', label: '已确认' },
      { key: 'COMPLETED', label: '已完成' }
    ],
    currentStatus: '',
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
    },
    viewMode: 'list',
    bookings: [],
    loading: false,
    currentMonth: new Date().toISOString().slice(0, 7),
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    calendarDays: [],
    selectedDate: '',
    selectedDateBookings: []
  },

  onLoad() {
    this.loadBookings();
    this.generateCalendar();
  },

  onShow() {
    if (this.data.bookings.length > 0) {
      this.refreshList();
    }
  },

  onPullDownRefresh() {
    this.refreshList().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 加载约课列表
  async loadBookings() {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      const baseUrl = getBaseUrl();
      const params = new URLSearchParams({
        teacherId: getUserId(),
        limit: 100
      });

      if (this.data.currentStatus) {
        params.append('status', this.data.currentStatus);
      }

      const response = await wx.request({
        url: `${baseUrl}/api/bookings?${params.toString()}`,
        method: 'GET',
        header: { 'x-user-id': getUserId() }
      });

      if (response.statusCode === 200) {
        const { data } = response.data;
        const bookings = data.map(booking => ({
          ...booking,
          scheduledAt: this.formatDateTime(booking.scheduledAt),
          classTypeLabel: this.data.classTypeLabels[booking.classType] || booking.classType
        }));

        this.setData({ bookings, loading: false });
      }
    } catch (error) {
      console.error('加载约课失败:', error);
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

  // 刷新列表
  async refreshList() {
    await this.loadBookings();
    this.generateCalendar();
  },

  // 切换状态
  onStatusChange(e) {
    const status = e.currentTarget.dataset.status;
    if (status === this.data.currentStatus) return;

    this.setData({ currentStatus: status });
    this.loadBookings();
  },

  // 切换视图
  onSwitchView(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ viewMode: mode });
  },

  // 生成日历
  generateCalendar() {
    const currentDate = new Date(this.data.currentMonth + '-01');
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days = [];
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;

    // 上个月的日期
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        day: prevMonthLastDay - i,
        dateStr: `${year}-${month.toString().padStart(2, '0')}-${(prevMonthLastDay - i).toString().padStart(2, '0')}`,
        isOtherMonth: true,
        isToday: false,
        hasBooking: false
      });
    }

    // 当月日期
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`;
      const bookingCount = this.countBookingsOnDate(dateStr);
      days.push({
        day: i,
        dateStr,
        isOtherMonth: false,
        isToday: dateStr === todayStr,
        hasBooking: bookingCount > 0,
        bookingCount
      });
    }

    // 下个月的日期
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        day: i,
        dateStr: `${year}-${(month + 2).toString().padStart(2, '0')}-${i.toString().padStart(2, '0')}`,
        isOtherMonth: true,
        isToday: false,
        hasBooking: false
      });
    }

    this.setData({ calendarDays: days });
  },

  // 统计某日期的约课数
  countBookingsOnDate(dateStr) {
    return this.data.bookings.filter(b => {
      const bookingDate = new Date(b.scheduledAt).toISOString().split('T')[0];
      return bookingDate === dateStr;
    }).length;
  },

  // 上一月
  onPrevMonth() {
    const currentDate = new Date(this.data.currentMonth + '-01');
    currentDate.setMonth(currentDate.getMonth() - 1);
    const newMonth = currentDate.toISOString().slice(0, 7);
    this.setData({ currentMonth: newMonth });
    this.generateCalendar();
  },

  // 下一月
  onNextMonth() {
    const currentDate = new Date(this.data.currentMonth + '-01');
    currentDate.setMonth(currentDate.getMonth() + 1);
    const newMonth = currentDate.toISOString().slice(0, 7);
    this.setData({ currentMonth: newMonth });
    this.generateCalendar();
  },

  // 点击日期
  onDayTap(e) {
    const dateStr = e.currentTarget.dataset.date;
    const bookings = this.data.bookings.filter(b => {
      const bookingDate = new Date(b.scheduledAt).toISOString().split('T')[0];
      return bookingDate === dateStr;
    }).map(b => ({
      ...b,
      time: new Date(b.scheduledAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }));

    this.setData({
      selectedDate: dateStr,
      selectedDateBookings: bookings
    });
  },

  // 点击约课卡片
  onBookingTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/booking-detail/booking-detail?id=${id}`
    });
  },

  // 确认约课
  async onConfirm(e) {
    const id = e.currentTarget.dataset.id;
    try {
      const baseUrl = getBaseUrl();
      await wx.request({
        url: `${baseUrl}/api/bookings/${id}/confirm`,
        method: 'PUT',
        header: { 'x-user-id': getUserId() }
      });

      wx.showToast({ title: '已确认' });
      this.refreshList();
    } catch (error) {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 取消约课
  onCancel(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/booking-cancel/booking-cancel?id=${id}`
    });
  },

  // 完成约课
  onComplete(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/booking-complete/booking-complete?id=${id}`
    });
  },

  // 添加约课
  onAddBooking() {
    wx.navigateTo({
      url: '/pages/booking-create/booking-create'
    });
  }
});
