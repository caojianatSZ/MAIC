#!/bin/bash
# deploy.sh - 部署脚本

set -e

echo "========================================="
echo "OpenMAIC 高精度批改系统 - 部署脚本"
echo "========================================="

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查环境
echo -e "${YELLOW}检查环境...${NC}"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: 未安装 Node.js${NC}"
    echo "请访问 https://nodejs.org/ 下载安装"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js 版本: $NODE_VERSION${NC}"

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}未安装 pnpm，正在安装...${NC}"
    npm install -g pnpm
fi

echo -e "${GREEN}✓ pnpm 版本: $(pnpm -v)${NC}"

# 检查 PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}警告: 未检测到 PostgreSQL${NC}"
    echo "如果使用远程数据库，请确保 DATABASE_URL 已配置"
fi

# 安装依赖
echo ""
echo -e "${YELLOW}安装依赖...${NC}"
pnpm install --frozen-lockfile

# 类型检查
echo ""
echo -e "${YELLOW}运行类型检查...${NC}"
pnpm tsc --noEmit

if [ $? -ne 0 ]; then
    echo -e "${RED}类型检查失败，请修复错误后重试${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 类型检查通过${NC}"

# 生成 Prisma Client
echo ""
echo -e "${YELLOW}生成 Prisma Client...${NC}"
pnpm prisma generate

# 运行数据库迁移（可选）
echo ""
echo -e "${YELLOW}是否运行数据库迁移？(y/N)${NC}"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    pnpm prisma migrate deploy
    echo -e "${GREEN}✓ 数据库迁移完成${NC}"
fi

# 构建生产版本
echo ""
echo -e "${YELLOW}构建生产版本...${NC}"
pnpm build

echo -e "${GREEN}✓ 构建完成${NC}"

# 启动生产服务器
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}部署完成！${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "启动命令："
echo "  开发模式: pnpm dev"
echo "  生产模式: pnpm start"
echo "  PM2:     pm2 start npm --name 'openmaic' -- start"
echo ""
echo "API 端点："
echo "  V3 批改: POST /api/diagnosis/photo-v3"
echo ""
echo -e "${YELLOW}环境变量检查：${NC}"
if [ -f .env.local ]; then
    echo -e "${GREEN}✓ .env.local 存在${NC}"
else
    echo -e "${RED}✗ .env.local 不存在${NC}"
    echo "请创建 .env.local 并配置必要的环境变量："
    echo "  - DATABASE_URL"
    echo "  - GLM_API_KEY"
    echo "  - OPENAI_API_KEY (可选)"
    echo "  - ANTHROPIC_API_KEY (可选)"
fi

echo ""
echo -e "${GREEN}准备就绪！${NC}"
