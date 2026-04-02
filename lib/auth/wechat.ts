/**
 * 微信小程序认证工具
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface WechatLoginResult {
  success: boolean;
  userId?: string;
  isNewUser?: boolean;
  error?: string;
}

/**
 * 微信小程序登录
 * @param code 微信登录code
 * @param userInfo 用户信息（可选）
 */
export async function wechatLogin(
  code: string,
  userInfo?: {
    nickname?: string;
    avatarUrl?: string;
    gender?: number;
    city?: string;
    province?: string;
    country?: string;
  }
): Promise<WechatLoginResult> {
  try {
    // TODO: 实际调用微信API
    // const appId = process.env.WECHAT_APP_ID;
    // const appSecret = process.env.WECHAT_APP_SECRET;
    // const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${appSecret}&js_code=${code}&grant_type=authorization_code`;
    // const response = await fetch(url);
    // const data = await response.json();

    // 目前返回Mock数据
    const mockOpenid = `mock_openid_${Date.now()}`;

    // 查找或创建用户
    let user = await prisma.user.findUnique({
      where: { openid: mockOpenid },
      include: { wechatUserInfo: true }
    });

    const isNewUser = !user;

    if (!user) {
      // 创建新用户
      user = await prisma.user.create({
        data: {
          openid: mockOpenid,
          nickname: userInfo?.nickname,
          avatarUrl: userInfo?.avatarUrl,
          lastLoginAt: new Date(),
          loginCount: 1,
          wechatUserInfo: {
            create: {
              openid: mockOpenid,
              nickname: userInfo?.nickname,
              gender: userInfo?.gender ? userInfo.gender.toString() : undefined,
              city: userInfo?.city,
              province: userInfo?.province,
              country: userInfo?.country,
              sessionKey: `mock_session_key_${Date.now()}` // 加密存储
            }
          }
        },
        include: { wechatUserInfo: true }
      });
    } else {
      // 更新登录信息
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          loginCount: { increment: 1 }
        },
        include: { wechatUserInfo: true }
      });
    }

    return {
      success: true,
      userId: user.id,
      isNewUser
    };
  } catch (error) {
    console.error('微信登录失败:', error);
    return {
      success: false,
      error: '登录失败，请重试'
    };
  }
}

/**
 * 生成JWT Token
 * @param userId 用户ID
 */
export async function generateToken(userId: string): Promise<string> {
  // TODO: 使用jsonwebtoken生成真实的JWT
  // const jwt = require('jsonwebtoken');
  // return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

  // 目前返回Mock token
  return `mock_token_${userId}_${Date.now()}`;
}

/**
 * 验证JWT Token
 * @param token JWT Token
 */
export async function verifyToken(token: string): Promise<{ valid: boolean; userId?: string }> {
  // TODO: 验证真实的JWT
  // const jwt = require('jsonwebtoken');
  // try {
  //   const decoded = jwt.verify(token, process.env.JWT_SECRET);
  //   return { valid: true, userId: decoded.userId };
  // } catch (error) {
  //   return { valid: false };
  // }

  // 目前简单验证Mock token
  if (token.startsWith('mock_token_')) {
    const userId = token.split('_')[2];
    return { valid: true, userId };
  }

  return { valid: false };
}
