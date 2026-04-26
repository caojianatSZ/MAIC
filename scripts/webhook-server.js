const http = require('http');
const { exec } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 配置
const PORT = process.env.WEBHOOK_PORT || 3001;
const HOST = '127.0.0.1';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const DEPLOY_SCRIPT = '/opt/openmaic/scripts/deploy.sh';
const LOG_FILE = '/var/log/openmaic/webhook.log';

// 日志目录
const LOG_DIR = path.dirname(LOG_FILE);
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 日志函数
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...data
  };

  const logLine = JSON.stringify(logEntry);
  console.log(`[Webhook] ${logLine}`);

  // 写入日志文件
  try {
    fs.appendFileSync(LOG_FILE, logLine + '\n');
  } catch (err) {
    console.error('[Webhook] Failed to write log:', err.message);
  }
}

// 验证签名
function verifySignature(payload, signature) {
  if (!WEBHOOK_SECRET) {
    log('WARN', 'WEBHOOK_SECRET 未配置，跳过签名验证');
    return true;
  }

  if (!signature) {
    log('WARN', '请求缺少签名');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  const receivedSignature = signature.replace('sha256=', '');

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(receivedSignature)
  );
}

// 执行部署
function deploy() {
  return new Promise((resolve, reject) => {
    log('INFO', '开始部署...');

    const deployProcess = exec(
      `bash ${DEPLOY_SCRIPT}`,
      {
        env: {
          ...process.env,
          NODE_ENV: 'production'
        },
        timeout: 300000 // 5分钟超时
      },
      (error, stdout, stderr) => {
        if (error) {
          log('ERROR', '部署失败', {
            code: error.code,
            message: error.message,
            stderr: stderr.slice(-500) // 最后500字符
          });
          reject(error);
          return;
        }

        if (stderr) {
          log('WARN', '部署警告', { stderr: stderr.slice(-500) });
        }

        log('INFO', '部署成功', {
          stdout: stdout.slice(-500)
        });
        resolve({ stdout, stderr });
      }
    );

    // 超时处理
    deployProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        log('INFO', 'Deploy output', { output });
      }
    });
  });
}

// 创建 HTTP 服务器
const server = http.createServer(async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);

  // 添加 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Hub-Signature-256, X-GitHub-Event, X-Hub-Signature');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 健康检查
  if (req.method === 'GET' && req.url === '/health') {
    log('INFO', 'Health check', { requestId });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      service: 'webhook-server',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // 状态端点
  if (req.method === 'GET' && req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'running',
      version: '2.0.0',
      hasSecret: !!WEBHOOK_SECRET,
      deployScript: DEPLOY_SCRIPT
    }));
    return;
  }

  // Webhook 端点
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const signature = req.headers['x-hub-signature-256'] ||
                          req.headers['x-hub-signature'] || '';
        const event = req.headers['x-github-event'] || '';

        log('INFO', '收到 webhook', {
          requestId,
          event,
          hasSignature: !!signature,
          bodyLength: body.length
        });

        // 验证签名
        if (!verifySignature(body, signature)) {
          log('WARN', '签名验证失败', { requestId });
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid signature' }));
          return;
        }

        // 解析 payload
        let data;
        try {
          data = JSON.parse(body);
        } catch (e) {
          log('ERROR', 'JSON 解析失败', { requestId, error: e.message });
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
          return;
        }

        // 只处理 push 事件
        if (event === 'push') {
          const ref = data.ref;
          const repository = data.repository?.full_name;
          const pusher = data.pusher?.name;
          const commit = data.head_commit?.id?.substring(0, 7);

          log('INFO', 'Push 事件详情', {
            requestId,
            ref,
            repository,
            pusher,
            commit
          });

          // 只处理 main 分支
          if (ref && ref.includes('refs/heads/main')) {
            try {
              await deploy();

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: true,
                message: '部署成功',
                commit
              }));
            } catch (error) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                success: false,
                error: error.message
              }));
            }
          } else {
            log('INFO', '忽略非 main 分支推送', { requestId, ref });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              message: '事件已接收（非 main 分支）'
            }));
          }
        } else {
          log('INFO', '忽略非 push 事件', { requestId, event });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            message: '事件已接收'
          }));
        }
      } catch (error) {
        log('ERROR', 'Webhook 处理错误', {
          requestId,
          error: error.message,
          stack: error.stack
        });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });

    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// 错误处理
server.on('error', (error) => {
  log('ERROR', 'Server error', { error: error.message });
  if (error.code === 'EADDRINUSE') {
    log('ERROR', `端口 ${PORT} 已被占用，请检查是否有其他进程运行`);
  }
});

// 启动服务器
server.listen(PORT, HOST, () => {
  log('INFO', 'Webhook 服务器启动', {
    port: PORT,
    host: HOST,
    publicUrl: 'https://corp0.hz-college.com/webhook',
    healthUrl: 'https://corp0.hz-college.com/webhook/health',
    hasSecret: !!WEBHOOK_SECRET
  });
});

// 优雅退出
process.on('SIGTERM', () => {
  log('INFO', '收到 SIGTERM 信号，正在关闭...');
  server.close(() => {
    log('INFO', '服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('INFO', '收到 SIGINT 信号，正在关闭...');
  server.close(() => {
    log('INFO', '服务器已关闭');
    process.exit(0);
  });
});
