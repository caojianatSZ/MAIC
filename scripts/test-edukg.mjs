#!/usr/bin/env node
/**
 * EduKG 适配器测试脚本
 *
 * 使用方法:
 * node scripts/test-edukg.mjs
 *
 * 环境变量:
 * EDUKG_PHONE - EduKG注册手机号
 * EDUKG_PASSWORD - EduKG登录密码
 */

// 加载环境变量
import { config } from 'dotenv';
config({ path: '.env.local' });

async function testEduKGAdapter() {
  console.log('========================================');
  console.log('EduKG 适配器测试');
  console.log('========================================\n');

  // 检查环境变量
  const phone = process.env.EDUKG_PHONE;
  const password = process.env.EDUKG_PASSWORD;

  console.log('环境配置:');
  console.log(`  EDUKG_PHONE: ${phone ? '✓ 已配置 (' + phone + ')' : '✗ 未配置'}`);
  console.log(`  EDUKG_PASSWORD: ${password ? '✓ 已配置 (****)' : '✗ 未配置'}`);
  console.log(`  EDUKG_BASE_URL: ${process.env.EDUKG_BASE_URL || 'https://api.edukg.cn/2021/repo'}`);
  console.log('');

  if (!phone || !password) {
    console.log('⚠️  警告: 未配置EduKG凭证，将使用Mock模式\n');
  }

  // 测试场景
  const testCases = [
    { subject: '数学', topic: '二次函数' },
    { subject: '数学', topic: '配方法' },
    { subject: '英语', topic: '时态' },
  ];

  console.log('开始测试...\n');

  for (let i = 0; i < testCases.length; i++) {
    const { subject, topic } = testCases[i];
    console.log(`----------------------------------------`);
    console.log(`测试 ${i + 1}/${testCases.length}: ${subject} - ${topic}`);
    console.log(`----------------------------------------`);

    try {
      // 动态导入适配器
      const { edukgAdapter } = await import('../lib/edukg/adapter.js');

      const startTime = Date.now();
      const result = await edukgAdapter.getKnowledgeGraph(subject, topic);
      const duration = Date.now() - startTime;

      console.log('✓ 成功获取知识图谱');
      console.log(`  - 耗时: ${duration}ms`);
      console.log(`  - 节点数: ${result.nodes.length}`);
      console.log(`  - 边数: ${result.edges.length}`);
      console.log(`  - 数据源: ${result.source}`);

      if (result.nodes.length > 0) {
        console.log('\n  知识点示例:');
        result.nodes.slice(0, 3).forEach((node, idx) => {
          console.log(`    ${idx + 1}. ${node.name} (等级: ${node.level})`);
        });
      }

      console.log('');
    } catch (error) {
      console.error('✗ 测试失败:', error.message);
      console.error('  错误详情:', error);
      console.log('');
    }
  }

  console.log('========================================');
  console.log('测试完成');
  console.log('========================================');
}

// 运行测试
testEduKGAdapter().catch(console.error);
