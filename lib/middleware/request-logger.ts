import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import { nanoid } from 'nanoid';

const logger = createLogger('RequestLogger');

interface RequestLog {
  requestId: string;
  method: string;
  url: string;
  userAgent?: string;
  ip?: string;
  timestamp: string;
  duration?: number;
  status?: number;
  error?: string;
}

export async function logRequest(
  req: NextRequest,
  handler: (req: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const requestId = nanoid(8);
  const startTime = Date.now();

  // 提取请求信息
  const requestLog: RequestLog = {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.headers.get('user-agent') || undefined,
    ip: req.headers.get('x-forwarded-for') ||
        req.headers.get('x-real-ip') ||
        undefined,
    timestamp: new Date().toISOString(),
  };

  try {
    // 添加请求ID到请求头
    const requestWithId = req;
    requestWithId.headers.set('x-request-id', requestId);

    logger.info('Incoming request', {
      requestId,
      method: req.method,
      url: req.url,
      userAgent: requestLog.userAgent,
    });

    // 执行请求处理
    const response = await handler(requestWithId);

    // 计算请求处理时间
    const duration = Date.now() - startTime;

    // 记录响应信息
    logger.info('Request completed', {
      requestId,
      status: response.status,
      duration: `${duration}ms`,
    });

    // 添加响应头
    response.headers.set('x-request-id', requestId);
    response.headers.set('x-response-time', `${duration}ms`);

    return response;

  } catch (error) {
    const duration = Date.now() - startTime;

    // 记录错误信息
    logger.error('Request failed', {
      requestId,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : String(error),
      duration: `${duration}ms`,
    });

    // 返回错误响应
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        requestId,
      },
      { status: 500 }
    );
  }
}

// 为特定路由创建日志包装器
export function createLoggedRoute(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options?: {
    logBody?: boolean;
    logHeaders?: boolean;
    skipHealthCheck?: boolean;
  }
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    // 跳过健康检查日志
    if (options?.skipHealthCheck && req.url.includes('/api/health')) {
      return handler(req);
    }

    return logRequest(req, handler);
  };
}
