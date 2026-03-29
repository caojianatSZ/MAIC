'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface StatsData {
  organizationId: string;
  organizationName: string;
  totalViews: number;
  totalCompletions: number;
  totalConversions: number;
  conversionRate: number;
  statsPerClassroom: Array<{
    classroomId: string;
    shareToken: string;
    subject: string | null;
    grade: string | null;
    views: number;
    completions: number;
    conversions: number;
    conversionRate: number;
  }>;
}

interface FunnelData {
  organizationId: string;
  organizationName: string;
  funnel: {
    stage1: { name: string; count: number; percentage: number };
    stage2: { name: string; count: number; percentage: number; rate: number };
    stage3: { name: string; count: number; percentage: number; rate: number };
  };
  stageToStage: {
    viewToCompletion: number;
    completionToConversion: number;
    viewToConversion: number;
  };
  averageWatchDuration: number;
}

interface Conversion {
  phone: string;
  createdAt: string;
  subject?: string;
  grade?: string;
}

export default function DashboardPage() {
  const params = useParams();
  const organizationId = params.organizationId as string;

  const [stats, setStats] = useState<StatsData | null>(null);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [recentConversions, setRecentConversions] = useState<Conversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // 并行获取所有数据
        const [statsRes, funnelRes] = await Promise.all([
          fetch(`/api/organizations/${organizationId}/stats`),
          fetch(`/api/organizations/${organizationId}/funnel`),
        ]);

        if (!statsRes.ok || !funnelRes.ok) {
          throw new Error('获取数据失败');
        }

        const [statsData, funnelData] = await Promise.all([
          statsRes.json(),
          funnelRes.json(),
        ]);

        if (statsData.success) {
          setStats(statsData);
        }

        if (funnelData.success) {
          setFunnel(funnelData);
        }

        // 获取最近的转化记录（从每个课堂的转化中获取最新的一些）
        if (statsData.success && statsData.statsPerClassroom) {
          const conversionsRes = await Promise.all(
            statsData.statsPerClassroom.map(async (classroom: any) => {
              const response = await fetch(
                `/api/organizations/${organizationId}/conversions?classroomId=${classroom.classroomId}&limit=5`
              );
              return response.json();
            })
          );

          // 合并所有转化记录并按时间排序
          const allConversions: Conversion[] = [];
          conversionsRes.forEach((data: any, index) => {
            if (data.success && data.conversions) {
              data.conversions.forEach((conv: any) => {
                allConversions.push({
                  ...conv,
                  subject: statsData.statsPerClassroom[index]?.subject,
                  grade: statsData.statsPerClassroom[index]?.grade,
                });
              });
            }
          });

          allConversions.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );

          setRecentConversions(allConversions.slice(0, 10));
        }
      } catch (err) {
        console.error('获取数据失败:', err);
        setError('加载数据失败，请刷新页面重试');
      } finally {
        setLoading(false);
      }
    }

    if (organizationId) {
      fetchData();
    }
  }, [organizationId]);

  // 遮掩手机号（只显示前3位和后4位）
  function maskPhone(phone: string): string {
    if (phone.length < 7) return phone;
    return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
  }

  // 格式化时间
  function formatTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h2 className="text-red-800 font-semibold mb-2">加载失败</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!stats || !funnel) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* 头部 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">数据看板</h1>
          <p className="text-gray-600">{stats.organizationName}</p>
        </div>

        {/* 关键指标卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* 浏览量 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-600 text-sm font-medium">总浏览量</h3>
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalViews}</p>
            <p className="text-xs text-gray-500 mt-1">唯一访客数</p>
          </div>

          {/* 完成量 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-600 text-sm font-medium">完成量</h3>
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalCompletions}</p>
            <p className="text-xs text-gray-500 mt-1">完成课程的用户</p>
          </div>

          {/* 转化量 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-600 text-sm font-medium">转化量</h3>
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.totalConversions}</p>
            <p className="text-xs text-gray-500 mt-1">获取的联系线索</p>
          </div>

          {/* 转化率 */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-600 text-sm font-medium">转化率</h3>
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.conversionRate}%</p>
            <p className="text-xs text-gray-500 mt-1">转化量 / 浏览量</p>
          </div>
        </div>

        {/* 转化漏斗 */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">转化漏斗</h2>

          <div className="space-y-4">
            {/* 浏览阶段 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">浏览</span>
                <span className="text-sm text-gray-600">{funnel.funnel.stage1.count} (100%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                  style={{ width: '100%' }}
                ></div>
              </div>
            </div>

            {/* 完成阶段 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">完成</span>
                <span className="text-sm text-gray-600">
                  {funnel.funnel.stage2.count} ({funnel.funnel.stage2.rate}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-green-600 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${funnel.funnel.stage2.percentage}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                完成率: {funnel.stageToStage.viewToCompletion}%
              </p>
            </div>

            {/* 转化阶段 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">转化</span>
                <span className="text-sm text-gray-600">
                  {funnel.funnel.stage3.count} ({funnel.funnel.stage3.rate}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div
                  className="bg-purple-600 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${funnel.funnel.stage3.percentage}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                转化率: {funnel.stageToStage.viewToConversion}%
              </p>
            </div>
          </div>

          {/* 平均观看时长 */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">平均观看时长</span>
              <span className="text-lg font-semibold text-gray-900">
                {Math.floor(funnel.averageWatchDuration / 60)}分{funnel.averageWatchDuration % 60}秒
              </span>
            </div>
          </div>
        </div>

        {/* 最近转化 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">最近转化</h2>

          {recentConversions.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-gray-500">暂无转化记录</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      手机号
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      课程
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      年级
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      转化时间
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {recentConversions.map((conversion, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {maskPhone(conversion.phone)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {conversion.subject || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {conversion.grade || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatTime(conversion.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
