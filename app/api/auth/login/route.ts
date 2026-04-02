import { NextRequest, NextResponse } from 'next/server';
import { wechatLogin, generateToken } from '@/lib/auth/wechat';

/**
 * 微信小程序登录
 * POST /api/auth/login
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, userInfo } = body;

    // 验证参数
    if (!code) {
      return NextResponse.json({
        success: false,
        error: '缺少code参数'
      }, { status: 400 });
    }

    // 微信登录
    const loginResult = await wechatLogin(code, userInfo);

    if (!loginResult.success) {
      return NextResponse.json({
        success: false,
        error: loginResult.error
      }, { status: 400 });
    }

    // 生成Token
    const token = await generateToken(loginResult.userId!);

    return NextResponse.json({
      success: true,
      data: {
        token,
        userId: loginResult.userId,
        isNewUser: loginResult.isNewUser,
        expiresIn: 7 * 24 * 60 * 60 // 7天（秒）
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    return NextResponse.json({
      success: false,
      error: '登录失败，请重试'
    }, { status: 500 });
  }
}
