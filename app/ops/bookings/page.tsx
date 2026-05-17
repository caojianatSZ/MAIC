'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Booking {
  id: string
  scheduledAt: string
  status: string
  attendanceStatus?: string
  classType: string
  subject: string
  grade?: string
  duration: number
  student: {
    id: string
    nickname: string
  }
  teacher: {
    id: string
    nickname: string
  }
  city: {
    id: string
    name: string
  }
}

const statusLabels: Record<string, string> = {
  'PENDING': '待确认',
  'CONFIRMED': '已确认',
  'IN_PROGRESS': '进行中',
  'COMPLETED': '已完成',
  'CANCELLED': '已取消',
  'NO_SHOW': '未到场'
}

const attendanceLabels: Record<string, string> = {
  'ATTENDED': '出勤',
  'ABSENT': '缺勤',
  'CANCELLED': '取消'
}

const classTypeLabels: Record<string, string> = {
  'ONE_V1': '1对1',
  'ONE_V2': '1对2',
  'ONE_V3': '1对3',
  'ONE_V4': '1对4',
  'ONE_VN': '1对N'
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBookings()
  }, [])

  async function fetchBookings() {
    try {
      // 这里需要实际的 API
      setBookings([])
    } catch (error) {
      console.error('获取约课列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">约课管理</h1>
        <p className="text-gray-500">管理和查看所有约课记录</p>
      </div>

      {/* 筛选栏 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-500">快速筛选:</span>
          <FilterButton label="全部" active />
          <FilterButton label="今天" />
          <FilterButton label="本周" />
          <FilterButton label="已完成" />
          <FilterButton label="待确认" />
        </div>
      </div>

      {/* 约课列表 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-12">加载中...</div>
        ) : bookings.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">上课时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">学生</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">老师</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">科目</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">出勤</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div>
                      <p className="font-medium">
                        {new Date(booking.scheduledAt).toLocaleDateString()}
                      </p>
                      <p className="text-gray-400">
                        {new Date(booking.scheduledAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {booking.student.nickname}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {booking.teacher.nickname}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{booking.subject}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {classTypeLabels[booking.classType]}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      booking.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                      booking.status === 'CONFIRMED' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {statusLabels[booking.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {booking.attendanceStatus ? attendanceLabels[booking.attendanceStatus] : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <Link
                      href={`/ops/bookings/${booking.id}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      查看
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12 text-gray-400">
            暂无约课数据
          </div>
        )}
      </div>
    </div>
  )
}

function FilterButton({ label, active }: { label: string; active?: boolean }) {
  return (
    <button
      className={`px-3 py-1 rounded-full text-sm ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  )
}
