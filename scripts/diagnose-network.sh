#!/bin/bash
# OpenMAIC 网络诊断脚本

echo "🔍 OpenMAIC 网络连接诊断"
echo "=========================="

echo ""
echo "1. 检查本地服务状态..."
echo "📡 应用服务 (端口3000):"
if netstat -tuln | grep -q ":3000 "; then
    echo "   ✅ 正在监听"
else
    echo "   ❌ 未监听"
fi

echo "🌐 Nginx服务 (端口80):"
if netstat -tuln | grep -q ":80 "; then
    echo "   ✅ 正在监听"
else
    echo "   ❌ 未监听"
fi

echo ""
echo "2. 检查进程状态..."
echo "🔧 PM2进程:"
pm2 list | grep openmaic-web || echo "   ❌ 进程未运行"

echo "🔧 Nginx进程:"
if systemctl is-active --quiet nginx; then
    echo "   ✅ Nginx运行中"
else
    echo "   ❌ Nginx未运行"
fi

echo ""
echo "3. 本地连接测试..."
echo "🔗 测试localhost:3000..."
if curl -s -m 5 http://localhost:3000/api/health > /dev/null; then
    echo "   ✅ 本地应用正常"
else
    echo "   ❌ 本地应用无法访问"
fi

echo "🔗 测试localhost (Nginx):"
if curl -s -m 5 http://localhost/api/health > /dev/null; then
    echo "   ✅ 本地Nginx正常"
else
    echo "   ❌ 本地Nginx无法访问"
fi

echo ""
echo "4. 网络配置信息..."
echo "🌍 公网IP: $(curl -s ifconfig.me)"
echo "🏠 内网IP: $(ip addr show | grep 'inet ' | grep -v '127.0.0.1' | head -1 | awk '{print $2}')"

echo ""
echo "5. 防火墙状态..."
echo "🔒 iptables规则:"
sudo iptables -L INPUT -n -v | head -10

echo ""
echo "6. 最近的应用日志..."
echo "📋 PM2错误日志 (最近3行):"
pm2 logs openmaic-web --err --lines 3 --nostream 2>/dev/null || echo "   无日志"

echo ""
echo "=========================="
echo "🔧 诊断结果:"

if curl -s -m 5 http://localhost:3000/api/health > /dev/null; then
    echo "✅ 应用服务正常运行"
else
    echo "❌ 应用服务有问题"
fi

if systemctl is-active --quiet nginx; then
    echo "✅ Nginx服务正常运行"
else
    echo "❌ Nginx服务有问题"
fi

echo ""
echo "⚠️  如果公网无法访问，请检查："
echo "1. 阿里云安全组规则：确保允许TCP 80端口入站"
echo "2. ECS实例公网访问：确认实例已分配公网IP"
echo "3. 网络ACL：检查VPC网络ACL规则"
echo ""
echo "🔧 阿里云安全组配置指南："
echo "1. 登录阿里云控制台"
echo "2. 进入 ECS → 实例 → 找到本实例"
echo "3. 点击 安全组 → 配置规则"
echo "4. 添加入站规则："
echo "   - 授权策略：允许"
echo "   - 协议类型：自定义TCP"
echo "   - 端口范围：80/80"
echo "   - 授权对象：0.0.0.0/0"
echo "   - 优先级：1"
echo "   - 描述：OpenMAIC Web服务"
