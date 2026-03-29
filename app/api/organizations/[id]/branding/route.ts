import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { organizations } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';

// 验证十六进制颜色格式
function isValidHexColor(color: string): boolean {
  return /^#[0-9A-F]{6}$/i.test(color);
}

// GET: 获取品牌设置
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 验证组织是否存在
    const [org] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        primaryColor: organizations.primaryColor,
        secondaryColor: organizations.secondaryColor,
        logoData: organizations.logoData,
        logoMimeType: organizations.logoMimeType,
      })
      .from(organizations)
      .where(eq(organizations.id, id));

    if (!org) {
      return apiError(
        API_ERROR_CODES.INVALID_REQUEST,
        404,
        '机构不存在'
      );
    }

    // 返回品牌设置,如果未设置则返回默认值
    return apiSuccess({
      organizationId: org.id,
      organizationName: org.name,
      primaryColor: org.primaryColor || '#3B82F6', // 默认蓝色
      secondaryColor: org.secondaryColor || '#EFF6FF', // 默认浅蓝色
      hasLogo: !!org.logoData,
    });
  } catch (error) {
    console.error('Get branding error:', error);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      '获取品牌设置失败'
    );
  }
}

// PUT: 更新品牌设置
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { primaryColor, secondaryColor } = body;

    // 验证组织是否存在
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id));

    if (!org) {
      return apiError(
        API_ERROR_CODES.INVALID_REQUEST,
        404,
        '机构不存在'
      );
    }

    // 验证颜色格式
    if (primaryColor && !isValidHexColor(primaryColor)) {
      return apiError(
        API_ERROR_CODES.INVALID_REQUEST,
        400,
        '主颜色格式不正确,请使用 #RRGGBB 格式'
      );
    }

    if (secondaryColor && !isValidHexColor(secondaryColor)) {
      return apiError(
        API_ERROR_CODES.INVALID_REQUEST,
        400,
        '次颜色格式不正确,请使用 #RRGGBB 格式'
      );
    }

    // 更新品牌设置
    const [updatedOrg] = await db
      .update(organizations)
      .set({
        primaryColor: primaryColor || null,
        secondaryColor: secondaryColor || null,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, id))
      .returning({
        id: organizations.id,
        name: organizations.name,
        primaryColor: organizations.primaryColor,
        secondaryColor: organizations.secondaryColor,
      });

    return apiSuccess({
      organizationId: updatedOrg.id,
      organizationName: updatedOrg.name,
      primaryColor: updatedOrg.primaryColor || '#3B82F6',
      secondaryColor: updatedOrg.secondaryColor || '#EFF6FF',
      message: '品牌设置更新成功',
    });
  } catch (error) {
    console.error('Update branding error:', error);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      '更新品牌设置失败'
    );
  }
}
