'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const SUBJECTS = [
  { value: 'math', label: '数学' },
  { value: 'english', label: '英语' },
  { value: 'physics', label: '物理' },
  { value: 'chemistry', label: '化学' },
  { value: 'biology', label: '生物' },
  { value: 'chinese', label: '语文' }
]

const GRADES = [
  { value: '小学一年级', label: '小学一年级' },
  { value: '小学二年级', label: '小学二年级' },
  { value: '小学三年级', label: '小学三年级' },
  { value: '小学四年级', label: '小学四年级' },
  { value: '小学五年级', label: '小学五年级' },
  { value: '小学六年级', label: '小学六年级' },
  { value: '初中一年级', label: '初中一年级' },
  { value: '初中二年级', label: '初中二年级' },
  { value: '初中三年级', label: '初中三年级' },
  { value: '高中一年级', label: '高中一年级' },
  { value: '高中二年级', label: '高中二年级' },
  { value: '高中三年级', label: '高中三年级' }
]

const CLASS_TYPES = [
  { value: 'ONE_V1', label: '1对1' },
  { value: 'ONE_V2', label: '1对2' },
  { value: 'ONE_V3', label: '1对3' },
  { value: 'ONE_V4', label: '1对4' }
]

const DIFFICULTY_LEVELS = [
  { value: 1, label: '基础', description: '适合初学者，注重概念理解' },
  { value: 2, label: '中等', description: '标准难度，平衡理论和练习' },
  { value: 3, label: '进阶', description: '有一定挑战，强调应用' },
  { value: 4, label: '提高', description: '较高难度，深入拓展' },
  { value: 5, label: '竞赛', description: '最高难度，面向竞赛' }
]

export default function CourseGeneratePage() {
  const router = useRouter()
  const [generating, setGenerating] = useState(false)
  const [formData, setFormData] = useState({
    subject: 'math',
    grade: '初中一年级',
    topic: '',
    classType: 'ONE_V1',
    duration: 60,
    difficulty: 2,
    teacherPersona: '',
    studentPersona: ''
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!formData.topic.trim()) {
      alert('请输入课程主题')
      return
    }

    setGenerating(true)
    try {
      const res = await fetch('/api/teacher/course-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        const data = await res.json()
        router.push(`/ops/teacher/courses/${data.courseSession.id}`)
      } else {
        const error = await res.json()
        alert(error.error || '生成失败')
      }
    } catch (error) {
      console.error('生成课程失败:', error)
      alert('生成失败，请重试')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 页面标题 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI 课程生成</h1>
        <p className="text-gray-500">输入课程信息，AI 将自动生成完整的课程内容</p>
      </div>

      {/* 生成表单 */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* 基本信息 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">基本信息</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                科目 <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              >
                {SUBJECTS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                年级
              </label>
              <select
                value={formData.grade}
                onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                {GRADES.map(g => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              课程主题 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              placeholder="例如：一元二次方程的解法"
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            />
            <p className="text-sm text-gray-400 mt-1">
              简要描述本节课要讲授的主题内容
            </p>
          </div>
        </div>

        {/* 课程设置 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">课程设置</h2>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                班级类型
              </label>
              <select
                value={formData.classType}
                onChange={(e) => setFormData({ ...formData, classType: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                {CLASS_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                课时时长
              </label>
              <select
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="30">30分钟</option>
                <option value="45">45分钟</option>
                <option value="60">60分钟</option>
                <option value="90">90分钟</option>
                <option value="120">120分钟</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                难度级别
              </label>
              <select
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: parseInt(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                {DIFFICULTY_LEVELS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 可选设置 */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">可选设置</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              教师人设
            </label>
            <textarea
              value={formData.teacherPersona}
              onChange={(e) => setFormData({ ...formData, teacherPersona: e.target.value })}
              placeholder="例如：一位耐心细致、善于用生活例子讲解概念的老师"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              学生描述
            </label>
            <textarea
              value={formData.studentPersona}
              onChange={(e) => setFormData({ ...formData, studentPersona: e.target.value })}
              placeholder="例如：基础较弱，需要更多练习巩固"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end space-x-4 pt-4 border-t">
          <Link
            href="/ops/teacher/courses"
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            取消
          </Link>
          <button
            type="submit"
            disabled={generating}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {generating ? '生成中...' : '开始生成'}
          </button>
        </div>
      </form>

      {/* 使用说明 */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">使用说明</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• 课程主题应具体明确，如"一元二次方程的求根公式"</li>
          <li>• 难度级别影响内容的深度和讲解方式</li>
          <li>• 教师人设和学生描述可以帮助 AI 生成更贴合实际的内容</li>
          <li>• 生成过程通常需要 30-60 秒，请耐心等待</li>
        </ul>
      </div>
    </div>
  )
}
