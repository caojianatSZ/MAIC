#!/bin/bash
# 微信小程序部署配置检查清单

echo "🔍 OpenMAIC 微信小程序部署检查清单"
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查函数
check_item() {
  local status=$1
  local message=$2

  if [ "$status" = "✅" ]; then
    echo -e "${GREEN}✅${NC} $message"
  elif [ "$status" = "❌" ]; then
    echo -e "${RED}❌${NC} $message"
  else
    echo -e "${YELLOW}⚠️${NC}  $message"
  fi
}

echo ""
echo "📱 第一阶段：域名和SSL证书"
echo "----------------------------"

check_item "⚠️"  "1.1 域名购买"
echo "     状态: 未购买"
echo "     建议: 访问 https://wanwang.aliyun.com/ 购买域名"
echo ""

check_item "❌"  "1.2 域名备案"
echo "     状态: 未备案"
echo "     建议: 如使用.cn域名，需完成ICP备案"
echo ""

check_item "❌"  "1.3 SSL证书"
echo "     状态: 未配置"
echo "     建议: 申请Let's Encrypt免费证书或阿里云免费证书"
echo ""

echo "📱 第二阶段：微信小程序后台配置"
echo "------------------------------------"

check_item "⚠️"  "2.1 服务器域名配置"
echo "     状态: 需要配置"
echo "     路径: 微信小程序后台 → 开发 → 开发设置 → 服务器域名"
echo "     需要: request合法域名、uploadFile合法域名、downloadFile合法域名"
echo ""

check_item "⚠️"  "2.2 业务域名配置"
echo "     状态: 需要配置"
echo "     路径: 设置 → 基本设置 → 功能设置"
echo ""

echo "📱 第三阶段：服务器配置"
echo "----------------------------"

# 检查当前HTTPS配置
echo "3.1 HTTPS证书检查:"
if ssh hongzhi "test -f /etc/letsencrypt/live/openmaic.com/fullchain.pem" 2>/dev/null; then
  check_item "✅"  "SSL证书已安装"
else
  check_item "❌"  "SSL证书未安装"
  echo "     安装命令: sudo certbot --nginx -d yourdomain.com"
fi
echo ""

# 检查Nginx配置
echo "3.2 Nginx HTTPS配置:"
if ssh hongzhi "grep -q 'listen 443 ssl' /etc/nginx/conf.d/openmaic.conf" 2>/dev/null; then
  check_item "✅"  "HTTPS已配置"
else
  check_item "❌"  "HTTPS未配置"
  echo "     需要: 配置Nginx SSL监听443端口"
fi
echo ""

# 检查CORS配置
echo "3.3 CORS跨域配置:"
if ssh hongzhi "grep -q 'Access-Control-Allow-Origin' /etc/nginx/conf.d/openmaic.conf" 2>/dev/null; then
  check_item "✅"  "CORS已配置"
else
  check_item "⚠️"  "CORS建议在应用层配置"
fi
echo ""

echo "📱 第四阶段：小程序代码配置"
echo "----------------------------"

check_item "⚠️"  "4.1 环境配置文件"
echo "     状态: 已创建"
echo "     文件: miniprogram/config/env.js"
echo "     需要: 修改生产环境baseUrl"
echo ""

# 检查当前配置
echo "当前API地址配置:"
grep -A 5 "production:" /Users/caojian/Projects/OpenMAIC/miniprogram/config/env.js | grep "baseUrl"
echo ""

check_item "⚠️"  "4.2 域名检查"
echo "     当前: 使用http://localhost:3000"
echo "     需要: 修改为https://api.yourdomain.com"
echo ""

echo "📱 第五阶段：测试和发布"
echo "----------------------------"

check_item "⚠️"  "5.1 真机测试"
echo "     状态: 待测试"
echo "     方法: 开发者工具 → 预览 → 扫码真机测试"
echo ""

check_item "⚠️"  "5.2 体验版测试"
echo "     状态: 待上传"
echo "     方法: 开发者工具 → 上传 → 选为体验版"
echo ""

check_item "⚠️"  "5.3 提交审核"
echo "     状态: 待提交"
echo "     需要: 小程序名称、图标、截图、服务类目等"
echo ""

echo "=========================================="
echo "🎯 立即行动清单:"
echo ""
echo "1. 【必须】购买域名并配置DNS"
echo "2. 【必须】申请SSL证书"
echo "3. 【必须】配置微信小程序服务器域名"
echo "4. 【重要】修改小程序代码中的API地址"
echo "5. 【建议】完成真机测试"
echo "6. 【建议】准备审核材料并提交"
echo ""

echo "📖 详细指南:"
echo "docs/WECHAT_MINIPROGRAM_DEPLOYMENT.md"
echo ""

echo "🔧 配置命令:"
echo "修改环境配置: 编辑 miniprogram/config/env.js"
echo "上传代码: 微信开发者工具 → 上传"
echo "真机测试: 微信开发者工具 → 预览"
echo ""

echo "⚠️  注意事项:"
echo "1. 微信小程序强制要求HTTPS协议"
echo "2. 域名必须备案（中国大陆）"
echo "3. 服务器域名每月只能修改5次"
echo "4. 域名不能包含端口号"
echo "5. 审核周期1-7天，请提前准备"
