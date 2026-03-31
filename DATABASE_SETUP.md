# OpenMAIC数据库设置指南

## 1. 安装依赖

```bash
# 安装Prisma CLI
pnpm add -D prisma

# 安装Prisma Client
pnpm add @prisma/client

# 或使用npm
npm install -D prisma
npm install @prisma/client
```

## 2. 配置数据库

### 开发环境（SQLite）
```bash
# 复制环境变量文件
cp .env.example .env.local

# .env.local内容（使用SQLite）
DATABASE_URL="file:./dev.db"
```

### 生产环境（PostgreSQL）
```bash
# .env.local内容（使用PostgreSQL）
DATABASE_URL="postgresql://user:password@localhost:5432/openmaic?schema=public"
```

## 3. 初始化数据库

```bash
# 生成Prisma Client
pnpm prisma generate

# 创建数据库迁移
pnpm prisma migrate dev --name init

# 运行种子数据
pnpm prisma db seed
```

## 4. 查看数据库

### Prisma Studio（推荐）
```bash
# 打开Prisma Studio（可视化数据库管理工具）
pnpm prisma studio
```

### 命令行
```bash
# 查看数据
pnpm prisma db pull
```

## 5. 部署到生产环境

### Vercel（推荐）
1. 在Vercel项目设置中添加环境变量 `DATABASE_URL`
2. 部署时会自动运行迁移

### 其他平台
```bash
# 生成生产环境迁移
pnpm prisma migrate deploy

# 重置数据库（谨慎使用）
pnpm prisma migrate reset --force
```

## 6. 常用命令

```bash
# 开发环境
pnpm prisma migrate dev    # 创建迁移并应用
pnpm prisma studio        # 打开Prisma Studio
pnpm prisma db seed       # 运行种子数据

# 生产环境
pnpm prisma migrate deploy # 部署迁移
pnpm prisma db push        # 直接推送schema到数据库
```

## 7. 故障排查

### 连接错误
```bash
# 检查DATABASE_URL是否正确设置
echo $DATABASE_URL

# 测试数据库连接
pnpm prisma db push
```

### 迁移错误
```bash
# 查看迁移状态
pnpm prisma migrate status

# 重置迁移（开发环境）
pnpm prisma migrate reset --force
```

## 环境变量说明

| 变量名 | 说明 | 示例 |
|--------|------|------|
| DATABASE_URL | 数据库连接字符串 | `postgresql://...` 或 `file:./dev.db` |
| WECHAT_APP_ID | 微信小程序AppID | `wx1234567890abcdef` |
| WECHAT_APP_SECRET | 微信小程序AppSecret | `1234567890abcdef` |
| JWT_SECRET | JWT签名密钥 | `your-secret-key` |
| EDUKG_API_URL | EduKG API地址 | `https://api.edukg.cn/2021/repo` |

## 数据备份

```bash
# 导出数据
pnpm prisma db pull --schema=./prisma/schema.prisma

# 恢复数据
# 先恢复schema
pnpm prisma db push

# 再运行种子数据
pnpm prisma db seed
```
