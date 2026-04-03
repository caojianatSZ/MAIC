/**
 * 流式课程生成器
 * 支持边生成边返回，优化用户体验
 */

import { generateSceneOutlinesFromRequirements } from './outline-generator'
import { generateSceneContent } from './scene-generator'
import { getTemplateScene } from './template-fallback'

export interface GenerationRequirements {
  topic: string
  subject: string
  grade: string
  difficulty: 'standard' | 'advanced'
  style?: 'basic' | 'applied'
  knowledgePoints?: string[]
  prerequisites?: string[]
  learningGoals?: string[]
  estimatedDuration?: number
}

export interface StreamCallbacks {
  onProgress: (stage: string, percent: number) => void
  onSceneReady: (sceneIndex: number, scene: any) => void
  onPartialReady: (partialCourse: any) => void
  onComplete: (finalCourse: any) => void
  onError: (error: Error) => void
}

/**
 * 流式生成课程
 */
export async function generateCourseStreaming(
  requirements: GenerationRequirements,
  callbacks: StreamCallbacks
): Promise<void> {
  try {
    // 阶段1：分析需求并生成大纲
    callbacks.onProgress('analyzing', 10)

    const enhancedRequirements = await enhanceRequirements(requirements)
    callbacks.onProgress('generating_outline', 30)

    // 注意：这里需要适配现有的 outline-generator 接口
    // 由于现有实现需要 aiCall 函数，我们需要创建一个简化版本
    // 或者重用现有的生成逻辑

    // 暂时使用简化的实现
    const outlines = await generateSimpleOutlines(enhancedRequirements)
    callbacks.onProgress('outline_ready', 50)

    // 阶段2：优先生成前2个场景（首屏）
    callbacks.onProgress('generating_first_scenes', 60)

    const firstTwoScenes = await Promise.all([
      generateSceneWithTimeout(outlines[0], 90000),
      generateSceneWithTimeout(outlines[1], 90000)
    ])

    // 返回初版课程（可播放）
    const partialCourse = {
      courseId: `course_${Date.now()}`,
      topic: requirements.topic,
      subject: requirements.subject,
      grade: requirements.grade,
      difficulty: requirements.difficulty,
      style: requirements.style || 'basic',
      scenes: firstTwoScenes,
      totalScenes: outlines.length,
      progress: Math.round((2 / outlines.length) * 100),
      status: 'partial',
      canPlay: true
    }

    callbacks.onPartialReady(partialCourse)

    // 阶段3：后台继续生成剩余场景
    callbacks.onProgress('generating_remaining', 70)

    const remainingScenes: any[] = []
    for (let i = 2; i < outlines.length; i++) {
      const scene = await generateSceneWithTimeout(outlines[i], 90000)
      remainingScenes.push(scene)
      callbacks.onSceneReady(i, scene)
      callbacks.onProgress('generating_remaining', 70 + Math.round((i / outlines.length) * 25))
    }

    // 完整课程
    const finalCourse = {
      ...partialCourse,
      scenes: [...firstTwoScenes, ...remainingScenes],
      progress: 100,
      status: 'complete',
      canPlay: true
    }

    callbacks.onComplete(finalCourse)

  } catch (error) {
    callbacks.onError(error as Error)
  }
}

/**
 * 增强需求描述（添加AI扩展）
 */
async function enhanceRequirements(
  requirements: GenerationRequirements
): Promise<any> {
  // 这里可以调用EduKG或其他AI服务来增强需求
  // 目前返回基础增强
  return {
    ...requirements,
    learningGoals: requirements.learningGoals || [
      `理解${requirements.topic}的核心概念`,
      `掌握${requirements.topic}的基本方法`,
      `能够应用${requirements.topic}解决实际问题`
    ],
    estimatedDuration: requirements.estimatedDuration || 600
  }
}

/**
 * 生成简单大纲（用于演示）
 */
async function generateSimpleOutlines(requirements: any): Promise<any[]> {
  // 为演示生成固定的大纲结构
  return [
    {
      id: 'scene_1',
      type: 'slide',
      title: `${requirements.topic} - 概念引入`,
      description: `介绍${requirements.topic}的基本概念和重要性`,
      keyPoints: [
        `${requirements.topic}的定义`,
        `${requirements.topic}的历史背景`,
        `${requirements.topic}的现实意义`
      ],
      order: 1,
      language: 'zh-CN',
      subject: requirements.subject
    },
    {
      id: 'scene_2',
      type: 'slide',
      title: `${requirements.topic} - 核心原理`,
      description: `深入讲解${requirements.topic}的核心原理和性质`,
      keyPoints: [
        `${requirements.topic}的基本性质`,
        `${requirements.topic}的数学表达`,
        `${requirements.topic}的推导过程`
      ],
      order: 2,
      language: 'zh-CN',
      subject: requirements.subject
    },
    {
      id: 'scene_3',
      type: 'quiz',
      title: `${requirements.topic} - 基础测试`,
      description: `通过测试检验对${requirements.topic}基础知识的掌握`,
      keyPoints: [
        '基本概念理解',
        '核心原理应用',
        '常见问题辨析'
      ],
      quizConfig: {
        questionCount: 3,
        difficulty: 'easy',
        questionTypes: ['single']
      },
      order: 3,
      language: 'zh-CN',
      subject: requirements.subject
    },
    {
      id: 'scene_4',
      type: 'slide',
      title: `${requirements.topic} - 应用实例`,
      description: `通过实例展示${requirements.topic}的实际应用`,
      keyPoints: [
        `${requirements.topic}在生活中的应用`,
        `${requirements.topic}在学习中的应用`,
        `${requirements.topic}在其他领域的应用`
      ],
      order: 4,
      language: 'zh-CN',
      subject: requirements.subject
    },
    {
      id: 'scene_5',
      type: 'quiz',
      title: `${requirements.topic} - 综合测试`,
      description: `综合测试对${requirements.topic}的全面理解`,
      keyPoints: [
        '综合应用能力',
        '问题解决能力',
        '拓展思考能力'
      ],
      quizConfig: {
        questionCount: 5,
        difficulty: 'medium',
        questionTypes: ['single', 'multiple']
      },
      order: 5,
      language: 'zh-CN',
      subject: requirements.subject
    }
  ]
}

/**
 * 生成场景（带超时和降级）
 */
async function generateSceneWithTimeout(
  outline: any,
  timeoutMs: number
): Promise<any> {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('生成超时')), timeoutMs)
  )

  try {
    // 注意：这里需要适配现有的 generateSceneContent 接口
    // 由于现有实现需要 aiCall 函数，我们需要使用模板降级
    // 在实际使用中，应该调用真实的生成逻辑

    // 暂时直接使用模板降级
    const scene = await Promise.race([
      generateSceneContentMock(outline),
      timeoutPromise
    ]) as any

    return scene
  } catch (error) {
    console.warn(`场景生成失败，使用模板: ${outline.title}`, error)
    return getTemplateScene({
      type: outline.type,
      subject: outline.subject,
      topic: outline.title.split(' - ')[0]
    })
  }
}

/**
 * 生成场景内容（模拟版本）
 */
async function generateSceneContentMock(outline: any): Promise<any> {
  // 模拟AI生成延迟
  await new Promise(resolve => setTimeout(resolve, 2000))

  // 返回模拟的场景内容
  return {
    id: outline.id,
    type: outline.type,
    title: outline.title,
    description: outline.description,
    keyPoints: outline.keyPoints,
    content: {
      type: outline.type,
      // 根据类型返回不同的内容结构
      ...(outline.type === 'slide' && {
        elements: [
          {
            type: 'text',
            content: `<h2>${outline.title}</h2><p>${outline.description}</p>`,
            left: 50,
            top: 50,
            width: 900,
            height: 200
          }
        ],
        remark: outline.keyPoints.join('；')
      }),
      ...(outline.type === 'quiz' && {
        questions: [
          {
            id: 'q_1',
            type: 'single',
            question: `关于${outline.title.split(' - ')[0]}，以下说法正确的是？`,
            options: [
              { value: 'A', label: '选项A' },
              { value: 'B', label: '选项B' },
              { value: 'C', label: '选项C' },
              { value: 'D', label: '选项D' }
            ],
            answer: ['A']
          }
        ]
      })
    },
    actions: [
      {
        id: 'action_1',
        type: 'speech',
        title: '讲解',
        text: outline.description
      }
    ],
    duration: outline.type === 'quiz' ? 180 : 120
  }
}
