import { NextRequest, NextResponse } from 'next/server'
import { generateCourseStreaming } from '@/lib/generation/streaming-generator'

/**
 * Demo课程生成API（同步版本，用于小程序）
 * POST /api/demo/generate-course-sync
 *
 * 注意：这是非流式版本，等待完整生成后返回结果
 * 适用于不支持SSE的微信小程序
 */
export const maxDuration = 480 // 8分钟

interface GenerateCourseRequest {
  topic: string
  grade?: string
  subject?: string
  difficulty?: 'standard' | 'advanced'
  style?: 'basic' | 'applied'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as GenerateCourseRequest
    const {
      topic,
      grade = '初三',
      subject = 'math',
      difficulty = 'standard',
      style = 'basic'
    } = body

    console.log(`🚀 开始生成课程: ${topic} (${grade} ${subject})`)

    // 使用Promise包装流式生成，等待完成
    const finalCourse = await new Promise<any>((resolve, reject) => {
      generateCourseStreaming(
        {
          topic,
          grade,
          subject,
          difficulty,
          style
        },
        {
          onProgress: (stage, percent) => {
            console.log(`⏳ [${percent}%] ${stage}`)
          },
          onSceneReady: (sceneIndex, scene) => {
            console.log(`✓ 场景${sceneIndex + 1}生成完成`)
          },
          onPartialReady: (partialCourse) => {
            console.log(`🎬 初版课程就绪！已生成${partialCourse.scenes.length}/${partialCourse.totalScenes}个场景`)
          },
          onComplete: (course) => {
            console.log(`🎉 全部生成完成！总场景数: ${course.scenes.length}`)
            resolve(course)
          },
          onError: (error) => {
            console.error('生成失败:', error)
            reject(error)
          }
        }
      )
    })

    // 返回成功响应
    return NextResponse.json({
      success: true,
      data: finalCourse
    })

  } catch (error) {
    console.error('课程生成失败:', error)

    return NextResponse.json({
      success: false,
      error: (error as Error).message || '课程生成失败'
    }, { status: 500 })
  }
}
