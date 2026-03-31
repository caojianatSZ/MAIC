import { NextRequest, NextResponse } from 'next/server';
import { edukgAdapter } from '@/lib/edukg/adapter';

/**
 * 测试优化后的 EduKG 集成
 * GET /api/test-edukg-optimized
 */
export async function GET(request: NextRequest) {
  const results = {
    timestamp: new Date().toISOString(),
    tests: [] as any[],
  };

  console.log('========================================');
  console.log('EduKG 优化功能测试');
  console.log('========================================\n');

  // 测试1: 搜索知识图谱（带详细关系）
  console.log('测试 1: 搜索知识图谱（带详细关系）');
  try {
    const startTime = Date.now();
    const kg = await edukgAdapter.getKnowledgeGraph('数学', '二次函数');
    const duration = Date.now() - startTime;

    results.tests.push({
      name: '知识图谱搜索',
      success: true,
      duration,
      nodes: kg.nodes.length,
      edges: kg.edges.length,
      maxLevel: kg.metadata.maxLevel,
      nodeDetails: kg.nodes.slice(0, 3).map(n => ({
        name: n.name,
        level: n.level,
        prerequisites: n.prerequisites.length,
        hasDescription: !!n.description,
      })),
    });

    console.log(`✅ 成功: ${kg.nodes.length} 个节点, ${kg.edges.length} 条边, 最高等级: ${kg.metadata.maxLevel}`);
  } catch (error) {
    results.tests.push({
      name: '知识图谱搜索',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log(`❌ 失败: ${error}`);
  }

  // 测试2: 获取习题
  console.log('\n测试 2: 获取习题');
  try {
    const startTime = Date.now();
    const questions = await edukgAdapter.getQuestions('二次函数', {
      type: '选择题',
      pageSize: 5,
    });
    const duration = Date.now() - startTime;

    results.tests.push({
      name: '获取习题',
      success: true,
      duration,
      count: questions.length,
      questionSamples: questions.slice(0, 2).map(q => ({
        hasQuestion: !!q.question,
        hasOptions: q.options.length > 0,
        hasAnswer: !!q.answer,
      })),
    });

    console.log(`✅ 成功: 获取 ${questions.length} 道题目`);
  } catch (error) {
    results.tests.push({
      name: '获取习题',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log(`❌ 失败: ${error}`);
  }

  // 测试3: 诊断题目 API（使用 EduKG）
  console.log('\n测试 3: 诊断题目 API（使用 EduKG）');
  try {
    const startTime = Date.now();
    const quizResponse = await fetch(`${request.nextUrl.origin}/api/diagnosis/quiz?subject=math&topic=quadratic_function&count=3&useEduKG=true`);
    const quizData = await quizResponse.json();
    const duration = Date.now() - startTime;

    results.tests.push({
      name: '诊断题目 API',
      success: quizData.success,
      duration,
      questionCount: quizData.data?.questions?.length || 0,
      source: quizData.data?.source || '未知',
    });

    console.log(`✅ 成功: ${quizData.data?.questions?.length || 0} 道题目, 来源: ${quizData.data?.source}`);
  } catch (error) {
    results.tests.push({
      name: '诊断题目 API',
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    console.log(`❌ 失败: ${error}`);
  }

  console.log('\n========================================');
  console.log('测试完成');
  console.log('========================================\n');

  return NextResponse.json({
    success: true,
    data: results,
  });
}
