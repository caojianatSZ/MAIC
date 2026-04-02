/**
 * 创建测试用户脚本
 * 运行: npx tsx prisma/seed-test-user.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createTestUser() {
  try {
    console.log('🔄 开始创建测试用户...')

    // 创建 demo_user（小程序使用）
    const demoUser = await prisma.user.upsert({
      where: { openid: 'demo_user' },
      update: {
        lastLoginAt: new Date(),
        isActive: true
      },
      create: {
        id: 'demo_user_id',
        openid: 'demo_user',
        nickname: '小程序测试用户',
        avatarUrl: 'https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTL1',
        phoneNumber: '13800138000',
        email: 'demo@example.com',
        lastLoginAt: new Date(),
        loginCount: 1,
        isActive: true,
        isVip: true
      }
    })

    console.log('✅ demo_user 创建成功:', {
      id: demoUser.id,
      nickname: demoUser.nickname,
      openid: demoUser.openid
    })

    // 创建或更新学生档案
    const profile = await prisma.studentProfile.upsert({
      where: { userId: demoUser.id },
      update: {},
      create: {
        userId: demoUser.id,
        learningStyle: {
          visual: 0.6,
          auditory: 0.4,
          kinesthetic: 0.5
        },
        strongPoints: ['图形思维', '应用能力'],
        weakPoints: ['计算准确性'],
        studyStats: {
          totalStudyTime: 0,
          questionsCompleted: 0,
          lessonsLearned: 0,
          currentStreak: 0,
          longestStreak: 0
        }
      }
    })

    console.log('✅ 学生档案创建成功')

    // 同时创建 test_user（测试用）
    const testUser = await prisma.user.upsert({
      where: { id: 'test_user' },
      update: {
        lastLoginAt: new Date()
      },
      create: {
        id: 'test_user',
        openid: 'test_openid',
        nickname: 'API测试用户',
        avatarUrl: 'https://example.com/avatar.png',
        isActive: true,
        isVip: true,
        lastLoginAt: new Date(),
        loginCount: 5
      }
    })

    console.log('✅ test_user 创建成功:', {
      id: testUser.id,
      nickname: testUser.nickname
    })

    // 查看所有用户
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        nickname: true,
        openid: true,
        isActive: true,
        isVip: true
      }
    })

    console.log(`\n📊 当前数据库共有 ${allUsers.length} 个用户:`)
    allUsers.forEach(u => {
      console.log(`  - ${u.id}: ${u.nickname || '未命名'} (${u.openid}) [VIP: ${u.isVip ? '✓' : '✗'}]`)
    })

    console.log('\n🎉 测试用户创建完成！')
    console.log('\n📝 小程序中使用:')
    console.log('   userId: demo_user_id')
    console.log('   openid: demo_user')

  } catch (error) {
    console.error('❌ 创建测试用户失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

createTestUser()

