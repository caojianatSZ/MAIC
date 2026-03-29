/**
 * 微信小程序登录 API
 *
 * 功能：
 * 1. 接收微信小程序的 code
 * 2. 调用微信 code2session API 获取 openid
 * 3. 创建或更新用户记录
 * 4. 返回 JWT token
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

// JWT 密钥（生产环境应从环境变量读取）
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 微信小程序 AppID 和 AppSecret（从环境变量读取）
const WECHAT_APPID = process.env.WECHAT_APPID || '';
const WECHAT_APPSECRET = process.env.WECHAT_APPSECRET || '';

interface WechatCode2SessionResponse {
  openid: string;
  session_key: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    // 验证参数
    if (!code) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_CODE',
            message: '缺少 code 参数'
          }
        },
        { status: 400 }
      );
    }

    // 1. 调用微信 code2session API
    const wechatApiUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${WECHAT_APPID}&secret=${WECHAT_APPSECRET}&js_code=${code}&grant_type=authorization_code`;

    const wechatResponse = await fetch(wechatApiUrl);
    const wechatData: WechatCode2SessionResponse = await wechatResponse.json();

    // 检查微信 API 错误
    if (wechatData.errcode) {
      console.error('微信 code2session 失败:', wechatData.errcode, wechatData.errmsg);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'WECHAT_AUTH_FAILED',
            message: `微信认证失败: ${wechatData.errmsg}`
          }
        },
        { status: 401 }
      );
    }

    const { openid, unionid } = wechatData;

    // 2. 查询或创建用户
    let user;
    const existingUsers = await db
      .select()
      .from(users)
      .where(eq(users.openid, openid))
      .limit(1);

    if (existingUsers.length > 0) {
      // 用户已存在，更新登录时间
      user = existingUsers[0];
      await db
        .update(users)
        .set({
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id));
    } else {
      // 新用户，创建记录
      const newUsers = await db
        .insert(users)
        .values({
          openid,
          unionid: unionid || null
        })
        .returning();
      user = newUsers[0];
    }

    // 3. 生成 JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        openid: user.openid
      },
      JWT_SECRET,
      { expiresIn: '30d' } // 30 天有效
    );

    // 4. 返回成功响应
    return NextResponse.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          openid: user.openid,
          nickName: user.nickName,
          avatarUrl: user.avatarUrl
        }
      }
    });

  } catch (error) {
    console.error('登录失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '登录失败，请稍后重试'
        }
      },
      { status: 500 }
    );
  }
}

// 支持 OPTIONS 请求（预检）
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
