/**
 * 微信小程序用户档案管理API
 *
 * 功能：
 * - GET /api/miniprogram/user/profile - 获取用户档案
 * - POST /api/miniprogram/user/profile - 设置年级科目（首次）
 * - PUT /api/miniprogram/user/profile - 更新档案
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 年级选项
export const GRADE_LEVELS = [
  // 小学
  { value: 'PRIMARY_1', label: '小学一年级', category: 'primary' },
  { value: 'PRIMARY_2', label: '小学二年级', category: 'primary' },
  { value: 'PRIMARY_3', label: '小学三年级', category: 'primary' },
  { value: 'PRIMARY_4', label: '小学四年级', category: 'primary' },
  { value: 'PRIMARY_5', label: '小学五年级', category: 'primary' },
  { value: 'PRIMARY_6', label: '小学六年级', category: 'primary' },
  // 初中
  { value: 'MIDDLE_1', label: '初中一年级', category: 'middle' },
  { value: 'MIDDLE_2', label: '初中二年级', category: 'middle' },
  { value: 'MIDDLE_3', label: '初中三年级', category: 'middle' },
  // 高中
  { value: 'HIGH_1', label: '高中一年级', category: 'high' },
  { value: 'HIGH_2', label: '高中二年级', category: 'high' },
  { value: 'HIGH_3', label: '高中三年级', category: 'high' },
];

// 科目选项
export const SUBJECTS = [
  { value: 'math', label: '数学' },
  { value: 'chinese', label: '语文' },
  { value: 'english', label: '英语' },
  { value: 'physics', label: '物理' },
  { value: 'chemistry', label: '化学' },
  { value: 'biology', label: '生物' },
  { value: 'history', label: '历史' },
  { value: 'geography', label: '地理' },
  { value: 'politics', label: '政治' },
];

/**
 * 验证JWT token并返回用户ID
 */
async function getUserIdFromToken(request: NextRequest): Promise<string | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return decoded.userId;
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * GET - 获取用户档案
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 验证token并获取用户ID
    const userId = await getUserIdFromToken(request);
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '未授权访问'
          }
        },
        { status: 401 }
      );
    }

    // 2. 查询用户档案
    const userList = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userList.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: '用户不存在'
          }
        },
        { status: 404 }
      );
    }

    const user = userList[0];

    // 3. 返回用户档案
    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        nickName: user.nickName,
        avatarUrl: user.avatarUrl,
        gradeLevel: user.gradeLevel,
        subjects: user.subjects || [],
        organizationId: user.organizationId,
        createdAt: user.createdAt,
      },
      meta: {
        gradeLevels: GRADE_LEVELS,
        subjects: SUBJECTS,
      },
    });
  } catch (error) {
    console.error('获取用户档案失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取用户档案失败'
        }
      },
      { status: 500 }
    );
  }
}

/**
 * POST - 设置年级科目（首次）
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证token并获取用户ID
    const userId = await getUserIdFromToken(request);
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '未授权访问'
          }
        },
        { status: 401 }
      );
    }

    // 2. 解析请求体
    const body = await request.json();
    const { gradeLevel, subjects } = body;

    // 3. 验证参数
    if (!gradeLevel) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_GRADE_LEVEL',
            message: '缺少年级参数'
          }
        },
        { status: 400 }
      );
    }

    if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_SUBJECTS',
            message: '缺少科目参数或科目为空'
          }
        },
        { status: 400 }
      );
    }

    // 4. 验证年级和科目是否有效
    const validGradeLevel = GRADE_LEVELS.some(g => g.value === gradeLevel);
    if (!validGradeLevel) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_GRADE_LEVEL',
            message: '无效的年级参数'
          }
        },
        { status: 400 }
      );
    }

    const invalidSubjects = subjects.filter((s: string) => !SUBJECTS.some(sub => sub.value === s));
    if (invalidSubjects.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_SUBJECTS',
            message: `无效的科目参数: ${invalidSubjects.join(', ')}`
          }
        },
        { status: 400 }
      );
    }

    // 5. 查询用户当前档案
    const userList = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userList.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: '用户不存在'
          }
        },
        { status: 404 }
      );
    }

    const user = userList[0];

    // 6. 检查是否已经设置过档案
    if (user.gradeLevel || (user.subjects && user.subjects.length > 0)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PROFILE_ALREADY_SET',
            message: '用户档案已设置，请使用PUT接口更新'
          }
        },
        { status: 400 }
      );
    }

    // 7. 更新用户档案
    const updated = await db
      .update(users)
      .set({
        gradeLevel,
        subjects,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    // 8. 返回更新后的用户档案
    return NextResponse.json({
      success: true,
      data: {
        id: updated[0].id,
        gradeLevel: updated[0].gradeLevel,
        subjects: updated[0].subjects,
        updatedAt: updated[0].updatedAt,
      },
      message: '用户档案设置成功',
    });
  } catch (error) {
    console.error('设置用户档案失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '设置用户档案失败'
        }
      },
      { status: 500 }
    );
  }
}

/**
 * PUT - 更新用户档案
 */
export async function PUT(request: NextRequest) {
  try {
    // 1. 验证token并获取用户ID
    const userId = await getUserIdFromToken(request);
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '未授权访问'
          }
        },
        { status: 401 }
      );
    }

    // 2. 解析请求体
    const body = await request.json();
    const { gradeLevel, subjects, nickName } = body;

    // 3. 验证至少有一个字段要更新
    if (!gradeLevel && (!subjects || subjects.length === 0) && !nickName) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOTHING_TO_UPDATE',
            message: '没有需要更新的字段'
          }
        },
        { status: 400 }
      );
    }

    // 4. 构建更新数据
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (gradeLevel) {
      const validGradeLevel = GRADE_LEVELS.some(g => g.value === gradeLevel);
      if (!validGradeLevel) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_GRADE_LEVEL',
              message: '无效的年级参数'
            }
          },
          { status: 400 }
        );
      }
      updateData.gradeLevel = gradeLevel;
    }

    if (subjects && Array.isArray(subjects) && subjects.length > 0) {
      const invalidSubjects = subjects.filter((s: string) => !SUBJECTS.some(sub => sub.value === s));
      if (invalidSubjects.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_SUBJECTS',
              message: `无效的科目参数: ${invalidSubjects.join(', ')}`
            }
          },
          { status: 400 }
        );
      }
      updateData.subjects = subjects;
    }

    if (nickName) {
      updateData.nickName = nickName;
    }

    // 5. 更新用户档案
    const updated = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();

    // 6. 返回更新后的用户档案
    return NextResponse.json({
      success: true,
      data: {
        id: updated[0].id,
        nickName: updated[0].nickName,
        gradeLevel: updated[0].gradeLevel,
        subjects: updated[0].subjects,
        updatedAt: updated[0].updatedAt,
      },
      message: '用户档案更新成功',
    });
  } catch (error) {
    console.error('更新用户档案失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '更新用户档案失败'
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
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
