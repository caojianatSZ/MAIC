import { NextResponse } from 'next/server'

// API 错误类
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// 预定义错误
export const Errors = {
  // 通用错误
  BAD_REQUEST: (message = '请求参数错误') => new ApiError(400, message, 'BAD_REQUEST'),
  UNAUTHORIZED: (message = '未授权') => new ApiError(401, message, 'UNAUTHORIZED'),
  FORBIDDEN: (message = '无权限') => new ApiError(403, message, 'FORBIDDEN'),
  NOT_FOUND: (message = '资源不存在') => new ApiError(404, message, 'NOT_FOUND'),
  CONFLICT: (message = '资源冲突') => new ApiError(409, message, 'CONFLICT'),
  INTERNAL_ERROR: (message = '服务器内部错误') => new ApiError(500, message, 'INTERNAL_ERROR'),

  // 业务错误
  CITY_NOT_FOUND: (cityId: string) => new ApiError(404, `城市不存在: ${cityId}`, 'CITY_NOT_FOUND'),
  USER_NOT_FOUND: (userId: string) => new ApiError(404, `用户不存在: ${userId}`, 'USER_NOT_FOUND'),
  LEAD_NOT_FOUND: (leadId: string) => new ApiError(404, `线索不存在: ${leadId}`, 'LEAD_NOT_FOUND'),
  BOOKING_NOT_FOUND: (bookingId: string) => new ApiError(404, `约课不存在: ${bookingId}`, 'BOOKING_NOT_FOUND'),
  PAYMENT_NOT_FOUND: (paymentId: string) => new ApiError(404, `支付记录不存在: ${paymentId}`, 'PAYMENT_NOT_FOUND'),

  INVALID_ROLE: (role: string) => new ApiError(400, `无效的角色: ${role}`, 'INVALID_ROLE'),
  TEACHER_NOT_IN_CITY: (teacherId: string, cityId: string) =>
    new ApiError(400, `老师不属于该城市: ${teacherId}`, 'TEACHER_NOT_IN_CITY'),
  PAYMENT_ALREADY_SETTLED: (paymentId: string) =>
    new ApiError(400, `支付记录已结算: ${paymentId}`, 'PAYMENT_ALREADY_SETTLED'),
  BOOKING_ALREADY_COMPLETED: (bookingId: string) =>
    new ApiError(400, `约课已完成: ${bookingId}`, 'BOOKING_ALREADY_COMPLETED')
}

// 错误处理响应
export function handleError(error: unknown) {
  console.error('API Error:', error)

  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          message: error.message,
          code: error.code
        }
      },
      { status: error.statusCode }
    )
  }

  // Prisma 错误处理
  if (error instanceof Error && 'code' in error) {
    const prismaError = error as any
    switch (prismaError.code) {
      case 'P2002':
        return NextResponse.json(
          { error: { message: '记录已存在', code: 'DUPLICATE_RECORD' } },
          { status: 409 }
        )
      case 'P2025':
        return NextResponse.json(
          { error: { message: '关联记录不存在', code: 'RELATED_RECORD_NOT_FOUND' } },
          { status: 404 }
        )
      case 'P2003':
        return NextResponse.json(
          { error: { message: '外键约束失败', code: 'FOREIGN_KEY_CONSTRAINT' } },
          { status: 400 }
        )
    }
  }

  // 默认错误
  return NextResponse.json(
    { error: { message: '服务器内部错误', code: 'INTERNAL_ERROR' } },
    { status: 500 }
  )
}

// 成功响应辅助函数
export function success<T>(data: T, message?: string) {
  return NextResponse.json({
    success: true,
    data,
    ...(message && { message })
  })
}

// 分页响应辅助函数
export function paginated<T>(items: T[], total: number, page: number, limit: number) {
  return NextResponse.json({
    success: true,
    data: items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  })
}
