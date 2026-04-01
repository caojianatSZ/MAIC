/**
 * 创建测试用户
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createTestUser() {
  console.log('创建测试用户...')

  const user = await prisma.user.upsert({
    where: { id: 'test_user' },
    create: {
      id: 'test_user',
      openid: 'test_openid',
      nickname: '测试用户',
      avatarUrl: 'https://example.com/avatar.png',
      isActive: true
    },
    update: {}
  })

  console.log('✅ 测试用户创建成功:', user.id)

  await prisma.$disconnect()
}

createTestUser()
