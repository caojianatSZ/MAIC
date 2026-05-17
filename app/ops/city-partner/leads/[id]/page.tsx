'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface LeadDetail {
  id: string
  studentName: string
  parentName?: string
  phoneNumber: string
  grade?: string
  status: string
  sourceChannel?: string
  sourceNotes?: string
  scheduledTime?: string
  convertedAt?: string
  lostReason?: string
  notes?: Array<{ time: string; content: string; author: string }>
  city: {
    id: string
    name: string
  }
  cityPartner: {
    id: string
    nickname: string
  }
  assignedTeacher?: {
    id: string
    nickname: string
  }
  trialBookings?: Array<{
    id: string
    scheduledAt: string
    status: string
    teacher: {
      id: string
      nickname: string
    }
  }>
}

const statusLabels: Record<string, string> = {
  'NEW': '新线索',
  'CONTACTED': '已联系',
  'SCHEDULED': '已试课',
  'COMPLETED': '试课完成',
  'CONVERTED': '已转化',
  'LOST': '流失'
}

export default function LeadDetailPage({
  params
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const [lead, setLead] = useState<LeadDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (params.id) {
      fetchLead()
    }
  }, [params.id])

  async function fetchLead() {
    try {
      const res = await fetch(`/api/leads/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setLead(data)
      }
    } catch (error) {
      console.error('获取线索详情失败:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateStatus(newStatus: string) {
    try {
      const res = await fetch(`/api/leads/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (res.ok) {
        fetchLead()
      }
    } catch (error) {
      console.error('更新状态失败:', error)
    }
  }

  async function handleAddNote() {
    if (!newNote.trim() || saving) return

    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: newNote })
      })

      if (res.ok) {
        setNewNote('')
        fetchLead()
      }
    } catch (error) {
      console.error('添加备注失败:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">加载中...</div>
  }

  if (!lead) {
    return <div className="text-center py-12">线索不存在</div>
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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{lead.studentName}</h1>
          <p className="text-gray-500">
            {lead.parentName && `${lead.parentName} · `}
            {lead.grade}
          </p>
        </div>
        <select
          value={lead.status}
          onChange={(e) => handleUpdateStatus(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2"
        >
          {Object.entries(statusLabels).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧信息 */}
        <div className="space-y-6">
          {/* 基本信息 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">基本信息</h2>
            <div className="space-y-3">
              <InfoRow label="学生姓名" value={lead.studentName} />
              <InfoRow label="家长姓名" value={lead.parentName || '-'} />
              <InfoRow label="联系电话" value={lead.phoneNumber} />
              <InfoRow label="年级" value={lead.grade || '-'} />
              <InfoRow label="所属城市" value={lead.city.name} />
              <InfoRow label="负责人" value={lead.cityPartner.nickname} />
              {lead.assignedTeacher && (
                <InfoRow label="分配老师" value={lead.assignedTeacher.nickname} />
              )}
            </div>
          </div>

          {/* 来源信息 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">来源信息</h2>
            <div className="space-y-3">
              <InfoRow label="获客渠道" value={lead.sourceChannel || '-'} />
              <InfoRow label="渠道备注" value={lead.sourceNotes || '-'} />
            </div>
          </div>
        </div>

        {/* 右侧信息 */}
        <div className="space-y-6">
          {/* 状态跟踪 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">状态跟踪</h2>
            <div className="space-y-3">
              <InfoRow label="当前状态" value={statusLabels[lead.status]} />
              {lead.scheduledTime && (
                <InfoRow
                  label="试课时间"
                  value={new Date(lead.scheduledTime).toLocaleString()}
                />
              )}
              {lead.convertedAt && (
                <InfoRow
                  label="转化时间"
                  value={new Date(lead.convertedAt).toLocaleString()}
                />
              )}
              {lead.lostReason && (
                <InfoRow label="流失原因" value={lead.lostReason} />
              )}
            </div>
          </div>

          {/* 跟进记录 */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">跟进记录</h2>
            <div className="space-y-3 mb-4">
              {lead.notes && lead.notes.length > 0 ? (
                lead.notes.map((note, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <p className="text-sm">{note.content}</p>
                      <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                        {new Date(note.time).toLocaleString()}
                      </span>
                    </div>
                    {note.author && (
                      <p className="text-xs text-gray-400 mt-1">by {note.author}</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-sm">暂无跟进记录</p>
              )}
            </div>
            <div className="flex space-x-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="添加跟进记录..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
              />
              <button
                onClick={handleAddNote}
                disabled={saving || !newNote.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 试课记录 */}
      {lead.trialBookings && lead.trialBookings.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">试课记录</h2>
          <div className="space-y-3">
            {lead.trialBookings.map((booking) => (
              <div key={booking.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">
                    {new Date(booking.scheduledAt).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">
                    老师: {booking.teacher.nickname}
                  </p>
                </div>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                  {booking.status}
                </span>
              </div>
            ))}
          </div>
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
