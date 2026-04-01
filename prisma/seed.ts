import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('开始种子数据...');

  // 1. 创建知识点
  console.log('创建知识点...');
  const knowledgePoints = await Promise.all([
    prisma.knowledgePoint.upsert({
      where: { identifier: 'kf_001' },
      update: {},
      create: {
        identifier: 'kf_001',
        subject: 'math',
        name: '二次函数定义',
        description: '形如y=ax²+bx+c（a≠0）的函数称为二次函数，其中a、b、c是常数，a≠0',
        level: 0,
        prerequisites: [],
        metadata: {
          difficulty: '初级',
          tags: ['基础', '定义']
        }
      }
    }),
    prisma.knowledgePoint.upsert({
      where: { identifier: 'kf_002' },
      update: {},
      create: {
        identifier: 'kf_002',
        subject: 'math',
        name: '二次函数图像',
        description: '二次函数的图像是一条抛物线。当a>0时，开口向上；当a<0时，开口向下',
        level: 1,
        prerequisites: ['kf_001'],
        metadata: {
          difficulty: '中级',
          tags: ['图像', '性质']
        }
      }
    }),
    prisma.knowledgePoint.upsert({
      where: { identifier: 'kf_003' },
      update: {},
      create: {
        identifier: 'kf_003',
        subject: 'math',
        name: '配方法求顶点',
        description: '通过配方法将二次函数化为顶点式y=a(x-h)²+k，其中(h,k)是顶点坐标',
        level: 1,
        prerequisites: ['kf_001'],
        metadata: {
          difficulty: '中级',
          tags: ['计算', '顶点']
        }
      }
    }),
    prisma.knowledgePoint.upsert({
      where: { identifier: 'kf_004' },
      update: {},
      create: {
        identifier: 'kf_004',
        subject: 'math',
        name: '图像平移变换',
        description: '二次函数图像的平移规律：左右平移改变x，上下平移改变常数项',
        level: 2,
        prerequisites: ['kf_002'],
        metadata: {
          difficulty: '中级',
          tags: ['变换', '平移']
        }
      }
    }),
    prisma.knowledgePoint.upsert({
      where: { identifier: 'kf_005' },
      update: {},
      create: {
        identifier: 'kf_005',
        subject: 'math',
        name: '实际应用题',
        description: '利用二次函数解决实际生活中的最值问题，如面积最大、利润最大等',
        level: 2,
        prerequisites: ['kf_002', 'kf_003'],
        metadata: {
          difficulty: '高级',
          tags: ['应用', '最值']
        }
      }
    })
  ]);

  console.log(`创建了 ${knowledgePoints.length} 个知识点`);

  // 2. 创建题目
  console.log('创建题目...');

  // 获取知识点ID映射
  const kpMap = new Map();
  knowledgePoints.forEach(kp => {
    kpMap.set(kp.identifier, kp.id);
  });

  const questions = [
    {
      identifier: 'dq_001',
      subject: 'math',
      type: 'single',
      question: '下列函数中，哪个是二次函数？',
      options: ['y = 2x + 1', 'y = x²', 'y = 1/x', 'y = √x'],
      answer: '1',
      explanation: '二次函数的定义是形如y = ax² + bx + c（a≠0）的函数',
      knowledgePointIdentifiers: ['kf_001'],
      difficulty: 1
    },
    {
      identifier: 'dq_002',
      subject: 'math',
      type: 'single',
      question: '二次函数 y = ax² + bx + c 中，a > 0 时，图像开口方向是？',
      options: ['向上', '向下', '无法确定', '与a无关'],
      answer: '0',
      explanation: '当a > 0时，抛物线开口向上；当a < 0时，开口向下',
      knowledgePointIdentifiers: ['kf_002'],
      difficulty: 1
    }
    ];

  for (const q of questions) {
    const question = await prisma.question.upsert({
      where: { identifier: q.identifier },
      update: {},
      create: {
        identifier: q.identifier,
        subject: q.subject,
        type: q.type,
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        difficulty: q.difficulty
      }
    });

    // 关联知识点
    for (const kpIdentifier of q.knowledgePointIdentifiers) {
      const kpId = kpMap.get(kpIdentifier);
      if (kpId) {
        await prisma.questionKnowledgePoint.upsert({
          where: {
            questionId_knowledgePointId: {
              questionId: question.id,
              knowledgePointId: kpId
            }
          },
          update: {},
          create: {
            questionId: question.id,
            knowledgePointId: kpId
          }
        });
      }
    }
  }

  console.log(`创建了 ${questions.length} 道题目`);

  // 3. 创建课程
  console.log('创建课程...');
  const lessons = await Promise.all([
    prisma.lesson.upsert({
      where: { identifier: 'lesson_001' },
      update: {},
      create: {
        identifier: 'lesson_001',
        subject: 'math',
        title: '配方法求顶点',
        description: '学习如何通过配方法将二次函数化为顶点式，掌握求顶点坐标的方法',
        duration: 180,
        sceneCount: 3,
        difficulty: 3,
        type: 'slide',
        knowledgePointIds: [kpMap.get('kf_003')!],
        metadata: {
          teacher: 'AI老师-王老师',
          targetAudience: '初中学生',
          learningObjectives: [
            '理解配方法的原理',
            '掌握配方法的步骤',
            '能够用配方法求二次函数的顶点坐标'
          ]
        }
      }
    }),
    prisma.lesson.upsert({
      where: { identifier: 'lesson_002' },
      update: {},
      create: {
        identifier: 'lesson_002',
        subject: 'math',
        title: '二次函数图像的性质',
        description: '深入理解二次函数图像的开口方向、对称轴、顶点等性质',
        duration: 300,
        sceneCount: 5,
        difficulty: 2,
        type: 'slide',
        knowledgePointIds: [kpMap.get('kf_002')!],
        metadata: {
          teacher: 'AI老师-李老师',
          targetAudience: '初中学生',
          learningObjectives: [
            '掌握二次函数图像的开口方向与系数a的关系',
            '会求二次函数的对称轴和顶点',
            '理解二次函数图像的对称性'
          ]
        }
      }
    })
  ]);

  console.log(`创建了 ${lessons.length} 个课程`);

  // 4. 创建场景
  console.log('创建场景...');
  const scene = await prisma.scene.upsert({
    where: { identifier: 'scene_001_001' },
    update: {},
    create: {
      identifier: 'scene_001_001',
      lessonId: lessons[0].id,
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
          }
        ],
        whiteboard: {
          steps: [
            {
              action: 'write',
              content: 'y = x² + 4x + 3',
              position: { x: 100, y: 100 }
            }
          ]
        },
        speech: {
          text: '配方法的核心思想是通过添加和减去一次项系数一半的平方，将二次项和一次项配成完全平方式。',
          voice: 'female_teacher'
        }
      },
      duration: 60
    }
  });

  console.log(`创建了 1 个场景示例`);

  // 5. 创建系统配置
  console.log('创建系统配置...');
  await prisma.systemConfig.upsert({
    where: { key: 'edukg_api_url' },
    update: {},
    create: {
      key: 'edukg_api_url',
      value: 'https://api.edukg.cn/2021/repo',
      valueType: 'string'
    }
  });

  await prisma.systemConfig.upsert({
    where: { key: 'app_version' },
    update: {},
    create: {
      key: 'app_version',
      value: '1.0.0',
      valueType: 'string'
    }
  });

  console.log('系统配置创建完成');

  console.log('种子数据完成！');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
