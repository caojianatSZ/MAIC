// 试课线索详情
const { getBaseUrl, getUserId } = require('../../utils/user');
const { formatDate } = require('../../utils/config');

Page({
  data: {
    leadId: '',
    lead: null,
    loading: true,
    statusLabels: {
      NEW: '新线索',
      CONTACTED: '已联系',
      SCHEDULED: '已预约',
      COMPLETED: '已完成',
      CONVERTED: '已转化',
      LOST: '已流失'
    }
  },

  onLoad(options) {
    this.setData({ leadId: options.id });
    this.loadLeadDetail();
  },

  onShow() {
    // 从其他页面返回时刷新
    if (this.data.lead) {
      this.loadLeadDetail();
    }
  },

  // 加载线索详情
  async loadLeadDetail() {
    this.setData({ loading: true });

    try {
      const baseUrl = getBaseUrl();
      const response = await wx.request({
        url: `${baseUrl}/api/trial-leads/${this.data.leadId}`,
        method: 'GET',
        header: { 'x-user-id': getUserId() }
      });

      if (response.statusCode === 200) {
        const lead = {
          ...response.data,
          createdAt: formatDate(response.data.createdAt),
          scheduledTime: response.data.scheduledTime ? formatDate(response.data.scheduledTime) : null
        };
        this.setData({ lead, loading: false });
      }
    } catch (error) {
      console.error('加载详情失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  // 拨打电话
  onCall() {
    if (this.data.lead?.phoneNumber) {
      wx.makePhoneCall({
        phoneNumber: this.data.lead.phoneNumber
      });
    }
  },

  // 标记已联系
  async onContact() {
    await this.updateStatus('CONTACTED', '已标记为已联系');
  },

  // 预约试课
  onBookTrial() {
    wx.navigateTo({
      url: `/pages/booking-create/booking-create?leadId=${this.data.leadId}`
    });
  },

  // 完成试课
  async onCompleteTrial() {
    wx.showModal({
      title: '完成试课',
      content: '请确认试课已完成',
      success: async (res) => {
        if (res.confirm) {
          await this.updateStatus('COMPLETED', '试课已完成');
        }
      }
    });
  },

  // 取消试课
  async onCancelTrial() {
    wx.showModal({
      title: '取消试课',
      content: '确定要取消试课预约吗？',
      success: async (res) => {
        if (res.confirm) {
          // 恢复到已联系状态
          await this.updateStatus('CONTACTED', '试课已取消');
        }
      }
    });
  },

  // 转化成交
  onConvert() {
    wx.navigateTo({
      url: `/pages/trial-lead-convert/trial-lead-convert?id=${this.data.leadId}`
    });
  },

  // 标记流失
  async onMarkLost() {
    wx.showModal({
      title: '标记流失',
      content: '标记为流失后，线索将不再显示在活跃列表中',
      confirmText: '确认',
      confirmColor: '#EF4444',
      success: async (res) => {
        if (res.confirm) {
          await this.updateStatus('LOST', '已标记为流失');
        }
      }
    });
  },

  // 添加备注
  onAddNote() {
    wx.navigateTo({
      url: `/pages/note-add/note-add?leadId=${this.data.leadId}`
    });
  },

  // 删除线索
  async onDelete() {
    if (this.data.lead?.status !== 'NEW') {
      wx.showToast({
        title: '只能删除新线索',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '删除线索',
      content: '确定要删除这条线索吗？此操作不可恢复',
      confirmText: '删除',
      confirmColor: '#EF4444',
      success: async (res) => {
        if (res.confirm) {
          try {
            const baseUrl = getBaseUrl();
            await wx.request({
              url: `${baseUrl}/api/trial-leads/${this.data.leadId}`,
              method: 'DELETE',
              header: { 'x-user-id': getUserId() }
            });

            wx.showToast({ title: '已删除' });
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          } catch (error) {
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 更新状态
  async updateStatus(status, successMsg) {
    try {
      const baseUrl = getBaseUrl();
      await wx.request({
        url: `${baseUrl}/api/trial-leads/${this.data.leadId}`,
        method: 'PUT',
        header: {
          'x-user-id': getUserId(),
          'content-type': 'application/json'
        },
        data: { status }
      });

      wx.showToast({
        title: successMsg,
        icon: 'success'
      });
      this.loadLeadDetail();
    } catch (error) {
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
  },

  // 编辑信息
  onEditInfo() {
    wx.navigateTo({
      url: `/pages/trial-lead-edit/trial-lead-edit?id=${this.data.leadId}`
    });
  }
});
