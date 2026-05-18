// 添加备注
const { getBaseUrl, getUserId } = require('../../utils/user');

Page({
  data: {
    leadId: '',
    content: '',
    submitting: false,
    quickNotes: [
      '已电话联系',
      '家长表示有意向',
      '安排试课时间',
      '待进一步跟进',
      '学生年级较高',
      '需要个性化方案'
    ]
  },

  onLoad(options) {
    this.setData({ leadId: options.leadId });
  },

  onInputChange(e) {
    this.setData({ content: e.detail.value });
  },

  onQuickNote(e) {
    const note = e.currentTarget.dataset.note;
    this.setData({ content: note });
  },

  async onSubmit(e) {
    const content = e.detail.value.content || this.data.content;

    if (!content.trim()) {
      wx.showToast({ title: '请输入备注内容', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    try {
      const baseUrl = getBaseUrl();
      const noteItem = {
        type: 'followup',
        content,
        timestamp: new Date().toISOString()
      };

      await wx.request({
        url: `${baseUrl}/api/trial-leads/${this.data.leadId}`,
        method: 'PUT',
        header: {
          'x-user-id': getUserId(),
          'content-type': 'application/json'
        },
        data: {
          notes: [noteItem]
        }
      });

      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (error) {
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  onCancel() {
    wx.navigateBack();
  }
});
