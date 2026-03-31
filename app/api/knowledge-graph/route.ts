import { NextRequest, NextResponse } from 'next/server';
import { edukgAdapter } from '@/lib/edukg/adapter';

/**
 * 获取知识图谱（调用EduKG接口）
 * GET /api/knowledge-graph?subject=math&topic=quadratic_function
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const subject = searchParams.get('subject') || 'math';
    const topic = searchParams.get('topic') || 'quadratic_function';

    // 使用EduKG适配器获取知识图谱
    const knowledgeGraph = await edukgAdapter.getKnowledgeGraph(subject, topic);

    return NextResponse.json({
      success: true,
      data: knowledgeGraph
    });
  } catch (error) {
    console.error('获取知识图谱失败:', error);
    return NextResponse.json({
      success: false,
      error: '获取知识图谱失败'
    }, { status: 500 });
  }
}
