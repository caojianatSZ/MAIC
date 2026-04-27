/**
 * Phase 3 数据初始化脚本
 * 运行错题巩固成就 seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runPhase3Seed() {
  console.log('🌱 开始 Phase 3 数据初始化...\n');

  try {
    // 动态导入并运行错题巩固成就 seed
    const seedModule = await import('./seed-wrong-question-achievements');
    console.log('✅ 错题巩固成就初始化完成\n');

    // 统计信息
    const totalAchievements = await prisma.achievement.count();
    const behaviorAchievements = await prisma.achievement.count({ where: { type: 'behavior' } });
    const progressAchievements = await prisma.achievement.count({ where: { type: 'progress' } });

    console.log('📊 成就系统统计:');
    console.log(`  总成就数: ${totalAchievements}`);
    console.log(`  行为成就: ${behaviorAchievements}`);
    console.log(`  进度成就: ${progressAchievements}`);

    // 检查 KnowledgeMastery 表
    const knowledgeMasteryCount = await prisma.knowledgeMastery.count();
    console.log(`\n  KnowledgeMastery 记录数: ${knowledgeMasteryCount}`);

    // 检查扩展的 WrongQuestion 表字段
    const wrongQuestions = await prisma.wrongQuestion.findMany({
      select: {
        id: true,
        primaryKnowledgeUri: true,
        standardAnswer: true,
        masteryLevel: true
      },
      take: 1
    });

    if (wrongQuestions.length > 0) {
      console.log('\n✅ WrongQuestion 表扩展字段可用');
    }

  } catch (error) {
    console.error('❌ Phase 3 数据初始化失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n🎉 Phase 3 数据初始化完成！');
}

// 直接运行
runPhase3Seed().catch(err => {
  console.error(err);
  process.exit(1);
});
