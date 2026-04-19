# Webhook 部署指南 - hongzhi 服务器

## 📋 当前状态

### ✅ 已配置
- **Webhook 服务**: ✅ 运行中 (openmaic-webhook)
- **PM2**: ✅ 运行中
- **应用**: ✅ openmaic-web 运行在 http://172.31.195.59:3000
- **Git 仓库**: github.com:caojianatSZ/MAIC

### ⚠️ 最近部署问题
- **最后尝试**: 构建失败
- **错误**: `ENOENT: no such file or directory` (Next.js 构建错误)
- **原因**: 新模块的 TypeScript 类型错误或依赖问题

## 🔧 解决方案

### 步骤 1: 修复本地构建问题

首先确保本地代码可以成功构建：

```bash
# 1. 清理旧构建
rm -rf .next

# 2. 重新构建
pnpm build
```

### 步骤 2: 推送代码到 GitHub

```bash
# 1. 提交所有更改
git add .
git commit -m "feat: 添加高精度批改系统完整实现

- Layout Graph 基础设施
- Top-K 匹配增强
- LLM Rerank 模块
- 置信度融合
- Fallback 体系
- 端到端集成

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

# 2. 推送到远程仓库
git push origin main
```

### 步骤 3: Webhook 自动部署

推送后，hongzhi 服务器上的 webhook 会：
1. 接收 GitHub push 事件
2. 执行部署脚本 `/opt/openmaic/scripts/deploy.sh`
3. 拉取最新代码
4. 安装依赖
5. 构建生产版本
6. 重启服务

### 步骤 4: 监控部署状态

```bash
# SSH 登录服务器检查
ssh hongzhi

# 查看 webhook 日志
pm2 logs openmaic-webhook --lines 50

# 查看应用日志
pm2 logs openmaic-web --lines 50

# 检查服务状态
pm2 status
```

## 🔍 故障排查

### 如果构建失败

1. **检查日志**:
   ```bash
   ssh hongzhi
   tail -f /var/log/openmaic-error.log
   ```

2. **手动部署**:
   ```bash
   ssh hongzhi
   cd /opt/openmaic

   # 拉取最新代码
   git pull origin main

   # 安装依赖
   pnpm install

   # 构建调试
   pnpm build --debug

   # 如果成功，重新构建
   pnpm build
   ```

3. **回滚到上一个版本**:
   ```bash
   ssh hongzhi
   cd /opt/openmaic

   # 回滚
   git reset --hard HEAD~1

   # 重启服务
   pm2 restart openmaic-web
   ```

## 📝 部署脚本内容

服务器上的部署脚本位于：`/opt/openmaic/scripts/deploy.sh`

当前流程：
1. 拉取最新代码
2. 安装依赖
3. 数据库迁移
4. 清理构建缓存
5. 构建生产版本
6. 重启 PM2 服务

## ✅ 验证部署

部署成功后，访问以下地址验证：

1. **主页**: http://hongzhi:3000
2. **API 健康检查**: http://hongzhi:3000/api/health
3. **小程序测试**: 使用小程序拍照测试批改功能

---

**下一步**: 修复本地构建问题后，推送代码到 GitHub，webhook 将自动部署到 hongzhi 服务器。
