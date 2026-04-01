/**
 * 成就系统初始化数据
 * 为数学科5个核心知识点创建5级成就
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 成就等级配置
const ACHIEVEMENT_LEVELS = [
  {
    level: 'bronze',
    name: '初识者',
    icon: '🥉',
    threshold: 0,
    description: '刚刚开始学习这个知识点',
    color: '#CD7F32'
  },
  {
    level: 'silver',
    name: '进阶者',
    icon: '🥈',
    threshold: 41,
    description: '完成3道题目，开始理解',
    color: '#C0C0C0'
  },
  {
    level: 'gold',
    name: '熟练者',
    icon: '🥇',
    threshold: 71,
    description: '完成5道题目且正确率80%+',
    color: '#FFD700'
  },
  {
    level: 'diamond',
    name: '精通者',
    icon: '💎',
    threshold: 91,
    description: '完成7道题目且正确率90%+',
    color: '#B9F2FF'
  },
  {
    level: 'king',
    name: '大师',
    icon: '👑',
    threshold: 96,
    description: '持续正确应用，完全掌握',
    color: '#FF6B6B'
  }
]

// 数学科5个核心知识点
const MATH_KNOWLEDGE_POINTS = [
  {
    id: 'kp_quadratic_function',
    name: '二次函数',
    identifier: 'quadratic_function'
  },
  {
    id: 'kp_linear_function',
    name: '一次函数',
    identifier: 'linear_function'
  },
  {
    id: 'kp_geometry',
    name: '几何图形',
    identifier: 'geometry'
  },
  {
    id: 'kp_algebra',
    name: '代数基础',
    identifier: 'algebra_basics'
  },
  {
    id: 'kp_probability',
    name: '概率统计',
    identifier: 'probability_statistics'
  }
]

// 学习习惯成就
const HABIT_ACHIEVEMENTS = [
  {
    identifier: 'habit_streak_7',
    name: '坚持学习',
    description: '连续学习7天',
    type: 'habit',
    condition: {
      type: 'study_streak',
      streak_days: 7
    }
  },
  {
    identifier: 'habit_streak_30',
    name: '学习达人',
    description: '连续学习30天',
    type: 'habit',
    condition: {
      type: 'study_streak',
      streak_days: 30
    }
  }
]

// 学习行为成就
const BEHAVIOR_ACHIEVEMENTS = [
  {
    identifier: 'behavior_questions_10',
    name: '勤学好问',
    description: '完成10道题目',
    type: 'behavior',
    condition: {
      type: 'questions_completed',
      min_questions: 10
    }
  },
  {
    identifier: 'behavior_questions_100',
    name: '题海战术',
    description: '完成100道题目',
    type: 'behavior',
    condition: {
      type: 'questions_completed',
      min_questions: 100
    }
  }
]

async function seedAchievements() {
  console.log('开始初始化成就数据...')

  // 1. 为每个知识点创建5级成就
  for (const kp of MATH_KNOWLEDGE_POINTS) {
    console.log(`创建知识点成就: ${kp.name}`)

    for (const levelConfig of ACHIEVEMENT_LEVELS) {
      const identifier = `math_${kp.identifier}_${levelConfig.level}`

      // 检查是否已存在
      const existing = await prisma.achievement.findUnique({
        where: { identifier }
      })

      if (existing) {
        console.log(`  ✓ ${levelConfig.name} 成就已存在`)
        continue
      }

      // 创建成就
      await prisma.achievement.create({
        data: {
          identifier,
          type: 'progress',
          subject: 'math',
          knowledgePointId: kp.id,
          level: levelConfig.level,
          name: `${kp.name}${levelConfig.name}`,
          description: levelConfig.description,
          iconUrl: levelConfig.icon,
          condition: {
            type: 'knowledge_point_mastery',
            accuracy_threshold: levelConfig.threshold === 0 ? 0 : 80,
            min_questions: levelConfig.threshold === 0 ? 1 :
                          levelConfig.level === 'silver' ? 3 :
                          levelConfig.level === 'gold' ? 5 :
                          levelConfig.level === 'diamond' ? 7 : 10
          },
          points: levelConfig.level === 'bronze' ? 10 :
                   levelConfig.level === 'silver' ? 20 :
                   levelConfig.level === 'gold' ? 50 :
                   levelConfig.level === 'diamond' ? 100 : 200
        }
      })

      console.log(`  ✓ 创建 ${levelConfig.name} 成就: ${identifier}`)
    }
  }

  // 2. 创建学习习惯成就
  console.log('\n创建学习习惯成就...')
  for (const achievement of HABIT_ACHIEVEMENTS) {
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
        name: achievement.name,
        description: achievement.description,
        iconUrl: '⭐',
        level: 'bronze', // 习惯成就统一设为青铜级
        condition: achievement.condition,
        points: 50
      }
    })

    console.log(`  ✓ 创建习惯成就: ${achievement.name}`)
  }

  // 3. 创建学习行为成就
  console.log('\n创建学习行为成就...')
  for (const achievement of BEHAVIOR_ACHIEVEMENTS) {
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
        name: achievement.name,
        description: achievement.description,
        iconUrl: '🎯',
        level: 'bronze', // 行为成就统一设为青铜级
        condition: achievement.condition,
        points: 30
      }
    })

    console.log(`  ✓ 创建行为成就: ${achievement.name}`)
  }

  console.log('\n✅ 成就数据初始化完成！')

  // 统计信息
  const totalAchievements = await prisma.achievement.count()
  const progressAchievements = await prisma.achievement.count({ where: { type: 'progress' } })
  const habitAchievements = await prisma.achievement.count({ where: { type: 'habit' } })
  const behaviorAchievements = await prisma.achievement.count({ where: { type: 'behavior' } })

  console.log('\n📊 成就统计:')
  console.log(`  总成就数: ${totalAchievements}`)
  console.log(`  进度成就: ${progressAchievements}`)
  console.log(`  习惯成就: ${habitAchievements}`)
  console.log(`  行为成就: ${behaviorAchievements}`)
}

async function main() {
  try {
    await seedAchievements()
  } catch (error) {
    console.error('初始化失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
