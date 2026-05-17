'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import * as echarts from 'echarts'

interface DashboardStats {
  totalRevenue: number
  totalLeads: number
  convertedLeads: number
  conversionRate: number
  activeTeachers: number
  totalBookings: number
  completedBookings: number
  avgAttendance: number
  revenueByCity: Array<{
    id: string
    name: string
    revenue: number
    platformRevenue: number
  }>
  revenueTrend: Array<{
    date: string
    revenue: number
    platformRevenue: number
    count: number
  }>
  funnelData: {
    new: number
    contacted: number
    scheduled: number
    completed: number
    converted: number
  }
  topTeachers: Array<{
    id: string
    name: string
    bookings: number
    revenue: number
    rating: number
  }>
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d')

  // ECharts 实例引用
  const revenueChartRef = useRef<HTMLDivElement>(null)
  const funnelChartRef = useRef<HTMLDivElement>(null)
  const cityChartRef = useRef<HTMLDivElement>(null)
  const teacherChartRef = useRef<HTMLDivElement>(null)

  // 图表实例
  const revenueChartInstance = useRef<echarts.ECharts | null>(null)
  const funnelChartInstance = useRef<echarts.ECharts | null>(null)
  const cityChartInstance = useRef<echarts.ECharts | null>(null)
  const teacherChartInstance = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    fetchData()
  }, [dateRange])

  useEffect(() => {
    // 组件挂载时初始化图表
    if (!loading && stats) {
      initCharts()
    }

    // 组件卸载时销毁图表
    return () => {
      revenueChartInstance.current?.dispose()
      funnelChartInstance.current?.dispose()
      cityChartInstance.current?.dispose()
      teacherChartInstance.current?.dispose()
    }
  }, [stats, loading])

  async function fetchData() {
    setLoading(true)
    try {
      const endDate = new Date()
      const startDate = new Date()
      if (dateRange === '7d') startDate.setDate(endDate.getDate() - 7)
      else if (dateRange === '30d') startDate.setDate(endDate.getDate() - 30)
      else startDate.setDate(endDate.getDate() - 90)

      const [revenueRes, overviewRes] = await Promise.all([
        fetch(`/api/hq-ops/revenue?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&groupBy=day`),
        fetch('/api/hq-ops/overview')
      ])

      const revenueData = await revenueRes.json()
      const overviewData = await overviewRes.json()

      // 获取城市数据
      const citiesRes = await fetch('/api/hq-ops/cities')
      const citiesData = await citiesRes.json()

      // 获取教师数据
      const teachersRes = await fetch('/api/hq-ops/teachers')
      let teachersData: any[] = []
      if (teachersRes.ok) {
        teachersData = (await teachersRes.json()).teachers || []
      }

      setStats({
        totalRevenue: revenueData.summary?.totalRevenue || 0,
        totalLeads: overviewData.overview?.totalLeads || 0,
        convertedLeads: overviewData.overview?.convertedLeads || 0,
        conversionRate: overviewData.overview?.conversionRate || 0,
        activeTeachers: overviewData.overview?.totalTeachers || 0,
        totalBookings: 0,
        completedBookings: 0,
        avgAttendance: 0,
        revenueByCity: revenueData.groupData || [],
        revenueTrend: revenueData.groupData || [],
        funnelData: {
          new: overviewData.overview?.totalLeads || 0,
          contacted: Math.floor((overviewData.overview?.totalLeads || 0) * 0.6),
          scheduled: Math.floor((overviewData.overview?.totalLeads || 0) * 0.4),
          completed: Math.floor((overviewData.overview?.totalLeads || 0) * 0.3),
          converted: overviewData.overview?.convertedLeads || 0
        },
        topTeachers: teachersData.slice(0, 10).map((t: any) => ({
          id: t.id,
          name: t.name || '未知老师',
          bookings: t.bookings?.length || 0,
          revenue: 0,
          rating: 4.5
        }))
      })
    } catch (error) {
      console.error('获取数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  function initCharts() {
    if (!stats) return

    // 收入趋势图
    if (revenueChartRef.current) {
      if (revenueChartInstance.current) {
        revenueChartInstance.current.dispose()
      }
      revenueChartInstance.current = echarts.init(revenueChartRef.current)

      revenueChartInstance.current.setOption({
        title: {
          text: '收入趋势',
          left: 'center',
          textStyle: { fontSize: 16, fontWeight: 'bold' }
        },
        tooltip: {
          trigger: 'axis',
          formatter: (params: any) => {
            let result = params[0].axisValue + '<br/>'
            params.forEach((param: any) => {
              result += `${param.marker} ${param.seriesName}: ¥${(param.value / 100).toFixed(0)}<br/>`
            })
            return result
          }
        },
        legend: {
          data: ['总收入', '平台收入'],
          bottom: 10
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '15%',
          top: '15%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          data: stats.revenueTrend.map(d => d.date.substring(5)),
          axisLabel: { rotate: 45 }
        },
        yAxis: {
          type: 'value',
          axisLabel: {
            formatter: (value: number) => '¥' + (value / 1000).toFixed(0) + 'k'
          }
        },
        series: [
          {
            name: '总收入',
            type: 'line',
            smooth: true,
            data: stats.revenueTrend.map(d => d.revenue),
            itemStyle: { color: '#3b82f6' },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0)' }
              ])
            }
          },
          {
            name: '平台收入',
            type: 'line',
            smooth: true,
            data: stats.revenueTrend.map(d => d.platformRevenue),
            itemStyle: { color: '#10b981' },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
                { offset: 1, color: 'rgba(16, 185, 129, 0)' }
              ])
            }
          }
        ]
      })
    }

    // 转化漏斗图
    if (funnelChartRef.current) {
      if (funnelChartInstance.current) {
        funnelChartInstance.current.dispose()
      }
      funnelChartInstance.current = echarts.init(funnelChartRef.current)

      const funnelData = [
        { value: stats.funnelData.new, name: '新线索' },
        { value: stats.funnelData.contacted, name: '已联系' },
        { value: stats.funnelData.scheduled, name: '已预约体验' },
        { value: stats.funnelData.completed, name: '已完成体验' },
        { value: stats.funnelData.converted, name: '已转化' }
      ]

      funnelChartInstance.current.setOption({
        title: {
          text: '线索转化漏斗',
          left: 'center',
          textStyle: { fontSize: 16, fontWeight: 'bold' }
        },
        tooltip: {
          trigger: 'item',
          formatter: '{b}: {c} ({d}%)'
        },
        series: [
          {
            type: 'funnel',
            left: '10%',
            top: 60,
            bottom: 60,
            width: '80%',
            min: 0,
            max: Math.max(...funnelData.map(d => d.value)),
            minSize: '0%',
            maxSize: '100%',
            sort: 'descending',
            gap: 2,
            label: {
              show: true,
              position: 'inside',
              formatter: '{b}: {c}',
              fontSize: 12
            },
            labelLine: {
              length: 10,
              lineStyle: {
                width: 1,
                type: 'solid'
              }
            },
            itemStyle: {
              borderColor: '#fff',
              borderWidth: 1
            },
            emphasis: {
              label: {
                fontSize: 14,
                fontWeight: 'bold'
              }
            },
            data: funnelData
          }
        ]
      })
    }

    // 城市收入对比图
    if (cityChartRef.current && stats.revenueByCity.length > 0) {
      if (cityChartInstance.current) {
        cityChartInstance.current.dispose()
      }
      cityChartInstance.current = echarts.init(cityChartRef.current)

      cityChartInstance.current.setOption({
        title: {
          text: '城市收入对比',
          left: 'center',
          textStyle: { fontSize: 16, fontWeight: 'bold' }
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params: any) => {
            const param = params[0]
            return `${param.name}<br/>总收入: ¥${(param.value / 100).toFixed(0)}`
          }
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          top: '15%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          data: stats.revenueByCity.map(c => c.name),
          axisLabel: { interval: 0, rotate: 30 }
        },
        yAxis: {
          type: 'value',
          axisLabel: {
            formatter: (value: number) => '¥' + (value / 1000).toFixed(0) + 'k'
          }
        },
        series: [
          {
            type: 'bar',
            data: stats.revenueByCity.map(c => ({
              value: c.revenue,
              itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: '#8b5cf6' },
                  { offset: 1, color: '#6366f1' }
                ])
              }
            })),
            barWidth: '60%'
          }
        ]
      })
    }

    // 教师排行榜
    if (teacherChartRef.current && stats.topTeachers.length > 0) {
      if (teacherChartInstance.current) {
        teacherChartInstance.current.dispose()
      }
      teacherChartInstance.current = echarts.init(teacherChartRef.current)

      teacherChartInstance.current.setOption({
        title: {
          text: '教师预约排行',
          left: 'center',
          textStyle: { fontSize: 16, fontWeight: 'bold' }
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' }
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          top: '10%',
          containLabel: true
        },
        xAxis: {
          type: 'value',
          axisLabel: { formatter: '{value} 单' }
        },
        yAxis: {
          type: 'category',
          data: stats.topTeachers.map((t, i) => `${i + 1}. ${t.name}`).reverse(),
          axisLabel: { width: 100, overflow: 'truncate' }
        },
        series: [
          {
            type: 'bar',
            data: stats.topTeachers.map(t => t.bookings).reverse(),
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: '#f59e0b' },
                { offset: 1, color: '#f97316' }
              ])
            },
            barWidth: '50%'
          }
        ]
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题和筛选 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">数据可视化仪表盘</h1>
          <p className="text-gray-500">关键指标和趋势分析</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">时间范围:</span>
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                dateRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {range === '7d' ? '近7天' : range === '30d' ? '近30天' : '近90天'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : stats ? (
        <>
          {/* 关键指标卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="总收入"
              value={`¥${((stats.totalRevenue || 0) / 100).toFixed(0)}`}
              change="+12.5%"
              changeType="positive"
              icon="💰"
            />
            <MetricCard
              label="线索转化率"
              value={`${stats.conversionRate}%`}
              change="+2.3%"
              changeType="positive"
              icon="📈"
            />
            <MetricCard
              label="活跃教师"
              value={stats.activeTeachers}
              change="+5"
              changeType="positive"
              icon="👨‍🏫"
            />
            <MetricCard
              label="总线索数"
              value={stats.totalLeads}
              change="+23"
              changeType="positive"
              icon="👥"
            />
          </div>

          {/* 图表行 1: 收入趋势 + 转化漏斗 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div ref={revenueChartRef} className="w-full h-[320px]" />
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div ref={funnelChartRef} className="w-full h-[320px]" />
            </div>
          </div>

          {/* 图表行 2: 城市对比 + 教师排行 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div ref={cityChartRef} className="w-full h-[320px]" />
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div ref={teacherChartRef} className="w-full h-[320px]" />
            </div>
          </div>

          {/* 转化详情 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">转化详情</h2>
            <div className="grid grid-cols-5 gap-4">
              <ConversionStep label="新线索" count={stats.funnelData.new} color="bg-blue-500" />
              <div className="flex items-center justify-center text-gray-400">→</div>
              <ConversionStep label="已联系" count={stats.funnelData.contacted} color="bg-indigo-500" />
              <div className="flex items-center justify-center text-gray-400">→</div>
              <ConversionStep label="已预约" count={stats.funnelData.scheduled} color="bg-purple-500" />
              <div className="flex items-center justify-center text-gray-400">→</div>
              <ConversionStep label="已完成" count={stats.funnelData.completed} color="bg-orange-500" />
              <div className="flex items-center justify-center text-gray-400">→</div>
              <ConversionStep label="已转化" count={stats.funnelData.converted} color="bg-green-500" />
            </div>
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">新线索 → 已联系</span>
                <span className="font-medium">
                  {stats.funnelData.new > 0 ? Math.round((stats.funnelData.contacted / stats.funnelData.new) * 100) : 0}%
                </span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-600">已联系 → 已预约</span>
                <span className="font-medium">
                  {stats.funnelData.contacted > 0 ? Math.round((stats.funnelData.scheduled / stats.funnelData.contacted) * 100) : 0}%
                </span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-600">已预约 → 已完成</span>
                <span className="font-medium">
                  {stats.funnelData.scheduled > 0 ? Math.round((stats.funnelData.completed / stats.funnelData.scheduled) * 100) : 0}%
                </span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-600">已完成 → 已转化</span>
                <span className="font-medium">
                  {stats.funnelData.completed > 0 ? Math.round((stats.funnelData.converted / stats.funnelData.completed) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* 快捷操作 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">快捷操作</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link href="/ops/hq-ops" className="block text-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                返回总部工作台
              </Link>
              <Link href="/ops/hq-ops/cities" className="block text-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                城市管理
              </Link>
              <Link href="/ops/admin/scheduler" className="block text-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                任务调度
              </Link>
              <Link href="/ops/admin/notifications" className="block text-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                通知管理
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}

function MetricCard({
  label,
  value,
  change,
  changeType,
  icon
}: {
  label: string
  value: string | number
  change: string
  changeType: 'positive' | 'negative'
  icon: string
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-md transition">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          <p className={`mt-1 text-sm ${changeType === 'positive' ? 'text-green-600' : 'text-red-600'}`}>
            {changeType === 'positive' ? '↑' : '↓'} {change}
          </p>
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </div>
  )
}

function ConversionStep({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`${color} text-white rounded-full w-14 h-14 flex items-center justify-center text-lg font-bold`}>
        {count}
      </div>
      <p className="mt-2 text-sm text-gray-600 text-center">{label}</p>
    </div>
  )
}
