// 老师仪表盘
const { getBaseUrl, getUserId } = require('../../utils/user');

Page({
  data: {
    loading: true,
    userInfo: {},
    currentDate: '',
    currentWeekday: '',
    unreadCount: 0,
    todayStats: {
      bookings: 0,
      completed: 0,
      pending: 0,
      overdue: 0
    },
    todayBookings: [],
    todos: [],
    weekStats: {
      conversionRate: 0,
      conversionTrend: 0,
      totalHours: 0,
      hoursTrend: 0,
      newLeads: 0,
      leadsTrend: 0
    }
  },

  onLoad() {
    this.initDate();
    this.loadDashboardData();
  },

  onShow() {
    this.loadDashboardData();
  },

  onPullDownRefresh() {
    this.loadDashboardData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 初始化日期
  initDate() {
    const now = new Date();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    this.setData({
      currentDate: `${now.getMonth() + 1}月${now.getDate()}日`,
      currentWeekday: weekdays[now.getDay()]
    });
  },

  // 加载仪表盘数据
  async loadDashboardData() {
    this.setData({ loading: true });

    try {
      const baseUrl = getBaseUrl();
      const response = await wx.request({
        url: `${baseUrl}/api/teacher/dashboard?teacherId=${getUserId()}`,
        method: 'GET',
        header: { 'x-user-id': getUserId() }
      });

      if (response.statusCode === 200) {
        const data = response.data;

        // 处理今日课程
        const todayBookings = (data.todayBookings || []).map(booking => {
          const date = new Date(booking.scheduledAt);
          return {
            ...booking,
            time: `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`,
            statusLabel: this.getStatusLabel(booking.status)
          };
        });

        // 处理待办事项
        const todos = [];
        if (data.pendingLeads > 0) {
          todos.push({
            id: 'leads',
            type: 'leads',
            title: '新线索待处理',
            description: `${data.pendingLeads} 条新线索`,
            time: '今天',
            icon: '/images/icon-lead.png',
            color: 'rgba(59, 130, 246, 0.1)'
          });
        }
        if (data.pendingConfirmations > 0) {
          todos.push({
            id: 'confirmations',
            type: 'bookings',
            title: '待确认约课',
            description: `${data.pendingConfirmations} 个预约待确认`,
            time: '今天',
            icon: '/images/icon-confirm.png',
            color: 'rgba(245, 158, 11, 0.1)'
          });
        }
        if (data.pendingPayments > 0) {
          todos.push({
            id: 'payments',
            type: 'payments',
            title: '待跟进收款',
            description: `${data.pendingPayments} 笔款项待确认`,
            time: '本周',
            icon: '/images/icon-payment.png',
            color: 'rgba(239, 68, 68, 0.1)'
          });
        }

        this.setData({
          userInfo: data.teacher || {},
          unreadCount: data.unreadCount || 0,
          todayStats: {
            bookings: data.todayBookingsCount || 0,
            completed: data.todayCompletedCount || 0,
            pending: data.pendingConfirmations || 0,
            overdue: data.pendingPayments || 0
          },
          todayBookings,
          todos,
          weekStats: {
            conversionRate: data.conversionRate || 0,
            conversionTrend: data.conversionTrend || 0,
            totalHours: data.weekHours || 0,
            hoursTrend: data.hoursTrend || 0,
            newLeads: data.weekNewLeads || 0,
            leadsTrend: data.leadsTrend || 0
          },
          loading: false
        });
      }
    } catch (error) {
      console.error('加载仪表盘失败:', error);
      this.setData({ loading: false });
    }
  },

  // 获取状态标签
  getStatusLabel(status) {
    const labels = {
      PENDING: '待确认',
      CONFIRMED: '已确认',
      COMPLETED: '已完成',
      CANCELLED: '已取消'
    };
    return labels[status] || status;
  },

  // 通知
  onNotifications() {
    wx.navigateTo({
      url: '/pages/notifications/notifications'
    });
  },

  // 查看全部课程
  onViewAllBookings() {
    wx.navigateTo({
      url: '/pages/bookings-list/bookings-list'
    });
  },

  // 点击课程
  onBookingTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/booking-detail/booking-detail?id=${id}`
    });
  },

  // 点击待办
  onTodoTap(e) {
    const type = e.currentTarget.dataset.type;
    const routes = {
      leads: '/pages/trial-leads-list/trial-leads-list?status=NEW',
      bookings: '/pages/bookings-list/bookings-list?status=PENDING',
      payments: '/pages/payments-list/payments-list?status=PENDING'
    };
    if (routes[type]) {
      wx.navigateTo({ url: routes[type] });
    }
  }
});
