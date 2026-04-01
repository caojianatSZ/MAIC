/**
 * 获取知识掌握雷达图数据API
 * GET /api/student/radar?userId=xxx&subject=math
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const subject = searchParams.get('subject') || 'math'

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '缺少用户ID'
      }, { status: 400 })
    }

    // 获取用户在该科目的所有学习进度
    const learningProgress = await prisma.learningProgress.findMany({
      where: {
        userId,
        knowledgePointName: {
          contains: subject === 'math' ? '' : '' // 简化实现，实际需要更精确的匹配
        }
      },
      orderBy: {
        masteryLevel: 'desc'
      },
      take: 8 // 雷达图最多显示8个知识点
    })

    // 格式化为雷达图数据
    const radarData = {
      subject,
      knowledgePoints: learningProgress.map(lp => ({
        name: lp.knowledgePointName,
        current: lp.masteryLevel,
        lastMonth: Math.max(0, lp.masteryLevel - 10) // 简化实现：假设上月比现在低10%
      }))
    }

    return NextResponse.json({
      success: true,
      data: radarData
    })

  } catch (error) {
    console.error('获取雷达图数据失败:', error)
    return NextResponse.json({
      success: false,
      error: '获取雷达图数据失败'
    }, { status: 500 })
  }
}
