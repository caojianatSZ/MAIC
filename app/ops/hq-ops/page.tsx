'use client'

import { useEffect, useState } from 'react'

interface OverviewStats {
  totalCities: number
  activeCities: number
  totalPartners: number
  totalTeachers: number
  totalLeads: number
  convertedLeads: number
  conversionRate: number
  totalRevenue: number
}

interface CityStats {
  id: string
  name: string
  stats: {
    leads: number
    converted: number
    bookings: number
    teachers: number
    revenue: number
    conversionRate: number
  }
}

export default function HqOpsPage() {
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [cities, setCities] = useState<CityStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [overviewRes, citiesRes] = await Promise.all([
        fetch('/api/hq-ops/overview'),
        fetch('/api/hq-ops/cities')
      ])

      const overviewData = await overviewRes.json()
      const citiesData = await citiesRes.json()

      setStats(overviewData.overview)
      setCities(citiesData.cities || [])
    } catch (error) {
      console.error('获取数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">加载中...</div>
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">总部运营工作台</h1>
        <p className="text-gray-500">全平台数据监控和管理</p>
      </div>

      {/* 关键指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="运营城市" value={stats?.activeCities || 0} total={stats?.totalCities || 0} />
        <StatCard label="城市合伙人" value={stats?.totalPartners || 0} />
        <StatCard label="在线老师" value={stats?.totalTeachers || 0} />
        <StatCard label="总收入" value={`¥${((stats?.totalRevenue || 0) / 100).toFixed(0)}`} />
      </div>

      {/* 转化漏斗 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">线索转化漏斗</h2>
        <div className="flex items-center justify-between">
          <FunnelStep label="新线索" count={stats?.totalLeads || 0} color="bg-blue-500" />
          <div className="h-1 flex-1 bg-gray-200 mx-2" />
          <FunnelStep label="已转化" count={stats?.convertedLeads || 0} color="bg-green-500" />
          <div className="ml-4 text-lg font-semibold">
            转化率: {stats?.conversionRate || 0}%
          </div>
        </div>
      </div>

      {/* 城市对比 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">城市数据对比</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">城市</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">线索</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">转化</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">转化率</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">老师</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">收入</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {cities.map((city) => (
                <tr key={city.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium">{city.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{city.stats.leads}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{city.stats.converted}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      city.stats.conversionRate >= 30 ? 'bg-green-100 text-green-800' :
                      city.stats.conversionRate >= 20 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {city.stats.conversionRate}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{city.stats.teachers}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    ¥{(city.stats.revenue / 100).toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">快捷操作</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickAction label="创建城市" href="/ops/hq-ops/cities/new" />
          <QuickAction label="收入分析" href="/ops/hq-ops/revenue" />
          <QuickAction label="老师管理" href="/ops/hq-ops/teachers" />
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, total }: { label: string; value: string | number; total?: number }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {total !== undefined && (
        <p className="mt-1 text-sm text-gray-500">总计 {total}</p>
      )}
    </div>
  )
}

function FunnelStep({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`${color} text-white rounded-full w-16 h-16 flex items-center justify-center text-xl font-bold`}>
        {count}
      </div>
      <p className="mt-2 text-sm text-gray-600">{label}</p>
    </div>
  )
}

function QuickAction({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      className="block text-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
    >
      {label}
    </a>
  )
}
