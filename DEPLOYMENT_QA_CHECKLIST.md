# OpenMAIC QA环境部署完成清单

## 部署状态
- 服务器: 阿里云 ECS (CentOS 8, 4核15G)
- 部署路径: /opt/openmaic
- 状态: ✅ 部署完成
- 访问地址: http://120.79.15.99

## 已完成的配置

### ✅ 1. 环境配置
- Node.js 22.22.2 已安装
- pnpm 10.28.0 已安装
- PM2 6.0.14 已安装并配置开机自启动
- PostgreSQL 16 已通过Docker部署并运行

### ✅ 2. 应用部署
- Next.js应用已成功构建并部署
- PM2进程管理已配置，应用运行正常
- Nginx反向代理已配置并正常工作

### ✅ 3. 环境变量
- .env.qa已配置，包含GLM API密钥
- 数据库连接已配置：postgresql://openmaic:openmaic_password@postgres:5432/openmaic

### ✅ 4. 服务验证
- 应用健康检查: http://120.79.15.99/api/health ✅
- Next.js应用: http://120.79.15.99 ✅
- PostgreSQL: localhost:5432 ✅

## 服务信息
- **应用地址**: http://服务器IP:3000 (直接访问)
- **Nginx代理**: http://服务器IP (通过Nginx)
- **PostgreSQL**: localhost:5432
- **数据库用户**: openmaic
- **数据库密码**: openmaic_password
- **数据库名称**: openmaic

## 常用命令

### 查看日志
```bash
# PM2应用日志
pm2 logs openmaic-web

# PM2应用日志（实时）
pm2 logs openmaic-web --lines 100

# PostgreSQL日志
docker logs -f openmaic-postgres

# Nginx日志
tail -f /var/log/nginx/openmaic-access.log
tail -f /var/log/nginx/openmaic-error.log
```

### 重启服务
```bash
# 重启Next.js应用
pm2 restart openmaic-web

# 重启PostgreSQL
docker restart openmaic-postgres

# 重启Nginx
sudo nginx -s reload
```

### 停止服务
```bash
# 停止Next.js应用
pm2 stop openmaic-web

# 停止PostgreSQL
docker stop openmaic-postgres
```

### 更新代码
```bash
cd /opt/openmaic
git pull origin main
pnpm install
pnpm build
pm2 restart openmaic-web
```

## 数据库管理

### 连接数据库
```bash
docker exec -it openmaic-postgres psql -U openmaic -d openmaic
```

### 数据库备份
```bash
# 创建备份目录
mkdir -p /opt/openmaic/backups

# 备份数据库
docker exec openmaic-postgres pg_dump -U openmaic openmaic > /opt/openmaic/backups/backup_$(date +%Y%m%d).sql
```

### 数据库恢复
```bash
docker exec -i openmaic-postgres psql -U openmaic openmaic < /opt/openmaic/backups/backup_20260409.sql
```

### 数据库迁移
```bash
cd /opt/openmaic
pnpm prisma migrate dev
```

## 监控和维护

### PM2进程管理
```bash
# 查看进程状态
pm2 list

# 查看进程详细信息
pm2 show openmaic-web

# 查看进程监控
pm2 monit

# 重启进程
pm2 restart openmaic-web

# 重载进程（零停机）
pm2 reload openmaic-web

# 清除日志
pm2 flush
```

### 系统资源监控
```bash
# 系统资源
htop

# Docker资源
docker stats

# 磁盘使用
df -h

# 内存使用
free -h
```

### 清理Docker资源
```bash
# 清理未使用的镜像
docker image prune -a

# 清理未使用的容器
docker container prune

# 清理未使用的卷
docker volume prune
```

## 待完成配置

### SSL证书配置 (需要域名)
当获得域名后，需要配置SSL证书：

1. 安装certbot:
```bash
sudo yum install -y certbot python3-certbot-nginx
```

2. 申请证书:
```bash
sudo certbot --nginx -d your-domain.com
```

3. 自动续期:
```bash
sudo certbot renew --dry-run
```

### PostgreSQL自动备份
创建定时任务:
```bash
crontab -e
```

添加以下内容(每天凌晨2点备份):
```
0 2 * * * cd /opt/openmaic && docker exec openmaic-postgres pg_dump -U openmaic openmaic > backups/backup_$(date +\%Y\%m\%d).sql
```

## 故障排查

### 应用无法启动
1. 检查PM2日志: `pm2 logs openmaic-web --lines 100`
2. 检查环境变量: `cat .env.qa`
3. 检查端口占用: `netstat -tuln | grep 3000`
4. 检查PM2进程: `pm2 list`
5. 手动启动测试: `cd /opt/openmaic && pnpm start`

### 数据库连接失败
1. 检查数据库状态: `docker ps | grep postgres`
2. 检查数据库日志: `docker logs openmaic-postgres`
3. 验证连接: `docker exec openmaic-postgres pg_isready -U openmaic`
4. 测试连接: `docker exec -it openmaic-postgres psql -U openmaic -d openmaic`

### Nginx问题
1. 检查配置: `sudo nginx -t`
2. 重载配置: `sudo nginx -s reload`
3. 查看错误日志: `tail -f /var/log/nginx/openmaic-error.log`
4. 查看访问日志: `tail -f /var/log/nginx/openmaic-access.log`

### 性能问题
1. 检查PM2进程资源: `pm2 monit`
2. 检查系统资源: `htop`
3. 检查数据库性能: `docker stats openmaic-postgres`

## 联系信息
- 部署人员: Claude AI Assistant
- 部署日期: 2026-04-09
- 最后更新: 2026-04-09
- 文档版本: 2.0

## 部署总结

### 技术栈
- **应用服务器**: Node.js 22.22.2 + Next.js 16.1.2
- **进程管理**: PM2 6.0.14
- **数据库**: PostgreSQL 16 (Docker容器)
- **反向代理**: Nginx
- **包管理**: pnpm 10.28.0

### 部署架构
```
Internet → Nginx (80) → Node.js (3000) → Next.js应用
                              ↓
                         PostgreSQL (5432)
```

### 访问地址
- **应用主页**: http://120.79.15.99
- **健康检查**: http://120.79.15.99/api/health
- **数据库**: localhost:5432 (仅服务器内部访问)

### 下一步优化建议
1. 配置域名和SSL证书
2. 设置PostgreSQL自动备份
3. 配置应用监控和告警
4. 优化数据库查询性能
5. 配置CDN加速静态资源
