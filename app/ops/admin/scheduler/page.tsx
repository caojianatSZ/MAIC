'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface ScheduledTask {
  id: string
  name: string
  enabled: boolean
  schedule: string
  description: string
  lastRun?: string
  nextRun?: string
}

interface SchedulerStatus {
  running: boolean
  tasks: ScheduledTask[]
  presets: Array<{ name: string; expression: string }>
}

export default function SchedulerManagePage() {
  const [status, setStatus] = useState<SchedulerStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [triggering, setTriggering] = useState<string | null>(null)

  useEffect(() => {
    fetchStatus()
    // 每30秒刷新一次
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  async function fetchStatus() {
    try {
      const res = await fetch('/api/admin/scheduler')
      if (res.ok) {
        const data = await res.json()
        setStatus(data.data)
      }
    } catch (error) {
      console.error('获取调度器状态失败:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleTrigger(taskId: string) {
    setTriggering(taskId)
    try {
      const res = await fetch('/api/admin/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId })
      })

      if (res.ok) {
        fetchStatus()
        alert('任务已触发')
      }
    } catch (error) {
      console.error('触发任务失败:', error)
      alert('触发任务失败')
    } finally {
      setTriggering(null)
    }
  }

  async function handleToggle(taskId: string, enabled: boolean) {
    try {
      const res = await fetch('/api/admin/scheduler', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, enabled })
      })

      if (res.ok) {
        fetchStatus()
      }
    } catch (error) {
      console.error('切换任务状态失败:', error)
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">任务调度管理</h1>
          <p className="text-gray-500">管理系统定时任务</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`w-3 h-3 rounded-full ${status?.running ? 'bg-green-500' : 'bg-gray-400'}`}></span>
          <span className="text-sm text-gray-600">
            {status?.running ? '调度器运行中' : '调度器已停止'}
          </span>
        </div>
      </div>

      {/* 调度器信息 */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h2 className="text-sm font-medium text-blue-900 mb-2">调度器说明</h2>
        <div className="text-sm text-blue-700 space-y-1">
          <p>• Cron 表达式格式: 分 时 日 月 周</p>
          <p>• 示例: <code className="bg-blue-100 px-1 rounded">0 9 * * *</code> = 每天早上9点</p>
          <p>• 调度器每分钟检查一次，执行到期的任务</p>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">定时任务列表</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="px-6 py-12 text-center text-gray-400">加载中...</div>
          ) : status?.tasks && status.tasks.length > 0 ? (
            status.tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                triggering={triggering === task.id}
                onTrigger={() => handleTrigger(task.id)}
                onToggle={(enabled) => handleToggle(task.id, enabled)}
              />
            ))
          ) : (
            <div className="px-6 py-12 text-center text-gray-400">暂无定时任务</div>
          )}
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">快捷操作</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/ops/admin/notifications"
            className="block text-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            通知管理
          </Link>
          <Link
            href="/ops/admin/logs"
            className="block text-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            任务日志
          </Link>
          <Link
            href="/ops/admin/system"
            className="block text-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            系统配置
          </Link>
        </div>
      </div>
    </div>
  )
}

function TaskRow({
  task,
  triggering,
  onTrigger,
  onToggle
}: {
  task: ScheduledTask
  triggering: boolean
  onTrigger: () => void
  onToggle: (enabled: boolean) => void
}) {
  return (
    <div className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
      <div className="flex-1">
        <div className="flex items-center space-x-3">
          <h3 className="font-medium text-gray-900">{task.name}</h3>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            task.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {task.enabled ? '已启用' : '已禁用'}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-1">{task.description}</p>
        <div className="flex items-center space-x-6 mt-2 text-sm">
          <span className="text-gray-500">Cron: <code className="bg-gray-100 px-2 py-0.5 rounded">{task.schedule}</code></span>
          {task.lastRun && (
            <span className="text-gray-500">
              上次: {new Date(task.lastRun).toLocaleString('zh-CN')}
            </span>
          )}
          {task.nextRun && (
            <span className="text-gray-500">
              下次: {new Date(task.nextRun).toLocaleString('zh-CN')}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <button
          onClick={() => onToggle(!task.enabled)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            task.enabled
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {task.enabled ? '禁用' : '启用'}
        </button>
        <button
          onClick={onTrigger}
          disabled={triggering || !task.enabled}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {triggering ? '执行中...' : '立即执行'}
        </button>
      </div>
    </div>
  )
}
