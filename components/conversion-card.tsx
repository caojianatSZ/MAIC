'use client';

import { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ConversionCardProps {
  organizationId: string;
  classroomId: string;
  shareToken: string;
}

export function ConversionCard({ organizationId: _organizationId, classroomId: _classroomId, shareToken }: ConversionCardProps) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Check if already submitted
  useEffect(() => {
    const storageKey = `submitted_${shareToken}`;
    const submitted = localStorage.getItem(storageKey);
    if (submitted) {
      setHasSubmitted(true);
    }
  }, [shareToken]);

  const validatePhone = (phone: string): boolean => {
    return /^[1][3-9]\d{9}$/.test(phone);
  };

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();

    // Validate phone
    if (!validatePhone(phone)) {
      setMessage({ type: 'error', text: '请输入正确的手机号' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/convert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shareToken,
          phone,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Mark as submitted in localStorage
        const storageKey = `submitted_${shareToken}`;
        localStorage.setItem(storageKey, new Date().toISOString());
        setHasSubmitted(true);
        setMessage({ type: 'success', text: data.message || '提交成功！我们会尽快联系您' });
        setPhone('');
      } else {
        setMessage({ type: 'error', text: data.message || '提交失败，请稍后重试' });
      }
    } catch (error) {
      console.error('Submission error:', error);
      setMessage({ type: 'error', text: '网络错误，请稍后重试' });
    } finally {
      setLoading(false);
    }
  };

  if (hasSubmitted) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-green-50 border-t border-green-200 p-4 shadow-lg z-50">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-green-800 font-medium">您已提交过信息，我们会尽快联系您！</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-50">
      <div className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex-1 w-full">
              <Input
                type="tel"
                placeholder="请输入手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={11}
                disabled={loading}
                className="text-lg"
              />
            </div>
            <Button
              type="submit"
              disabled={loading || !phone}
              size="lg"
              className="w-full sm:w-auto whitespace-nowrap"
              style={{
                backgroundColor: 'var(--brand-primary, #3B82F6)',
                color: '#FFFFFF',
              }}
              // 移除默认样式以应用品牌颜色
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              {loading ? '提交中...' : '立即获取'}
            </Button>
          </div>

          {message && (
            <div
              className={`text-sm p-2 rounded-md ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
            <Shield className="w-3 h-3" />
            <span>您的信息仅用于联系，不会泄露</span>
          </div>
        </form>
      </div>
    </div>
  );
}
