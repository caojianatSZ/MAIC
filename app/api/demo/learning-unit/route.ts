import { NextRequest, NextResponse } from 'next/server';
import { buildDemoLearningUnit } from '@/lib/data/builder/learning-unit-builder';

/**
 * 获取Demo学习单元完整数据
 * GET /api/demo/learning-unit?id=quadratic_function_adaptive
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id') || 'quadratic_function_adaptive';

    // 使用学习单元构建器生成数据
    const learningUnit = await buildDemoLearningUnit();

    return NextResponse.json({
      success: true,
      data: learningUnit
    });
  } catch (error) {
    console.error('获取Demo学习单元失败:', error);
    return NextResponse.json({
      success: false,
      error: '获取Demo学习单元失败'
    }, { status: 500 });
  }
}
