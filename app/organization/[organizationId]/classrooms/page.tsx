'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  BookOpen,
  Plus,
  Share2,
  Eye,
  Users,
  Phone,
  Copy,
  ExternalLink,
  ArrowLeft,
  TrendingUp,
  Clock,
  Edit2,
  Check,
} from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  primaryColor?: string;
  secondaryColor?: string;
}

interface ClassroomStats {
  id: string;
  classroomId: string;
  shareToken: string;
  subject?: string;
  grade?: string;
  subjectCategory?: string; // 科目分类
  views: number;
  conversions: number;
  conversionRate: number;
  lastView?: string;
  knowledgePoints?: Array<{
    uri: string;
    name: string;
    isPrimary: boolean;
    relevanceScore: number;
  }>;
}

export default function OrganizationClassroomsPage() {
  const params = useParams();
  const router = useRouter();
  const organizationId = params?.organizationId as string;

  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [classrooms, setClassrooms] = useState<ClassroomStats[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editSubjectCategory, setEditSubjectCategory] = useState('');
  const [editGrade, setEditGrade] = useState('');
  const [editKnowledgePoints, setEditKnowledgePoints] = useState<string>('');

  useEffect(() => {
    async function loadData() {
      try {
        // Load organization branding
        const orgRes = await fetch(`/api/organizations/${organizationId}/branding`);
        if (orgRes.ok) {
          const orgData = await orgRes.json();
          if (orgData.success) {
            setOrganization({
              id: orgData.organizationId,
              name: orgData.organizationName,
              primaryColor: orgData.primaryColor,
              secondaryColor: orgData.secondaryColor,
            });
          }
        }

        // Load classroom stats
        const statsRes = await fetch(`/api/organizations/${organizationId}/stats`);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          if (statsData.success) {
            const classroomStats = statsData.statsPerClassroom.map((stat: any) => ({
              classroomId: stat.classroomId,
              shareToken: stat.shareToken,
              subject: stat.subject,
              grade: stat.grade,
              subjectCategory: stat.subjectCategory,
              views: stat.views,
              conversions: stat.conversions,
              conversionRate: stat.conversionRate,
              knowledgePoints: stat.knowledgePoints || [],
            }));
            setClassrooms(classroomStats);
          }
        }
      } catch (error) {
        console.error('Load data error:', error);
        toast.error('加载数据失败');
      } finally {
        setLoading(false);
      }
    }

    if (organizationId) {
      loadData();
    }
  }, [organizationId]);

  const copyShareLink = (shareToken: string) => {
    const shareUrl = `${window.location.origin}/share/${shareToken}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success('分享链接已复制到剪贴板');
  };

  const startEditing = (classroom: ClassroomStats) => {
    setEditingId(classroom.shareToken);
    setEditSubject(classroom.subject || '');
    setEditSubjectCategory(classroom.subjectCategory || '');
    setEditGrade(classroom.grade || '');
    // 将知识点数组转换为逗号分隔的字符串
    setEditKnowledgePoints(
      classroom.knowledgePoints?.map((kp) => kp.name).join(', ') || ''
    );
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditSubject('');
    setEditSubjectCategory('');
    setEditGrade('');
    setEditKnowledgePoints('');
  };

  const saveEdit = async (shareToken: string) => {
    try {
      // 解析知识点字符串为数组
      const knowledgePointsArray = editKnowledgePoints
        .split(/[,，]/) // 支持中英文逗号
        .map((kp) => kp.trim())
        .filter((kp) => kp.length > 0);

      // 构建知识点对象数组
      const knowledgePoints = knowledgePointsArray.map((name, idx) => ({
        uri: `temp:edu/kg/custom:${encodeURIComponent(name)}`,
        name,
        isPrimary: idx === 0, // 第一个作为主要知识点
        relevanceScore: 100 - idx * 10, // 递减的相关度分数
      }));

      const res = await fetch(`/api/organization-classrooms/${shareToken}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: editSubject,
          subjectCategory: editSubjectCategory || null,
          grade: editGrade || null,
          knowledgePoints: knowledgePoints.length > 0 ? knowledgePoints : null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          // Update local state
          setClassrooms(prev => prev.map(c =>
            c.shareToken === shareToken ? {
              ...c,
              subject: data.data.subject,
              subjectCategory: data.data.subjectCategory,
              grade: data.data.grade,
              knowledgePoints: knowledgePoints.length > 0 ? knowledgePoints : c.knowledgePoints,
            } : c
          ));
          toast.success('课程信息已更新');
          cancelEditing();
        }
      }
    } catch (error) {
      console.error('Update error:', error);
      toast.error('更新失败');
    }
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => router.back()}
                size="sm"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {organization.name} - 课程管理
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  管理您的课程并创建分享链接
                </p>
              </div>
            </div>
            <Button
              onClick={() => router.push('/')}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              生成新课程
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {classrooms.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <BookOpen className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                还没有课程
              </h3>
              <p className="text-gray-500 mb-6">
                生成您的第一个课程并创建分享链接
              </p>
              <Button onClick={() => router.push('/')}>
                <Plus className="w-4 h-4 mr-2" />
                生成新课程
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {classrooms.map((classroom) => (
              <Card key={classroom.shareToken} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {editingId === classroom.shareToken ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editSubject}
                            onChange={(e) => setEditSubject(e.target.value)}
                            placeholder="课程名称"
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            autoFocus
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={editSubjectCategory}
                              onChange={(e) => setEditSubjectCategory(e.target.value)}
                              placeholder="科目（如：数学、语文）"
                              className="w-full px-3 py-2 border rounded-md text-sm"
                            />
                            <input
                              type="text"
                              value={editGrade}
                              onChange={(e) => setEditGrade(e.target.value)}
                              placeholder="年级（如：三年级）"
                              className="w-full px-3 py-2 border rounded-md text-sm"
                            />
                          </div>
                          <input
                            type="text"
                            value={editKnowledgePoints}
                            onChange={(e) => setEditKnowledgePoints(e.target.value)}
                            placeholder="知识点（用逗号分隔，如：分数, 加法）"
                            className="w-full px-3 py-2 border rounded-md text-sm"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => saveEdit(classroom.shareToken)}>
                              <Check className="w-4 h-4 mr-1" />
                              保存
                            </Button>
                            <Button size="sm" variant="outline" onClick={cancelEditing}>
                              取消
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <CardTitle
                            className="flex items-center gap-2 cursor-pointer hover:text-blue-600 transition-colors"
                            onClick={() =>
                              window.open(
                                `${window.location.origin}/share/${classroom.shareToken}`,
                                '_blank'
                              )
                            }
                          >
                            <BookOpen className="w-5 h-5" />
                            {classroom.subject || '未命名课程'}
                            {classroom.grade && (
                              <span className="text-sm font-normal text-gray-500">
                                ({classroom.grade})
                              </span>
                            )}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            分享令牌: {classroom.shareToken}
                          </CardDescription>
                          {/* 知识点标签 */}
                          {classroom.knowledgePoints && classroom.knowledgePoints.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {classroom.knowledgePoints.slice(0, 5).map((kp, idx) => (
                                <span
                                  key={idx}
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    kp.isPrimary
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}
                                >
                                  {kp.name}
                                  {kp.isPrimary && (
                                    <span className="ml-1 text-blue-600">★</span>
                                  )}
                                </span>
                              ))}
                              {classroom.knowledgePoints.length > 5 && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-500">
                                  +{classroom.knowledgePoints.length - 5}
                                </span>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    {editingId !== classroom.shareToken && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEditing(classroom)}
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          编辑
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyShareLink(classroom.shareToken)}
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          复制链接
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            window.open(
                              `${window.location.origin}/share/${classroom.shareToken}`,
                              '_blank'
                            )
                          }
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          预览
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* 浏览量 */}
                    <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Eye className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">浏览量</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {classroom.views}
                        </p>
                      </div>
                    </div>

                    {/* 转化量 */}
                    <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Phone className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">转化量</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {classroom.conversions}
                        </p>
                      </div>
                    </div>

                    {/* 转化率 */}
                    <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">转化率</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {classroom.conversionRate.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    {/* 最近访问 */}
                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <Clock className="w-5 h-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">最近访问</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {classroom.lastView || '暂无'}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
