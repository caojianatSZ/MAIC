'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface AnalyticsData {
  student: {
    id: string
    nickname: string
    city?: string
  }
  summary: {
    totalStudyTime: number
    totalLessons: number
    totalQuizzes: number
    activeDays: number
    avgDailyStudyTime: number
  }
  subjectStats: Record<string, {
    totalStudyTime: number
    lessonCount: number
    quizCount: number
    avgScore: number
    masteryLevel: string
  }>
  masteryAnalysis: {
    mastered: number
    partial: number
    weak: number
    bySubject: Record<string, { mastered: number; partial: number; weak: number }>
  }
  trend: Array<{ date: string; studyTime: number; lessons: number }>
  recentDiagnoses: Array<{
    id: string
    subject: string
    score: number
    questionCount: number
    createdAt: Date
  }>
}

interface Recommendation {
  type: 'weak' | 'practice' | 'review'
  priority: 'high' | 'medium' | 'low'
  knowledgePoint: {
    id: string
    name: string
    subject: string
    grade?: string
  }
  reason: string
  masteryInfo: {
    level: string
    practiceCount: number
    lastReviewed?: Date
  }
}

export default function StudentDetailPage({
  params
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'mastery' | 'recommend'>('overview')

  useEffect(() => {
    fetchData()
  }, [params.id])

  async function fetchData() {
    try {
      // 获取学习分析
      const analyticsRes = await fetch(`/api/student/analytics?userId=${params.id}`)
      if (analyticsRes.ok) {
        const data = await analyticsRes.json()
        setAnalytics(data.data)
      }

      // 获取推荐
      const recRes = await fetch(`/api/student/recommendations?userId=${params.id}`)
      if (recRes.ok) {
        const data = await recRes.json()
        setRecommendations(data.data.recommendations || [])
      }
    } catch (error) {
      console.error('获取数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">加载中...</div>
  }

  if (!analytics) {
    return <div className="text-center py-12">学生信息不存在</div>
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
        <h1 className="text-2xl font-bold text-gray-900">{analytics.student.nickname}</h1>
        <p className="text-gray-500">
          {analytics.student.city && `${analytics.student.city} · `}
          学生ID: {analytics.student.id.slice(0, 8)}...
        </p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="总学习时长"
          value={`${Math.floor(analytics.summary.totalStudyTime / 60)}小时`}
        />
        <StatCard label="已完成课程" value={analytics.summary.totalLessons} />
        <StatCard label="已完成测验" value={analytics.summary.totalQuizzes} />
        <StatCard label="活跃天数" value={analytics.summary.activeDays} />
      </div>

      {/* 标签页 */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <TabButton
              label="学习概览"
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
            />
            <TabButton
              label="掌握情况"
              active={activeTab === 'mastery'}
              onClick={() => setActiveTab('mastery')}
            />
            <TabButton
              label="学习推荐"
              active={activeTab === 'recommend'}
              onClick={() => setActiveTab('recommend')}
            />
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <OverviewTab analytics={analytics} />
          )}

          {activeTab === 'mastery' && (
            <MasteryTab analytics={analytics} />
          )}

          {activeTab === 'recommend' && (
            <RecommendTab recommendations={recommendations} />
          )}
        </div>
      </div>
    </div>
  )
}

function OverviewTab({ analytics }: { analytics: AnalyticsData }) {
  return (
    <div className="space-y-6">
      {/* 按科目统计 */}
      <div>
        <h2 className="text-lg font-semibold mb-4">各科目学习情况</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(analytics.subjectStats).map(([subject, stats]) => (
            <div key={subject} className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium mb-2">{subject}</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">学习时长</span>
                  <span>{Math.floor(stats.totalStudyTime / 60)}分钟</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">完成课程</span>
                  <span>{stats.lessonCount}节</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">完成测验</span>
                  <span>{stats.quizCount}次</span>
                </div>
                {stats.quizCount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">平均分</span>
                    <span className={stats.avgScore >= 80 ? 'text-green-600' : stats.avgScore >= 60 ? 'text-yellow-600' : 'text-red-600'}>
                      {stats.avgScore.toFixed(1)}分
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 最近诊断 */}
      {analytics.recentDiagnoses.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">最近诊断</h2>
          <div className="space-y-2">
            {analytics.recentDiagnoses.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium">{d.subject}</p>
                  <p className="text-sm text-gray-500">
                    {d.questionCount}题 · {new Date(d.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  d.score >= 80 ? 'bg-green-100 text-green-800' :
                  d.score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {d.score}分
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MasteryTab({ analytics }: { analytics: AnalyticsData }) {
  return (
    <div className="space-y-6">
      {/* 总体掌握情况 */}
      <div className="grid grid-cols-3 gap-4">
        <MasteryCard label="已掌握" count={analytics.masteryAnalysis.mastered} color="green" />
        <MasteryCard label="部分掌握" count={analytics.masteryAnalysis.partial} color="yellow" />
        <MasteryCard label="需加强" count={analytics.masteryAnalysis.weak} color="red" />
      </div>

      {/* 按科目掌握情况 */}
      <div>
        <h2 className="text-lg font-semibold mb-4">各科目知识点掌握</h2>
        <div className="space-y-4">
          {Object.entries(analytics.masteryAnalysis.bySubject).map(([subject, data]) => {
            const total = data.mastered + data.partial + data.weak
            const masteredPercent = total > 0 ? (data.mastered / total) * 100 : 0

            return (
              <div key={subject} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{subject}</h3>
                  <span className="text-sm text-gray-500">{total}个知识点</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                  <div
                    className="bg-green-500 h-3 rounded-full"
                    style={{ width: `${masteredPercent}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>已掌握: {data.mastered}</span>
                  <span>部分: {data.partial}</span>
                  <span>需加强: {data.weak}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function RecommendTab({ recommendations }: { recommendations: Recommendation[] }) {
  if (recommendations.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        暂无学习推荐
      </div>
    )
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 }
  const sortedRecs = [...recommendations].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  )

  return (
    <div className="space-y-4">
      {sortedRecs.map((rec, index) => (
        <RecommendationCard key={index} recommendation={rec} />
      ))}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

function MasteryCard({ label, count, color }: { label: string; count: number; color: string }) {
  const colorClasses = {
    green: 'bg-green-50 text-green-800 border-green-200',
    yellow: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    red: 'bg-red-50 text-red-800 border-red-200'
  }

  return (
    <div className={`rounded-lg p-6 border ${colorClasses[color as keyof typeof colorClasses]}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="mt-2 text-3xl font-bold">{count}</p>
    </div>
  )
}

function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  const priorityColors = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div className="flex-1">
        <div className="flex items-center space-x-3 mb-1">
          <h3 className="font-medium">{recommendation.knowledgePoint.name}</h3>
          <span className={`px-2 py-0.5 rounded text-xs ${priorityColors[recommendation.priority]}`}>
            {recommendation.priority === 'high' ? '重点学习' :
             recommendation.priority === 'medium' ? '建议练习' : '可选复习'}
          </span>
        </div>
        <p className="text-sm text-gray-500">
          {recommendation.knowledgePoint.subject}
          {recommendation.knowledgePoint.grade && ` · ${recommendation.knowledgePoint.grade}`}
        </p>
        <p className="text-sm text-gray-400 mt-1">{recommendation.reason}</p>
      </div>
      <button className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
        开始学习
      </button>
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
