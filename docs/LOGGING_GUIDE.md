# OpenMAIC 日志配置指南

## 📋 日志系统概览

OpenMAIC现在具备完整的四级日志系统：

```
应用层 (lib/logger.ts) → PM2层 (pm2 logs) → Nginx层 (访问日志) → 数据库层 (PostgreSQL日志)
```

## 🔧 日志配置详情

### 1. 应用层日志

**日志级别：**
- `debug` - 详细调试信息（开发环境）
- `info` - 一般信息（生产环境推荐）
- `warn` - 警告信息
- `error` - 错误信息

**日志格式：**
- JSON格式：`{"timestamp":"...","level":"INFO","tag":"API","message":"..."}`
- 文本格式：`[2026-04-09T08:00:00.000Z] [INFO] [API] 请求处理完成`

**使用示例：**
```typescript
import { createLogger } from '@/lib/logger';

const logger = createLogger('MyAPI');

logger.debug('调试信息', { userId: '123', action: 'login' });
logger.info('一般信息', '用户登录成功');
logger.warn('警告信息', '响应时间过长', { duration: '5000ms' });
logger.error('错误信息', new Error('数据库连接失败'));
```

### 2. PM2进程日志

**日志位置：**
- `/var/log/openmaic-out.log` - 标准输出日志
- `/var/log/openmaic-error.log` - 错误日志
- `/var/log/openmaic-combined.log` - 合并日志

**日志轮转：**
- 单文件最大：100MB
- 保留文件数：7个
- 压缩旧日志：是
- 轮转时间：每天0点

**查看命令：**
```bash
# 实时查看日志
pm2 logs openmaic-web

# 查看最近100行
pm2 logs openmaic-web --lines 100

# 查看错误日志
pm2 logs openmaic-web --err

# 清空日志
pm2 flush
```

### 3. Nginx日志

**日志位置：**
- `/var/log/nginx/openmaic-access.log` - 访问日志
- `/var/log/nginx/openmaic-error.log` - 错误日志

**日志格式包含：**
- 客户端IP
- 请求时间
- 请求方法和路径
- HTTP状态码
- 响应大小
- 请求时间（总时间 + 上游时间）
- User-Agent
- 转发IP

**查看命令：**
```bash
# 实时查看访问日志
tail -f /var/log/nginx/openmaic-access.log

# 查看错误日志
tail -f /var/log/nginx/openmaic-error.log

# 查找特定状态的请求
grep " 500 " /var/log/nginx/openmaic-access.log

# 查找慢请求（响应时间>1秒）
awk '$NF > 1.0' /var/log/nginx/openmaic-access.log
```

### 4. PostgreSQL日志

**日志位置：**
```bash
docker logs openmaic-postgres
docker logs -f openmaic-postgres  # 实时查看
```

**日志内容：**
- 数据库启动信息
- 连接信息
- 检查点信息
- 错误信息

## 🚀 快速部署

### 部署改进的日志配置

```bash
# 1. 在本地执行部署脚本
chmod +x scripts/setup-logging.sh
./scripts/setup-logging.sh

# 2. 手动部署（如果脚本失败）
ssh hongzhi
cd /opt/openmaic
git pull origin main
pnpm install
pnpm build
pm2 restart openmaic-web
```

## 📊 日志分析技巧

### 1. 查找错误

```bash
# 查找应用层错误
grep "ERROR" /var/log/openmaic-out.log | tail -20

# 查找HTTP 500错误
grep " 500 " /var/log/nginx/openmaic-access.log

# 查找特定时间段的错误
grep "2026-04-09 08:" /var/log/openmaic-error.log
```

### 2. 性能分析

```bash
# 查找最慢的10个请求
awk '{print $NF}' /var/log/nginx/openmaic-access.log | sort -n | tail -10

# 统计各HTTP状态码数量
awk '{print $9}' /var/log/nginx/openmaic-access.log | sort | uniq -c | sort -rn

# 查找特定IP的请求
grep "1.2.3.4" /var/log/nginx/openmaic-access.log
```

### 3. 实时监控

```bash
# 实时查看应用日志
pm2 logs openmaic-web

# 实时查看Nginx访问日志
tail -f /var/log/nginx/openmaic-access.log

# 实时查看错误日志
tail -f /var/log/openmaic-error.log
```

### 4. 日志聚合

```bash
# 查看最近1小时的日志
find /var/log -name "*.log" -mmin -60 -exec grep -H "ERROR" {} \;

# 统计错误类型
grep "ERROR" /var/log/openmaic-out.log | awk -F'\\] \\[' '{print $3}' | sort | uniq -c
```

## 🔍 故障排查流程

### 1. API请求失败

```bash
# 1. 查看Nginx访问日志（找到请求）
tail -100 /var/log/nginx/openmaic-access.log | grep "POST /api/endpoint"

# 2. 查看应用日志（找到错误）
pm2 logs openmaic-web --lines 100 --err

# 3. 查看数据库连接
docker logs openmaic-postgres | grep -i error
```

### 2. 性能问题

```bash
# 1. 查看慢请求
awk '$NF > 2.0' /var/log/nginx/openmaic-access.log | tail -20

# 2. 查看应用日志中的性能信息
grep "duration" /var/log/openmaic-out.log | tail -20

# 3. 检查数据库性能
docker exec openmaic-postgres pg_stat_activity
```

### 3. 系统资源问题

```bash
# 1. 查看PM2进程资源使用
pm2 monit

# 2. 查看系统资源
htop

# 3. 查看磁盘使用
df -h
```

## 🛠️ 日志管理

### 日志清理

```bash
# 清理PM2日志
pm2 flush

# 清理旧的应用日志（>7天）
find /var/log -name "openmaic*.log" -mtime +7 -delete

# 清理Nginx旧日志
find /var/log/nginx -name "openmaic*.log.*" -mtime +30 -delete
```

### 日志备份

```bash
# 创建日志备份
tar -czf /opt/openmaic/logs/archived/logs-$(date +%Y%m%d).tar.gz /var/log/openmaic*.log

# 同步到备份服务器
scp /opt/openmaic/logs/archived/logs-*.tar.gz backup-server:/backups/
```

## ⚡ 性能优化建议

### 1. 减少日志量

```bash
# 生产环境使用info级别
export LOG_LEVEL=info

# 禁用健康检查日志
# (已在Nginx配置中设置)
```

### 2. 异步日志

```typescript
// 对于高频操作，考虑异步日志记录
const logger = createLogger('HighFrequencyAPI');
setImmediate(() => logger.info('异步日志记录', data));
```

### 3. 日志采样

```typescript
// 对于高频日志，考虑采样
const shouldLog = Math.random() < 0.1; // 10%采样
if (shouldLog) {
  logger.debug('采样日志', data);
}
```

## 📱 监控告警建议

### 1. 关键指标监控

- **错误率**: `grep "ERROR" /var/log/openmaic-out.log | wc -l`
- **慢请求**: `awk '$NF > 3.0' /var/log/nginx/openmaic-access.log | wc -l`
- **5xx错误**: `grep " 5[0-9][0-9] " /var/log/nginx/openmaic-access.log | wc -l`

### 2. 告警阈值

- 错误率 > 1% → 发送告警
- 慢请求率 > 5% → 发送告警
- 5xx错误率 > 0.1% → 紧急告警

## 🔗 相关链接

- [PM2日志文档](https://pm2.keymetrics.io/docs/usage/log-management/)
- [Nginx日志配置](http://nginx.org/en/docs/http/ngx_http_log_module.html)
- [PostgreSQL日志](https://www.postgresql.org/docs/current/runtime-config-logging.html)
