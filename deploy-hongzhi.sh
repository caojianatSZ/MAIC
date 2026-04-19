#!/bin/bash
# deploy-hongzhi.sh - 部署到 hongzhi 服务器脚本

set -e

echo "========================================="
echo "OpenMAIC 部署到 hongzhi 服务器"
echo "========================================="

# 配置
SERVER_USER="root"  # 根据实际情况修改
SERVER_HOST="hongzhi"  # 或 IP 地址
SERVER_DIR="/var/www/openmaic"
GIT_REPO="your-repo-url"  # 你的 Git 仓库地址

echo "服务器信息："
echo "  主机: $SERVER_HOST"
echo "  目录: $SERVER_DIR"
echo ""
read -p "确认以上信息正确吗？(y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "部署已取消"
    exit 1
fi

# 1. 本地构建
echo ""
echo "========================================="
echo "步骤 1: 本地构建"
echo "========================================="

echo "清理旧的构建..."
rm -rf .next

echo "安装依赖..."
pnpm install

echo "生成 Prisma Client..."
pnpm prisma generate

echo "构建生产版本..."
pnpm build

echo "✅ 本地构建完成"

# 2. 打包
echo ""
echo "========================================="
echo "步骤 2: 打包部署文件"
echo "========================================="

DEPLOY_DIR="deploy-hongzhi"
rm -rf $DEPLOY_DIR
mkdir -p $DEPLOY_DIR

# 复制必要文件
cp -r .next $DEPLOY_DIR/
cp -r node_modules/.prisma $DEPLOY_DIR/
cp -r prisma $DEPLOY_DIR/
cp package.json pnpm-lock.yaml $DEPLOY_DIR/
cp -r public $DEPLOY_DIR/
cp -r lib $DEPLOY_DIR/
cp -r app $DEPLOY_DIR/

# 创建启动脚本
cat > $DEPLOY_DIR/start.sh << 'EOF'
#!/bin/bash
cd /var/www/openmaic
export NODE_ENV=production
export PORT=3000
export DATABASE_URL="postgresql://openmaic:your_password@localhost:5432/openmaic"
export GLM_API_KEY="$GLM_API_KEY"
export TEXTIN_APP_ID="$TEXTIN_APP_ID"
export TEXTIN_SECRET_CODE="$TEXTIN_SECRET_CODE"

echo "启动 OpenMAIC..."
npx next start -p 3000
EOF

chmod +x $DEPLOY_DIR/start.sh

echo "✅ 打包完成"

# 3. 上传到服务器
echo ""
echo "========================================="
echo "步骤 3: 上传到服务器"
echo "========================================="

echo "正在上传到 $SERVER_HOST..."
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.next' \
  --exclude='*.log' \
  ./ $SERVER_USER@$SERVER_HOST:$SERVER_DIR/

echo "✅ 上传完成"

# 4. 远程配置
echo ""
echo "========================================="
echo "步骤 4: 远程配置"
echo "========================================="

ssh $SERVER_USER@$SERVER_HOST << 'ENDSSH'
cd $SERVER_DIR

# 安装依赖（如果需要）
if [ ! -d "node_modules" ]; then
  echo "安装 pnpm..."
  npm install -g pnpm
  pnpm install --frozen-lockfile
fi

# 生成 Prisma Client
pnpm prisma generate

# 运行数据库迁移
pnpm prisma migrate deploy

# 重启服务
echo "重启服务..."
pm2 restart openmaic || pm2 start npm --name "openmaic" -- start

echo "✅ 远程配置完成"
ENDSSH

echo ""
echo "========================================="
echo "✅ 部署完成！"
echo "========================================="
echo ""
echo "访问地址："
echo "  http://$SERVER_HOST:3000"
echo ""
echo "查看日志："
echo "  ssh $SERVER_USER@$SERVER_HOST 'pm2 logs openmaic'"
echo ""
echo "管理命令："
echo "  ssh $SERVER_USER@$SERVER_HOST 'pm2 status'"
echo "  ssh $SERVER_USER@$SERVER_HOST 'pm2 restart openmaic'"
echo "  ssh $SERVER_USER@$SERVER_HOST 'pm2 stop openmaic'"
