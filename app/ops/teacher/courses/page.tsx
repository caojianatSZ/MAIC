'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface CourseSession {
  id: string
  title: string
  description: string | null
  subject: string
  grade: string | null
  topic: string
  duration: number
  difficulty: number
  isCompleted: boolean
  isPublished: boolean
  sceneCount: number
  createdAt: string
}

const SUBJECT_LABELS: Record<string, string> = {
  'math': '数学',
  'english': '英语',
  'physics': '物理',
  'chemistry': '化学',
  'biology': '生物',
  'chinese': '语文'
}

const DIFFICULTY_LABELS: Record<number, string> = {
  1: '基础',
  2: '中等',
  3: '进阶',
  4: '提高',
  5: '竞赛'
}

const DIFFICULTY_COLORS: Record<number, string> = {
  1: 'bg-green-100 text-green-800',
  2: 'bg-blue-100 text-blue-800',
  3: 'bg-yellow-100 text-yellow-800',
  4: 'bg-orange-100 text-orange-800',
  5: 'bg-red-100 text-red-800'
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseSession[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all')

  useEffect(() => {
    fetchCourses()
  }, [filter])

  async function fetchCourses() {
    try {
      const status = filter === 'all' ? '' : filter
      const res = await fetch(`/api/teacher/course-sessions?status=${status}`)
      if (res.ok) {
        const data = await res.json()
        setCourses(data.sessions || [])
      }
    } catch (error) {
      console.error('获取课程列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">我的课程</h1>
          <p className="text-gray-500">管理和查看 AI 生成的课程</p>
        </div>
        <Link
          href="/ops/teacher/courses/generate"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          生成新课程
        </Link>
      </div>

      {/* 筛选栏 */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-500">状态筛选:</span>
          <FilterButton
            label="全部"
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <FilterButton
            label="已完成"
            active={filter === 'completed'}
            onClick={() => setFilter('completed')}
          />
          <FilterButton
            label="生成中"
            active={filter === 'pending'}
            onClick={() => setFilter('pending')}
          />
        </div>
      </div>

      {/* 课程列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-3 text-center py-12">加载中...</div>
        ) : courses.length > 0 ? (
          courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onStatusChange={fetchCourses}
            />
          ))
        ) : (
          <div className="col-span-3 text-center py-12 text-gray-400">
            暂无课程数据
            <div className="mt-4">
              <Link
                href="/ops/teacher/courses/generate"
                className="text-blue-600 hover:text-blue-800"
              >
                去生成第一个课程 →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FilterButton({
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

function CourseCard({
  course,
  onStatusChange
}: {
  course: CourseSession
  onStatusChange: () => void
}) {
  return (
    <div className="bg-white rounded-lg shadow hover:shadow-md transition">
      <div className="p-6">
        {/* 课程标题 */}
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
            {course.title}
          </h3>
          {!course.isCompleted && (
            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
              生成中
            </span>
          )}
        </div>

        {/* 课程描述 */}
        {course.description && (
          <p className="text-sm text-gray-500 mb-4 line-clamp-2">
            {course.description}
          </p>
        )}

        {/* 课程信息 */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">科目</span>
            <span className="font-medium">{SUBJECT_LABELS[course.subject] || course.subject}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">年级</span>
            <span className="font-medium">{course.grade || '-'}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">时长</span>
            <span className="font-medium">{course.duration}分钟</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">场景数</span>
            <span className="font-medium">{course.sceneCount}个</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">难度</span>
            <span className={`px-2 py-0.5 rounded text-xs ${DIFFICULTY_COLORS[course.difficulty]}`}>
              {DIFFICULTY_LABELS[course.difficulty]}
            </span>
          </div>
        </div>

        {/* 状态标签 */}
        <div className="flex items-center space-x-2 mb-4">
          {course.isPublished && (
            <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
              已发布
            </span>
          )}
          {course.isCompleted && !course.isPublished && (
            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
              草稿
            </span>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex space-x-2">
          <Link
            href={`/ops/teacher/courses/${course.id}`}
            className="flex-1 text-center px-3 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 text-sm"
          >
            查看详情
          </Link>
          {course.isCompleted && !course.isPublished && (
            <button
              onClick={async () => {
                const res = await fetch(`/api/teacher/course-sessions/${course.id}`, {
                  method: 'POST'
                })
                if (res.ok) {
                  onStatusChange()
                }
              }}
              className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            >
              发布
            </button>
          )}
        </div>
      </div>

      {/* 时间信息 */}
      <div className="px-6 py-3 bg-gray-50 border-t text-xs text-gray-400">
        创建于 {new Date(course.createdAt).toLocaleString()}
      </div>
    </div>
  )
}
