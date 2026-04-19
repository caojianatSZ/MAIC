# OpenMAIC 高精度批改系统 - 部署文档

## 📋 目录

1. [系统要求](#系统要求)
2. [环境配置](#环境配置)
3. [本地部署](#本地部署)
4. [服务器部署](#服务器部署)
5. [API 使用](#api-使用)
6. [监控和维护](#监控和维护)

---

## 系统要求

### 软件要求

- **Node.js**: >= 18.17.0
- **pnpm**: >= 8.0.0
- **PostgreSQL**: >= 14.0
- **Redis** (可选): 用于缓存

### 硬件要求

- **CPU**: >= 2 核心
- **内存**: >= 4GB
- **磁盘**: >= 10GB 可用空间

---

## 环境配置

### 1. 安装依赖

```bash
# 安装 pnpm
npm install -g pnpm

# 安装项目依赖
pnpm install
```

### 2. 配置环境变量

创建 `.env.local` 文件：

```bash
# 数据库
DATABASE_URL="postgresql://user:password@localhost:5432/openmaic"

# LLM API Keys（至少配置一个）
GLM_API_KEY="your_glm_api_key"
OPENAI_API_KEY="your_openai_api_key"  # 可选
ANTHROPIC_API_KEY="your_anthropic_api_key"  # 可选

# TextIn OCR
TEXTIN_API_KEY="your_textin_api_key"
TEXTIN_SECRET_KEY="your_textin_secret"

# 应用配置
NODE_ENV="production"
PORT=3000
```

### 3. 数据库设置

```bash
# 生成 Prisma Client
pnpm prisma generate

# 运行数据库迁移
pnpm prisma migrate deploy

# （可选）填充初始数据
pnpm prisma db seed
```

---

## 本地部署

### 快速启动

```bash
# 方式 1：使用部署脚本
./deploy.sh

# 方式 2：手动启动
pnpm install
pnpm prisma generate
pnpm dev
```

### 访问应用

- **Web 应用**: http://localhost:3000
- **API 文档**: http://localhost:3000/api/diagnosis/photo-v3

---

## 服务器部署

### 使用 PM2 部署（推荐）

#### 1. 安装 PM2

```bash
npm install -g pm2
```

#### 2. 构建应用

```bash
pnpm build
```

#### 3. 启动应用

```bash
# 启动
pm2 start npm --name "openmaic" -- start

# 查看状态
pm2 status

# 查看日志
pm2 logs openmaic

# 设置开机自启
pm2 startup
pm2 save
```

#### 4. 配置 Nginx 反向代理

```nginx
# /etc/nginx/sites-available/openmaic

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/openmaic /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 5. 配置 SSL（使用 Let's Encrypt）

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 使用 Docker 部署

#### Dockerfile

```dockerfile
FROM node:18-alpine AS base

# 安装 pnpm
RUN npm install -g pnpm

# 工作目录
WORKDIR /app

# 复制依赖文件
COPY package.json pnpm-lock.yaml ./

# 安装依赖
RUN pnpm install --frozen-lockfile

# 复制源代码
COPY . .

# 生成 Prisma Client
RUN pnpm prisma generate

# 构建应用
RUN pnpm build

# 生产镜像
FROM node:18-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY --from=base /app/.next ./.next
COPY --from=base /app/public ./public
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/lib ./lib

RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "start"]
```

#### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/openmaic
      - NODE_ENV=production
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:14-alpine
    environment:
      - POSTGRES_DB=openmaic
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

启动：

```bash
docker-compose up -d
```

---

## API 使用

### V3 批改 API

**端点**: `POST /api/diagnosis/photo-v3`

**请求体**:

```json
{
  "imageBase64": "data:image/jpeg;base64,...",
  "subject": "math",
  "grade": "初三",
  "mode": "balanced",
  "debug": false
}
```

**参数说明**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| imageBase64 | string | 是 | 图像的 base64 编码 |
| imageUrl | string | 是* | 图像 URL（与 imageBase64 二选一） |
| subject | string | 否 | 学科，默认 "math" |
| grade | string | 否 | 年级，默认 "初三" |
| mode | string | 否 | 批改模式：fast/balanced/accurate |
| debug | boolean | 否 | 是否返回调试信息 |

**响应**:

```json
{
  "success": true,
  "mode": "batch",
  "questions": [
    {
      "id": "1",
      "content": "1. 计算 2 + 3 = ?",
      "type": "essay",
      "studentAnswer": "5",
      "judgment": {
        "isCorrect": true,
        "correctAnswer": "5",
        "analysis": "答案正确",
        "confidence": 0.92,
        "needsReview": false
      },
      "knowledgePoints": []
    }
  ],
  "summary": {
    "totalQuestions": 5,
    "correctCount": 4,
    "score": 80,
    "weakKnowledgePoints": ["分数运算"],
    "lowConfidenceCount": 0,
    "needsReview": false
  },
  "performance": {
    "totalTimeMs": 3240,
    "matchingTimeMs": 1200,
    "rerankingTimeMs": 1500,
    "fusionTimeMs": 500,
    "llmCalls": 2,
    "estimatedCost": 0.02
  },
  "ocrValidation": {
    "isValid": true,
    "confidence": 0.89,
    "warnings": []
  }
}
```

---

## 监控和维护

### 日志管理

```bash
# PM2 日志
pm2 logs openmaic

# 清理日志
pm2 flush

# 日志轮转
pm2 install pm2-logrotate
```

### 性能监控

```bash
# PM2 监控
pm2 monit

# 查看资源使用
pm2 show openmaic
```

### 数据库维护

```bash
# 备份数据库
pg_dump -U postgres openmaic > backup.sql

# 恢复数据库
psql -U postgres openmaic < backup.sql

# 查看数据库大小
psql -U postgres -d openmaic -c "SELECT pg_size_pretty(pg_database_size('openmaic'));"
```

### 更新部署

```bash
# 拉取最新代码
git pull

# 安装新依赖
pnpm install

# 运行数据库迁移
pnpm prisma migrate deploy

# 重启应用
pm2 restart openmaic
```

---

## 故障排查

### 常见问题

#### 1. 端口被占用

```bash
# 查看占用端口的进程
lsof -i :3000

# 杀死进程
kill -9 <PID>
```

#### 2. 数据库连接失败

```bash
# 检查 PostgreSQL 状态
sudo systemctl status postgresql

# 检查数据库连接
psql -U postgres -d openmaic
```

#### 3. 内存不足

```bash
# 查看内存使用
free -h

# 重启应用释放内存
pm2 restart openmaic
```

#### 4. API 响应慢

```bash
# 查看日志
pm2 logs openmaic --lines 100

# 检查数据库性能
psql -U postgres -d openmaic -c "SELECT * FROM pg_stat_activity;"
```

---

## 性能优化建议

### 1. 启用缓存

```bash
# 安装 Redis
sudo apt install redis-server

# 配置 Redis
sudo systemctl start redis
```

### 2. 调整批改模式

- **快速模式**（fast）：适合预览，成本低
- **平衡模式**（balanced）：默认模式，性价比高
- **精确模式**（accurate）：适合正式批改，准确率最高

### 3. 批量处理

使用批量 API 提高吞吐量：

```bash
POST /api/diagnosis/batch
```

---

## 安全建议

1. **环境变量保护**：永远不要提交 `.env.local` 到 Git
2. **API 密钥轮换**：定期更换 API Keys
3. **速率限制**：配置 API 速率限制防止滥用
4. **HTTPS**：生产环境必须使用 HTTPS
5. **输入验证**：严格验证所有用户输入

---

## 联系支持

如有问题，请联系开发团队或提交 Issue。

**部署完成！🎉**
