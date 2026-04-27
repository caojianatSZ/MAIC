/**
 * 错题巩固成就系统初始化数据
 * 为错题巩固和学习掌握创建成就
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 错题巩固成就
const WRONG_QUESTION_ACHIEVEMENTS = [
  // 错题收集类
  {
    identifier: 'wrong_collector_5',
    name: '错题新手',
    description: '记录5道错题',
    type: 'behavior',
    subject: null,
    condition: {
      type: 'wrong_question_count',
      min_count: 5
    },
    points: 10,
    level: 'bronze'
  },
  {
    identifier: 'wrong_collector_20',
    name: '错题收集者',
    description: '记录20道错题',
    type: 'behavior',
    subject: null,
    condition: {
      type: 'wrong_question_count',
      min_count: 20
    },
    points: 30,
    level: 'silver'
  },
  {
    identifier: 'wrong_collector_50',
    name: '错题达人',
    description: '记录50道错题',
    type: 'behavior',
    subject: null,
    condition: {
      type: 'wrong_question_count',
      min_count: 50
    },
    points: 50,
    level: 'gold'
  },
  // 错题复习类
  {
    identifier: 'wrong_reviewer_10',
    name: '复习起步',
    description: '复习10道错题',
    type: 'behavior',
    subject: null,
    condition: {
      type: 'wrong_question_review_count',
      min_count: 10
    },
    points: 15,
    level: 'bronze'
  },
  {
    identifier: 'wrong_reviewer_50',
    name: '复习达人',
    description: '复习50道错题',
    type: 'behavior',
    subject: null,
    condition: {
      type: 'wrong_question_review_count',
      min_count: 50
    },
    points: 40,
    level: 'silver'
  },
  // 错题掌握类
  {
    identifier: 'wrong_master_5',
    name: '初战告捷',
    description: '掌握5道错题（复习后连续答对）',
    type: 'progress',
    subject: null,
    condition: {
      type: 'wrong_question_mastered_count',
      min_count: 5
    },
    points: 50,
    level: 'bronze'
  },
  {
    identifier: 'wrong_master_20',
    name: '错题克星',
    description: '掌握20道错题',
    type: 'progress',
    subject: null,
    condition: {
      type: 'wrong_question_mastered_count',
      min_count: 20
    },
    points: 100,
    level: 'silver'
  },
  {
    identifier: 'wrong_master_50',
    name: '错题消灭者',
    description: '掌握50道错题',
    type: 'progress',
    subject: null,
    condition: {
      type: 'wrong_question_mastered_count',
      min_count: 50
    },
    points: 200,
    level: 'gold'
  },
  // 知识点掌握类
  {
    identifier: 'knowledge_master_3',
    name: '基础扎实',
    description: '完全掌握3个知识点',
    type: 'progress',
    subject: null,
    condition: {
      type: 'knowledge_point_mastered_count',
      min_count: 3
    },
    points: 50,
    level: 'bronze'
  },
  {
    identifier: 'knowledge_master_10',
    name: '知识渊博',
    description: '完全掌握10个知识点',
    type: 'progress',
    subject: null,
    condition: {
      type: 'knowledge_point_mastered_count',
      min_count: 10
    },
    points: 150,
    level: 'silver'
  },
  {
    identifier: 'knowledge_master_30',
    name: '知识专家',
    description: '完全掌握30个知识点',
    type: 'progress',
    subject: null,
    condition: {
      type: 'knowledge_point_mastered_count',
      min_count: 30
    },
    points: 300,
    level: 'gold'
  },
  // 练习完成类
  {
    identifier: 'practice_starter_10',
    name: '练习新手',
    description: '完成10道推荐练习题',
    type: 'behavior',
    subject: null,
    condition: {
      type: 'practice_questions_count',
      min_count: 10
    },
    points: 20,
    level: 'bronze'
  },
  {
    identifier: 'practice_regular_50',
    name: '练习常客',
    description: '完成50道推荐练习题',
    type: 'behavior',
    subject: null,
    condition: {
      type: 'practice_questions_count',
      min_count: 50
    },
    points: 60,
    level: 'silver'
  },
  {
    identifier: 'practice_master_100',
    name: '练习大师',
    description: '完成100道推荐练习题',
    type: 'behavior',
    subject: null,
    condition: {
      type: 'practice_questions_count',
      min_count: 100
    },
    points: 120,
    level: 'gold'
  },
  // 弱项攻克类
  {
    identifier: 'weak_conqueror_1',
    name: '攻克难关',
    description: '将1个弱项知识点提升到掌握水平',
    type: 'progress',
    subject: null,
    condition: {
      type: 'weak_point_conquered_count',
      min_count: 1
    },
    points: 80,
    level: 'bronze'
  },
  {
    identifier: 'weak_conqueror_5',
    name: '弱点克星',
    description: '将5个弱项知识点提升到掌握水平',
    type: 'progress',
    subject: null,
    condition: {
      type: 'weak_point_conquered_count',
      min_count: 5
    },
    points: 200,
    level: 'silver'
  },
  {
    identifier: 'weak_conqueror_10',
    name: '弱点大师',
    description: '将10个弱项知识点提升到掌握水平',
    type: 'progress',
    subject: null,
    condition: {
      type: 'weak_point_conquered_count',
      min_count: 10
    },
    points: 400,
    level: 'gold'
  }
]

// 数学科专属错题巩固成就
const MATH_WRONG_ACHIEVEMENTS = [
  {
    identifier: 'math_wrong_master_5',
    name: '数学错题初学者',
    description: '掌握5道数学错题',
    type: 'progress',
    subject: 'math',
    condition: {
      type: 'wrong_question_mastered_count',
      subject: 'math',
      min_count: 5
    },
    points: 30,
    level: 'bronze'
  },
  {
    identifier: 'math_wrong_master_20',
    name: '数学错题达人',
    description: '掌握20道数学错题',
    type: 'progress',
    subject: 'math',
    condition: {
      type: 'wrong_question_mastered_count',
      subject: 'math',
      min_count: 20
    },
    points: 80,
    level: 'silver'
  }
]

// 物理科专属错题巩固成就
const PHYSICS_WRONG_ACHIEVEMENTS = [
  {
    identifier: 'physics_wrong_master_5',
    name: '物理错题初学者',
    description: '掌握5道物理错题',
    type: 'progress',
    subject: 'physics',
    condition: {
      type: 'wrong_question_mastered_count',
      subject: 'physics',
      min_count: 5
    },
    points: 30,
    level: 'bronze'
  },
  {
    identifier: 'physics_wrong_master_20',
    name: '物理错题达人',
    description: '掌握20道物理错题',
    type: 'progress',
    subject: 'physics',
    condition: {
      type: 'wrong_question_mastered_count',
      subject: 'physics',
      min_count: 20
    },
    points: 80,
    level: 'silver'
  }
]

// 英语科专属错题巩固成就
const ENGLISH_WRONG_ACHIEVEMENTS = [
  {
    identifier: 'english_wrong_master_5',
    name: '英语错题初学者',
    description: '掌握5道英语错题',
    type: 'progress',
    subject: 'english',
    condition: {
      type: 'wrong_question_mastered_count',
      subject: 'english',
      min_count: 5
    },
    points: 30,
    level: 'bronze'
  },
  {
    identifier: 'english_wrong_master_20',
    name: '英语错题达人',
    description: '掌握20道英语错题',
    type: 'progress',
    subject: 'english',
    condition: {
      type: 'wrong_question_mastered_count',
      subject: 'english',
      min_count: 20
    },
    points: 80,
    level: 'silver'
  }
]

async function seedWrongQuestionAchievements() {
  console.log('开始初始化错题巩固成就数据...')

  // 合并所有成就
  const allAchievements = [
    ...WRONG_QUESTION_ACHIEVEMENTS,
    ...MATH_WRONG_ACHIEVEMENTS,
    ...PHYSICS_WRONG_ACHIEVEMENTS,
    ...ENGLISH_WRONG_ACHIEVEMENTS
  ]

  for (const achievement of allAchievements) {
    const existing = await prisma.achievement.findUnique({
      where: { identifier: achievement.identifier }
    })

    if (existing) {
      console.log(`  ✓ ${achievement.name} 已存在`)
      continue
    }

    await prisma.achievement.create({
      data: {
        identifier: achievement.identifier,
        type: achievement.type,
        subject: achievement.subject,
        name: achievement.name,
        description: achievement.description,
        iconUrl: getIconForType(achievement.type),
        level: achievement.level,
        condition: achievement.condition,
        points: achievement.points
      }
    })

    console.log(`  ✓ 创建成就: ${achievement.name}`)
  }

  console.log('\n✅ 错题巩固成就数据初始化完成！')

  // 统计信息
  const totalAchievements = await prisma.achievement.count()
  const wrongQuestionAchievements = await prisma.achievement.count({
    where: {
      OR: [
        { identifier: { startsWith: 'wrong_' } },
        { identifier: { startsWith: 'math_wrong_' } },
        { identifier: { startsWith: 'physics_wrong_' } },
        { identifier: { startsWith: 'english_wrong_' } },
        { identifier: { startsWith: 'knowledge_master_' } },
        { identifier: { startsWith: 'practice_' } },
        { identifier: { startsWith: 'weak_conqueror_' } }
      ]
    }
  })

  console.log('\n📊 成就统计:')
  console.log(`  总成就数: ${totalAchievements}`)
  console.log(`  错题巩固成就数: ${wrongQuestionAchievements}`)
}

function getIconForType(type: string): string {
  const icons: Record<string, string> = {
    'behavior': '📝',
    'progress': '🏆',
    'habit': '⭐'
  }
  return icons[type] || '🎖️'
}

async function main() {
  try {
    await seedWrongQuestionAchievements()
  } catch (error) {
    console.error('初始化失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
