'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface BookingDetail {
  id: string
  scheduledAt: string
  status: string
  attendanceStatus?: string
  classType: string
  subject: string
  grade?: string
  duration: number
  notes?: any
  student: {
    id: string
    nickname: string
    phoneNumber?: string
  }
  teacher: {
    id: string
    nickname: string
    phoneNumber?: string
  }
  trialLead?: {
    id: string
    studentName: string
    status: string
  }
  city: {
    id: string
    name: string
  }
  cityPartner: {
    id: string
    nickname: string
  }
  course?: {
    id: string
    title: string
    topic: string
  }
  payments?: Array<{
    id: string
    amount: number
    status: string
    settlementStatus: string
  }>
}

export default function BookingDetailPage({
  params
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const [booking, setBooking] = useState<BookingDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (params.id) {
      fetchBooking()
    }
  }, [params.id])

  async function fetchBooking() {
    try {
      const res = await fetch(`/api/bookings/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setBooking(data)
      }
    } catch (error) {
      console.error('获取约课详情失败:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateStatus(newStatus: string) {
    try {
      const res = await fetch(`/api/bookings/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (res.ok) {
        fetchBooking()
      }
    } catch (error) {
      console.error('更新状态失败:', error)
    }
  }

  async function handleUpdateAttendance(status: string) {
    try {
      const res = await fetch(`/api/bookings/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendanceStatus: status })
      })

      if (res.ok) {
        fetchBooking()
      }
    } catch (error) {
      console.error('更新出勤失败:', error)
    }
  }

  if (loading) {
    return <div className="text-center py-12">加载中...</div>
  }

  if (!booking) {
    return <div className="text-center py-12">约课记录不存在</div>
  }

  const scheduledDate = new Date(booking.scheduledAt)
  const endTime = new Date(scheduledDate.getTime() + booking.duration * 60000)

  return (
    <div className="space-y-6">
      {/* 返回按钮 */}
      <button
        onClick={() => router.back()}
        className="text-blue-600 hover:text-blue-800"
      >
        ← 返回
      </button>

      {/* 页面标题 */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">约课详情</h1>
          <p className="text-gray-500">
            {booking.subject} · {booking.grade}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">上课时间</p>
          <p className="text-lg font-semibold">
            {scheduledDate.toLocaleString()}
          </p>
          <p className="text-sm text-gray-500">
            {booking.duration}分钟 ({scheduledDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧信息 */}
        <div className="space-y-6">
          {/* 基本信息 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">课程信息</h2>
            <div className="space-y-3">
              <InfoRow label="科目" value={booking.subject} />
              <InfoRow label="年级" value={booking.grade || '-'} />
              <InfoRow label="班级类型" value={booking.classType.replace('_', '对')} />
              <InfoRow label="课时时长" value={`${booking.duration}分钟`} />
              <InfoRow label="所属城市" value={booking.city.name} />
              {booking.course && (
                <>
                  <InfoRow label="课程标题" value={booking.course.title} />
                  <InfoRow label="课程主题" value={booking.course.topic} />
                </>
              )}
            </div>
          </div>

          {/* 参与人员 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">参与人员</h2>
            <div className="space-y-4">
              <PersonInfo
                label="学生"
                name={booking.student.nickname}
                phone={booking.student.phoneNumber}
              />
              <PersonInfo
                label="老师"
                name={booking.teacher.nickname}
                phone={booking.teacher.phoneNumber}
              />
              <PersonInfo
                label="城市合伙人"
                name={booking.cityPartner.nickname}
              />
            </div>
          </div>
        </div>

        {/* 右侧信息和操作 */}
        <div className="space-y-6">
          {/* 状态管理 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">状态管理</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">约课状态</label>
                <select
                  value={booking.status}
                  onChange={(e) => handleUpdateStatus(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="PENDING">待确认</option>
                  <option value="CONFIRMED">已确认</option>
                  <option value="IN_PROGRESS">进行中</option>
                  <option value="COMPLETED">已完成</option>
                  <option value="CANCELLED">已取消</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">出勤状态</label>
                <select
                  value={booking.attendanceStatus || ''}
                  onChange={(e) => e.target.value && handleUpdateAttendance(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="">未出勤</option>
                  <option value="ATTENDED">出勤</option>
                  <option value="ABSENT">缺勤</option>
                  <option value="CANCELLED">取消</option>
                </select>
              </div>
            </div>
          </div>

          {/* 支付信息 */}
          {booking.payments && booking.payments.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">支付信息</h2>
              <div className="space-y-3">
                {booking.payments.map((payment) => (
                  <div key={payment.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">¥{(payment.amount / 100).toFixed(2)}</p>
                      <p className="text-sm text-gray-400">
                        {payment.status === 'PAID' ? '已支付' : '待支付'}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      payment.settlementStatus === 'SETTLED'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {payment.settlementStatus === 'SETTLED' ? '已结算' : '未结算'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">快捷操作</h2>
            <div className="space-y-3">
              <ActionButton label="查看学生资料" href="#" />
              <ActionButton label="查看老师资料" href="#" />
              <ActionButton label="生成课堂报告" href="#" />
              <ActionButton label="联系家长" href={`tel:${booking.student.phoneNumber}`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100">
      <span className="text-gray-500 text-sm">{label}</span>
      <span className="font-medium text-sm">{value}</span>
    </div>
  )
}

function PersonInfo({
  label,
  name,
  phone
}: {
  label: string
  name: string
  phone?: string
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <span className="text-sm font-medium text-gray-500">{label}</span>
      <div className="text-right">
        <p className="font-medium">{name}</p>
        {phone && <p className="text-sm text-gray-400">{phone}</p>}
      </div>
    </div>
  )
}

function ActionButton({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      className="block w-full text-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
    >
      {label}
    </a>
  )
}
