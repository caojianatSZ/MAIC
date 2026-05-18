// 试课线索列表
const { getBaseUrl, getUserId } = require('../../utils/user');
const { formatDate } = require('../../utils/config');

Page({
  data: {
    statusTabs: [
      { key: '', label: '全部', count: 0 },
      { key: 'NEW', label: '新线索', count: 0 },
      { key: 'CONTACTED', label: '已联系', count: 0 },
      { key: 'SCHEDULED', label: '已预约', count: 0 },
      { key: 'COMPLETED', label: '已完成', count: 0 }
    ],
    currentStatus: '',
    statusLabels: {
      NEW: '新线索',
      CONTACTED: '已联系',
      SCHEDULED: '已预约',
      COMPLETED: '已完成',
      CONVERTED: '已转化',
      LOST: '已流失'
    },
    searchKeyword: '',
    leads: [],
    loading: false,
    loadingMore: false,
    hasMore: true,
    page: 1,
    pageSize: 20
  },

  onLoad() {
    this.loadLeads();
  },

  onShow() {
    // 从其他页面返回时刷新列表
    if (this.data.leads.length > 0) {
      this.refreshList();
    }
  },

  onPullDownRefresh() {
    this.refreshList().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  // 加载线索列表
  async loadLeads(refresh = false) {
    if (this.data.loading) return;

    this.setData({ loading: true });

    try {
      const baseUrl = getBaseUrl();
      const params = new URLSearchParams({
        page: refresh ? 1 : this.data.page,
        limit: this.data.pageSize
      });

      if (this.data.currentStatus) {
        params.append('status', this.data.currentStatus);
      }

      const response = await wx.request({
        url: `${baseUrl}/api/trial-leads?${params.toString()}`,
        method: 'GET',
        header: {
          'x-user-id': getUserId()
        }
      });

      if (response.statusCode === 200) {
        const { data, pagination } = response.data;
        const leads = data.map(lead => ({
          ...lead,
          createdAt: formatDate(lead.createdAt),
          scheduledTime: lead.scheduledTime ? formatDate(lead.scheduledTime) : null
        }));

        this.setData({
          leads: refresh ? leads : [...this.data.leads, ...leads],
          hasMore: pagination.page < pagination.pages,
          page: refresh ? 2 : this.data.page + 1,
          loading: false
        });

        // 更新 tab 计数
        this.updateTabCounts();
      }
    } catch (error) {
      console.error('加载线索失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  // 更新 tab 计数
  async updateTabCounts() {
    try {
      const baseUrl = getBaseUrl();
      const response = await wx.request({
        url: `${baseUrl}/api/trial-leads?limit=1`,
        method: 'GET',
        header: {
          'x-user-id': getUserId()
        }
      });

      if (response.statusCode === 200) {
        const { pagination } = response.data;
        const tabs = this.data.statusTabs.map(tab => ({
          ...tab,
          count: tab.key === '' ? pagination.total : 0 // TODO: 获取各状态计数
        }));
        this.setData({ statusTabs: tabs });
      }
    } catch (error) {
      console.error('更新计数失败:', error);
    }
  },

  // 刷新列表
  async refreshList() {
    this.setData({
      page: 1,
      hasMore: true
    });
    await this.loadLeads(true);
  },

  // 切换状态筛选
  onStatusChange(e) {
    const status = e.currentTarget.dataset.status;
    if (status === this.data.currentStatus) return;

    this.setData({
      currentStatus: status,
      page: 1,
      hasMore: true,
      leads: []
    });
    this.loadLeads(true);
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  // 确认搜索
  onSearch() {
    // TODO: 实现搜索功能
    wx.showToast({ title: '搜索功能待实现', icon: 'none' });
  },

  // 清除搜索
  onClearSearch() {
    this.setData({ searchKeyword: '' });
  },

  // 点击线索卡片
  onLeadTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/trial-lead-detail/trial-lead-detail?id=${id}`
    });
  },

  // 拨打电话
  onCall(e) {
    const phone = e.currentTarget.dataset.phone;
    wx.makePhoneCall({ phoneNumber: phone });
  },

  // 标记已联系
  async onContact(e) {
    const id = e.currentTarget.dataset.id;
    try {
      const baseUrl = getBaseUrl();
      await wx.request({
        url: `${baseUrl}/api/trial-leads/${id}`,
        method: 'PUT',
        header: {
          'x-user-id': getUserId(),
          'content-type': 'application/json'
        },
        data: { status: 'CONTACTED' }
      });

      wx.showToast({ title: '已标记' });
      this.refreshList();
    } catch (error) {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  // 预约试课
  onBookTrial(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/trial-lead-detail/trial-lead-detail?id=${id}&action=book`
    });
  },

  // 完成试课
  onCompleteTrial(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/trial-lead-detail/trial-lead-detail?id=${id}&action=complete`
    });
  },

  // 转化
  onConvert(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/trial-lead-detail/trial-lead-detail?id=${id}&action=convert`
    });
  },

  // 标记流失
  async onMarkLost(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认流失',
      content: '标记为流失后，该线索将不再显示在活跃列表中',
      success: async (res) => {
        if (res.confirm) {
          try {
            const baseUrl = getBaseUrl();
            await wx.request({
              url: `${baseUrl}/api/trial-leads/${id}`,
              method: 'PUT',
              header: {
                'x-user-id': getUserId(),
                'content-type': 'application/json'
              },
              data: { status: 'LOST' }
            });

            wx.showToast({ title: '已标记' });
            this.refreshList();
          } catch (error) {
            wx.showToast({ title: '操作失败', icon: 'none' });
          }
        }
      }
    });
  },

  // 添加新线索
  onAddLead() {
    wx.navigateTo({
      url: '/pages/trial-lead-create/trial-lead-create'
    });
  },

  // 加载更多
  onLoadMore() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.setData({ loadingMore: true });
      this.loadLeads().then(() => {
        this.setData({ loadingMore: false });
      });
    }
  }
});
