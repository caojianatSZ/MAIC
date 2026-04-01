/**
 * 多科目成就初始化
 * 为英语和物理科目创建完整的5级成就体系
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 英语科目知识点
const ENGLISH_KNOWLEDGE_POINTS = [
  {
    id: 'kp_english_tense',
    name: '时态',
    identifier: 'english_tense',
    subject: 'english'
  },
  {
    id: 'kp_english_vocabulary',
    name: '词汇',
    identifier: 'english_vocabulary',
    subject: 'english'
  },
  {
    id: 'kp_english_reading',
    name: '阅读理解',
    identifier: 'english_reading',
    subject: 'english'
  },
  {
    id: 'kp_english_grammar',
    name: '语法',
    identifier: 'english_grammar',
    subject: 'english'
  },
  {
    id: 'kp_english_listening',
    name: '听力',
    identifier: 'english_listening',
    subject: 'english'
  }
]

// 物理科目知识点
const PHYSICS_KNOWLEDGE_POINTS = [
  {
    id: 'kp_physics_mechanics',
    name: '力学',
    identifier: 'physics_mechanics',
    subject: 'physics'
  },
  {
    id: 'kp_physics_electricity',
    name: '电学',
    identifier: 'physics_electricity',
    subject: 'physics'
  },
  {
    id: 'kp_physics_heat',
    name: '热学',
    identifier: 'physics_heat',
    subject: 'physics'
  },
  {
    id: 'kp_physics_optics',
    name: '光学',
    identifier: 'physics_optics',
    subject: 'physics'
  },
  {
    id: 'kp_physics_energy',
    name: '能量',
    identifier: 'physics_energy',
    subject: 'physics'
  }
]

// 成就等级配置
const ACHIEVEMENT_LEVELS = [
  {
    level: 'bronze',
    name: '初识者',
    icon: '🥉',
    description: '刚刚开始学习',
    color: '#CD7F32'
  },
  {
    level: 'silver',
    name: '进阶者',
    icon: '🥈',
    description: '完成3道题目，开始理解',
    color: '#C0C0C0'
  },
  {
    level: 'gold',
    name: '熟练者',
    icon: '🥇',
    description: '完成5道题目且正确率80%+',
    color: '#FFD700'
  },
  {
    level: 'diamond',
    name: '精通者',
    icon: '💎',
    description: '完成7道题目且正确率90%+',
    color: '#B9F2FF'
  },
  {
    level: 'king',
    name: '大师',
    icon: '👑',
    description: '完全掌握，持续优秀',
    color: '#FF6B6B'
  }
]

/**
 * 为单个知识点创建5级成就
 */
async function createKnowledgePointAchievements(kp: any) {
  console.log(`\n创建 ${kp.subject} - ${kp.name} 成就...`)

  for (const levelConfig of ACHIEVEMENT_LEVELS) {
    const identifier = `${kp.subject}_${kp.identifier}_${levelConfig.level}`

    // 检查是否已存在
    const existing = await prisma.achievement.findUnique({
      where: { identifier }
    })

    if (existing) {
      console.log(`  ✓ ${levelConfig.name} 已存在`)
      continue
    }

    // 创建成就
    await prisma.achievement.create({
      data: {
        identifier,
        type: 'progress',
        subject: kp.subject,
        knowledgePointId: kp.id,
        level: levelConfig.level,
        name: `${kp.name}${levelConfig.name}`,
        description: levelConfig.description,
        iconUrl: levelConfig.icon,
        condition: {
          type: 'knowledge_point_mastery',
          accuracy_threshold: levelConfig.level === 'bronze' ? 0 :
                            levelConfig.level === 'silver' ? 70 :
                            levelConfig.level === 'gold' ? 80 :
                            levelConfig.level === 'diamond' ? 90 : 95,
          min_questions: levelConfig.level === 'bronze' ? 1 :
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

    console.log(`  ✓ 创建 ${levelConfig.name}: ${identifier}`)
  }
}

/**
 * 创建跨科目综合成就
 */
async function createCrossSubjectAchievements() {
  console.log('\n创建跨科目综合成就...')

  const crossSubjectAchievements = [
    {
      identifier: 'math_master',
      name: '数学大师',
      description: '掌握数学所有5个知识点达到黄金级',
      subject: 'math',
      icon: '📐',
      condition: {
        type: 'subject_master',
        subject: 'math',
        min_level: 'gold',
        min_knowledge_points: 5
      },
      points: 500
    },
    {
      identifier: 'english_master',
      name: '英语大师',
      description: '掌握英语所有5个知识点达到黄金级',
      subject: 'english',
      icon: '📖',
      condition: {
        type: 'subject_master',
        subject: 'english',
        min_level: 'gold',
        min_knowledge_points: 5
      },
      points: 500
    },
    {
      identifier: 'physics_master',
      name: '物理大师',
      description: '掌握物理所有5个知识点达到黄金级',
      subject: 'physics',
      icon: '⚡',
      condition: {
        type: 'subject_master',
        subject: 'physics',
        min_level: 'gold',
        min_knowledge_points: 5
      },
      points: 500
    },
    {
      identifier: 'all_rounder',
      name: '全能学霸',
      description: '在数学、英语、物理三科都达到白银级',
      subject: null,
      icon: '🏆',
      condition: {
        type: 'multi_subject_master',
        subjects: ['math', 'english', 'physics'],
        min_level: 'silver'
      },
      points: 1000
    }
  ]

  for (const achievement of crossSubjectAchievements) {
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
        type: 'progress',
        subject: achievement.subject,
        level: 'king', // 综合成就设为王者级
        name: achievement.name,
        description: achievement.description,
        iconUrl: achievement.icon,
        condition: achievement.condition,
        points: achievement.points
      }
    })

    console.log(`  ✓ 创建综合成就: ${achievement.name}`)
  }
}

async function main() {
  console.log('🎓 开始初始化多科目成就系统...\n')

  try {
    // 创建英语科目成就
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📚 英语科目')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    for (const kp of ENGLISH_KNOWLEDGE_POINTS) {
      await createKnowledgePointAchievements(kp)
    }

    // 创建物理科目成就
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('⚡ 物理科目')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    for (const kp of PHYSICS_KNOWLEDGE_POINTS) {
      await createKnowledgePointAchievements(kp)
    }

    // 创建跨科目综合成就
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🏆 综合成就')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    await createCrossSubjectAchievements()

    // 统计信息
    const totalAchievements = await prisma.achievement.count()
    const mathAchievements = await prisma.achievement.count({ where: { subject: 'math' } })
    const englishAchievements = await prisma.achievement.count({ where: { subject: 'english' } })
    const physicsAchievements = await prisma.achievement.count({ where: { subject: 'physics' } })
    const crossSubjectAchievements = await prisma.achievement.count({ where: { subject: null } })

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ 多科目成就初始化完成！')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('\n📊 成就统计:')
    console.log(`  总成就数: ${totalAchievements}`)
    console.log(`  数学科: ${mathAchievements} 个`)
    console.log(`  英语科: ${englishAchievements} 个`)
    console.log(`  物理科: ${physicsAchievements} 个`)
    console.log(`  综合成就: ${crossSubjectAchievements} 个`)
    console.log('\n🎉 新增成就:', totalAchievements - 29, '个')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  } catch (error) {
    console.error('❌ 初始化失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
