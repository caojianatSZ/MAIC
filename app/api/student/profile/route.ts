/**
 * 获取学生画像API
 * GET /api/student/profile?userId=xxx
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '缺少用户ID'
      }, { status: 400 })
    }

    // 获取学生画像
    let studentProfile = await prisma.studentProfile.findUnique({
      where: { userId }
    })

    // 如果画像不存在，创建默认画像
    if (!studentProfile) {
      studentProfile = await prisma.studentProfile.create({
        data: {
          userId,
          learningStyle: {
            visual: 0.5,
            auditory: 0.5,
            kinesthetic: 0.5
          },
          strongPoints: [],
          weakPoints: [],
          studyStats: {
            totalStudyTime: 0,
            questionsCompleted: 0,
            lessonsLearned: 0,
            currentStreak: 0,
            longestStreak: 0
          }
        }
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        userId: studentProfile.userId,
        learningStyle: studentProfile.learningStyle,
        strongPoints: studentProfile.strongPoints,
        weakPoints: studentProfile.weakPoints,
        studyStats: studentProfile.studyStats,
        lastUpdated: studentProfile.lastUpdated
      }
    })

  } catch (error) {
    console.error('获取学生画像失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取学生画像失败'
    }, { status: 500 })
  }
}
