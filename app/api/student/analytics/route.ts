import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/student/analytics?userId=xxx - 获取学生学习分析
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const subject = searchParams.get('subject')
    const days = parseInt(searchParams.get('days') || '30')

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '缺少用户ID'
      }, { status: 400 })
    }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // 获取学生信息
    const student = await prisma.user.findUnique({
      where: { id: userId },
      include: { city: true }
    })

    if (!student) {
      return NextResponse.json({
        success: false,
        error: '学生不存在'
      }, { status: 404 })
    }

    // 获取学习记录
    const studyRecords = await prisma.studyRecord.findMany({
      where: {
        userId,
        createdAt: { gte: startDate }
      },
      orderBy: { createdAt: 'desc' }
    })

    // 获取最近的诊断记录
    const diagnoses = await prisma.diagnosisRecord.findMany({
      where: {
        userId,
        createdAt: { gte: startDate }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    // 获取知识点掌握情况
    const masteryRecords = await prisma.knowledgeMastery.findMany({
      where: { userId }
    })

    // 按科目分组统计
    const subjectStats: Record<string, {
      totalStudyTime: number
      lessonCount: number
      quizCount: number
      avgScore: number
      masteryLevel: string
    }> = {}

    studyRecords.forEach(record => {
      const subj = record.subject || 'unknown'
      if (!subjectStats[subj]) {
        subjectStats[subj] = {
          totalStudyTime: 0,
          lessonCount: 0,
          quizCount: 0,
          avgScore: 0,
          masteryLevel: 'unknown'
        }
      }
      subjectStats[subj].totalStudyTime += record.timeSpent || 0
      if (record.type === 'lesson') {
        subjectStats[subj].lessonCount++
      } else if (record.type === 'quiz') {
        subjectStats[subj].quizCount++
        if (record.score) {
          subjectStats[subj].avgScore =
            (subjectStats[subj].avgScore * (subjectStats[subj].quizCount - 1) + record.score) /
            subjectStats[subj].quizCount
        }
      }
    })

    // 计算总体统计
    const totalStudyTime = studyRecords.reduce((sum, r) => sum + (r.timeSpent || 0), 0)
    const totalLessons = studyRecords.filter(r => r.type === 'lesson').length
    const totalQuizzes = studyRecords.filter(r => r.type === 'quiz').length

    // 知识点掌握分析
    const masteryAnalysis = {
      mastered: masteryRecords.filter(m => m.masteryLevel === 'mastered').length,
      partial: masteryRecords.filter(m => m.masteryLevel === 'partial').length,
      weak: masteryRecords.filter(m => m.masteryLevel === 'weak').length,
      bySubject: {} as Record<string, { mastered: number; partial: number; weak: number }>
    }

    masteryRecords.forEach(m => {
      const subj = m.subject || 'unknown'
      if (!masteryAnalysis.bySubject[subj]) {
        masteryAnalysis.bySubject[subj] = { mastered: 0, partial: 0, weak: 0 }
      }
      if (m.masteryLevel === 'mastered') masteryAnalysis.bySubject[subj].mastered++
      else if (m.masteryLevel === 'partial') masteryAnalysis.bySubject[subj].partial++
      else masteryAnalysis.bySubject[subj].weak++
    })

    // 学习趋势（按天统计）
    const dailyStats: Record<string, { studyTime: number; lessons: number }> = {}
    studyRecords.forEach(record => {
      const dateKey = record.createdAt.toISOString().split('T')[0]
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = { studyTime: 0, lessons: 0 }
      }
      dailyStats[dateKey].studyTime += record.timeSpent || 0
      if (record.type === 'lesson') {
        dailyStats[dateKey].lessons++
      }
    })

    const trend = Object.entries(dailyStats)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      success: true,
      data: {
        student: {
          id: student.id,
          nickname: student.nickname,
          city: student.city?.name
        },
        summary: {
          totalStudyTime,
          totalLessons,
          totalQuizzes,
          activeDays: Object.keys(dailyStats).length,
          avgDailyStudyTime: activeDays > 0 ? totalStudyTime / activeDays : 0
        },
        subjectStats,
        masteryAnalysis,
        trend,
        recentDiagnoses: diagnoses.map(d => ({
          id: d.id,
          subject: d.subject,
          score: d.totalScore,
          createdAt: d.createdAt
        }))
      }
    })
  } catch (error) {
    console.error('获取学习分析失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取学习分析失败'
    }, { status: 500 })
  }
}
