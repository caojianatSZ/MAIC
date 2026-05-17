'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface PaymentDetail {
  id: string
  amount: number
  status: string
  settlementStatus: string
  createdAt: string
  settledAt?: string
  teacherSalary: number
  partnerCommission: number
  platformRevenue: number
  booking: {
    id: string
    scheduledAt: string
    duration: number
    subject: string
    classType: string
    status: string
    attendanceStatus?: string
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
    city: {
      id: string
      name: string
    }
    cityPartner: {
      id: string
      nickname: string
    }
  }
}

const statusLabels: Record<string, string> = {
  'PENDING': '待支付',
  'PAID': '已支付',
  'FAILED': '支付失败',
  'REFUNDED': '已退款'
}

const settlementLabels: Record<string, string> = {
  'PENDING': '待结算',
  'PROCESSING': '结算中',
  'SETTLED': '已结算',
  'FAILED': '结算失败'
}

export default function PaymentDetailPage({
  params
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const [payment, setPayment] = useState<PaymentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [settling, Settling] = useState(false)

  useEffect(() => {
    if (params.id) {
      fetchPayment()
    }
  }, [params.id])

  async function fetchPayment() {
    try {
      const res = await fetch(`/api/payments/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setPayment(data)
      }
    } catch (error) {
      console.error('获取支付详情失败:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSettle() {
    if (!payment || payment.settlementStatus === 'SETTLED') return

    Settling(true)
    try {
      const res = await fetch(`/api/payments/${params.id}/settle`, {
        method: 'POST'
      })

      if (res.ok) {
        fetchPayment()
      } else {
        const error = await res.json()
        alert(error.error || '结算失败')
      }
    } catch (error) {
      console.error('结算失败:', error)
      alert('结算失败，请重试')
    } finally {
      Settling(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">加载中...</div>
  }

  if (!payment) {
    return <div className="text-center py-12">支付记录不存在</div>
  }

  const scheduledDate = new Date(payment.booking.scheduledAt)

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
          <h1 className="text-2xl font-bold text-gray-900">支付详情</h1>
          <p className="text-gray-500">支付ID: {payment.id}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-gray-900">¥{(payment.amount / 100).toFixed(2)}</p>
          <div className="flex items-center justify-end space-x-2 mt-1">
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              payment.status === 'PAID' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {statusLabels[payment.status]}
            </span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${
              payment.settlementStatus === 'SETTLED' ? 'bg-green-100 text-green-800' :
              payment.settlementStatus === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {settlementLabels[payment.settlementStatus]}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧信息 */}
        <div className="space-y-6">
          {/* 支付信息 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">支付信息</h2>
            <div className="space-y-3">
              <InfoRow label="支付金额" value={`¥${(payment.amount / 100).toFixed(2)}`} />
              <InfoRow label="支付状态" value={statusLabels[payment.status]} />
              <InfoRow label="结算状态" value={settlementLabels[payment.settlementStatus]} />
              <InfoRow
                label="创建时间"
                value={new Date(payment.createdAt).toLocaleString()}
              />
              {payment.settledAt && (
                <InfoRow
                  label="结算时间"
                  value={new Date(payment.settledAt).toLocaleString()}
                />
              )}
            </div>
          </div>

          {/* 课程信息 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">课程信息</h2>
            <div className="space-y-3">
              <InfoRow label="科目" value={payment.booking.subject} />
              <InfoRow label="班级类型" value={payment.booking.classType.replace('_', '对')} />
              <InfoRow label="课时时长" value={`${payment.booking.duration}分钟`} />
              <InfoRow
                label="上课时间"
                value={scheduledDate.toLocaleString()}
              />
              <InfoRow label="约课状态" value={payment.booking.status} />
              {payment.booking.attendanceStatus && (
                <InfoRow label="出勤状态" value={payment.booking.attendanceStatus} />
              )}
            </div>
          </div>
        </div>

        {/* 右侧信息 */}
        <div className="space-y-6">
          {/* 参与人员 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">参与人员</h2>
            <div className="space-y-4">
              <PersonInfo
                label="学生"
                name={payment.booking.student.nickname}
                phone={payment.booking.student.phoneNumber}
              />
              <PersonInfo
                label="老师"
                name={payment.booking.teacher.nickname}
                phone={payment.booking.teacher.phoneNumber}
              />
              <PersonInfo
                label="城市合伙人"
                name={payment.booking.cityPartner.nickname}
              />
            </div>
          </div>

          {/* 结算明细 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">结算明细</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                <div>
                  <p className="font-medium text-blue-900">教师薪资</p>
                  <p className="text-sm text-blue-600">60%</p>
                </div>
                <p className="text-xl font-bold text-blue-900">
                  ¥{(payment.teacherSalary / 100).toFixed(2)}
                </p>
              </div>
              <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                <div>
                  <p className="font-medium text-green-900">合伙人佣金</p>
                  <p className="text-sm text-green-600">20%</p>
                </div>
                <p className="text-xl font-bold text-green-900">
                  ¥{(payment.partnerCommission / 100).toFixed(2)}
                </p>
              </div>
              <div className="flex justify-between items-center p-4 bg-purple-50 rounded-lg">
                <div>
                  <p className="font-medium text-purple-900">平台收入</p>
                  <p className="text-sm text-purple-600">20%</p>
                </div>
                <p className="text-xl font-bold text-purple-900">
                  ¥{(payment.platformRevenue / 100).toFixed(2)}
                </p>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <div className="flex justify-between items-center">
                  <p className="font-medium text-gray-900">合计</p>
                  <p className="text-xl font-bold text-gray-900">
                    ¥{(payment.amount / 100).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      {payment.status === 'PAID' && payment.settlementStatus === 'PENDING' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">结算操作</h2>
          <button
            onClick={handleSettle}
            disabled={settling}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {settling ? '结算中...' : '执行结算'}
          </button>
          <p className="text-sm text-gray-500 mt-2">
            点击后将按照比例分配金额给教师、合伙人和平台
          </p>
        </div>
      )}
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
