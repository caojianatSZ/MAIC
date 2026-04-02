import { NextRequest, NextResponse } from 'next/server';
import { apiSuccess } from '@/lib/server/api-response';

/**
 * Demo 课程生成 API
 * POST /api/demo/generate-course
 *
 * 快速生成演示课程（5秒内返回），用于现场演示
 */
export const maxDuration = 10;

interface GenerateCourseRequest {
  topic: string;
  knowledgePointIds?: string[];
  subject?: string;
}

// 预定义的演示课程模板
const demoCourseTemplates = {
  '二次函数配方法': {
    title: '配方法求顶点',
    description: '通过配方法将二次函数化为顶点式，掌握二次函数的顶点求法',
    duration: 180, // 3分钟
    sceneCount: 3,
    difficulty: 3,
    scenes: [
      {
        id: 'scene_001',
        type: 'slide',
        title: '什么是顶点？',
        content: {
          type: 'explanation',
          text: '二次函数的顶点是抛物线的最高点或最低点。对于一般式 y = ax² + bx + c，我们可以通过配方法将其转化为顶点式 y = a(x-h)² + k，其中 (h, k) 就是顶点坐标。',
          examples: [
            'y = x² - 2x + 1 = (x-1)²，顶点为 (1, 0)',
            'y = -x² + 4x - 3 = -(x-2)² + 1，顶点为 (2, 1)'
          ],
          keyPoints: ['顶点的定义', '配方法的作用', '顶点式的形式']
        },
        duration: 60
      },
      {
        id: 'scene_002',
        type: 'interactive',
        title: '配方法步骤演示',
        content: {
          type: 'interactive_simulation',
          steps: [
            '步骤1: 将二次项系数提出（如果 a≠1）',
            '步骤2: 配方：加上并减去一次项系数一半的平方',
            '步骤3: 化为完全平方式',
            '步骤4: 整理得到顶点式'
          ],
          example: '以 y = x² - 4x + 3 为例，展示完整配方过程',
          interactiveElements: ['slider', 'stepByStep', 'practice']
        },
        duration: 60
      },
      {
        id: 'scene_003',
        type: 'quiz',
        title: '练习测试',
        content: {
          type: 'quiz',
          questions: [
            {
              question: '求 y = x² - 6x + 5 的顶点坐标',
              options: ['(3, -4)', '(-3, 4)', '(3, 4)', '(-3, -4)'],
              correctAnswer: 0,
              explanation: '配方得：y = (x-3)² - 4，顶点为 (3, -4)'
            },
            {
              question: '顶点式 y = 2(x+1)² - 3 的顶点坐标是？',
              options: ['(1, -3)', '(-1, -3)', '(1, 3)', '(-1, 3)'],
              correctAnswer: 1,
              explanation: '顶点式 y = a(x-h)² + k 中，顶点为 (h, k)，所以是 (-1, -3)'
            }
          ]
        },
        duration: 60
      }
    ],
    knowledgePointIds: ['kf_003'],
    tags: ['基础', '重点', '考试高频'],
    generatedAt: new Date().toISOString()
  },

  '二次函数图像': {
    title: '二次函数图像与性质',
    description: '理解二次函数图像的形状、开口方向、对称轴等性质',
    duration: 300, // 5分钟
    sceneCount: 4,
    difficulty: 2,
    scenes: [
      {
        id: 'scene_001',
        type: 'slide',
        title: '二次函数的图像',
        content: {
          type: 'explanation',
          text: '二次函数 y = ax² + bx + c 的图像是一条抛物线。当 a > 0 时，开口向上；当 a < 0 时，开口向下。对称轴是 x = -b/(2a)。',
          visualElements: ['parabola_graph', 'animation'],
          keyPoints: ['抛物线形状', '开口方向', '对称轴']
        },
        duration: 90
      },
      {
        id: 'scene_002',
        type: 'interactive',
        title: '探索参数对图像的影响',
        content: {
          type: 'interactive_simulation',
          description: '通过调整 a、b、c 参数，观察图像变化',
          interactiveElements: ['parameter_slider', 'real_time_graph'],
          exploration: '尝试改变 a 的正负，观察开口方向变化'
        },
        duration: 90
      },
      {
        id: 'scene_003',
        type: 'slide',
        title: '顶点与图像位置',
        content: {
          type: 'explanation',
          text: '顶点位置决定了图像在坐标系中的位置。顶点横坐标 h = -b/(2a)，纵坐标 k = (4ac-b²)/(4a)',
          examples: [
            'y = (x-2)² + 1，顶点 (2, 1)，图像向右平移2个单位，向上平移1个单位',
            'y = -(x+1)² + 3，顶点 (-1, 3)，开口向下，向左平移1个单位'
          ]
        },
        duration: 60
      },
      {
        id: 'scene_004',
        type: 'quiz',
        title: '图像性质测试',
        content: {
          type: 'quiz',
          questions: [
            {
              question: '函数 y = -2x² + 4x 的开口方向是？',
              options: ['向上', '向下', '不确定'],
              correctAnswer: 1,
              explanation: '因为 a = -2 < 0，所以开口向下'
            },
            {
              question: 'y = x² - 4x + 4 的对称轴是？',
              options: ['x = 2', 'x = -2', 'x = 4', 'x = -4'],
              correctAnswer: 0,
              explanation: '对称轴 x = -b/(2a) = -(-4)/(2×1) = 2'
            }
          ]
        },
        duration: 60
      }
    ],
    knowledgePointIds: ['kf_002'],
    tags: ['基础', '可视化', '互动'],
    generatedAt: new Date().toISOString()
  },

  '二次函数应用题': {
    title: '二次函数实际应用',
    description: '利用二次函数解决实际生活中的最值问题',
    duration: 360, // 6分钟
    sceneCount: 4,
    difficulty: 4,
    scenes: [
      {
        id: 'scene_001',
        type: 'slide',
        title: '生活中的二次函数',
        content: {
          type: 'explanation',
          text: '二次函数在现实生活中有广泛应用，例如：抛物运动轨迹、桥梁拱形设计、最大利润问题、最优方案选择等。',
          realWorldExamples: [
            '投篮时篮球的运动轨迹',
            '喷泉的水流曲线',
            '拱桥的形状'
          ],
          keyPoints: ['实际问题抽象', '建立函数模型', '求最值']
        },
        duration: 90
      },
      {
        id: 'scene_002',
        type: 'slide',
        title: '最大利润问题',
        content: {
          type: 'case_study',
          problem: '某商品售价为 x 元，利润为 P = -x² + 100x - 1600，求售价定为多少时利润最大？最大利润是多少？',
          solution: '这是一个二次函数问题，开口向下，顶点处取得最大值。',
          steps: [
            '求顶点横坐标：x = -100/(2×(-1)) = 50',
            '求顶点纵坐标：P = -50² + 100×50 - 1600 = 900',
            '结论：售价定为50元时，利润最大为900元'
          ]
        },
        duration: 90
      },
      {
        id: 'scene_003',
        type: 'pbl',
        title: '项目式学习：设计花坛',
        content: {
          type: 'pbl_activity',
          description: '利用二次函数设计一个面积为 16 平方米的矩形花坛，使用多长的篱笆最省？',
          learningGoals: [
            '将实际问题抽象为数学模型',
            '建立二次函数关系式',
            '求解最值问题'
          ],
          groupWork: '分组讨论，设计方案，展示成果'
        },
        duration: 120
      },
      {
        id: 'scene_004',
        type: 'quiz',
        title: '应用题练习',
        content: {
          type: 'quiz',
          questions: [
            {
              question: '某农场修建矩形养殖场，面积为 200m²，一边靠墙（墙长 20m），问长宽各为多少时，所用篱笆最短？',
              options: ['长 10m, 宽 20m', '长 20m, 宽 10m', '长 15m, 宽 13.3m', '长 14.1m, 宽 14.1m'],
              correctAnswer: 3,
              explanation: '设宽为 x，则长为 200/x。篱笆总长 L = x + 200/x + x = 2x + 200/x，求导得 x ≈ 14.1m'
            }
          ]
        },
        duration: 60
      }
    ],
    knowledgePointIds: ['kf_005'],
    tags: ['应用', 'PBL', '综合'],
    generatedAt: new Date().toISOString()
  }
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as GenerateCourseRequest;
    const { topic, knowledgePointIds = [], subject = 'math' } = body;

    // 根据主题选择合适的模板
    let selectedTemplate = null;

    if (topic.includes('配方法') || topic.includes('顶点')) {
      selectedTemplate = demoCourseTemplates['二次函数配方法'];
    } else if (topic.includes('图像') || topic.includes('抛物线')) {
      selectedTemplate = demoCourseTemplates['二次函数图像'];
    } else if (topic.includes('应用') || topic.includes('最值')) {
      selectedTemplate = demoCourseTemplates['二次函数应用题'];
    } else {
      // 默认返回配方法课程
      selectedTemplate = demoCourseTemplates['二次函数配方法'];
    }

    // 模拟 AI 生成时间（2秒）
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 返回生成的课程
    return apiSuccess({
      courseId: `demo_${Date.now()}`,
      topic: topic,
      subject: subject,
      title: selectedTemplate.title,
      description: selectedTemplate.description,
      duration: selectedTemplate.duration,
      sceneCount: selectedTemplate.sceneCount,
      difficulty: selectedTemplate.difficulty,
      scenes: selectedTemplate.scenes,
      knowledgePointIds: selectedTemplate.knowledgePointIds,
      tags: selectedTemplate.tags,
      generatedBy: 'OpenMAIC 多智能体 AI',
      generatedAt: selectedTemplate.generatedAt,
      // 添加 AI 生成标识
      aiFeatures: {
        multiAgent: true,
        knowledgeGraph: true,
        adaptive: true,
        personalized: true
      },
      // 生成过程信息（用于演示）
      generationProcess: {
        step1: '分析学习需求和学生背景 ✓',
        step2: '基于 EduKG 知识图谱规划路径 ✓',
        step3: '多智能体协作生成教学大纲 ✓',
        step4: '生成课程场景和互动内容 ✓',
        step5: '智能推荐练习题和测试 ✓',
        totalDuration: '2.3秒',
        agentsInvolved: ['教师智能体', '学生智能体', '教研员智能体']
      }
    }, 201);

  } catch (error) {
    console.error('Demo 课程生成失败:', error);
    return NextResponse.json({
      success: false,
      error: '课程生成失败',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
