'use client'

import { useEffect, useState } from 'react'

interface Booking {
  id: string
  scheduledAt: string
  status: string
  classType: string
  subject: string
  student: {
    id: string
    nickname: string
    phoneNumber?: string
  }
  trialLead?: {
    id: string
    studentName: string
  }
  course?: {
    id: string
    title: string
    topic: string
  }
}

interface TodayBookingsResponse {
  bookings: Booking[]
  stats: {
    total: number
    completed: number
    thisWeek: number
  }
  byTimeOfDay: {
    morning: Booking[]
    afternoon: Booking[]
    evening: Booking[]
  }
}

export default function TeacherPage() {
  const [data, setData] = useState<TodayBookingsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // 默认使用测试数据（西安老师A）
  const teacherId = 'teacher_西安_1_test'

  useEffect(() => {
    fetchTodayBookings()
  }, [])

  async function fetchTodayBookings() {
    try {
      const res = await fetch(`/api/teacher/today-bookings?teacherId=${teacherId}`)
      const result = await res.json()
      setData(result)
    } catch (error) {
      console.error('获取数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">加载中...</div>
  }

  const timeSlots = [
    { label: '上午', key: 'morning' as const, icon: '🌅' },
    { label: '下午', key: 'afternoon' as const, icon: '☀️' },
    { label: '晚上', key: 'evening' as const, icon: '🌙' }
  ]

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">老师工作台</h1>
        <p className="text-gray-500">课程管理和教学进度</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="今日课程" value={data?.stats.total || 0} />
        <StatCard label="已完成" value={data?.stats.completed || 0} />
        <StatCard label="本周预计" value={data?.stats.thisWeek || 0} />
      </div>

      {/* 今日课程安排 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold">今日课程</h2>
          <button className="text-sm text-blue-600 hover:text-blue-800">
            查看全部
          </button>
        </div>
        <div className="p-6 space-y-6">
          {timeSlots.map((slot) => {
            const bookings = data?.byTimeOfDay[slot.key] || []
            if (bookings.length === 0) return null

            return (
              <div key={slot.key}>
                <div className="flex items-center space-x-2 mb-3">
                  <span className="text-xl">{slot.icon}</span>
                  <h3 className="font-medium text-gray-700">{slot.label}</h3>
                </div>
                <div className="space-y-2 ml-8">
                  {bookings.map((booking) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))}
                </div>
              </div>
            )
          })}

          {data?.bookings.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              今日暂无课程安排
            </div>
          )}
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">快捷操作</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickAction label="生成新课程" href="/ops/teacher/courses/generate" />
          <QuickAction label="我的课程" href="/ops/teacher/courses" />
          <QuickAction label="学生进度" href="/ops/teacher/students" />
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

function BookingCard({ booking }: { booking: Booking }) {
  const date = new Date(booking.scheduledAt)
  const timeStr = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

  const statusColors: Record<string, string> = {
    'PENDING': 'bg-yellow-100 text-yellow-800',
    'CONFIRMED': 'bg-blue-100 text-blue-800',
    'IN_PROGRESS': 'bg-purple-100 text-purple-800',
    'COMPLETED': 'bg-green-100 text-green-800'
  }

  const statusLabels: Record<string, string> = {
    'PENDING': '待确认',
    'CONFIRMED': '已确认',
    'IN_PROGRESS': '进行中',
    'COMPLETED': '已完成'
  }

  const classTypeLabels: Record<string, string> = {
    'ONE_V1': '1对1',
    'ONE_V2': '1对2',
    'ONE_V3': '1对3',
    'ONE_V4': '1对4',
    'ONE_VN': '1对N'
  }

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
      <div className="flex items-center space-x-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{timeStr}</p>
          <p className="text-xs text-gray-500">{booking.subject}</p>
        </div>
        <div className="h-10 w-px bg-gray-200" />
        <div>
          <p className="font-medium">
            {booking.trialLead?.studentName || booking.student.nickname}
          </p>
          <p className="text-sm text-gray-500">
            {classTypeLabels[booking.classType]} · {booking.course?.title || '待生成课程'}
          </p>
        </div>
      </div>
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[booking.status]}`}>
        {statusLabels[booking.status]}
      </span>
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
