import { NextResponse } from 'next/server';
import { edukgAdapter } from '@/lib/edukg/adapter';

/**
 * 测试 EduKG 适配器
 * GET /api/test-edukg
 */
export async function GET() {
  const results = {
    timestamp: new Date().toISOString(),
    config: {
      hasPhone: !!process.env.EDUKG_PHONE,
      hasPassword: !!process.env.EDUKG_PASSWORD,
      baseUrl: process.env.EDUKG_BASE_URL || 'https://api.edukg.cn/2021/repo',
    },
    tests: [] as any[],
  };

  console.log('========================================');
  console.log('EduKG 适配器测试');
  console.log('========================================\n');

  console.log('环境配置:');
  console.log(`  EDUKG_PHONE: ${results.config.hasPhone ? '✓ 已配置' : '✗ 未配置'}`);
  console.log(`  EDUKG_PASSWORD: ${results.config.hasPassword ? '✓ 已配置' : '✗ 未配置'}`);
  console.log(`  EDUKG_BASE_URL: ${results.config.baseUrl}`);
  console.log('');

  if (!results.config.hasPhone || !results.config.hasPassword) {
    console.log('⚠️  警告: 未配置EduKG凭证，将使用Mock模式\n');
  }

  // 测试场景
  const testCases = [
    { subject: '数学', topic: '二次函数' },
    { subject: '数学', topic: '配方法' },
  ];

  for (let i = 0; i < testCases.length; i++) {
    const { subject, topic } = testCases[i];
    console.log(`----------------------------------------`);
    console.log(`测试 ${i + 1}/${testCases.length}: ${subject} - ${topic}`);
    console.log(`----------------------------------------`);

    const testResult: any = {
      subject,
      topic,
      success: false,
      duration: 0,
      nodes: 0,
      edges: 0,
      source: '',
      error: null,
    };

    try {
      const startTime = Date.now();
      const kg = await edukgAdapter.getKnowledgeGraph(subject, topic);
      const duration = Date.now() - startTime;

      testResult.success = true;
      testResult.duration = duration;
      testResult.nodes = kg.nodes.length;
      testResult.edges = kg.edges.length;
      testResult.source = kg.source;

      console.log('✓ 成功获取知识图谱');
      console.log(`  - 耗时: ${duration}ms`);
      console.log(`  - 节点数: ${kg.nodes.length}`);
      console.log(`  - 边数: ${kg.edges.length}`);
      console.log(`  - 数据源: ${kg.source}`);

      if (kg.nodes.length > 0) {
        console.log('\n  知识点示例:');
        kg.nodes.slice(0, 3).forEach((node, idx) => {
          console.log(`    ${idx + 1}. ${node.name} (等级: ${node.level})`);
        });
      }

      console.log('');
    } catch (error) {
      testResult.error = error instanceof Error ? error.message : String(error);
      console.error('✗ 测试失败:', testResult.error);
      console.error('  错误详情:', error);
      console.log('');
    }

    results.tests.push(testResult);
  }

  console.log('========================================');
  console.log('测试完成');
  console.log('========================================');

  return NextResponse.json(results);
}
