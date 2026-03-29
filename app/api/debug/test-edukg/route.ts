import { NextRequest, NextResponse } from 'next/server';
import { getEduKGService } from '@/lib/services/edukg';

/**
 * EduKG服务测试API
 * GET /api/debug/test-edukg?action=search&keyword=有理数
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action') || 'search';
  const keyword = searchParams.get('keyword') || '有理数';
  const category = searchParams.get('category') || undefined;
  const uri = searchParams.get('uri') || '数学#有理数';

  const edukg = getEduKGService();

  try {
    let result;
    let message = '';

    switch (action) {
      case 'search':
        message = `搜索知识点: ${keyword}`;
        result = await edukg.searchInstances(keyword, category);
        break;

      case 'getInstance':
        message = `获取知识点详情: ${uri}`;
        result = await edukg.getInstanceInfo(uri);
        break;

      case 'getChildNodes':
        message = `获取子知识点: ${uri}`;
        result = await edukg.getChildNodes(uri);
        break;

      case 'getRelations':
        message = `获取知识点关系: ${uri}`;
        result = await edukg.getRelations(uri);
        break;

      case 'recognize':
        message = `AI识别知识点: ${keyword}`;
        result = await edukg.recognizeKnowledgePoints(keyword, category);
        break;

      default:
        return NextResponse.json({
          error: 'Invalid action',
          supportedActions: ['search', 'getInstance', 'getChildNodes', 'getRelations', 'recognize'],
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      action,
      message,
      result,
      count: Array.isArray(result) ? result.length : 1,
    });
  } catch (error) {
    console.error('EduKG test error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
