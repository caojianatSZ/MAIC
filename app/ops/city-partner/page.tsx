'use client'

import { useEffect, useState } from 'react'

interface TodoItem {
  id: string
  type: string
  title: string
  count: number
  priority: string
  items: any[]
}

interface TodoSummary {
  todos: TodoItem[]
  summary: {
    total: number
    highPriority: number
  }
}

interface FunnelData {
  funnel: Array<{ stage: string; count: number; status: string }>
  summary: {
    totalLeads: number
    convertedLeads: number
    conversionRate: number
    attendanceRate: number
  }
}

export default function CityPartnerPage() {
  const [todos, setTodos] = useState<TodoSummary | null>(null)
  const [funnel, setFunnel] = useState<FunnelData | null>(null)
  const [loading, setLoading] = useState(true)

  // 默认使用测试数据（西安合伙人）
  const cityPartnerId = 'partner_西安_test'

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const [todosRes, funnelRes] = await Promise.all([
        fetch(`/api/city-partner/todos?cityPartnerId=${cityPartnerId}`),
        fetch(`/api/city-partner/leads-funnel?cityPartnerId=${cityPartnerId}`)
      ])

      const todosData = await todosRes.json()
      const funnelData = await funnelRes.json()

      setTodos(todosData)
      setFunnel(funnelData)
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
        <h1 className="text-2xl font-bold text-gray-900">城市合伙人工作台</h1>
        <p className="text-gray-500">线索管理和转化追踪</p>
      </div>

      {/* 关键指标 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          label="今日待办"
          value={todos?.summary.total || 0}
          highlight={todos?.summary.highPriority || 0}
          highlightLabel="高优先"
        />
        <MetricCard
          label="线索转化率"
          value={`${funnel?.summary.conversionRate || 0}%`}
        />
        <MetricCard
          label="试课到场率"
          value={`${funnel?.summary.attendanceRate || 0}%`}
        />
        <MetricCard
          label="总线索数"
          value={funnel?.summary.totalLeads || 0}
        />
      </div>

      {/* 今日待办 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">今日待办</h2>
        </div>
        <div className="p-6 space-y-4">
          {todos?.todos.map((todo) => (
            <TodoGroup key={todo.type} todo={todo} />
          ))}
        </div>
      </div>

      {/* 线索漏斗 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">线索转化漏斗</h2>
        <div className="flex items-center space-x-2">
          {funnel?.funnel.map((step, index) => (
            <div key={step.status} className="flex items-center">
              <FunnelBar stage={step.stage} count={step.count} />
              {index < funnel.funnel.length - 1 && (
                <div className="w-8 h-1 bg-gray-200 mx-2" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  highlight,
  highlightLabel
}: {
  label: string
  value: string | number
  highlight?: number
  highlightLabel?: string
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {highlight !== undefined && highlight > 0 && (
        <p className="mt-1 text-sm text-red-600">
          {highlightLabel}: {highlight}
        </p>
      )}
    </div>
  )
}

function TodoGroup({ todo }: { todo: TodoItem }) {
  const priorityColors = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <h3 className="font-medium">{todo.title}</h3>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityColors[todo.priority as keyof typeof priorityColors]}`}>
            {todo.count}
          </span>
        </div>
      </div>
      <div className="space-y-2">
        {todo.items.slice(0, 3).map((item, index) => (
          <div key={index} className="text-sm text-gray-600 flex justify-between">
            <span>{item.studentName || item.name || item.title || '待处理项'}</span>
            {item.phoneNumber && (
              <span className="text-gray-400">{item.phoneNumber}</span>
            )}
          </div>
        ))}
        {todo.items.length > 3 && (
          <p className="text-sm text-gray-400">还有 {todo.items.length - 3} 项...</p>
        )}
      </div>
    </div>
  )
}

function FunnelBar({ stage, count }: { stage: string; count: number }) {
  const widths: Record<string, number> = {
    '新线索': 100,
    '已联系': 80,
    '已试课': 60,
    '已转化': 40,
    '流失': 30
  }

  const colors: Record<string, string> = {
    '新线索': 'bg-blue-500',
    '已联系': 'bg-yellow-500',
    '已试课': 'bg-purple-500',
    '已转化': 'bg-green-500',
    '流失': 'bg-gray-400'
  }

  return (
    <div className="flex flex-col items-center">
      <div
        className={`${colors[stage] || 'bg-gray-500'} text-white rounded-t-lg py-4 px-6 text-center`}
        style={{ width: `${widths[stage] || 50}px` }}
      >
        <p className="text-2xl font-bold">{count}</p>
        <p className="text-xs mt-1">{stage}</p>
      </div>
    </div>
  )
}
