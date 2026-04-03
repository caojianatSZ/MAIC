import { NextRequest } from 'next/server'
import { generateCourseStreaming } from '@/lib/generation/streaming-generator'

/**
 * Demo课程生成API（流式版本）
 * POST /api/demo/generate-course
 *
 * 支持Server-Sent Events (SSE)流式输出
 */
export const maxDuration = 480 // 8分钟

interface GenerateCourseRequest {
  topic: string
  grade: string
  subject: string
  difficulty?: 'standard' | 'advanced'
  style?: 'basic' | 'applied'
  generateVersions?: boolean
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()

  // 创建SSE流
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: any) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
        controller.enqueue(encoder.encode(message))
      }

      try {
        // 解析请求
        const body = await request.json() as GenerateCourseRequest
        const { topic, grade, subject, difficulty = 'standard', style = 'basic' } = body

        // 发送开始事件
        sendEvent('progress', { stage: 'starting', percent: 0, message: '开始生成课程...' })

        // 调用流式生成器
        await generateCourseStreaming(
          {
            topic,
            grade,
            subject,
            difficulty,
            style
          },
          {
            onProgress: (stage, percent) => {
              const stageMessages: Record<string, string> = {
                'analyzing': '正在分析需求...',
                'generating_outline': '正在生成课程大纲...',
                'outline_ready': '课程大纲生成完成',
                'generating_first_scenes': '正在生成首批场景（首屏内容）...',
                'generating_remaining': '正在生成剩余场景...'
              }
              sendEvent('progress', {
                stage,
                percent,
                message: stageMessages[stage] || '处理中...'
              })
            },
            onSceneReady: (sceneIndex, scene) => {
              sendEvent('scene_ready', {
                sceneIndex,
                scene,
                message: `场景 ${sceneIndex + 1} 生成完成`
              })
            },
            onPartialReady: (partialCourse) => {
              sendEvent('partial_ready', {
                ...partialCourse,
                message: '首批场景就绪，可以开始播放！'
              })
            },
            onComplete: (finalCourse) => {
              sendEvent('generation_complete', {
                ...finalCourse,
                message: '课程生成完成！'
              })
              controller.close()
            },
            onError: (error) => {
              sendEvent('error', {
                message: error.message || '生成失败',
                code: 'GENERATION_ERROR',
                details: error.stack
              })
              controller.close()
            }
          }
        )

      } catch (error) {
        sendEvent('error', {
          message: '请求处理失败',
          code: 'REQUEST_ERROR',
          details: error instanceof Error ? error.message : String(error)
        })
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no' // 禁用Nginx缓冲
    }
  })
}
