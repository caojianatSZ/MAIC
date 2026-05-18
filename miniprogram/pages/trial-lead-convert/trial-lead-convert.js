// 试课线索转化
const { getBaseUrl, getUserId } = require('../../utils/user');

Page({
  data: {
    leadId: '',
    lead: null,
    loading: true,
    submitting: false,
    convertType: 'new',
    convertTypes: [
      { value: 'new', label: '新学员' },
      { value: 'returning', label: '续费学员' }
    ],
    packages: [
      { id: '1', name: '体验套餐', price: 199, description: '2课时体验包' },
      { id: '2', name: '基础套餐', price: 2980, description: '10课时' },
      { id: '3', name: '标准套餐', price: 5680, description: '20课时 + 赠送2课时' },
      { id: '4', name: '高级套餐', price: 10800, description: '40课时 + 赠送5课时' }
    ],
    packageId: '2',
    paymentMethod: 'wechat',
    paymentMethods: [
      { value: 'wechat', label: '微信支付' },
      { value: 'alipay', label: '支付宝' },
      { value: 'bank', label: '银行转账' },
      { value: 'cash', label: '现金' }
    ]
  },

  onLoad(options) {
    this.setData({ leadId: options.id });
    this.loadLeadDetail();
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
        this.setData({ lead: response.data, loading: false });
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

  // 转化类型变化
  onConvertTypeChange(e) {
    this.setData({ convertType: e.detail.value });
  },

  // 套餐选择
  onPackageSelect(e) {
    this.setData({ packageId: e.currentTarget.dataset.id });
  },

  // 确认转化
  async onConvert(e) {
    const formData = e.detail.value;

    // 验证
    if (!formData.paymentMethod) {
      wx.showToast({ title: '请选择支付方式', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    try {
      const baseUrl = getBaseUrl();

      // 1. 转化线索
      await wx.request({
        url: `${baseUrl}/api/trial-leads/${this.data.leadId}/convert`,
        method: 'POST',
        header: {
          'x-user-id': getUserId(),
          'content-type': 'application/json'
        },
        data: {
          createStudent: this.data.convertType === 'new'
        }
      });

      // 2. 创建支付记录
      const selectedPackage = this.data.packages.find(p => p.id === this.data.packageId);
      await wx.request({
        url: `${baseUrl}/api/payments`,
        method: 'POST',
        header: {
          'x-user-id': getUserId(),
          'content-type': 'application/json'
        },
        data: {
          studentId: this.data.lead.convertedStudentId || this.data.lead.id,
          amount: selectedPackage.price * 100, // 转换为分
          packageType: selectedPackage.name,
          packageDetail: {
            lessons: selectedPackage.description,
            leadId: this.data.leadId
          },
          status: formData.paymentStatus,
          paymentMethod: formData.paymentMethod,
          notes: formData.notes
        }
      });

      wx.showToast({
        title: '转化成功',
        icon: 'success'
      });

      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (error) {
      console.error('转化失败:', error);
      wx.showToast({
        title: error.message || '转化失败',
        icon: 'none'
      });
    } finally {
      this.setData({ submitting: false });
    }
  },

  // 取消
  onCancel() {
    wx.navigateBack();
  }
});
