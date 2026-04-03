import { NextRequest, NextResponse } from 'next/server'
import { generateMultiVersionCourses } from '@/lib/generation/multi-version-generator'

/**
 * 多版本生成API
 * POST /api/demo/generate-versions
 *
 * 并发生成4个版本的课程
 */
export const maxDuration = 480 // 8分钟

interface GenerateVersionsRequest {
  topic: string
  grade: string
  subject: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as GenerateVersionsRequest
    const { topic, grade, subject } = body

    console.log(`🚀 开始并发生成4个版本: ${topic} (${grade} ${subject})`)

    const result = await generateMultiVersionCourses(topic, grade, subject, (index, versionResult) => {
      console.log(`✓ 版本${index + 1}/4: ${versionResult.title} - ${versionResult.success ? '成功' : '失败'}`)
    })

    console.log(`✅ 多版本生成完成: ${result.versions.length}/4成功`)

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('多版本生成失败:', error)
    return NextResponse.json({
      success: false,
      error: '多版本生成失败'
    }, { status: 500 })
  }
}
