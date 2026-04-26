// app/api/webhook/deploy/route.ts
/**
 * Webhook 部署 API
 *
 * 接收 GitHub/GitLab Webhook，自动部署到 hongzhi 服务器
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import { exec } from 'child_process';
import { promisify } from 'util';

const log = createLogger('Webhook Deploy');
const execAsync = promisify(exec);

// Webhook 密钥（从环境变量读取）
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your-webhook-secret';

/**
 * 验证 Webhook 签名
 */
function verifyWebhookSignature(payload: string, signature: string): boolean {
  const hmac = require('crypto').createHmac('sha256', WEBHOOK_SECRET);
  const digest = hmac.update(payload).digest('hex');
  return signature === `sha256=${digest}`;
}

/**
 * 处理 GitHub Push 事件
 */
async function handleGitHubPush(payload: any) {
  const { ref, repository, pusher, head_commit } = payload;

  log.info('GitHub Push 事件', {
    ref,
    repository: repository.full_name,
    pusher: pusher.name,
    commit: head_commit.message
  });

  // 只处理 main 分支的推送
  if (!ref.includes('refs/heads/main')) {
    return {
      success: false,
      message: '只处理 main 分支的推送'
    };
  }

  try {
    // 执行部署
    log.info('开始部署到 hongzhi 服务器...');

    const deployScript = '/root/scripts/deploy-to-hongzhi.sh';

    const { stdout, stderr } = await execAsync(`bash ${deployScript}`);

    log.info('部署输出', { stdout });
    if (stderr) {
      log.warn('部署警告', { stderr });
    }

    return {
      success: true,
      message: '部署成功',
      commit: head_commit.id,
      author: pusher.name
    };
  } catch (error) {
    log.error('部署失败', { error });

    return {
      success: false,
      message: '部署失败',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 处理 GitLab Push 事件
 */
async function handleGitLabPush(payload: any) {
  const { ref, project, user_email, commits } = payload;

  log.info('GitLab Push 事件', {
    ref,
    project: project.name,
    user: user_email,
    commits: commits.length
  });

  // 只处理 main 分支的推送
  if (!ref.includes('refs/heads/main')) {
    return {
      success: false,
      message: '只处理 main 分支的推送'
    };
  }

  try {
    // 执行部署
    log.info('开始部署到 hongzhi 服务器...');

    const deployScript = '/root/scripts/deploy-to-hongzhi.sh';

    const { stdout, stderr } = await execAsync(`bash ${deployScript}`);

    log.info('部署输出', { stdout });
    if (stderr) {
      log.warn('部署警告', { stderr });
    }

    return {
      success: true,
      message: '部署成功',
      commits: commits.length
    };
  } catch (error) {
    log.error('部署失败', { error });

    return {
      success: false,
      message: '部署失败',
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Webhook API 端点
 */
export async function POST(request: NextRequest) {
  try {
    // 获取签名
    const signature = request.headers.get('x-hub-signature-256') ||
                      request.headers.get('x-hub-signature') || '';

    // 获取事件类型
    const githubEvent = request.headers.get('x-github-event') || '';
    const gitlabEvent = request.headers.get('x-gitlab-event') || '';

    // 读取请求体
    const payload = await request.text();

    // 验证签名（如果有）
    if (signature && !verifyWebhookSignature(payload, signature)) {
      log.warn('Webhook 签名验证失败');
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      );
    }

    log.info('收到 Webhook', {
      githubEvent,
      gitlabEvent,
      hasPayload: payload.length > 0
    });

    // 解析 payload
    let data: any;
    try {
      data = JSON.parse(payload);
    } catch (e) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // 处理不同平台的推送事件
    let result;

    if (githubEvent === 'push') {
      result = await handleGitHubPush(data);
    } else if (gitlabEvent === 'Push Hook') {
      result = await handleGitLabPush(data);
    } else {
      result = {
        success: false,
        message: `不支持的事件类型: ${githubEvent || gitlabEvent}`
      };
    }

    return NextResponse.json(result);

  } catch (error) {
    log.error('Webhook 处理失败', { error });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET 端点 - 用于测试 webhook 配置
 * Webhook 自动部署测试 - 2026-04-26
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Webhook Deploy API',
    status: 'running',
    info: {
      endpoint: '/api/webhook/deploy',
      method: 'POST',
      platforms: ['GitHub', 'GitLab'],
      events: ['push'],
      branches: ['main'],
      configuration: {
        secret: WEBHOOK_SECRET ? '已配置' : '未配置'
      }
    }
  });
}
