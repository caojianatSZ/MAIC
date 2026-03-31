/**
 * 学习内容数据
 * 包含微课和课程信息
 */

export interface Lesson {
  id: string;
  title: string;
  knowledgePoints: string[];
  duration: number; // 秒
  sceneCount: number;
  description: string;
  difficulty: number;
  type: 'slide' | 'quiz' | 'interactive' | 'pbl';
  metadata?: {
    teacher?: string;
    targetAudience?: string;
    learningObjectives?: string[];
  };
}

export interface Scene {
  id: string;
  type: 'slide' | 'quiz' | 'interactive_simulation' | 'pbl_activity' | 'discussion';
  title: string;
  content: any;
  duration: number;
}

/**
 * 二次函数微课内容
 */
export const quadraticFunctionLessons: Lesson[] = [
  {
    id: 'lesson_001',
    title: '配方法求顶点',
    knowledgePoints: ['kf_003'],
    duration: 180, // 3分钟
    sceneCount: 3,
    description: '学习如何通过配方法将二次函数化为顶点式，掌握求顶点坐标的方法',
    difficulty: 3,
    type: 'slide',
    metadata: {
      teacher: 'AI老师-王老师',
      targetAudience: '初中学生',
      learningObjectives: [
        '理解配方法的原理',
        '掌握配方法的步骤',
        '能够用配方法求二次函数的顶点坐标'
      ]
    }
  },
  {
    id: 'lesson_002',
    title: '二次函数图像的性质',
    knowledgePoints: ['kf_002'],
    duration: 300, // 5分钟
    sceneCount: 5,
    description: '深入理解二次函数图像的开口方向、对称轴、顶点等性质',
    difficulty: 2,
    type: 'slide',
    metadata: {
      teacher: 'AI老师-李老师',
      targetAudience: '初中学生',
      learningObjectives: [
        '掌握二次函数图像的开口方向与系数a的关系',
        '会求二次函数的对称轴和顶点',
        '理解二次函数图像的对称性'
      ]
    }
  },
  {
    id: 'lesson_003',
    title: '二次函数图像的平移',
    knowledgePoints: ['kf_002', 'kf_004'],
    duration: 240, // 4分钟
    sceneCount: 4,
    description: '掌握二次函数图像的平移规律，理解平移对函数解析式的影响',
    difficulty: 3,
    type: 'slide',
    metadata: {
      teacher: 'AI老师-张老师',
      targetAudience: '初中学生',
      learningObjectives: [
        '理解二次函数图像的平移规律',
        '掌握左右平移对解析式的影响',
        '掌握上下平移对解析式的影响'
      ]
    }
  },
  {
    id: 'lesson_004',
    title: '图像平移变换详解',
    knowledgePoints: ['kf_004'],
    duration: 240, // 4分钟
    sceneCount: 4,
    description: '深入学习二次函数图像的各种平移变换，包括复合变换',
    difficulty: 3,
    type: 'interactive',
    metadata: {
      teacher: 'AI老师-刘老师',
      targetAudience: '初中学生',
      learningObjectives: [
        '掌握二次函数图像的平移规律',
        '能根据平移要求写出新的函数解析式',
        '能根据函数解析式判断平移方式'
      ]
    }
  },
  {
    id: 'lesson_005',
    title: '二次函数实际应用',
    knowledgePoints: ['kf_005'],
    duration: 360, // 6分钟
    sceneCount: 6,
    description: '运用二次函数解决实际生活中的最值问题，建立数学模型',
    difficulty: 4,
    type: 'pbl',
    metadata: {
      teacher: 'AI老师-赵老师',
      targetAudience: '初中学生',
      learningObjectives: [
        '能够从实际问题中抽象出二次函数模型',
        '掌握求二次函数最值的方法',
        '能够运用二次函数解决实际问题'
      ]
    }
  }
];

/**
 * 场景数据示例
 */
export const sampleScenes: Record<string, Scene[]> = {
  'lesson_001': [
    {
      id: 'scene_001_001',
      type: 'slide',
      title: '配方法的概念',
      content: {
        elements: [
          {
            type: 'heading',
            text: '什么是配方法？'
          },
          {
            type: 'text',
            content: '配方法是一种将二次函数化为顶点式的方法，通过添加和减去适当的项，将表达式配成完全平方式。'
          },
          {
            type: 'formula',
            latex: 'y = ax^2 + bx + c = a(x-h)^2 + k'
          },
          {
            type: 'example',
            title: '示例',
            content: '将 y = x^2 + 4x + 3 配方'
          }
        ],
        whiteboard: {
          steps: [
            {
              action: 'write',
              content: 'y = x² + 4x + 3',
              position: { x: 100, y: 100 }
            },
            {
              action: 'write',
              content: '= (x² + 4x + 4) - 1',
              position: { x: 100, y: 150 }
            },
            {
              action: 'write',
              content: '= (x + 2)² - 1',
              position: { x: 100, y: 200 }
            },
            {
              action: 'highlight',
              content: '顶点坐标: (-2, -1)',
              position: { x: 100, y: 250 }
            }
          ]
        },
        speech: {
          text: '配方法的核心思想是通过添加和减去一次项系数一半的平方，将二次项和一次项配成完全平方式。',
          voice: 'female_teacher'
        }
      },
      duration: 60
    },
    {
      id: 'scene_001_002',
      type: 'quiz',
      title: '配方法练习',
      content: {
        question: '用配方法将 y = x² - 6x + 5 化为顶点式',
        type: 'single',
        options: [
          'y = (x+3)² - 4',
          'y = (x-3)² - 4',
          'y = (x+3)² + 4',
          'y = (x-3)² + 4'
        ],
        correctAnswer: 1,
        explanation: 'y = (x² - 6x + 9) - 4 = (x-3)² - 4',
        hints: [
          '提示1：一次项系数是-6',
          '提示2：一次项系数的一半是-3',
          '提示3：添加(-3)² = 9'
        ]
      },
      duration: 40
    },
    {
      id: 'scene_001_003',
      type: 'discussion',
      title: '配方法的应用',
      content: {
        topic: '配方法在实际问题中的应用',
        participants: [
          {
            role: 'teacher',
            name: '王老师',
            avatar: 'teacher_1.png',
            purpose: '引导讨论，解答疑问'
          },
          {
            role: 'student',
            name: '小明',
            avatar: 'student_1.png',
            purpose: '提出问题，展示常见错误'
          },
          {
            role: 'student',
            name: '小红',
            avatar: 'student_2.png',
            purpose: '分享解题思路'
          }
        ],
        script: [
          {
            speaker: 'teacher',
            content: '现在我们来看一个实际问题：果园有100棵苹果树，每多种一棵，每棵产量减少5个，怎样种植总产量最大？'
          },
          {
            speaker: 'student',
            name: '小明',
            content: '老师，这个问题怎么列式呢？'
          },
          {
            speaker: 'teacher',
            content: '设多种x棵，每棵产量600-5x个，总产量y=(100+x)(600-5x)'
          },
          {
            speaker: 'student',
            name: '小红',
            content: '我懂了！展开后用配方法求最大值'
          },
          {
            speaker: 'teacher',
            content: '对！y=-5x²+100x+60000=-5(x-10)²+60500，所以x=10时产量最大'
          }
        ]
      },
      duration: 80
    }
  ]
};

/**
 * 根据知识点获取课程
 */
export function getLessonsByKnowledgePoint(knowledgePointId: string): Lesson[] {
  return quadraticFunctionLessons.filter(lesson =>
    lesson.knowledgePoints.includes(knowledgePointId)
  );
}

/**
 * 根据课程ID获取场景
 */
export function getScenesByLesson(lessonId: string): Scene[] {
  return sampleScenes[lessonId] || [];
}

/**
 * 获取推荐课程列表
 */
export function getRecommendedLessons(knowledgePointIds: string[]): Lesson[] {
  const recommended = new Set<string>();

  knowledgePointIds.forEach(kpId => {
    const lessons = getLessonsByKnowledgePoint(kpId);
    lessons.forEach(lesson => recommended.add(lesson.id));
  });

  return Array.from(recommended)
    .map(id => quadraticFunctionLessons.find(l => l.id === id))
    .filter(Boolean) as Lesson[];
}
