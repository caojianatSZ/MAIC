#!/bin/bash
# OpenMAIC 日志配置部署脚本
# 用途：配置生产级别的日志系统

set -e

echo "🚀 开始配置OpenMAIC日志系统..."

# 1. 更新PM2配置
echo "📝 更新PM2配置..."
scp ecosystem.config.js hongzhi:/opt/openmaic/ecosystem.config.js

# 2. 更新环境变量
echo "📝 更新环境变量..."
scp .env.qa hongzhi:/opt/openmaic/.env.qa

# 3. 更新Nginx配置
echo "📝 更新Nginx配置..."
ssh hongzhi "sudo cp /etc/nginx/conf.d/openmaic.conf /etc/nginx/conf.d/openmaic.conf.backup"
ssh hongzhi "sudo tee /etc/nginx/conf.d/openmaic.conf > /dev/null << 'NGINX_CONFIG'
# OpenMAIC QA环境Nginx配置
server {
    listen 80;
    server_name _;

    # 日志配置 - 详细格式
    log_format openmaic_access '\$remote_addr - \$remote_user [\$time_local] '
                           '"\$request" \$status \$body_bytes_sent '
                           '"\$http_referer" "\$http_user_agent" '
                           '\$request_time \$upstream_response_time '
                           '\$http_x_forwarded_for';

    access_log /var/log/nginx/openmaic-access.log openmaic_access;
    error_log /var/log/nginx/openmaic-error.log warn;

    # 客户端最大请求体大小
    client_max_body_size 10M;

    # 代理到Next.js应用
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Request-ID \$request_id;
        proxy_cache_bypass \$http_upgrade;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 静态文件缓存（Next.js生成的静态文件）
    location /_next/static {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 7d;
        add_header Cache-Control \"public, max-age=31536000, immutable\";
    }

    # 健康检查端点
    location /api/health {
        proxy_pass http://localhost:3000;
        access_log off;
    }
}
NGINX_CONFIG"

# 4. 测试Nginx配置
echo "🔧 测试Nginx配置..."
ssh hongzhi "sudo nginx -t"

# 5. 重新加载Nginx
echo "🔄 重新加载Nginx..."
ssh hongzhi "sudo nginx -s reload"

# 6. 安装PM2日志轮转模块
echo "📦 安装PM2日志轮转模块..."
ssh hongzhi "pm2 install pm2-logrotate || echo 'pm2-logrotate already installed'"

# 7. 配置PM2日志轮转
echo "⚙️ 配置PM2日志轮转..."
ssh hongzhi "pm2 set pm2-logrotate:max_size 100M"
ssh hongzhi "pm2 set pm2-logrotate:retain 7"
ssh hongzhi "pm2 set pm2-logrotate:compress true"
ssh hongzhi "pm2 set pm2-logrotate:rotateInterval '0 0 * * *'"

# 8. 重启应用以应用新配置
echo "🔄 重启应用..."
ssh hongzhi "cd /opt/openmaic && pm2 restart openmaic-web"

# 9. 创建日志目录
echo "📁 创建日志分析目录..."
ssh hongzhi "mkdir -p /opt/openmaic/logs/archived"

# 10. 显示日志状态
echo "📊 日志配置状态："
ssh hongzhi "echo '=== PM2日志 ===' && pm2 logs openmaic-web --lines 5 --nostream"
ssh hongzhi "echo '=== Nginx配置 ===' && sudo nginx -T 2>/dev/null | grep -A 10 'openmaic_access'"

echo "✅ 日志配置完成！"
echo ""
echo "📖 日志查看命令："
echo "  PM2应用日志: pm2 logs openmaic-web"
echo "  Nginx访问日志: tail -f /var/log/nginx/openmaic-access.log"
echo "  Nginx错误日志: tail -f /var/log/nginx/openmaic-error.log"
echo ""
echo "🔍 日志分析："
echo "  查看最近的错误: ssh hongzhi 'grep ERROR /var/log/openmaic-out.log | tail -20'"
echo "  查看请求时间: ssh hongzhi \"awk '{print \\$NF}' /var/log/nginx/openmaic-access.log | sort -n | tail -10\""
