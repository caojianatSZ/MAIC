'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Payment {
  id: string
  amount: number
  status: string
  settlementStatus: string
  createdAt: string
  settledAt?: string
  booking: {
    id: string
    scheduledAt: string
    student: {
      nickname: string
    }
    teacher: {
      nickname: string
    }
    city: {
      name: string
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

const statusColors: Record<string, string> = {
  'PENDING': 'bg-yellow-100 text-yellow-800',
  'PAID': 'bg-green-100 text-green-800',
  'FAILED': 'bg-red-100 text-red-800',
  'REFUNDED': 'bg-gray-100 text-gray-800'
}

const settlementColors: Record<string, string> = {
  'PENDING': 'bg-yellow-100 text-yellow-800',
  'PROCESSING': 'bg-blue-100 text-blue-800',
  'SETTLED': 'bg-green-100 text-green-800',
  'FAILED': 'bg-red-100 text-red-800'
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterSettlement, setFilterSettlement] = useState<string>('')
  const [filterCity, setFilterCity] = useState<string>('')

  useEffect(() => {
    fetchPayments()
  }, [])

  async function fetchPayments() {
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.append('status', filterStatus)
      if (filterSettlement) params.append('settlementStatus', filterSettlement)
      if (filterCity) params.append('cityId', filterCity)

      const res = await fetch(`/api/payments?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setPayments(data.payments || [])
      }
    } catch (error) {
      console.error('获取支付列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredPayments = payments

  const totalAmount = filteredPayments.reduce((sum, p) => sum + (p.status === 'PAID' ? p.amount : 0), 0)
  const settledAmount = filteredPayments.reduce((sum, p) => sum + (p.settlementStatus === 'SETTLED' ? p.amount : 0), 0)
  const pendingSettleAmount = filteredPayments.reduce(
    (sum, p) => sum + (p.status === 'PAID' && p.settlementStatus !== 'SETTLED' ? p.amount : 0),
    0
  )

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">支付管理</h1>
        <p className="text-gray-500">管理和查看所有支付记录</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-500">总收入</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">¥{(totalAmount / 100).toFixed(2)}</p>
          <p className="text-sm text-gray-400">{filteredPayments.filter(p => p.status === 'PAID').length} 笔已支付</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-500">已结算</p>
          <p className="mt-2 text-2xl font-bold text-green-600">¥{(settledAmount / 100).toFixed(2)}</p>
          <p className="text-sm text-gray-400">{filteredPayments.filter(p => p.settlementStatus === 'SETTLED').length} 笔已结算</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm font-medium text-gray-500">待结算</p>
          <p className="mt-2 text-2xl font-bold text-yellow-600">¥{(pendingSettleAmount / 100).toFixed(2)}</p>
          <p className="text-sm text-gray-400">
            {filteredPayments.filter(p => p.status === 'PAID' && p.settlementStatus !== 'SETTLED').length} 笔待处理
          </p>
        </div>
      </div>

      {/* 筛选栏 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-500">支付状态:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">全部</option>
              <option value="PENDING">待支付</option>
              <option value="PAID">已支付</option>
              <option value="FAILED">支付失败</option>
              <option value="REFUNDED">已退款</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-500">结算状态:</span>
            <select
              value={filterSettlement}
              onChange={(e) => setFilterSettlement(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">全部</option>
              <option value="PENDING">待结算</option>
              <option value="PROCESSING">结算中</option>
              <option value="SETTLED">已结算</option>
              <option value="FAILED">结算失败</option>
            </select>
          </div>
          <button
            onClick={fetchPayments}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            应用筛选
          </button>
        </div>
      </div>

      {/* 支付列表 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-12">加载中...</div>
        ) : filteredPayments.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">创建时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">城市</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">学生</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">老师</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">上课时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">金额</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">支付状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">结算状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {new Date(payment.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {payment.booking.city.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {payment.booking.student.nickname}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {payment.booking.teacher.nickname}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {new Date(payment.booking.scheduledAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    ¥{(payment.amount / 100).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[payment.status]}`}>
                      {statusLabels[payment.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${settlementColors[payment.settlementStatus]}`}>
                      {settlementLabels[payment.settlementStatus]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <Link
                      href={`/ops/payments/${payment.id}`}
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
            暂无支付数据
          </div>
        )}
      </div>

      {/* 结算说明 */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">结算比例说明</h3>
        <div className="grid grid-cols-3 gap-4 text-xs text-gray-600">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>教师 60%</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            <span>合伙人 20%</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            <span>平台 20%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
