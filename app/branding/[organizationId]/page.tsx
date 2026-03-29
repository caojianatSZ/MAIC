'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Palette, Save, ArrowLeft, BookOpen } from 'lucide-react';

interface BrandingSettings {
  primaryColor: string;
  secondaryColor: string;
}

interface Organization {
  id: string;
  name: string;
}

export default function BrandingPage() {
  const params = useParams();
  const router = useRouter();
  const organizationId = params?.organizationId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [settings, setSettings] = useState<BrandingSettings>({
    primaryColor: '#3B82F6',
    secondaryColor: '#EFF6FF',
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch(`/api/organizations/${organizationId}/branding`);
        if (!res.ok) {
          throw new Error('加载失败');
        }

        const json = await res.json();
        if (!json.success) {
          throw new Error(json.message || '加载失败');
        }

        setOrganization({
          id: json.organizationId,
          name: json.organizationName,
        });
        setSettings({
          primaryColor: json.primaryColor,
          secondaryColor: json.secondaryColor,
        });
      } catch (error) {
        console.error('Load settings error:', error);
        toast.error('加载品牌设置失败');
      } finally {
        setLoading(false);
      }
    }

    if (organizationId) {
      loadSettings();
    }
  }, [organizationId]);

  const handleSave = async () => {
    setSaving(true);

    try {
      const res = await fetch(`/api/organizations/${organizationId}/branding`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || '保存失败');
      }

      toast.success('品牌设置保存成功');
    } catch (error) {
      console.error('Save settings error:', error);
      toast.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleColorChange = (color: string, field: 'primaryColor' | 'secondaryColor') => {
    // 确保颜色值以 # 开头
    const normalizedColor = color.startsWith('#') ? color : `#${color}`;
    setSettings(prev => ({ ...prev, [field]: normalizedColor }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>加载中...</p>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-500">机构不存在</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={() => router.back()}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/organization/${organizationId}/classrooms`)}
            >
              <BookOpen className="w-4 h-4 mr-2" />
              课程管理
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Palette className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">品牌设置</h1>
              <p className="text-sm text-gray-600">{organization.name}</p>
            </div>
          </div>
        </div>

        {/* Branding Form */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Color Settings */}
          <Card>
            <CardHeader>
              <CardTitle>颜色设置</CardTitle>
              <CardDescription>
                自定义您机构的品牌颜色
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Primary Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  主颜色
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.primaryColor}
                    onChange={(e) => handleColorChange(e.target.value, 'primaryColor')}
                    className="w-16 h-16 rounded-lg border-2 border-gray-200 cursor-pointer"
                  />
                  <div className="flex-1">
                    <Input
                      type="text"
                      value={settings.primaryColor}
                      onChange={(e) => handleColorChange(e.target.value, 'primaryColor')}
                      placeholder="#3B82F6"
                      maxLength={7}
                      className="font-mono"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      用于按钮、链接等主要元素
                    </p>
                  </div>
                </div>
              </div>

              {/* Secondary Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  次颜色
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={settings.secondaryColor}
                    onChange={(e) => handleColorChange(e.target.value, 'secondaryColor')}
                    className="w-16 h-16 rounded-lg border-2 border-gray-200 cursor-pointer"
                  />
                  <div className="flex-1">
                    <Input
                      type="text"
                      value={settings.secondaryColor}
                      onChange={(e) => handleColorChange(e.target.value, 'secondaryColor')}
                      placeholder="#EFF6FF"
                      maxLength={7}
                      className="font-mono"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      用于背景等次要元素
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader>
              <CardTitle>实时预览</CardTitle>
              <CardDescription>
                查看您的品牌颜色在实际应用中的效果
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="space-y-4 p-6 rounded-lg border"
                style={{
                  backgroundColor: settings.secondaryColor,
                  borderColor: settings.primaryColor,
                }}
              >
                {/* Header Preview */}
                <div className="flex items-center gap-3 p-3 bg-white rounded-lg border-b-2">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: settings.primaryColor }}
                  >
                    {organization.name.charAt(0)}
                  </div>
                  <span className="font-semibold text-lg">{organization.name}</span>
                </div>

                {/* Button Preview */}
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">按钮样式:</p>
                  <div className="flex gap-3 flex-wrap">
                    <Button
                      style={{
                        backgroundColor: settings.primaryColor,
                        color: '#FFFFFF',
                      }}
                    >
                      主要按钮
                    </Button>
                    <Button
                      variant="outline"
                      style={{
                        borderColor: settings.primaryColor,
                        color: settings.primaryColor,
                      }}
                    >
                      次要按钮
                    </Button>
                  </div>
                </div>

                {/* Link Preview */}
                <div className="pt-3 border-t">
                  <p className="text-sm text-gray-600">链接样式:</p>
                  <a
                    href="#"
                    className="text-sm font-medium mt-2 inline-block"
                    style={{ color: settings.primaryColor }}
                    onClick={(e) => e.preventDefault()}
                  >
                    这是一个链接示例 →
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => router.back()}
            disabled={saving}
          >
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2"
          >
            {saving ? (
              <>保存中...</>
            ) : (
              <>
                <Save className="w-4 h-4" />
                保存设置
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
