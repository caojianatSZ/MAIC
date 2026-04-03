/**
 * 多版本并发生成器
 * 同时生成4个版本：2种风格 × 2种难度
 */

import { prisma } from '@/lib/prisma'
import { generateCourseStreaming } from './streaming-generator'

export interface VersionConfig {
  style: 'basic' | 'applied'
  difficulty: 'standard' | 'advanced'
}

export interface VersionResult {
  classroomId: string
  style: string
  difficulty: string
  title: string
  duration: number
  sceneCount: number
  success: boolean
  error?: string
}

/**
 * 并发生成4个版本
 */
export async function generateMultiVersionCourses(
  topic: string,
  grade: string,
  subject: string,
  onProgress?: (versionIndex: number, result: VersionResult) => void
): Promise<{
  topic: string
  versions: VersionResult[]
}> {
  const versionConfigs: VersionConfig[] = [
    { style: 'basic', difficulty: 'standard' },
    { style: 'basic', difficulty: 'advanced' },
    { style: 'applied', difficulty: 'standard' },
    { style: 'applied', difficulty: 'advanced' }
  ]

  // 并发生成4个版本
  const generationPromises = versionConfigs.map(async (config, index) => {
    try {
      const classroomId = await generateAndStoreVersion({
        topic,
        grade,
        subject,
        ...config
      })

      const result: VersionResult = {
        classroomId,
        style: config.style,
        difficulty: config.difficulty,
        title: buildVersionTitle(topic, config.style, config.difficulty),
        duration: 0,
        sceneCount: 0,
        success: true
      }

      onProgress?.(index, result)
      return result

    } catch (error) {
      const result: VersionResult = {
        classroomId: '',
        style: config.style,
        difficulty: config.difficulty,
        title: buildVersionTitle(topic, config.style, config.difficulty),
        duration: 0,
        sceneCount: 0,
        success: false,
        error: (error as Error).message
      }

      onProgress?.(index, result)
      return result
    }
  })

  const versions = await Promise.all(generationPromises)

  return {
    topic,
    versions: versions.filter(v => v.success)
  }
}

/**
 * 生成并存储单个版本
 */
async function generateAndStoreVersion(config: {
  topic: string
  grade: string
  subject: string
  style: 'basic' | 'applied'
  difficulty: 'standard' | 'advanced'
}): Promise<string> {
  let finalCourse: {
    scenes: Array<{ duration?: number }>
  } | null = null

  // 使用Promise包装流式生成
  await new Promise<void>((resolve, reject) => {
    generateCourseStreaming(
      {
        topic: config.topic,
        grade: config.grade,
        subject: config.subject,
        difficulty: config.difficulty,
        style: config.style
      },
      {
        onProgress: () => {},
        onSceneReady: () => {},
        onPartialReady: () => {},
        onComplete: (course) => {
          finalCourse = course
          resolve()
        },
        onError: (error) => {
          reject(error)
        }
      }
    )
  })

  // 存储到数据库
  const classroom = await prisma.classroom.create({
    data: {
      identifier: `classroom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: buildVersionTitle(config.topic, config.style, config.difficulty),
      description: `AI生成的${config.topic}课程 - ${config.style}风格 × ${config.difficulty}难度`,
      subject: config.subject,
      grade: config.grade,
      difficulty: config.difficulty,
      style: config.style,
      versionType: `${config.style}_${config.difficulty}`,
      parentTopic: config.topic,
      generationMethod: 'ai_generated',
      scenes: finalCourse.scenes,
      sceneCount: finalCourse.scenes.length,
      duration: finalCourse.scenes.reduce((sum: number, s: { duration?: number }) => sum + (s.duration || 0), 0),
      metadata: {
        generatedBy: 'OpenMAIC',
        agentsInvolved: ['课程设计智能体', '内容生成智能体'],
        generationDuration: Date.now(),
        knowledgePointIds: config.topic
      }
    }
  })

  return classroom.id
}

/**
 * 构建版本标题
 */
function buildVersionTitle(
  topic: string,
  style: string,
  difficulty: string
): string {
  const styleNames: Record<string, string> = {
    'basic': '基础型',
    'applied': '应用型'
  }
  const difficultyNames: Record<string, string> = {
    'standard': '标准',
    'advanced': '进阶'
  }

  return `${topic} - ${styleNames[style]}×${difficultyNames[difficulty]}`
}
