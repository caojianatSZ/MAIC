'use client'

import { useEffect, useState } from 'react'

interface City {
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

export default function CitiesPage() {
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newCityName, setNewCityName] = useState('')

  useEffect(() => {
    fetchCities()
  }, [])

  async function fetchCities() {
    try {
      const res = await fetch('/api/hq-ops/cities')
      const data = await res.json()
      setCities(data.cities || [])
    } catch (error) {
      console.error('获取城市列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateCity() {
    if (!newCityName.trim()) return

    try {
      const res = await fetch('/api/hq-ops/cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCityName })
      })

      if (res.ok) {
        setNewCityName('')
        setShowCreateModal(false)
        fetchCities()
      } else {
        const error = await res.json()
        alert(error.error || '创建失败')
      }
    } catch (error) {
      console.error('创建城市失败:', error)
      alert('创建失败')
    }
  }

  if (loading) {
    return <div className="text-center py-12">加载中...</div>
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">城市管理</h1>
          <p className="text-gray-500">创建和管理运营城市</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          创建城市
        </button>
      </div>

      {/* 城市列表 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">城市名称</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">合伙人</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">线索数</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">约课数</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {cities.map((city) => (
              <tr key={city.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap font-medium">{city.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    city.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {city.status === 'ACTIVE' ? '运营中' : '已停用'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {city.partner ? (
                    <div>
                      <p className="font-medium">{city.partner.nickname}</p>
                      <p className="text-gray-400 text-xs">{city.partner.phoneNumber}</p>
                    </div>
                  ) : (
                    <span className="text-gray-400">未分配</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{city._count.trialLeads}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{city._count.bookings}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <a
                    href={`/ops/hq-ops/cities/${city.id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    查看
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 创建城市弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">创建新城市</h2>
            <input
              type="text"
              value={newCityName}
              onChange={(e) => setNewCityName(e.target.value)}
              placeholder="城市名称（如：杭州）"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setNewCityName('')
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleCreateCity}
                disabled={!newCityName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
