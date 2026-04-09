# 微信小程序部署完整指南

## 📋 当前配置状态

### ✅ 已完成的配置
- [x] 小程序AppID: `wx8e6c28b48fb11fc6`
- [x] 小程序基础代码完成
- [x] 后端API接口开发完成
- [x] 服务器环境部署完成
- [x] 开发模式配置 (urlCheck: false)

### ❌ 缺失的关键配置

#### 1. **域名和SSL证书** 🔴 **必需**
微信小程序强制要求：
- ✅ 必须使用HTTPS协议
- ✅ 域名必须备案（中国大陆）
- ✅ SSL证书必须有效

**当前状态**: 无域名，使用IP地址

#### 2. **服务器域名白名单配置** 🔴 **必需**
在微信小程序后台配置合法域名

**当前状态**: 未配置

#### 3. **生产环境API地址配置** 🟡 **重要**
修改小程序代码中的API地址

**当前状态**: 使用localhost:3000

---

## 🚀 完整部署步骤

### 第一阶段：域名和证书配置（1-2天）

#### 1.1 购买域名
```bash
推荐域名注册商：
- 阿里云：https://wanwang.aliyun.com/
- 腾讯云：https://dnspod.cloud.tencent.com/
- Cloudflare：https://www.cloudflare.com/

建议域名：
- openmaic.com
- maic.ai
- homework-tutor.cn
```

#### 1.2 域名备案（如使用.cn域名）
```bash
备案流程：
1. 登录阿里云备案系统
2. 提交备案信息
3. 阿里云初审（1-2天）
4. 管局审核（7-20天）

提示：使用.com/.net等域名可免备案
```

#### 1.3 配置DNS解析
```bash
在域名DNS管理中添加A记录：
- 记录类型：A
- 主机记录：@ 或 www
- 记录值：120.79.15.99
- TTL：600
```

#### 1.4 申请SSL证书

**方案A：使用Let's Encrypt免费证书（推荐）**
```bash
# 在服务器上执行
ssh hongzhi

# 安装certbot
sudo yum install -y certbot python3-certbot-nginx

# 申请证书
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 自动续期
sudo certbot renew --dry-run
```

**方案B：使用阿里云免费证书**
```bash
1. 登录阿里云控制台
2. 数字证书管理服务 → SSL证书
3. 申请免费证书（DV单域名证书）
4. 下载Nginx格式证书
5. 上传到服务器
```

#### 1.5 配置Nginx SSL

```nginx
# /etc/nginx/conf.d/openmaic-ssl.conf
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL证书配置
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL优化配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 其他配置...
    location / {
        proxy_pass http://localhost:3000;
        # 其他proxy配置...
    }
}
```

---

### 第二阶段：微信小程序后台配置（30分钟）

#### 2.1 登录微信小程序后台
```
网址：https://mp.weixin.qq.com/
使用管理员账号扫码登录
```

#### 2.2 配置服务器域名

**路径**: 开发 → 开发管理 → 开发设置 → 服务器域名

**需要配置的域名**:
```
request合法域名：
https://api.yourdomain.com
https://yourdomain.com

uploadFile合法域名：
https://api.yourdomain.com

downloadFile合法域名：
https://yourdomain.com

socket合法域名：
wss://api.yourdomain.com
```

**注意事项**：
- 域名必须为HTTPS
- 域名必须经过ICP备案
- 每月只能修改5次
- 域名不需要带端口号

#### 2.3 配置业务域名

**路径**: 设置 → 基本设置 → 基本信息 → 功能设置

```
业务域名：
https://yourdomain.com
https://www.yourdomain.com
```

#### 2.4 配置隐私设置

**路径**: 设置 → 基本设置 → 隐私设置

根据小程序功能配置用户隐私保护指引

---

### 第三阶段：小程序代码修改（1小时）

#### 3.1 创建环境配置文件

```javascript
// miniprogram/config/env.js
const ENV = {
  development: {
    baseUrl: 'http://localhost:3000', // 开发环境
    enableDebug: true
  },
  production: {
    baseUrl: 'https://api.yourdomain.com', // 生产环境
    enableDebug: false
  }
}

// 根据编译模式自动切换
function getConfig() {
  const isDev = wx.getAccountInfoSync().miniProgram.envVersion === 'develop'
  return isDev ? ENV.development : ENV.production
}

module.exports = {
  ENV: getConfig()
}
```

#### 3.2 修改app.js配置

```javascript
// miniprogram/app.js
const { ENV } = require('./config/env.js')

App({
  globalData: {
    userInfo: null,
    token: null,
    userId: 'demo_user_id', // 开发测试用户ID
    baseUrl: ENV.baseUrl   // 使用环境配置
    enableDebug: ENV.enableDebug
  }
})
```

#### 3.3 更新project.config.json

```json
{
  "setting": {
    "urlCheck": true  // 生产环境必须开启域名检查
  }
}
```

---

### 第四阶段：服务器配置优化（30分钟）

#### 4.1 配置CORS

```typescript
// lib/api/cors.ts
export function setCorsHeaders(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', 'https://yourdomain.com')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
}

// 在API路由中使用
import { setCorsHeaders } from '@/lib/api/cors'

export async function OPTIONS(req: NextRequest) {
  const response = new NextResponse(null, { status: 200 })
  setCorsHeaders(response)
  return response
}
```

#### 4.2 配置安全头部

```nginx
# Nginx安全头部配置
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval'" always;
```

---

### 第五阶段：测试和发布（1-2天）

#### 5.1 开发工具测试

1. **真机调试**
```bash
1. 微信开发者工具 → 预览 → 生成二维码
2. 使用微信扫码在真机上测试
3. 检查所有API调用是否正常
```

2. **体验版测试**
```bash
1. 微信开发者工具 → 上传
2. 登录小程序管理后台
3. 版本管理 → 开发版本 → 选为体验版
4. 分享体验版二维码给测试用户
```

#### 5.2 提交审核

**准备材料**:
- 小程序名称 (唯一，不能包含"最佳"、"第一"等词汇)
- 小程序简介 (120字以内)
- 小程序图标 (108x108px，不超过2MB)
- 小程序截图 (至少4张，尺寸：375x667px)
- 服务类目 (选择：教育 → 在线教育)
- 资质证件 (如需要)

**审核时间**: 1-7天

#### 5.3 发布上线

审核通过后点击"发布"按钮

---

## ⚠️ 常见问题排查

### 1. 域名不合法
```
问题：request:fail url not in domain list
解决：在微信小程序后台添加域名到request合法域名
```

### 2. SSL证书问题
```
问题：request:fail (anonymous):in the certificateis invalid
解决：检查SSL证书是否有效，确保使用完整证书链
```

### 3. 端口问题
```
问题：配置域名时不能带端口号
解决：使用Nginx反向代理到标准端口(443)
```

### 4. 备案问题
```
问题：域名未备案
解决：使用.com等海外域名或完成ICP备案
```

---

## 📊 成本预估

### 必需成本
- **域名**: ¥50-100/年
- **服务器**: 阿里云ECS (已有)
- **SSL证书**: 免费(Let's Encrypt)或¥500/年(商业证书)

### 可选成本
- **CDN加速**: ¥50-200/月
- **短信服务**: ¥0.045/条
- **云存储**: ¥0.1/GB/月

---

## 🎯 快速开始检查清单

### 立即可做
- [ ] 检查当前服务器配置
- [ ] 确认小程序AppID和密钥
- [ ] 测试本地API接口

### 本周完成
- [ ] 购买域名
- [ ] 配置DNS解析
- [ ] 申请SSL证书
- [ ] 配置Nginx HTTPS

### 下周完成
- [ ] 微信小程序后台配置域名
- [ ] 修改小程序代码API地址
- [ ] 真机测试
- [ ] 提交审核

---

## 📞 技术支持

如有问题，可参考：
- [微信小程序开发文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [微信开放社区](https://developers.weixin.qq.com/community/)
- [阿里云SSL证书部署](https://help.aliyun.com/document_detail/98728.html)

---

**生成时间**: 2026-04-09
**版本**: 1.0
**适用项目**: OpenMAIC 作业辅导助手
