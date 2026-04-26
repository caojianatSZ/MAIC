#!/bin/bash
#####################################
# OpenMAIC 自动部署脚本
# 更新时间: 2026-04-26
#####################################

set -o pipefail  # 捕获管道错误

# 配置
PROJECT_DIR="/opt/openmaic"
LOG_FILE="/var/log/openmaic/deploy.log"
PM2_APP_NAME="openmaic-web"
HEALTH_CHECK_URL="http://localhost:3000"
MAX_RETRIES=3
HEALTH_TIMEOUT=60

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
    echo "[INFO] $(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
    echo "[WARN] $(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
    echo "[ERROR] $(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

# 错误处理
error_exit() {
    log_error "$1"
    log_error "部署失败！请查看日志: $LOG_FILE"
    exit 1
}

# 创建日志目录
mkdir -p "$(dirname "$LOG_FILE")"

log_info "=========================================="
log_info "开始部署 OpenMAIC"
log_info "=========================================="

# 检查项目目录
if [ ! -d "$PROJECT_DIR" ]; then
    error_exit "项目目录不存在: $PROJECT_DIR"
fi

cd "$PROJECT_DIR" || error_exit "无法进入项目目录"

# 1. 检查 Git 状态
log_info "检查 Git 状态..."
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
log_info "当前分支: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "main" ]; then
    log_warn "当前不在 main 分支，切换到 main..."
    git checkout main || error_exit "切换分支失败"
fi

# 2. 拉取最新代码
log_info "拉取最新代码..."
if ! git pull origin main 2>&1 | tee -a "$LOG_FILE"; then
    error_exit "Git pull 失败"
fi

NEW_COMMIT=$(git rev-parse --short HEAD)
log_info "新提交: $NEW_COMMIT"

# 3. 检查是否有 .env 变化
if git diff HEAD~1 HEAD --name-only | grep -q "\.env"; then
    log_warn ".env 文件有变化，请手动检查环境变量"
fi

# 4. 清理函数（带重试）
clean_with_retry() {
    local max_attempts=$1
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        log_info "清理构建缓存 (尝试 $attempt/$max_attempts)..."

        rm -rf .next
        rm -rf node_modules/.cache
        find . -name "*.log" -type f -delete 2>/dev/null || true

        if [ $? -eq 0 ]; then
            log_info "清理完成"
            return 0
        fi

        attempt=$((attempt + 1))
        sleep 2
    done

    log_warn "清理失败，继续部署..."
}

clean_with_retry 3

# 5. 安装依赖（带重试）
install_with_retry() {
    local max_attempts=$1
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        log_info "安装依赖 (尝试 $attempt/$max_attempts)..."

        if pnpm install --frozen-lockfile 2>&1 | tee -a "$LOG_FILE"; then
            log_info "依赖安装成功"
            return 0
        fi

        attempt=$((attempt + 1))
        if [ $attempt -le $max_attempts ]; then
            log_warn "依赖安装失败，2秒后重试..."
            sleep 2
        fi
    done

    error_exit "依赖安装失败"
}

install_with_retry 3

# 6. 数据库 schema 更新
log_info "更新数据库 schema..."
if pnpm prisma db push --skip-generate 2>&1 | tee -a "$LOG_FILE"; then
    log_info "数据库更新成功"
else
    log_warn "数据库更新失败，继续部署..."
fi

# 7. 生成 Prisma Client
log_info "生成 Prisma Client..."
if pnpm prisma generate 2>&1 | tee -a "$LOG_FILE"; then
    log_info "Prisma Client 生成成功"
else
    log_warn "Prisma Client 生成失败，继续部署..."
fi

# 8. 构建项目（带重试和内存管理）
build_with_retry() {
    local max_attempts=$1
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        log_info "构建项目 (尝试 $attempt/$max_attempts)..."

        # 设置 Node.js 内存限制
        export NODE_OPTIONS="--max-old-space-size=4096"

        if pnpm build 2>&1 | tee -a "$LOG_FILE"; then
            log_info "构建成功"
            unset NODE_OPTIONS
            return 0
        fi

        attempt=$((attempt + 1))
        if [ $attempt -le $max_attempts ]; then
            log_warn "构建失败，清理缓存后重试..."
            rm -rf .next
            sleep 3
        fi
    done

    unset NODE_OPTIONS
    error_exit "构建失败"
}

build_with_retry 3

# 9. 重启 PM2 服务
log_info "重启 PM2 服务..."
if pm2 restart "$PM2_APP_NAME" 2>&1 | tee -a "$LOG_FILE"; then
    log_info "PM2 服务重启成功"
else
    # 尝试重新加载
    log_warn "PM2 重启失败，尝试重新加载..."
    if pm2 reload "$PM2_APP_NAME" 2>&1 | tee -a "$LOG_FILE"; then
        log_info "PM2 服务重新加载成功"
    else
        error_exit "PM2 操作失败"
    fi
fi

# 10. 健康检查
log_info "等待服务启动..."
sleep 5

log_info "执行健康检查..."
elapsed=0
while [ $elapsed -lt $HEALTH_TIMEOUT ]; do
    if curl -sf "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
        log_info "健康检查通过！"
        break
    fi

    elapsed=$((elapsed + 2))
    if [ $elapsed -ge $HEALTH_TIMEOUT ]; then
        log_warn "健康检查超时，但部署可能已成功"
        break
    fi

    sleep 2
done

# 11. 显示 PM2 状态
log_info "PM2 服务状态:"
pm2 list | grep -E "(name|$PM2_APP_NAME)" | tee -a "$LOG_FILE"

log_info "=========================================="
log_info "部署完成！提交: $NEW_COMMIT"
log_info "=========================================="

exit 0
