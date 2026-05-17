'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface CityDetail {
  id: string
  name: string
  status: string
  partner?: {
    id: string
    nickname: string
    phoneNumber?: string
  }
  _count: {
    trialLeads: number
    bookings: number
    users: number
  }
}

interface Teacher {
  id: string
  nickname: string
  phoneNumber?: string
  avatarUrl?: string
}

interface Lead {
  id: string
  studentName: string
  parentName?: string
  phoneNumber: string
  grade?: string
  status: string
  createdAt: string
}

export default function CityDetailPage({
  params
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const [city, setCity] = useState<CityDetail | null>(null)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'teachers' | 'leads'>('overview')

  useEffect(() => {
    if (params.id) {
      fetchData()
    }
  }, [params.id])

  async function fetchData() {
    try {
      // 获取城市详情
      const citiesRes = await fetch('/api/hq-ops/cities')
      const citiesData = await citiesRes.json()
      const foundCity = citiesData.cities?.find((c: CityDetail) => c.id === params.id)
      if (foundCity) {
        setCity(foundCity)
      }

      // 获取城市老师
      const teachersRes = await fetch(`/api/hq-ops/cities/${params.id}/teachers`)
      const teachersData = await teachersRes.json()
      setTeachers(teachersData.teachers || [])

      // 获取城市线索
      const leadsRes = await fetch(`/api/city-partner/leads-funnel?cityId=${params.id}`)
      // 简化处理，实际应该有专门的 API
    } catch (error) {
      console.error('获取数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">加载中...</div>
  }

  if (!city) {
    return <div className="text-center py-12">城市不存在</div>
  }

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{city.name}</h1>
        <p className="text-gray-500">
          {city.partner ? `合伙人: ${city.partner.nickname}` : '未分配合伙人'}
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="线索总数" value={city._count.trialLeads} />
        <StatCard label="约课总数" value={city._count.bookings} />
        <StatCard label="用户总数" value={city._count.users} />
      </div>

      {/* 标签页 */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <TabButton
            label="概览"
            active={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
          />
          <TabButton
            label="老师"
            active={activeTab === 'teachers'}
            onClick={() => setActiveTab('teachers')}
          />
          <TabButton
            label="线索"
            active={activeTab === 'leads'}
            onClick={() => setActiveTab('leads')}
          />
        </nav>
      </div>

      {/* 标签页内容 */}
      <div className="bg-white rounded-lg shadow p-6">
        {activeTab === 'overview' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">城市概览</h2>
            <div className="space-y-4">
              <InfoRow label="城市名称" value={city.name} />
              <InfoRow label="运营状态" value={city.status === 'ACTIVE' ? '运营中' : '已停用'} />
              <InfoRow
                label="合伙人"
                value={city.partner ? `${city.partner.nickname} (${city.partner.phoneNumber})` : '未分配'}
              />
              <InfoRow label="创建时间" value={new Date().toLocaleDateString()} />
            </div>
          </div>
        )}

        {activeTab === 'teachers' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">城市老师 ({teachers.length})</h2>
            <div className="space-y-3">
              {teachers.map((teacher) => (
                <div
                  key={teacher.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                      {teacher.nickname?.charAt(0) || '?'}
                    </div>
                    <div>
                      <p className="font-medium">{teacher.nickname}</p>
                      <p className="text-sm text-gray-400">{teacher.phoneNumber || '无手机号'}</p>
                    </div>
                  </div>
                  <button className="text-sm text-blue-600 hover:text-blue-800">
                    查看详情
                  </button>
                </div>
              ))}
              {teachers.length === 0 && (
                <p className="text-gray-400 text-center py-8">该城市暂无老师</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'leads' && (
          <div>
            <h2 className="text-lg font-semibold mb-4">线索列表</h2>
            <p className="text-gray-400">线索数据开发中...</p>
          </div>
        )}
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

function TabButton({
  label,
  active,
  onClick
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`py-4 px-1 border-b-2 font-medium text-sm ${
        active
          ? 'border-blue-500 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {label}
    </button>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
