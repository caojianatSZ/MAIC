#!/bin/bash
# deploy-to-hongzhi.sh - 部署到 hongzhi 服务器的脚本（在服务器上执行）

set -e

echo "========================================="
echo "开始部署 OpenMAIC 到 hongzhi"
echo "========================================="

# 配置
REPO_URL="git@github.com:your-username/OpenMAIC.git"  # 修改为你的仓库地址
DEPLOY_DIR="/var/www/openmaic"
BACKUP_DIR="/var/www/openmaic-backup"
GIT_WORK_DIR="/tmp/openmaic-git"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR $(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN $(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

# 记录开始时间
START_TIME=$(date +%s)
log "部署开始"

# 1. 备份当前版本
log "步骤 1: 备份当前版本"
if [ -d "$DEPLOY_DIR" ]; then
    mkdir -p "$BACKUP_DIR"
    BACKUP_NAME="openmaic-$(date +%Y%m%d-%H%M%S)"
    cp -r "$DEPLOY_DIR" "$BACKUP_DIR/$BACKUP_NAME"
    log "备份完成: $BACKUP_NAME"
else
    log "没有现有版本需要备份"
fi

# 2. 拉取最新代码
log "步骤 2: 拉取最新代码"
mkdir -p "$GIT_WORK_DIR"
cd "$GIT_WORK_DIR"

if [ -d ".git" ]; then
    log "仓库已存在，拉取更新"
    git fetch origin main
    git reset --hard origin/main
else
    log "克隆仓库"
    git clone "$REPO_URL" "$GIT_WORK_DIR"
fi

log "当前版本: $(git log -1 --format='%h - %s')"

# 3. 安装依赖
log "步骤 3: 安装依赖"
cd "$GIT_WORK_DIR"

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    log "安装 pnpm"
    npm install -g pnpm
fi

# 清理旧构建
rm -rf .next

# 安装依赖
log "安装项目依赖..."
pnpm install --frozen-lockfile

# 4. 生成 Prisma Client
log "步骤 4: 生成 Prisma Client"
pnpm prisma generate

# 5. 数据库迁移
log "步骤 5: 运行数据库迁移"
pnpm prisma migrate deploy

# 6. 构建生产版本
log "步骤 6: 构建生产版本"
pnpm build

# 7. 部署到生产目录
log "步骤 7: 部署到生产目录"
mkdir -p "$DEPLOY_DIR"

# 复制构建文件
cp -r .next "$DEPLOY_DIR/"
cp -r public "$DEPLOY_DIR/"
cp -r prisma "$DEPLOY_DIR/"
cp package.json pnpm-lock.yaml "$DEPLOY_DIR/"

# 复制必要的依赖（精简）
mkdir -p "$DEPLOY_DIR/node_modules"
cp -r node_modules/.prisma "$DEPLOY_DIR/node_modules/"
cp -r node_modules/@prisma "$DEPLOY_DIR/node_modules/"

# 复制 lib 和 app 目录
cp -r lib "$DEPLOY_DIR/"
cp -r app "$DEPLOY_DIR/"

# 8. 设置环境变量
log "步骤 8: 配置环境变量"
cat > "$DEPLOY_DIR/.env" << 'EOF'
# 生产环境变量
NODE_ENV=production
PORT=3000

# 数据库
DATABASE_URL="postgresql://openmaic:OpenMAIC2024@localhost:5432/openmaic"

# API Keys
GLM_API_KEY="$GLM_API_KEY"
TEXTIN_APP_ID="$TEXTIN_APP_ID"
TEXTIN_SECRET_CODE="$TEXTIN_SECRET_CODE"

# 可选：其他 LLM Provider
# OPENAI_API_KEY="$OPENAI_API_KEY"
# ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"
EOF

# 9. 重启服务
log "步骤 9: 重启服务"

# 检查是否安装了 PM2
if ! command -v pm2 &> /dev/null; then
    log "安装 PM2"
    npm install -g pm2
fi

# 停止旧服务
if pm2 list | grep -q "openmaic"; then
    log "停止旧服务"
    pm2 stop openmaic
    sleep 2
fi

# 启动新服务
log "启动新服务"
cd "$DEPLOY_DIR"
pm2 start npm --name "openmaic" -- start

# 保存 PM2 配置
pm2 save

# 10. 清理临时文件
log "步骤 10: 清理临时文件"
rm -rf "$GIT_WORK_DIR"

# 计算耗时
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

log "✅ 部署完成！"
echo ""
echo "========================================="
echo -e "${GREEN}部署成功！${NC}"
echo "========================================="
echo ""
echo "访问地址："
echo "  http://hongzhi:3000"
echo ""
echo "管理命令："
echo "  查看日志: pm2 logs openmaic"
echo "  查看状态: pm2 status"
echo "  重启服务: pm2 restart openmaic"
echo "  停止服务: pm2 stop openmaic"
echo ""
echo "回滚到上一版本（如果需要）："
echo "  cd $BACKUP_DIR"
echo "  ls -lt  # 查看备份"
echo "  cp -r ../openmaic-backup/备份名/* $DEPLOY_DIR/"
echo "  pm2 restart openmaic"
echo ""
echo "部署耗时: ${DURATION}秒"
echo "========================================="

# 11. 健康检查
log "步骤 11: 健康检查"
sleep 3

if curl -f http://localhost:3000/api/health &> /dev/null; then
    log "✅ 服务健康检查通过"
else
    warn "⚠️  服务健康检查失败，请手动检查"
fi

log "部署流程全部完成！"
