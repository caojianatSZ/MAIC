// app/api/debug/test-aliyun-auth/route.ts
/**
 * 测试阿里云API认证方式
 */

import { NextRequest, NextResponse } from 'next/server';
import { testAuthentication } from '@/lib/aliyun/edututor-client';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const imageUrl = searchParams.get('image') || 'https://example.com/test.jpg';

  try {
    const result = await testAuthentication(imageUrl);

    return NextResponse.json({
      success: true,
      message: '认证测试成功',
      result
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
