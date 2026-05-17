'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface NotificationTemplate {
  id: string
  name: string
  title: string
  templateId: string
  content: string
  example: string
}

export default function NotificationManagePage() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [testUserId, setTestUserId] = useState('')

  useEffect(() => {
    fetchTemplates()
  }, [])

  async function fetchTemplates() {
    try {
      const res = await fetch('/api/wechat/subscription/templates')
      if (res.ok) {
        const data = await res.json()
        setTemplates(data.data || [])
      }
    } catch (error) {
      console.error('获取模板失败:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSendTest(templateId: string) {
    if (!testUserId.trim()) {
      alert('请输入测试用户ID')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/wechat/subscription/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: testUserId,
          type: templateId.toLowerCase().replace('_', '_'),
          data: {
            datetime: new Date(),
            courseName: '测试课程 - 二次函数',
            teacherName: '张老师',
            amount: 18000,
            receivedAt: new Date(),
            courseInfo: '数学 - 二次函数',
            duration: 60,
            evaluation: '优秀',
            unlockTime: new Date(),
            name: '数学小能手',
            description: '完成10节数学课程',
            studyTime: 90,
            completedCourses: 2,
            performance: '表现优秀'
          }
        })
      })

      if (res.ok) {
        const result = await res.json()
        if (result.success) {
          alert('测试消息发送成功')
        } else {
          alert(result.message || '发送失败')
        }
      }
    } catch (error) {
      console.error('发送测试消息失败:', error)
      alert('发送失败')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">消息通知管理</h1>
        <p className="text-gray-500">管理微信订阅消息模板</p>
      </div>

      {/* 测试发送 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">发送测试消息</h2>
        <div className="flex items-center space-x-4">
          <input
            type="text"
            value={testUserId}
            onChange={(e) => setTestUserId(e.target.value)}
            placeholder="输入用户ID进行测试"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
          />
          <button
            onClick={() => handleSendTest('')}
            disabled={sending || !testUserId}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {sending ? '发送中...' : '发送测试'}
          </button>
        </div>
        <p className="text-sm text-gray-400 mt-2">
          提示: 确保用户已授权订阅消息，且已在微信小程序后台配置模板ID
        </p>
      </div>

      {/* 模板列表 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">订阅消息模板</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="px-6 py-12 text-center text-gray-400">加载中...</div>
          ) : templates.length > 0 ? (
            templates.map((template) => (
              <TemplateRow
                key={template.id}
                template={template}
                onSendTest={() => handleSendTest(template.id)}
                testUserId={testUserId}
                sending={sending}
              />
            ))
          ) : (
            <div className="px-6 py-12 text-center text-gray-400">暂无模板</div>
          )}
        </div>
      </div>

      {/* 配置说明 */}
      <div className="bg-yellow-50 rounded-lg p-4">
        <h2 className="text-sm font-medium text-yellow-900 mb-2">配置说明</h2>
        <div className="text-sm text-yellow-700 space-y-1">
          <p>1. 在微信小程序后台申请订阅消息模板</p>
          <p>2. 将模板ID配置到 <code className="bg-yellow-100 px-1 rounded">lib/wechat/subscription-service.ts</code></p>
          <p>3. 用户需在小程序中主动授权才能接收消息</p>
          <p>4. 每个模板有字段长度限制，超长会被截断</p>
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">快捷操作</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/ops/admin/scheduler"
            className="block text-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            任务调度
          </Link>
          <Link
            href="/ops/admin/notification-history"
            className="block text-center p-4 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            发送记录
          </Link>
          <Link
            href="https://mp.weixin.qq.com"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center p-4 border border-blue-300 text-blue-600 rounded-lg hover:bg-blue-50"
          >
            微信小程序后台 →
          </Link>
        </div>
      </div>
    </div>
  )
}

function TemplateRow({
  template,
  onSendTest,
  testUserId,
  sending
}: {
  template: NotificationTemplate
  onSendTest: () => void
  testUserId: string
  sending: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            <h3 className="font-medium text-gray-900">{template.title}</h3>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">
              {template.name}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">模板ID: {template.templateId || '未配置'}</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {expanded ? '收起' : '展开'}
          </button>
          <button
            onClick={onSendTest}
            disabled={sending || !testUserId}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            测试发送
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">内容格式</p>
            <pre className="text-sm bg-gray-50 p-3 rounded whitespace-pre-wrap">{template.content}</pre>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">示例</p>
            <pre className="text-sm bg-gray-50 p-3 rounded whitespace-pre-wrap">{template.example}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
