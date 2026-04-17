/**
 * 微信小程序登录 API
 *
 * 功能：
 * 1. 接收微信小程序的 code
 * 2. 调用微信 code2session API 获取 openid
 * 3. 创建或更新用户记录
 * 4. 返回 JWT token、用户档案、机构信息
 * 5. 检查是否需要设置年级科目
 * 6. 支持机构邀请码关联
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, organizations } from '@/drizzle/schema';
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
    const { code, inviteCode } = body;

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

    // 如果有邀请码，先验证并获取机构信息
    const organizationId: string | null = null;
    if (inviteCode) {
      // TODO: 验证邀请码并获取机构ID
      // 这里需要实现邀请码验证逻辑
      // 暂时跳过，后续实现
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
      // 用户已存在，更新登录时间和机构（如果有邀请码）
      user = existingUsers[0];
      const updateData: any = {
        updatedAt: new Date()
      };

      // 如果有邀请码且用户还没有机构，则关联机构
      if (organizationId && !user.organizationId) {
        updateData.organizationId = organizationId;
      }

      await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, user.id));

      // 刷新用户数据
      const updated = await db
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      user = updated[0];
    } else {
      // 新用户，创建记录
      const newUsers = await db
        .insert(users)
        .values({
          openid,
          unionid: unionid || null,
          organizationId: organizationId || null
        })
        .returning();
      user = newUsers[0];
    }

    // 3. 查询机构信息（如果用户有关联机构）
    let organization = null;
    if (user.organizationId) {
      const orgs = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, user.organizationId))
        .limit(1);

      if (orgs.length > 0) {
        organization = {
          id: orgs[0].id,
          name: orgs[0].name,
          logoData: orgs[0].logoData,
          primaryColor: orgs[0].primaryColor,
          secondaryColor: orgs[0].secondaryColor,
        };
      }
    }

    // 4. 检查是否需要设置年级科目
    const needsProfileSetup = !user.gradeLevel || !user.subjects || user.subjects.length === 0;

    // 5. 生成 JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        openid: user.openid
      },
      JWT_SECRET,
      { expiresIn: '30d' } // 30 天有效
    );

    // 6. 返回成功响应
    return NextResponse.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          openid: user.openid,
          nickName: user.nickName,
          avatarUrl: user.avatarUrl,
          gradeLevel: user.gradeLevel,
          subjects: user.subjects,
          organizationId: user.organizationId,
        },
        organization,
        needsProfileSetup,
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
