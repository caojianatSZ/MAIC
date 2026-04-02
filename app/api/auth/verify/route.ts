import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/wechat';

/**
 * 验证Token
 * POST /api/auth/verify
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({
        success: false,
        error: '缺少token参数'
      }, { status: 400 });
    }

    // 验证Token
    const result = await verifyToken(token);

    if (!result.valid) {
      return NextResponse.json({
        success: false,
        error: 'Token无效或已过期'
      }, { status: 401 });
    }

    // TODO: 从数据库获取用户信息
    // const user = await prisma.user.findUnique({
    //   where: { id: result.userId },
    //   include: { wechatUserInfo: true }
    // });

    return NextResponse.json({
      success: true,
      data: {
        userId: result.userId,
        // user
      }
    });
  } catch (error) {
    console.error('Token验证失败:', error);
    return NextResponse.json({
      success: false,
      error: 'Token验证失败'
    }, { status: 500 });
  }
}
