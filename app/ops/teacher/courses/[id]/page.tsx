'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Scene {
  title: string
  description?: string
  duration?: number
  agent?: string
}

interface CourseDetail {
  id: string
  title: string
  description: string | null
  subject: string
  grade: string | null
  topic: string
  classType: string
  duration: number
  difficulty: number
  isCompleted: boolean
  isPublished: boolean
  sceneCount: number
  scenes: Scene[]
  createdAt: string
  completedAt: string | null
  publishedAt: string | null
  generationResult?: {
    success: boolean
    error?: string
  }
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

const CLASS_TYPE_LABELS: Record<string, string> = {
  'ONE_V1': '1对1',
  'ONE_V2': '1对2',
  'ONE_V3': '1对3',
  'ONE_V4': '1对4'
}

export default function CourseDetailPage({
  params
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'scenes'>('overview')

  useEffect(() => {
    fetchCourse()
    // 轮询检查生成状态
    const interval = setInterval(() => {
      if (course && !course.isCompleted) {
        fetchCourse()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [params.id])

  async function fetchCourse() {
    try {
      const res = await fetch(`/api/teacher/course-sessions/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setCourse(data)
      }
    } catch (error) {
      console.error('获取课程详情失败:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handlePublish() {
    if (!course) return

    setPublishing(true)
    try {
      const res = await fetch(`/api/teacher/course-sessions/${params.id}`, {
        method: 'POST'
      })

      if (res.ok) {
        fetchCourse()
      }
    } catch (error) {
      console.error('发布失败:', error)
    } finally {
      setPublishing(false)
    }
  }

  async function handleDelete() {
    if (!confirm('确定要删除这个课程吗？')) return

    try {
      const res = await fetch(`/api/teacher/course-sessions/${params.id}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        router.push('/ops/teacher/courses')
      }
    } catch (error) {
      console.error('删除失败:', error)
    }
  }

  if (loading) {
    return <div className="text-center py-12">加载中...</div>
  }

  if (!course) {
    return <div className="text-center py-12">课程不存在</div>
  }

  return (
    <div className="space-y-6">
      {/* 返回按钮 */}
      <Link
        href="/ops/teacher/courses"
        className="text-blue-600 hover:text-blue-800 inline-block"
      >
        ← 返回课程列表
      </Link>

      {/* 页面标题 */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{course.title}</h1>
            {!course.isCompleted && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
                生成中...
              </span>
            )}
            {course.isPublished && (
              <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                已发布
              </span>
            )}
          </div>
          <p className="text-gray-500">{course.description}</p>
        </div>

        {/* 操作按钮 */}
        <div className="flex space-x-3">
          {course.isCompleted && !course.isPublished && (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300"
            >
              {publishing ? '发布中...' : '发布课程'}
            </button>
          )}
          {course.isPublished && (
            <button
              onClick={() => router.push(`/classroom/${course.id}`)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              开始上课
            </button>
          )}
          <button
            onClick={handleDelete}
            className="px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50"
          >
            删除
          </button>
        </div>
      </div>

      {/* 课程信息卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <InfoCard label="科目" value={SUBJECT_LABELS[course.subject] || course.subject} />
        <InfoCard label="年级" value={course.grade || '-'} />
        <InfoCard label="班级类型" value={CLASS_TYPE_LABELS[course.classType] || course.classType} />
        <InfoCard label="时长" value={`${course.duration}分钟`} />
        <InfoCard label="难度" value={DIFFICULTY_LABELS[course.difficulty]} />
        <InfoCard label="场景数" value={`${course.sceneCount}个`} />
        <InfoCard
          label="创建时间"
          value={new Date(course.createdAt).toLocaleDateString()}
        />
        <InfoCard
          label="状态"
          value={course.isCompleted ? '已完成' : '生成中'}
        />
      </div>

      {/* 标签页 */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <TabButton
              label="概览"
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
            />
            <TabButton
              label="课程场景"
              active={activeTab === 'scenes'}
              onClick={() => setActiveTab('scenes')}
            />
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">课程概览</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">课程主题</h3>
                  <p className="text-gray-900">{course.topic}</p>
                </div>

                {course.generationResult && !course.generationResult.success && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-red-800 mb-2">生成失败</h3>
                    <p className="text-sm text-red-600">{course.generationResult.error}</p>
                  </div>
                )}

                {!course.isCompleted && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-yellow-800 mb-2">课程生成中</h3>
                    <p className="text-sm text-yellow-700">
                      AI 正在为您生成课程内容，请稍候...
                    </p>
                    <div className="mt-3 w-full bg-yellow-200 rounded-full h-2">
                      <div className="bg-yellow-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                    </div>
                  </div>
                )}

                {course.isCompleted && course.sceneCount > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="text-sm font-medium text-green-800 mb-2">生成完成</h3>
                    <p className="text-sm text-green-700">
                      课程已成功生成，包含 {course.sceneCount} 个场景
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'scenes' && (
            <div>
              <h2 className="text-lg font-semibold mb-4">课程场景</h2>
              {!course.isCompleted ? (
                <div className="text-center py-12 text-gray-400">
                  课程生成中，场景内容将在此显示
                </div>
              ) : course.scenes.length > 0 ? (
                <div className="space-y-4">
                  {course.scenes.map((scene, index) => (
                    <SceneCard key={index} index={index + 1} scene={scene} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  暂无场景数据
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
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

function SceneCard({ index, scene }: { index: number; scene: Scene }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <span className="flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-600 rounded-full font-medium text-sm">
              {index}
            </span>
            <h3 className="font-semibold text-gray-900">{scene.title}</h3>
            {scene.duration && (
              <span className="text-sm text-gray-500">{scene.duration}分钟</span>
            )}
          </div>
          {scene.description && (
            <p className="text-sm text-gray-600 ml-11">{scene.description}</p>
          )}
        </div>
        {scene.agent && (
          <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
            {scene.agent}
          </span>
        )}
      </div>
    </div>
  )
}
