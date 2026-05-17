'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Lead {
  id: string
  studentName: string
  parentName?: string
  phoneNumber: string
  grade?: string
  status: string
  sourceChannel?: string
  createdAt: string
  scheduledTime?: string
  city: {
    id: string
    name: string
  }
}

const statusLabels: Record<string, string> = {
  'NEW': '新线索',
  'CONTACTED': '已联系',
  'SCHEDULED': '已试课',
  'COMPLETED': '试课完成',
  'CONVERTED': '已转化',
  'LOST': '流失'
}

const statusColors: Record<string, string> = {
  'NEW': 'bg-blue-100 text-blue-800',
  'CONTACTED': 'bg-yellow-100 text-yellow-800',
  'SCHEDULED': 'bg-purple-100 text-purple-800',
  'COMPLETED': 'bg-indigo-100 text-indigo-800',
  'CONVERTED': 'bg-green-100 text-green-800',
  'LOST': 'bg-gray-100 text-gray-800'
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('')

  // 默认使用西安城市
  const cityId = 'use_test_city_id'

  useEffect(() => {
    fetchLeads()
  }, [])

  async function fetchLeads() {
    try {
      // 使用测试 API 获取所有线索
      const res = await fetch('/api/test/flow')
      const data = await res.json()
      // 这里需要实际的 API 来获取线索列表
      setLeads([])
    } catch (error) {
      console.error('获取线索列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredLeads = filterStatus
    ? leads.filter(l => l.status === filterStatus)
    : leads

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">线索管理</h1>
          <p className="text-gray-500">管理和跟进试课线索</p>
        </div>
        <Link
          href="/ops/city-partner/leads/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          添加线索
        </Link>
      </div>

      {/* 筛选栏 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-500">状态筛选:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">全部</option>
            <option value="NEW">新线索</option>
            <option value="CONTACTED">已联系</option>
            <option value="SCHEDULED">已试课</option>
            <option value="COMPLETED">试课完成</option>
            <option value="CONVERTED">已转化</option>
            <option value="LOST">流失</option>
          </select>
        </div>
      </div>

      {/* 线索列表 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-12">加载中...</div>
        ) : filteredLeads.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">学生姓名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">家长</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">联系方式</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">年级</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">来源</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">试课时间</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium">{lead.studentName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{lead.parentName || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{lead.phoneNumber}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{lead.grade || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[lead.status]}`}>
                      {statusLabels[lead.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">{lead.sourceChannel || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {lead.scheduledTime
                      ? new Date(lead.scheduledTime).toLocaleString()
                      : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <Link
                      href={`/ops/city-partner/leads/${lead.id}`}
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
            暂无线索数据
          </div>
        )}
      </div>

      {/* 状态说明 */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">状态说明</h3>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-xs">
          {Object.entries(statusLabels).map(([key, label]) => (
            <div key={key} className="flex items-center space-x-1">
              <span className={`w-2 h-2 rounded-full ${statusColors[key].split(' ')[0]}`} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
