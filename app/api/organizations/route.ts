import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { organizations } from '@/drizzle/schema';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, logoData, logoMimeType, phone, wechatQrUrl } = body;

    // 验证必填字段
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return apiError(
        API_ERROR_CODES.MISSING_REQUIRED_FIELD,
        400,
        '机构名称不能为空'
      );
    }

    // 验证手机号格式（11位数字）
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
      return apiError(
        API_ERROR_CODES.INVALID_REQUEST,
        400,
        '手机号格式不正确，请输入11位有效手机号'
      );
    }

    // 验证 Base64 数据
    if (logoData && typeof logoData === 'string') {
      // 检查是否是有效的 Base64 字符串
      const base64Pattern = /^data:image\/(\w+);base64,([A-Za-z0-9+/=]+)$/;
      if (!base64Pattern.test(logoData)) {
        return apiError(
          API_ERROR_CODES.INVALID_REQUEST,
          400,
          'Logo 数据格式不正确，请提供有效的 Base64 图片数据'
        );
      }
    }

    // 提取 Base64 数据（如果有前缀）
    const base64Data = logoData && logoData.includes('base64,')
      ? logoData.split(',')[1]
      : logoData;

    const [org] = await db.insert(organizations).values({
      name: name.trim(),
      logoData: base64Data || null,
      logoMimeType: logoMimeType || null,
      phone: phone || null,
      wechatQrUrl: wechatQrUrl || null,
    }).returning();

    return apiSuccess({
      id: org.id,
      name: org.name,
      message: '机构注册成功！请保存您的机构 ID'
    });
  } catch (error) {
    console.error('Registration error:', error);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      '注册失败，请稍后重试'
    );
  }
}
