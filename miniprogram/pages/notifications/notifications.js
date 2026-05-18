// 通知列表
const { getUserId } = require('../../utils/user');

Page({
  data: {
    currentCategory: 'all',
    categories: [
      { key: 'all', label: '全部', count: 0 },
      { key: 'booking', label: '约课', count: 0 },
      { key: 'lead', label: '线索', count: 0 },
      { key: 'payment', label: '支付', count: 0 }
    ],
    notifications: [],
    loading: false
  },

  onLoad() {
    this.loadNotifications();
  },

  onShow() {
    this.loadNotifications();
  },

  onPullDownRefresh() {
    this.loadNotifications().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 加载通知
  async loadNotifications() {
    this.setData({ loading: true });

    // 模拟通知数据
    const mockNotifications = [
      {
        id: '1',
        type: 'booking',
        title: '新约课待确认',
        description: '张三预约了明天的数学课程',
        time: '10分钟前',
        read: false,
        icon: '/images/icon-calendar.png',
        color: 'rgba(59, 130, 246, 0.1)',
        data: { bookingId: 'xxx' }
      },
      {
        id: '2',
        type: 'lead',
        title: '新试课线索',
        description: '李四家长咨询了试课信息',
        time: '1小时前',
        read: false,
        icon: '/images/icon-lead.png',
        color: 'rgba(245, 158, 11, 0.1)',
        data: { leadId: 'xxx' }
      },
      {
        id: '3',
        type: 'payment',
        title: '待收款提醒',
        description: '王五的课时费待确认收款',
        time: '昨天',
        read: true,
        icon: '/images/icon-payment.png',
        color: 'rgba(239, 68, 68, 0.1)',
        data: { paymentId: 'xxx' }
      }
    ];

    this.setData({
      notifications: mockNotifications,
      categories: [
        { key: 'all', label: '全部', count: 2 },
        { key: 'booking', label: '约课', count: 1 },
        { key: 'lead', label: '线索', count: 1 },
        { key: 'payment', label: '支付', count: 0 }
      ],
      loading: false
    });
  },

  // 切换分类
  onCategoryChange(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({ currentCategory: category });
    // TODO: 根据分类筛选通知
  },

  // 点击通知
  onNotificationTap(e) {
    const { type, data, id } = e.currentTarget.dataset;

    // 标记为已读
    const notifications = this.data.notifications.map(n => {
      if (n.id === id) {
        return { ...n, read: true };
      }
      return n;
    });
    this.setData({ notifications });

    // 跳转到对应页面
    const routes = {
      booking: '/pages/bookings-list/bookings-list',
      lead: '/pages/trial-leads-list/trial-leads-list',
      payment: '/pages/payments-list/payments-list'
    };

    if (routes[type]) {
      wx.navigateTo({ url: routes[type] });
    }
  }
});
