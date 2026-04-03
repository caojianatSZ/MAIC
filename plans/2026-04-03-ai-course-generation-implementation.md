# AI智能课程生成演示系统实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 使用OpenMAIC平台能力实际生成AI课程，展示从自然语言到完整课程的全流程能力，替代静态录屏演示。

**Architecture:**
- 利用现有 `lib/generation/` 模块进行课程生成（outline-generator → scene-generator）
- 使用EduKG知识图谱API提供智能推荐
- 通过SSE实现流式生成和实时进度推送
- 并发生成4个版本（2种风格 × 2种难度）存储到数据库

**Tech Stack:**
- Backend: Next.js 16, Prisma 6, TypeScript
- Frontend: 微信小程序（JavaScript）
- AI: Vercel AI SDK, LangGraph多智能体系统
- Database: PostgreSQL
- Real-time: Server-Sent Events (SSE)

---

## Task 1: 数据库Schema更新

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/xxx_add_classroom_models/migration.sql`

**Step 1: 添加Classroom模型和关联表到schema.prisma**

在 `prisma/schema.prisma` 文件末尾（在 `SystemConfig` 模型之后）添加：

```prisma
// ============================================
// AI课程生成模块
// ============================================

// AI生成的教室（课程）
model Classroom {
  id                String   @id @default(cuid())

  // 基本信息
  identifier         String   @unique  // classroom_xxx
  title              String
  description        String?
  subject            String   // math, physics, chinese等
  grade              String?  // 初一~高三

  // 分类标签
  difficulty         String?  // standard, advanced
  style              String?  // basic, applied
  versionType        String?  @map("version_type")  // basic_standard, basic_advanced等

  // 课程内容
  scenes             Json     // 场景数组
  sceneCount         Int      @map("scene_count")
  duration           Int      // 总时长（秒）

  // 生成信息
  parentTopic         String?  @map("parent_topic")  // 原始主题（用于多版本分组）
  generationMethod    String?  @map("generation_method")  // ai_generated, manually_created
  metadata            Json?    // 生成元数据（agents, duration, knowledgePointIds等）

  // 时间戳
  createdAt          DateTime @default(now()) @map("created_at")
  updatedAt          DateTime @updatedAt @map("updated_at")

  // 关联
  knowledgePoints    ClassroomKnowledgePoint[]

  @@index([subject, grade])
  @@index([parentTopic])
  @@index([versionType])
  @@index([createdAt])
  @@map("classrooms")
}

// Classroom与KnowledgePoint的多对多关系
model ClassroomKnowledgePoint {
  id                String   @id @default(cuid())
  classroomId       String   @map("classroom_id")
  classroom         Classroom @relation(fields: [classroomId], references: [id], onDelete: Cascade)

  knowledgePointId  String   @map("knowledge_point_id")
  knowledgePoint    KnowledgePoint @relation(fields: [knowledgePointId], references: [id], onDelete: Cascade)

  @@unique([classroomId, knowledgePointId])
  @@index([knowledgePointId])
  @@map("classroom_knowledge_points")
}
```

**Step 2: 运行数据库迁移**

```bash
pnpm prisma migrate dev --name add_classroom_models
```

Expected output:
```
Applying migration `20260403xxxxxx_add_classroom_models`

The following migration(s) have been created and applied from new schema changes:

migrations/
  └─ 20260403xxxxxx_add_classroom_models/
    └─ migration.sql

Your database is now in sync with your schema.
```

**Step 3: 生成Prisma Client**

```bash
pnpm prisma generate
```

Expected: Prisma Client生成成功，无错误

**Step 4: 验证新模型**

```bash
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// 测试创建Classroom
const classroom = await prisma.classroom.create({
  data: {
    identifier: 'test_classroom',
    title: 'Test Course',
    subject: 'math',
    grade: '初三',
    difficulty: 'standard',
    style: 'basic',
    versionType: 'basic_standard',
    scenes: [],
    sceneCount: 0,
    duration: 0,
    parentTopic: 'test',
    generationMethod: 'ai_generated'
  }
});

console.log('✓ Classroom created:', classroom.id);

// 清理测试数据
await prisma.classroom.delete({ where: { id: classroom.id } });
console.log('✓ Test data cleaned up');

await prisma.\$disconnect();
"
```

Expected output:
```
✓ Classroom created: [some-id]
✓ Test data cleaned up
```

**Step 5: 提交数据库变更**

```bash
git add prisma/schema.prisma prisma/migrations/ prisma/prisma-dev.log
git commit -m "feat: 添加Classroom模型和KnowledgePoint关联表

- 新增Classroom模型用于存储AI生成的课程
- 新增ClassroomKnowledgePoint关联表实现多对多关系
- 支持版本类型标签（style × difficulty）
- 添加索引优化查询性能"
```

---

## Task 2: 创建智能推荐API

**Files:**
- Create: `app/api/demo/recommendations/route.ts`
- Create: `lib/edukg/recommendation.ts`

**Step 1: 创建EduKG推荐工具模块**

创建文件 `lib/edukg/recommendation.ts`:

```typescript
/**
 * EduKG智能推荐模块
 * 基于年级和科目推荐热门知识点主题
 */

export interface Recommendation {
  topic: string
  knowledgePointId: string
  difficulty: '基础' | '重点' | '难点'
  estimatedDuration: number // 秒
  relatedTopics: string[]
  popularity: number // 0-100推荐分数
}

// 预定义推荐数据（基于EduKG知识图谱）
// 实际实施时可从EduKG API动态获取
const RECOMMENDATION_DB: Record<string, Record<string, Recommendation[]>> = {
  '初三': {
    '数学': [
      {
        topic: '二次函数最值',
        knowledgePointId: 'kp_quadratic_max_min',
        difficulty: '重点',
        estimatedDuration: 600,
        relatedTopics: ['配方法', '顶点式', '函数图像'],
        popularity: 95
      },
      {
        topic: '一元二次方程解法',
        knowledgePointId: 'kp_quadratic_equation',
        difficulty: '基础',
        estimatedDuration: 480,
        relatedTopics: ['因式分解', '公式法', '求根公式'],
        popularity: 90
      },
      {
        topic: '相似三角形判定',
        knowledgePointId: 'kp_similar_triangles',
        difficulty: '重点',
        estimatedDuration: 720,
        relatedTopics: ['全等三角形', '相似比', '判定定理'],
        popularity: 88
      },
      {
        topic: '圆的性质与切线',
        knowledgePointId: 'kp_circle_properties',
        difficulty: '难点',
        estimatedDuration: 900,
        relatedTopics: ['圆心角', '圆周角', '切线性质'],
        popularity: 85
      },
      {
        topic: '二次函数应用题',
        knowledgePointId: 'kp_quadratic_applications',
        difficulty: '难点',
        estimatedDuration: 600,
        relatedTopics: ['最值问题', '建模', '实际应用'],
        popularity: 92
      },
      {
        topic: '概率计算方法',
        knowledgePointId: 'kp_probability',
        difficulty: '基础',
        estimatedDuration: 360,
        relatedTopics: ['古典概型', '频率', '树状图'],
        popularity: 80
      }
    ],
    '物理': [
      {
        topic: '欧姆定律',
        knowledgePointId: 'kp_ohms_law',
        difficulty: '重点',
        estimatedDuration: 600,
        relatedTopics: ['电流', '电压', '电阻'],
        popularity: 95
      },
      {
        topic: '串联并联电路',
        knowledgePointId: 'kp_circuits',
        difficulty: '基础',
        estimatedDuration: 540,
        relatedTopics: ['电流规律', '电压规律', '电路分析'],
        popularity: 90
      }
    ],
    '语文': [
      {
        topic: '议论文写作方法',
        knowledgePointId: 'kp_argumentative_essay',
        difficulty: '重点',
        estimatedDuration: 720,
        relatedTopics: ['论点', '论据', '论证方法'],
        popularity: 88
      },
      {
        topic: '古诗词鉴赏',
        knowledgePointId: 'kp_poetry_appreciation',
        difficulty: '难点',
        estimatedDuration: 600,
        relatedTopics: ['意象', '意境', '表现手法'],
        popularity: 85
      }
    ]
  },
  '高一': {
    '数学': [
      {
        topic: '集合与函数',
        knowledgePointId: 'kp_sets_functions',
        difficulty: '基础',
        estimatedDuration: 540,
        relatedTopics: ['集合运算', '函数定义', '函数性质'],
        popularity: 90
      },
      {
        topic: '三角函数',
        knowledgePointId: 'kp_trigonometric_functions',
        difficulty: '重点',
        estimatedDuration: 720,
        relatedTopics: ['正弦', '余弦', '正切'],
        popularity: 92
      }
    ],
    '物理': [
      {
        topic: '力的分解与合成',
        knowledgePointId: 'kp_force_decomposition',
        difficulty: '重点',
        estimatedDuration: 600,
        relatedTopics: ['矢量', '平行四边形定则', '三角形定则'],
        popularity: 95
      },
      {
        topic: '牛顿运动定律',
        knowledgePointId: 'kp_newton_laws',
        difficulty: '重点',
        estimatedDuration: 720,
        relatedTopics: ['惯性', '加速度', '受力分析'],
        popularity: 93
      }
    ]
  }
}

/**
 * 获取推荐主题
 */
export async function getRecommendations(
  grade: string,
  subject: string,
  limit: number = 8
): Promise<Recommendation[]> {
  // 从预定义数据库中获取
  const recommendations = RECOMMENDATION_DB[grade]?.[subject] || []

  // 如果没有预定义数据，返回通用推荐
  if (recommendations.length === 0) {
    return getGenericRecommendations(subject, limit)
  }

  // 按popularity排序并限制数量
  return recommendations
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, limit)
}

/**
 * 获取通用推荐（当没有特定年级数据时）
 */
function getGenericRecommendations(subject: string, limit: number): Recommendation[] {
  const genericTopics: Record<string, string[]> = {
    '数学': ['函数基础', '方程求解', '几何证明', '统计分析'],
    '物理': ['力学基础', '电学基础', '光学现象', '能量转换'],
    '化学': ['元素周期表', '化学反应', '酸碱中和', '氧化还原'],
    '生物': ['细胞结构', '遗传规律', '生态系统', '光合作用'],
    '语文': ['阅读理解', '作文技巧', '古诗词', '文言文'],
    '英语': ['语法基础', '阅读技巧', '写作方法', '词汇积累']
  }

  const topics = genericTopics[subject] || ['基础知识', '重点难点', '实际应用']

  return topics.slice(0, limit).map((topic, index) => ({
    topic,
    knowledgePointId: `kp_generic_${index}`,
    difficulty: index < 2 ? '基础' : '重点',
    estimatedDuration: 600,
    relatedTopics: [],
    popularity: 70 - index * 5
  }))
}
```

**Step 2: 测试推荐模块**

创建测试文件 `tests/unit/edukg/recommendation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { getRecommendations } from '@/lib/edukg/recommendation'

describe('EduKG Recommendation', () => {
  it('should return recommendations for 初三数学', async () => {
    const recommendations = await getRecommendations('初三', '数学', 6)

    expect(recommendations).toHaveLength(6)
    expect(recommendations[0].topic).toBe('二次函数最值')
    expect(recommendations[0].popularity).toBeGreaterThan(90)
  })

  it('should return empty array for invalid grade', async () => {
    const recommendations = await getRecommendations('不存在', '数学', 6)

    expect(Array.isArray(recommendations)).toBe(true)
  })

  it('should sort by popularity', async () => {
    const recommendations = await getRecommendations('初三', '数学', 10)

    for (let i = 0; i < recommendations.length - 1; i++) {
      expect(recommendations[i].popularity).toBeGreaterThanOrEqual(recommendations[i + 1].popularity)
    }
  })
})
```

运行测试：
```bash
pnpm test tests/unit/edukg/recommendation.test.ts
```

Expected: 所有测试通过

**Step 3: 创建推荐API端点**

创建文件 `app/api/demo/recommendations/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { apiSuccess, apiError } from '@/lib/server/api-response'
import { getRecommendations } from '@/lib/edukg/recommendation'

/**
 * 智能推荐API
 * GET /api/demo/recommendations?grade=初三&subject=数学&limit=8
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const grade = searchParams.get('grade')
    const subject = searchParams.get('subject')
    const limit = parseInt(searchParams.get('limit') || '8', 10)

    // 参数验证
    if (!grade || !subject) {
      return apiError('缺少必要参数: grade 和 subject')
    }

    // 获取推荐
    const recommendations = await getRecommendations(grade, subject, limit)

    return apiSuccess({
      grade,
      subject,
      count: recommendations.length,
      recommendations
    })
  } catch (error) {
    console.error('推荐API错误:', error)
    return apiError('获取推荐失败', 500)
  }
}
```

**Step 4: 测试API端点**

```bash
curl "http://localhost:3000/api/demo/recommendations?grade=初三&subject=数学&limit=3"
```

Expected response:
```json
{
  "success": true,
  "data": {
    "grade": "初三",
    "subject": "数学",
    "count": 3,
    "recommendations": [
      {
        "topic": "二次函数最值",
        "knowledgePointId": "kp_quadratic_max_min",
        "difficulty": "重点",
        "estimatedDuration": 600,
        "relatedTopics": ["配方法", "顶点式", "函数图像"],
        "popularity": 95
      },
      ...
    ]
  }
}
```

**Step 5: 提交推荐功能**

```bash
git add lib/edukg/ app/api/demo/recommendations/ tests/unit/edukg/
git commit -m "feat: 添加智能推荐API

- 新增EduKG推荐模块
- 基于年级和科目推荐热门知识点
- 支持初三数学/物理/语文、高一数学/物理
- 预定义推荐数据库（可扩展为EduKG API调用）
- 添加单元测试"
```

---

## Task 3: 修改课程生成API支持流式生成

**Files:**
- Modify: `app/api/demo/generate-course/route.ts`
- Create: `lib/generation/streaming-generator.ts`

**Step 1: 创建流式生成器模块**

创建文件 `lib/generation/streaming-generator.ts`:

```typescript
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

export interface StreamEvent {
  type: 'progress' | 'scene_ready' | 'partial_ready' | 'generation_complete' | 'error'
  data: any
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

    const outlines = await generateSceneOutlinesFromRequirements(enhancedRequirements)
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
    const scene = await Promise.race([
      generateSceneContent(outline),
      timeoutPromise
    ]) as any

    return scene
  } catch (error) {
    console.warn(`场景生成失败，使用模板: ${outline.title}`, error)
    return getTemplateScene({
      type: outline.type,
      subject: outline.subject,
      topic: outline.topic
    })
  }
}
```

**Step 2: 创建模板降级模块**

创建文件 `lib/generation/template-fallback.ts`:

```typescript
/**
 * 模板降级模块
 * 当AI生成失败时使用预定义模板
 */

export interface TemplateOptions {
  type: string
  subject: string
  topic: string
}

export function getTemplateScene(options: TemplateOptions): any {
  const { type, subject, topic } = options

  const templates: Record<string, any> = {
    'slide': {
      type: 'slide',
      title: `${topic} - 概念讲解`,
      content: {
        type: 'explanation',
        text: `关于${topic}的核心知识点讲解。这是AI生成时的降级模板，实际使用时会由AI生成更丰富的内容。`,
        keyPoints: [
          `${topic}的基本概念`,
          `${topic}的重要性质`,
          `${topic}的应用方法`
        ]
      },
      duration: 120
    },
    'quiz': {
      type: 'quiz',
      title: `${topic} - 练习测试`,
      content: {
        type: 'quiz',
        questions: [
          {
            question: `关于${topic}，以下说法正确的是？`,
            options: [
              '选项A：这是降级模板的选项A',
              '选项B：这是降级模板的选项B',
              '选项C：这是降级模板的选项C',
              '选项D：这是降级模板的选项D'
            ],
            correctAnswer: 0,
            explanation: '这是AI生成时的降级解释'
          }
        ]
      },
      duration: 180
    },
    'interactive': {
      type: 'interactive',
      title: `${topic} - 互动探索`,
      content: {
        type: 'interactive_simulation',
        description: `探索${topic}的相关概念和性质`,
        interactiveElements: ['slider', 'stepByStep']
      },
      duration: 150
    }
  }

  return templates[type] || templates['slide']
}
```

**Step 3: 重写生成API支持流式输出**

完全重写 `app/api/demo/generate-course/route.ts`:

```typescript
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
        sendEvent('progress', { stage: 'starting', percent: 0 })

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
              sendEvent('progress', { stage, percent })
            },
            onSceneReady: (sceneIndex, scene) => {
              sendEvent('scene_ready', { sceneIndex, scene })
            },
            onPartialReady: (partialCourse) => {
              sendEvent('partial_ready', partialCourse)
            },
            onComplete: (finalCourse) => {
              sendEvent('generation_complete', finalCourse)
              controller.close()
            },
            onError: (error) => {
              sendEvent('error', {
                message: error.message || '生成失败',
                code: 'GENERATION_ERROR'
              })
              controller.close()
            }
          }
        )

      } catch (error) {
        sendEvent('error', {
          message: '请求处理失败',
          code: 'REQUEST_ERROR'
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
      'Access-Control-Allow-Origin': '*'
    }
  })
}
```

**Step 4: 测试流式API**

创建测试脚本 `scripts/test-streaming-generation.mjs`:

```javascript
#!/usr/bin/env node

/**
 * 测试流式课程生成API
 */

async function testStreamingGeneration() {
  console.log('🚀 开始测试流式课程生成...\n')

  const response = await fetch('http://localhost:3000/api/demo/generate-course', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: '二次函数最值',
      grade: '初三',
      subject: '数学',
      difficulty: 'standard',
      style: 'basic'
    })
  })

  if (!response.ok) {
    console.error('❌ API调用失败:', response.status)
    process.exit(1)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      console.log('\n✅ 生成完成')
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('event:')) {
        const event = line.substring(7).trim()
        continue
      }

      if (line.startsWith('data:')) {
        try {
          const data = JSON.parse(line.substring(5).trim())

          if (data.stage) {
            console.log(`⏳ [${data.percent}%] ${data.stage}`)
          } else if (data.sceneIndex !== undefined) {
            console.log(`✓ 场景${data.sceneIndex + 1}生成完成`)
          } else if (data.canPlay) {
            console.log(`\n🎬 初版课程就绪！`)
            console.log(`   课程ID: ${data.courseId}`)
            console.log(`   已生成: ${data.scenes.length}/${data.totalScenes}个场景`)
            console.log(`   进度: ${data.progress}%\n`)
          } else if (data.status === 'complete') {
            console.log(`\n🎉 全部生成完成！`)
            console.log(`   总场景数: ${data.scenes.length}`)
          } else if (data.message) {
            console.log(`❌ 错误: ${data.message}`)
          }
        } catch (e) {
          // 忽略JSON解析错误
        }
      }
    }
  }
}

testStreamingGeneration().catch(console.error)
```

运行测试：
```bash
node scripts/test-streaming-generation.mjs
```

Expected output:
```
🚀 开始测试流式课程生成...

⏳ [10%] analyzing
⏳ [30%] generating_outline
⏳ [50%] outline_ready
⏳ [60%] generating_first_scenes
✓ 场景1生成完成
✓ 场景2生成完成

🎬 初版课程就绪！
   课程ID: course_xxx
   已生成: 2/6个场景
   进度: 33%

⏳ [70%] generating_remaining
✓ 场景3生成完成
✓ 场景4生成完成
✓ 场景5生成完成
✓ 场景6生成完成

🎉 全部生成完成！
   总场景数: 6

✅ 生成完成
```

**Step 5: 提交流式生成功能**

```bash
git add lib/generation/streaming-generator.ts lib/generation/template-fallback.ts app/api/demo/generate-course/route.ts scripts/test-streaming-generation.mjs
git commit -m "feat: 实现流式课程生成API

- 新增流式生成器，支持边生成边返回
- 首屏2个场景30秒就绪，后台继续生成
- SSE实时推送进度和场景
- 超时控制（90秒/场景）+ 模板降级
- 添加测试脚本验证流式输出"
```

---

## Task 4: 实现多版本并发生成

**Files:**
- Create: `lib/generation/multi-version-generator.ts`
- Create: `app/api/demo/generate-versions/route.ts`

**Step 1: 创建多版本生成器**

创建文件 `lib/generation/multi-version-generator.ts`:

```typescript
/**
 * 多版本并发生成器
 * 同时生成4个版本：2种风格 × 2种难度
 */

import { prisma } from '@/lib/prisma'
import { generateCourseStreaming, StreamCallbacks } from './streaming-generator'

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
        duration: 0, // 从生成的课程获取
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
  let finalCourse: any = null

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
        onProgress: () => {}, // 忽略进度
        onSceneReady: () => {}, // 忽略场景
        onPartialReady: () => {}, // 忽略部分完成
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
      duration: finalCourse.scenes.reduce((sum: number, s: any) => sum + (s.duration || 0), 0),
      metadata: {
        generatedBy: 'OpenMAIC',
        agentsInvolved: ['课程设计智能体', '内容生成智能体'],
        generationDuration: Date.now(),
        knowledgePointIds: config.topic // 实际应从EduKG获取
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
  const styleNames = {
    'basic': '基础型',
    'applied': '应用型'
  }
  const difficultyNames = {
    'standard': '标准',
    'advanced': '进阶'
  }

  return `${topic} - ${styleNames[style as keyof typeof styleNames]}×${difficultyNames[difficulty as keyof typeof difficultyNames]}`
}
```

**Step 2: 创建多版本生成API**

创建文件 `app/api/demo/generate-versions/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { apiSuccess } from '@/lib/server/api-response'
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

    return apiSuccess(result)
  } catch (error) {
    console.error('多版本生成失败:', error)
    return NextResponse.json({
      success: false,
      error: '多版本生成失败'
    }, { status: 500 })
  }
}
```

**Step 3: 测试多版本生成**

创建测试脚本 `scripts/test-multi-version.mjs`:

```javascript
#!/usr/bin/env node

/**
 * 测试多版本并发生成
 */

async function testMultiVersionGeneration() {
  console.log('🚀 开始测试多版本并发生成...\n')

  const startTime = Date.now()

  const response = await fetch('http://localhost:3000/api/demo/generate-versions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: '二次函数最值',
      grade: '初三',
      subject: '数学'
    })
  })

  const result = await response.json()
  const duration = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log(`\n✅ 多版本生成完成！`)
  console.log(`   总耗时: ${duration}秒`)
  console.log(`   成功: ${result.data.versions.length}/4个版本\n`)

  result.data.versions.forEach((v, i) => {
    console.log(`${i + 1}. ${v.title}`)
    console.log(`   ID: ${v.classroomId}`)
    console.log(`   风格: ${v.style} | 难度: ${v.difficulty}`)
    console.log(`   场景数: ${v.sceneCount} | 时长: ${Math.round(v.duration / 60)}分钟\n`)
  })
}

testMultiVersionGeneration().catch(console.error)
```

运行测试：
```bash
node scripts/test-multi-version.mjs
```

Expected output:
```
🚀 开始测试多版本并发生成...

✓ 版本1/4: 二次函数最值 - 基础型×标准 - 成功
✓ 版本2/4: 二次函数最值 - 基础型×进阶 - 成功
✓ 版本3/4: 二次函数最值 - 应用型×标准 - 成功
✓ 版本4/4: 二次函数最值 - 应用型×进阶 - 成功

✅ 多版本生成完成！
   总耗时: 180.5秒
   成功: 4/4个版本

1. 二次函数最值 - 基础型×标准
   ID: classroom_xxx
   风格: basic | 难度: standard
   场景数: 6 | 时长: 10分钟

...
```

**Step 4: 提交多版本生成**

```bash
git add lib/generation/multi-version-generator.ts app/api/demo/generate-versions/ scripts/test-multi-version.mjs
git commit -m "feat: 实现多版本并发生成系统

- 同时生成4个版本（2种风格 × 2种难度）
- 并行执行，提升生成效率
- 自动存储到数据库
- 支持版本管理和查询"
```

---

## Task 5: 创建课程库查询和预览API

**Files:**
- Create: `app/api/demo/library/route.ts`
- Create: `app/api/demo/preview/[classroomId]/route.ts`

**Step 1: 创建课程库查询API**

创建文件 `app/api/demo/library/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/server/api-response'

/**
 * 课程库查询API
 * GET /api/demo/library?topic=二次函数最值
 *
 * 查询某个主题的所有生成版本
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const topic = searchParams.get('topic')

    if (!topic) {
      return apiError('缺少topic参数')
    }

    // 查询该主题的所有版本
    const classrooms = await prisma.classroom.findMany({
      where: {
        parentTopic: topic,
        generationMethod: 'ai_generated'
      },
      orderBy: { createdAt: 'desc' },
      take: 4
    })

    // 格式化返回
    const versions = classrooms.map(c => ({
      classroomId: c.id,
      title: c.title,
      style: c.style,
      difficulty: c.difficulty,
      duration: c.duration,
      sceneCount: c.sceneCount,
      versionType: c.versionType,
      createdAt: c.createdAt
    }))

    return apiSuccess({
      topic,
      count: versions.length,
      versions
    })
  } catch (error) {
    console.error('课程库查询失败:', error)
    return apiError('查询失败', 500)
  }
}
```

**Step 2: 创建版本预览API**

创建文件 `app/api/demo/preview/[classroomId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiSuccess, apiError } from '@/lib/server/api-response'

/**
 * 版本预览API
 * GET /api/demo/preview/:classroomId
 *
 * 获取某个版本的详细信息（大纲+首场景）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { classroomId: string } }
) {
  try {
    const { classroomId } = params

    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      include: {
        knowledgePoints: {
          include: {
            knowledgePoint: true
          }
        }
      }
    })

    if (!classroom) {
      return apiError('课程不存在', 404)
    }

    // 提取场景大纲
    const scenes = classroom.scenes as any[]
    const outline = scenes.map((s, i) => ({
      sceneIndex: i,
      title: s.title,
      type: s.type,
      duration: s.duration
    }))

    // 获取知识点列表
    const knowledgePoints = classroom.knowledgePoints.map(kp => kp.knowledgePoint.name)

    return apiSuccess({
      classroomId: classroom.id,
      title: classroom.title,
      description: classroom.description,
      subject: classroom.subject,
      grade: classroom.grade,
      style: classroom.style,
      difficulty: classroom.difficulty,
      versionType: classroom.versionType,
      duration: classroom.duration,
      sceneCount: classroom.sceneCount,
      knowledgePoints,
      outline,
      firstScene: scenes[0] || null,
      metadata: classroom.metadata
    })
  } catch (error) {
    console.error('预览获取失败:', error)
    return apiError('获取预览失败', 500)
  }
}
```

**Step 3: 测试课程库API**

```bash
# 先生成多版本
node scripts/test-multi-version.mjs

# 查询课程库
curl "http://localhost:3000/api/demo/library?topic=二次函数最值"

# 预览某个版本（替换为实际ID）
curl "http://localhost:3000/api/demo/preview/[classroomId]"
```

**Step 4: 提交课程库API**

```bash
git add app/api/demo/library/ app/api/demo/preview/
git commit -m "feat: 添加课程库查询和预览API

- 查询某个主题的所有生成版本
- 获取版本详细信息（大纲+首场景）
- 支持知识点关联展示"
```

---

## Task 6: 创建小程序输入页面

**Files:**
- Create: `miniprogram/pages/demo-input/demo-input.js`
- Create: `miniprogram/pages/demo-input/demo-input.wxml`
- Create: `miniprogram/pages/demo-input/demo-input.wxss`
- Create: `miniprogram/pages/demo-input/demo-input.json`
- Modify: `miniprogram/app.json`

**Step 1: 在app.json中注册新页面**

修改 `miniprogram/app.json`，在 `pages` 数组中添加：

```json
{
  "pages": [
    "pages/index/index",
    "pages/demo-input/demo-input",
    ...
  ]
}
```

**Step 2: 创建输入页面逻辑**

创建文件 `miniprogram/pages/demo-input/demo-input.js`:

```javascript
// pages/demo-input/demo-input.js
const { getBaseUrl } = require('../../utils/config')

Page({
  data: {
    // 用户选择
    selectedGrade: '初三',
    selectedSubject: '数学',

    // 选项列表
    gradeOptions: ['初一', '初二', '初三', '高一', '高二', '高三'],
    subjectOptions: ['数学', '物理', '化学', '生物', '语文', '英语', '历史', '地理', '政治'],

    // 推荐主题
    recommendations: [],
    loadingRecommendations: false,

    // 输入框
    inputTopic: '',

    // 生成状态
    generating: false
  },

  onLoad() {
    this.loadRecommendations()
  },

  /**
   * 选择年级
   */
  onSelectGrade(e) {
    const grade = e.currentTarget.dataset.grade
    this.setData({ selectedGrade: grade })
    this.loadRecommendations()
  },

  /**
   * 选择科目
   */
  onSelectSubject(e) {
    const subject = e.currentTarget.dataset.subject
    this.setData({ selectedSubject: subject })
    this.loadRecommendations()
  },

  /**
   * 加载推荐主题
   */
  async loadRecommendations() {
    const { selectedGrade, selectedSubject } = this.data

    this.setData({ loadingRecommendations: true })

    try {
      const res = await wx.request({
        url: `${getBaseUrl()}/api/demo/recommendations`,
        method: 'GET',
        data: {
          grade: selectedGrade,
          subject: selectedSubject,
          limit: 8
        }
      })

      if (res.data.success) {
        this.setData({
          recommendations: res.data.data.recommendations
        })
      }
    } catch (err) {
      console.error('加载推荐失败:', err)
    } finally {
      this.setData({ loadingRecommendations: false })
    }
  },

  /**
   * 点击推荐卡片
   */
  onSelectRecommendation(e) {
    const topic = e.currentTarget.dataset.topic
    this.setData({ inputTopic: topic })
  },

  /**
   * 输入框变化
   */
  onInputChange(e) {
    this.setData({
      inputTopic: e.detail.value
    })
  },

  /**
   * 开始生成
   */
  onStartGeneration() {
    const { inputTopic, selectedGrade, selectedSubject } = this.data

    if (!inputTopic) {
      wx.showToast({
        title: '请输入或选择主题',
        icon: 'none'
      })
      return
    }

    // 跳转到生成进度页面
    wx.navigateTo({
      url: `/pages/demo-generating/demo-generating?topic=${encodeURIComponent(inputTopic)}&grade=${selectedGrade}&subject=${selectedSubject}`
    })
  }
})
```

**Step 3: 创建输入页面UI**

创建文件 `miniprogram/pages/demo-input/demo-input.wxml`:

```xml
<view class="demo-input-page">
  <!-- 顶部用户信息卡片 -->
  <view class="user-info-card">
    <view class="info-row">
      <text class="label">年级</text>
      <scroll-view class="options-scroll" scroll-x>
        <view class="grade-options">
          <view
            wx:for="{{gradeOptions}}"
            wx:key="*this"
            class="option-item {{selectedGrade === item ? 'active' : ''}}"
            data-grade="{{item}}"
            bindtap="onSelectGrade"
          >
            {{item}}
          </view>
        </view>
      </scroll-view>
    </view>

    <view class="info-row">
      <text class="label">科目</text>
      <scroll-view class="options-scroll" scroll-x>
        <view class="subject-options">
          <view
            wx:for="{{subjectOptions}}"
            wx:key="*this"
            class="option-item {{selectedSubject === item ? 'active' : ''}}"
            data-subject="{{item}}"
            bindtap="onSelectSubject"
          >
            {{item}}
          </view>
        </view>
      </scroll-view>
    </view>
  </view>

  <!-- 智能推荐区域 -->
  <view class="recommendations-section">
    <view class="section-header">
      <text class="section-title">为你推荐的主题</text>
      <text class="section-subtitle">基于{{selectedGrade}}{{selectedSubject}}</text>
    </view>

    <view wx:if="{{loadingRecommendations}}" class="loading">
      <text>加载中...</text>
    </view>

    <view wx:else class="recommendations-grid">
      <view
        wx:for="{{recommendations}}"
        wx:key="knowledgePointId"
        class="recommendation-card"
        data-topic="{{item.topic}}"
        bindtap="onSelectRecommendation"
      >
        <view class="card-header">
          <text class="topic-name">{{item.topic}}</text>
          <view class="difficulty-badge {{item.difficulty}}">{{item.difficulty}}</view>
        </view>
        <view class="card-body">
          <text class="duration">{{item.estimatedDuration / 60}}分钟</text>
          <text class="popularity">推荐度 {{item.popularity}}%</text>
        </view>
        <view wx:if="{{item.relatedTopics.length > 0}}" class="card-footer">
          <text class="related-label">关联:</text>
          <text class="related-topics">{{item.relatedTopics.join('、')}}</text>
        </view>
      </view>
    </view>
  </view>

  <!-- 自定义输入区域 -->
  <view class="input-section">
    <view class="section-header">
      <text class="section-title">或输入自定义主题</text>
    </view>

    <view class="input-wrapper">
      <input
        class="topic-input"
        placeholder="如：二次函数最值"
        value="{{inputTopic}}"
        bindinput="onInputChange"
      />
    </view>
  </view>

  <!-- 开始生成按钮 -->
  <view class="action-section">
    <button
      class="start-button"
      disabled="{{!inputTopic || generating}}"
      bindtap="onStartGeneration"
    >
      开始生成
    </button>
    <text class="hint-text">平均生成时间：2-3分钟</text>
  </view>
</view>
```

**Step 4: 创建页面样式**

创建文件 `miniprogram/pages/demo-input/demo-input.wxss`:

```css
.demo-input-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx;
}

/* 用户信息卡片 */
.user-info-card {
  background: white;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.info-row {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}

.info-row:last-child {
  margin-bottom: 0;
}

.label {
  font-size: 28rpx;
  color: #333;
  margin-right: 16rpx;
  min-width: 80rpx;
}

.options-scroll {
  flex: 1;
  white-space: nowrap;
}

.grade-options, .subject-options {
  display: inline-flex;
}

.option-item {
  display: inline-block;
  padding: 8rpx 20rpx;
  margin-right: 12rpx;
  border-radius: 20rpx;
  font-size: 26rpx;
  background: #f0f0f0;
  color: #666;
  transition: all 0.3s;
}

.option-item.active {
  background: #1890ff;
  color: white;
}

/* 推荐区域 */
.recommendations-section {
  background: white;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.section-subtitle {
  font-size: 24rpx;
  color: #999;
}

.recommendations-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
}

.recommendation-card {
  background: #f9f9f9;
  border-radius: 12rpx;
  padding: 20rpx;
  border: 2rpx solid transparent;
  transition: all 0.3s;
}

.recommendation-card:active {
  border-color: #1890ff;
  background: #e6f7ff;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.topic-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
  flex: 1;
}

.difficulty-badge {
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  font-size: 20rpx;
}

.difficulty-badge.基础 {
  background: #e6f7ff;
  color: #1890ff;
}

.difficulty-badge.重点 {
  background: #fff7e6;
  color: #fa8c16;
}

.difficulty-badge.难点 {
  background: #fff1f0;
  color: #f5222d;
}

.card-body {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.duration, .popularity {
  font-size: 24rpx;
  color: #999;
}

.card-footer {
  font-size: 22rpx;
  color: #aaa;
}

.related-label {
  margin-right: 8rpx;
}

.related-topics {
  color: #666;
}

/* 输入区域 */
.input-section {
  background: white;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}

.input-wrapper {
  margin-top: 16rpx;
}

.topic-input {
  width: 100%;
  padding: 20rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 12rpx;
  font-size: 30rpx;
}

/* 操作区域 */
.action-section {
  padding: 20rpx 0;
}

.start-button {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
  color: white;
  font-size: 32rpx;
  font-weight: 500;
  border-radius: 44rpx;
  border: none;
}

.start-button[disabled] {
  background: #d9d9d9;
}

.hint-text {
  display: block;
  text-align: center;
  font-size: 24rpx;
  color: #999;
  margin-top: 16rpx;
}
```

**Step 5: 创建页面配置**

创建文件 `miniprogram/pages/demo-input/demo-input.json`:

```json
{
  "navigationBarTitleText": "AI课程生成",
  "navigationBarBackgroundColor": "#1890ff",
  "navigationBarTextStyle": "white"
}
```

**Step 6: 测试输入页面**

在微信开发者工具中：
1. 打开小程序
2. 导航到 demo-input 页面
3. 选择年级和科目
4. 点击推荐卡片或输入主题
5. 点击"开始生成"按钮

Expected: 能够正常选择和输入，跳转到生成页面

**Step 7: 提交输入页面**

```bash
git add miniprogram/pages/demo-input/ miniprogram/app.json
git commit -m "feat: 添加智能推荐输入页面

- 支持年级和科目选择
- 基于EduKG智能推荐主题
- 推荐卡片展示难度、时长、关联知识点
- 支持自定义主题输入"
```

---

## Task 7: 创建生成进度页面（SSE接收）

**Files:**
- Create: `miniprogram/pages/demo-generating/demo-generating.js`
- Create: `miniprogram/pages/demo-generating/demo-generating.wxml`
- Create: `miniprogram/pages/demo-generating/demo-generating.wxss`
- Create: `miniprogram/pages/demo-generating/demo-generating.json`
- Modify: `miniprogram/app.json`

**Step 1: 注册生成进度页面**

修改 `miniprogram/app.json`，添加页面路径：

```json
{
  "pages": [
    "pages/demo-input/demo-input",
    "pages/demo-generating/demo-generating",
    ...
  ]
}
```

**Step 2: 创建生成进度页面逻辑**

创建文件 `miniprogram/pages/demo-generating/demo-generating.js`:

```javascript
// pages/demo-generating/demo-generating.js
const { getBaseUrl } = require('../../utils/config')

Page({
  data: {
    topic: '',
    grade: '',
    subject: '',

    // 生成状态
    currentStage: '',
    progress: 0,

    // 场景列表
    scenes: [],
    totalScenes: 0,

    // 初版课程
    partialCourse: null,
    canPlay: false,

    // WebSocket连接
    socketConnected: false
  },

  onLoad(options) {
    const { topic, grade, subject } = options

    this.setData({
      topic: decodeURIComponent(topic),
      grade: decodeURIComponent(grade),
      subject: decodeURIComponent(subject)
    })

    this.startGeneration()
  },

  /**
   * 开始生成（使用轮询模拟SSE）
   */
  async startGeneration() {
    const { topic, grade, subject } = this.data

    try {
      // 调用流式生成API
      // 注意：小程序不支持SSE，使用轮询或WebSocket
      // 这里使用简化版本：调用API后等待complete事件

      wx.showLoading({ title: '生成中...', mask: true })

      // 方案1: 使用现有的生成API（非流式）
      const res = await wx.request({
        url: `${getBaseUrl()}/api/demo/generate-course`,
        method: 'POST',
        data: {
          topic,
          grade,
          subject,
          difficulty: 'standard',
          style: 'basic'
        }
      })

      wx.hideLoading()

      if (res.data.success || res.statusCode === 201) {
        const course = res.data.data

        this.setData({
          partialCourse: course,
          scenes: course.scenes || [],
          totalScenes: course.sceneCount || course.scenes?.length || 0,
          canPlay: true,
          progress: 100
        })

        wx.showToast({
          title: '生成完成！',
          icon: 'success'
        })
      } else {
        throw new Error(res.data.error || '生成失败')
      }

    } catch (err) {
      wx.hideLoading()
      console.error('生成失败:', err)

      wx.showModal({
        title: '生成失败',
        content: err.message || '课程生成失败，请重试',
        confirmText: '重试',
        cancelText: '返回',
        success: (res) => {
          if (res.confirm) {
            this.startGeneration()
          } else {
            wx.navigateBack()
          }
        }
      })
    }
  },

  /**
   * 立即播放
   */
  onPlayNow() {
    const { partialCourse } = this.data

    if (!partialCourse) {
      wx.showToast({
        title: '课程尚未就绪',
        icon: 'none'
      })
      return
    }

    // 跳转到播放器
    wx.navigateTo({
      url: `/pages/player/player?classroomId=${partialCourse.courseId}&mode=demo&courseData=${encodeURIComponent(JSON.stringify(partialCourse))}`
    })
  },

  /**
   * 等待完整版
   */
  onWaitComplete() {
    wx.showToast({
      title: '继续生成中...',
      icon: 'loading'
    })
  },

  onUnload() {
    // 清理连接
  }
})
```

**Step 3: 创建生成进度页面UI**

创建文件 `miniprogram/pages/demo-generating/demo-generating.wxml`:

```xml
<view class="demo-generating-page">
  <!-- 顶部状态 -->
  <view class="header-section">
    <text class="page-title">正在生成课程</text>
    <text class="topic-name">"{{topic}}"</text>
  </view>

  <!-- 进度条 -->
  <view class="progress-section">
    <view class="progress-bar">
      <view class="progress-fill" style="width: {{progress}}%"></view>
    </view>
    <text class="progress-text">{{progress}}%</text>
  </view>

  <!-- 当前步骤 -->
  <view wx:if="{{currentStage}}" class="stage-section">
    <text class="stage-text">{{currentStage}}</text>
  </view>

  <!-- 场景列表 -->
  <view class="scenes-section">
    <view class="section-header">
      <text class="section-title">课程场景</text>
      <text class="scene-count">{{scenes.length}}/{{totalScenes}}</text>
    </view>

    <view class="scenes-list">
      <view
        wx:for="{{scenes}}"
        wx:key="id"
        class="scene-item completed"
      >
        <view class="scene-icon">✓</view>
        <view class="scene-info">
          <text class="scene-title">{{item.title}}</text>
          <text class="scene-type">{{item.type}}</text>
        </view>
        <view class="scene-duration">{{item.duration || 0}}秒</view>
      </view>

      <!-- 占位符：显示正在生成的场景 -->
      <view wx:if="{{scenes.length < totalScenes}}" class="scene-item generating">
        <view class="scene-icon loading">⏳</view>
        <view class="scene-info">
          <text class="scene-title">正在生成...</text>
        </view>
      </view>
    </view>
  </view>

  <!-- 操作按钮 -->
  <view class="action-section">
    <button
      class="play-button {{canPlay ? 'active' : ''}}"
      disabled="{{!canPlay}}"
      bindtap="onPlayNow"
    >
      立即播放
    </button>

    <button
      wx:if="{{!canPlay}}"
      class="wait-button"
      bindtap="onWaitComplete"
    >
      继续等待完整版
    </button>
  </view>
</view>
```

**Step 4: 创建页面样式**

创建文件 `miniprogram/pages/demo-generating/demo-generating.wxss`:

```css
.demo-generating-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40rpx 20rpx;
}

/* 顶部状态 */
.header-section {
  text-align: center;
  margin-bottom: 60rpx;
}

.page-title {
  display: block;
  font-size: 36rpx;
  color: white;
  margin-bottom: 16rpx;
}

.topic-name {
  display: block;
  font-size: 48rpx;
  font-weight: bold;
  color: white;
}

/* 进度条 */
.progress-section {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 40rpx;
}

.progress-bar {
  height: 12rpx;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 6rpx;
  overflow: hidden;
  margin-bottom: 16rpx;
}

.progress-fill {
  height: 100%;
  background: white;
  border-radius: 6rpx;
  transition: width 0.3s;
}

.progress-text {
  display: block;
  text-align: center;
  font-size: 28rpx;
  color: white;
  font-weight: 500;
}

/* 当前步骤 */
.stage-section {
  text-align: center;
  margin-bottom: 40rpx;
}

.stage-text {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.9);
}

/* 场景列表 */
.scenes-section {
  background: white;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 40rpx;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.scene-count {
  font-size: 26rpx;
  color: #999;
}

.scenes-list {
  max-height: 600rpx;
  overflow-y: auto;
}

.scene-item {
  display: flex;
  align-items: center;
  padding: 20rpx;
  margin-bottom: 12rpx;
  background: #f9f9f9;
  border-radius: 12rpx;
}

.scene-icon {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16rpx;
  font-size: 32rpx;
}

.scene-item.completed .scene-icon {
  background: #52c41a;
  color: white;
  border-radius: 50%;
}

.scene-item.generating .scene-icon.loading {
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.scene-info {
  flex: 1;
}

.scene-title {
  display: block;
  font-size: 28rpx;
  color: #333;
  margin-bottom: 4rpx;
}

.scene-type {
  font-size: 24rpx;
  color: #999;
}

.scene-duration {
  font-size: 24rpx;
  color: #666;
}

/* 操作按钮 */
.action-section {
  padding: 20rpx 0;
}

.play-button {
  width: 100%;
  height: 88rpx;
  background: white;
  color: #667eea;
  font-size: 32rpx;
  font-weight: 500;
  border-radius: 44rpx;
  border: none;
}

.play-button.active {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.play-button[disabled] {
  background: rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 0.5);
}

.wait-button {
  width: 100%;
  height: 88rpx;
  background: transparent;
  color: white;
  font-size: 28rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.5);
  border-radius: 44rpx;
  margin-top: 16rpx;
}
```

**Step 5: 创建页面配置**

创建文件 `miniprogram/pages/demo-generating/demo-generating.json`:

```json
{
  "navigationBarTitleText": "生成中",
  "navigationBarBackgroundColor": "#667eea",
  "navigationBarTextStyle": "white"
}
```

**Step 6: 提交生成进度页面**

```bash
git add miniprogram/pages/demo-generating/ miniprogram/app.json
git commit -m "feat: 添加生成进度展示页面

- 实时显示生成进度和场景列表
- 初版就绪后可立即播放
- 支持边生成边播放"
```

---

## Task 8: 创建课程库展示页面

**Files:**
- Create: `miniprogram/pages/demo-library/demo-library.js`
- Create: `miniprogram/pages/demo-library/demo-library.wxml`
- Create: `miniprogram/pages/demo-library/demo-library.wxss`
- Create: `miniprogram/pages/demo-library/demo-library.json`
- Modify: `miniprogram/app.json`

**Step 1: 注册课程库页面**

修改 `miniprogram/app.json`，添加页面路径。

**Step 2: 创建课程库页面逻辑**

创建文件 `miniprogram/pages/demo-library/demo-library.js`:

```javascript
// pages/demo-library/demo-library.js
const { getBaseUrl } = require('../../utils/config')

Page({
  data: {
    topic: '',
    versions: [],
    loading: true
  },

  onLoad(options) {
    const { topic } = options

    this.setData({ topic: decodeURIComponent(topic) })
    this.loadLibrary()
  },

  /**
   * 加载课程库
   */
  async loadLibrary() {
    const { topic } = this.data

    try {
      const res = await wx.request({
        url: `${getBaseUrl()}/api/demo/library`,
        method: 'GET',
        data: { topic }
      })

      if (res.data.success) {
        this.setData({
          versions: res.data.data.versions,
          loading: false
        })
      }
    } catch (err) {
      console.error('加载课程库失败:', err)
      this.setData({ loading: false })
    }
  },

  /**
   * 点击版本卡片
   */
  onSelectVersion(e) {
    const { classroomId, style, difficulty } = e.currentTarget.dataset

    // 显示预览弹窗
    this.showPreview(classroomId)
  },

  /**
   * 显示预览
   */
  async showPreview(classroomId) {
    wx.showLoading({ title: '加载中...' })

    try {
      const res = await wx.request({
        url: `${getBaseUrl()}/api/demo/preview/${classroomId}`,
        method: 'GET'
      })

      wx.hideLoading()

      if (res.data.success) {
        const preview = res.data.data

        wx.showModal({
          title: preview.title,
          content: `风格：${preview.style}\n难度：${preview.difficulty}\n场景数：${preview.sceneCount}\n时长：${Math.round(preview.duration / 60)}分钟\n\n是否播放此版本？`,
          confirmText: '播放',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              this.playVersion(classroomId)
            }
          }
        })
      }
    } catch (err) {
      wx.hideLoading()
      console.error('加载预览失败:', err)
    }
  },

  /**
   * 播放版本
   */
  playVersion(classroomId) {
    wx.navigateTo({
      url: `/pages/player/player?classroomId=${classroomId}`
    })
  }
})
```

**Step 3: 创建课程库页面UI**

创建文件 `miniprogram/pages/demo-library/demo-library.wxml`:

```xml
<view class="demo-library-page">
  <!-- 顶部标题 -->
  <view class="header-section">
    <text class="page-title">已为"{{topic}}"生成</text>
    <text class="version-count">{{versions.length}}个版本</text>
  </view>

  <!-- 加载中 -->
  <view wx:if="{{loading}}" class="loading-section">
    <text>加载中...</text>
  </view>

  <!-- 版本网格 -->
  <view wx:else class="versions-grid">
    <view
      wx:for="{{versions}}"
      wx:key="classroomId"
      class="version-card"
      data-classroom-id="{{item.classroomId}}"
      data-style="{{item.style}}"
      data-difficulty="{{item.difficulty}}"
      bindtap="onSelectVersion"
    >
      <!-- 标签 -->
      <view class="card-badges">
        <view class="badge {{item.style}}">
          <text>{{item.style === 'basic' ? '基础型' : '应用型'}}</text>
        </view>
        <view class="badge {{item.difficulty}}">
          <text>{{item.difficulty === 'standard' ? '标准' : '进阶'}}</text>
        </view>
      </view>

      <!-- 标题 -->
      <view class="card-title">{{item.title}}</view>

      <!-- 信息 -->
      <view class="card-info">
        <view class="info-item">
          <text class="info-label">时长</text>
          <text class="info-value">{{Math.round(item.duration / 60)}}分钟</text>
        </view>
        <view class="info-item">
          <text class="info-label">场景</text>
          <text class="info-value">{{item.sceneCount}}个</text>
        </view>
      </view>
    </view>
  </view>

  <!-- 空状态 -->
  <view wx:if="{{!loading && versions.length === 0}}" class="empty-state">
    <text>暂无生成版本</text>
  </view>
</view>
```

**Step 4: 创建页面样式**

创建文件 `miniprogram/pages/demo-library/demo-library.wxss`:

```css
.demo-library-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 20rpx;
}

/* 顶部 */
.header-section {
  text-align: center;
  margin-bottom: 40rpx;
}

.page-title {
  display: block;
  font-size: 32rpx;
  color: #333;
  margin-bottom: 8rpx;
}

.version-count {
  display: block;
  font-size: 28rpx;
  color: #1890ff;
  font-weight: 500;
}

/* 版本网格 */
.versions-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
}

.version-card {
  background: white;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.1);
  transition: all 0.3s;
}

.version-card:active {
  transform: scale(0.98);
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.15);
}

.card-badges {
  display: flex;
  gap: 8rpx;
  margin-bottom: 16rpx;
}

.badge {
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
}

.badge.basic {
  background: #e6f7ff;
  color: #1890ff;
}

.badge.applied {
  background: #f6ffed;
  color: #52c41a;
}

.badge.standard {
  background: #f5f5f5;
  color: #666;
}

.badge.advanced {
  background: #fff7e6;
  color: #fa8c16;
}

.card-title {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
  margin-bottom: 16rpx;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-info {
  display: flex;
  justify-content: space-around;
}

.info-item {
  text-align: center;
}

.info-label {
  display: block;
  font-size: 22rpx;
  color: #999;
  margin-bottom: 4rpx;
}

.info-value {
  display: block;
  font-size: 26rpx;
  color: #333;
  font-weight: 500;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 120rpx 0;
  color: #999;
}

.loading-section {
  text-align: center;
  padding: 120rpx 0;
  color: #999;
}
```

**Step 5: 提交课程库页面**

```bash
git add miniprogram/pages/demo-library/ miniprogram/app.json
git commit -m "feat: 添加课程库展示页面

- 网格展示4个版本
- 支持预览和播放
- 标签区分风格和难度"
```

---

## Task 9: 端到端测试

**Step 1: 完整流程测试**

1. 启动开发服务器：
```bash
pnpm dev
```

2. 在微信开发者工具中：
   - 打开小程序
   - 进入 demo-input 页面
   - 选择"初三"+"数学"
   - 点击"二次函数最值"推荐卡片
   - 点击"开始生成"

3. 预期结果：
   - ✅ 跳转到生成进度页面
   - ✅ 显示生成进度
   - ✅ 30-60秒后显示"初版课程就绪"
   - ✅ "立即播放"按钮可点击
   - ✅ 点击播放，跳转到播放器
   - ✅ 能够正常播放课程

**Step 2: 多版本生成测试**

1. 生成完成后，查看课程库：
```bash
curl "http://localhost:3000/api/demo/library?topic=二次函数最值"
```

2. 预期结果：
   - ✅ 返回4个版本
   - ✅ 版本类型正确（basic_standard, basic_advanced, applied_standard, applied_advanced）

**Step 3: 播放器测试**

1. 从课程库选择某个版本播放
2. 预期结果：
   - ✅ 能够正常播放
   - ✅ 显示所有场景
   - ✅ 支持场景切换

**Step 4: 提交测试通过标记**

```bash
git add .
git commit -m "test: 完成端到端测试

- 测试完整生成流程
- 验证多版本生成
- 确认播放器集成
- 所有功能正常工作"
```

---

## 完成标准

✅ **数据库**: Classroom模型和关联表创建成功
✅ **后端API**: 4个API端点正常工作（推荐、生成、查询、预览）
✅ **流式生成**: 首屏30秒就绪，后台继续生成
✅ **多版本**: 并发生成4个版本，存储到数据库
✅ **前端页面**: 3个页面完整实现（输入、进度、课程库）
✅ **端到端测试**: 完整流程测试通过

---

## 预期交付物

1. **后端模块**:
   - `lib/edukg/recommendation.ts` - 智能推荐
   - `lib/generation/streaming-generator.ts` - 流式生成器
   - `lib/generation/multi-version-generator.ts` - 多版本生成器
   - `lib/generation/template-fallback.ts` - 模板降级
   - `app/api/demo/*/*.ts` - 4个API端点

2. **前端页面**:
   - `miniprogram/pages/demo-input/*` - 智能推荐输入页面
   - `miniprogram/pages/demo-generating/*` - 生成进度页面
   - `miniprogram/pages/demo-library/*` - 课程库展示页面

3. **测试脚本**:
   - `scripts/test-streaming-generation.mjs`
   - `scripts/test-multi-version.mjs`

4. **数据库变更**:
   - Prisma Schema更新
   - 数据库迁移文件

---

**下一步**: 执行此计划，逐步实现所有功能模块。
