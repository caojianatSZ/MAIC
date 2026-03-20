'use client';

import { useState, FormEvent } from 'react';

interface RegisterFormData {
  name: string;
  phone: string;
  logo: string;
  wechatQrUrl: string;
}

interface ValidationError {
  name?: string;
  phone?: string;
  logo?: string;
  wechatQrUrl?: string;
}

export default function RegisterForm() {
  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    phone: '',
    logo: '',
    wechatQrUrl: '',
  });

  const [errors, setErrors] = useState<ValidationError>({});
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [apiError, setApiError] = useState('');

  const validateForm = (): boolean => {
    const newErrors: ValidationError = {};

    // 验证机构名称
    if (!formData.name.trim()) {
      newErrors.name = '机构名称不能为空';
    }

    // 验证手机号
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!formData.phone) {
      newErrors.phone = '手机号不能为空';
    } else if (!phoneRegex.test(formData.phone)) {
      newErrors.phone = '请输入有效的11位手机号';
    }

    // 验证Logo
    if (!formData.logo) {
      newErrors.logo = '请上传机构Logo';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件大小 (500KB = 500 * 1024 bytes)
    const maxSize = 500 * 1024;
    if (file.size > maxSize) {
      setErrors({ ...errors, logo: 'Logo文件大小不能超过500KB' });
      return;
    }

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      setErrors({ ...errors, logo: '请上传图片文件' });
      return;
    }

    // 创建预览
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setLogoPreview(base64String);
      setFormData({ ...formData, logo: base64String });
      setErrors({ ...errors, logo: undefined });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // 清除之前的错误和成功消息
    setApiError('');
    setSuccessMessage('');

    // 验证表单
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone,
          logo: formData.logo,
          wechatQrUrl: formData.wechatQrUrl || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '注册失败，请稍后重试');
      }

      // 注册成功
      setSuccessMessage(`注册成功！您的机构ID是: ${data.organization.id}`);

      // 重置表单
      setFormData({
        name: '',
        phone: '',
        logo: '',
        wechatQrUrl: '',
      });
      setLogoPreview('');
    } catch (error) {
      setApiError(error instanceof Error ? error.message : '注册失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* 机构名称 */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
          机构名称 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            errors.name ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="请输入机构名称"
        />
        {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
      </div>

      {/* 手机号 */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
          手机号 <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          id="phone"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
            errors.phone ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="请输入11位手机号"
          maxLength={11}
        />
        {errors.phone && <p className="mt-1 text-sm text-red-500">{errors.phone}</p>}
      </div>

      {/* 机构Logo */}
      <div>
        <label htmlFor="logo" className="block text-sm font-medium text-gray-700 mb-2">
          机构Logo <span className="text-red-500">*</span>
        </label>
        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-gray-400 transition-colors">
          <div className="space-y-2 text-center">
            {logoPreview ? (
              <div className="space-y-2">
                <img
                  src={logoPreview}
                  alt="Logo预览"
                  className="mx-auto h-32 w-32 object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    setLogoPreview('');
                    setFormData({ ...formData, logo: '' });
                  }}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  移除图片
                </button>
              </div>
            ) : (
              <div>
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="flex text-sm text-gray-600 justify-center">
                  <label
                    htmlFor="logo"
                    className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none"
                  >
                    <span>上传图片</span>
                    <input
                      id="logo"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleLogoChange}
                    />
                  </label>
                  <p className="pl-1">或拖拽图片到此处</p>
                </div>
                <p className="text-xs text-gray-500">PNG, JPG, GIF 最大500KB</p>
              </div>
            )}
          </div>
        </div>
        {errors.logo && <p className="mt-1 text-sm text-red-500">{errors.logo}</p>}
      </div>

      {/* 微信二维码 (可选) */}
      <div>
        <label htmlFor="wechatQrUrl" className="block text-sm font-medium text-gray-700 mb-2">
          微信二维码 URL (可选)
        </label>
        <input
          type="url"
          id="wechatQrUrl"
          value={formData.wechatQrUrl}
          onChange={(e) => setFormData({ ...formData, wechatQrUrl: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="请输入微信二维码图片URL"
        />
        <p className="mt-1 text-sm text-gray-500">如果您有微信二维码，可以填写URL</p>
      </div>

      {/* API错误消息 */}
      {apiError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{apiError}</p>
        </div>
      )}

      {/* 成功消息 */}
      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-600">{successMessage}</p>
        </div>
      )}

      {/* 提交按钮 */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
      >
        {isSubmitting ? '注册中...' : '注册'}
      </button>
    </form>
  );
}
