# 数据看板功能说明

## 概述

已完成 B2B 获客工具的数据看板和分析功能，培训机构可以通过看板追踪课程分享的获客效果。

## 新增功能

### 1. 组织统计 API

**端点**: `GET /api/organizations/{id}/stats`

**返回数据**:
- `totalViews`: 总浏览量（唯一 session 数）
- `totalCompletions`: 总完成量（完成课程的用户数）
- `totalConversions`: 总转化量（唯一电话号码数）
- `conversionRate`: 转化率（转化量 / 浏览量）
- `statsPerClassroom`: 按课堂维度的统计数据

**示例**:
```bash
curl http://localhost:3000/api/organizations/{organizationId}/stats
```

### 2. 转化漏斗分析 API

**端点**: `GET /api/organizations/{id}/funnel`

**返回数据**:
- `funnel`: 三阶段漏斗数据
  - Stage 1: 浏览 (100%)
  - Stage 2: 完成 (完成率)
  - Stage 3: 转化 (转化率)
- `stageToStage`: 阶段间转化率
- `averageWatchDuration`: 平均观看时长（秒）

**示例**:
```bash
curl http://localhost:3000/api/organizations/{organizationId}/funnel
```

### 3. 转化记录 API

**端点**: `GET /api/organizations/{id}/conversions`

**查询参数**:
- `classroomId` (可选): 筛选特定课堂
- `limit` (可选): 返回数量，默认 10

**示例**:
```bash
# 获取所有转化记录
curl http://localhost:3000/api/organizations/{organizationId}/conversions

# 获取特定课堂的转化记录
curl "http://localhost:3000/api/organizations/{organizationId}/conversions?classroomId={classroomId}&limit=20"
```

### 4. 数据看板页面

**路径**: `/dashboard/{organizationId}`

**功能**:
- 关键指标卡片
  - 总浏览量
  - 完成量
  - 转化量
  - 转化率

- 转化漏斗可视化
  - 三阶段进度条展示
  - 阶段间转化率
  - 平均观看时长

- 最近转化表格
  - 手机号脱敏显示（前3位 + **** + 后4位）
  - 课程信息
  - 转化时间（相对时间显示）

## 技术实现

### 数据库查询
- 使用 Drizzle ORM 的 JOIN 和聚合函数
- 遵循数据库索引优化
- 使用 `ANY()` 查询多个关联记录

### API 设计
- 统一使用 `apiSuccess()` 和 `apiError()` 响应格式
- 完善的错误处理
- TypeScript 类型安全

### 前端页面
- React Hooks (useState, useEffect)
- 并行请求优化性能
- 响应式设计（移动端适配）
- 加载状态和错误处理

## 使用示例

### 1. 注册机构
```bash
curl -X POST http://localhost:3000/api/organizations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试培训机构",
    "phone": "13800138000"
  }'
```

### 2. 创建课程分享
```bash
curl -X POST http://localhost:3000/api/organization-classrooms \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "{organizationId}",
    "classroomId": "{classroomId}"
  }'
```

### 3. 查看数据看板
访问: `http://localhost:3000/dashboard/{organizationId}`

## 数据流程

1. **用户访问分享页面** → 记录浏览（`/api/track/view`）
2. **用户完成课程** → 更新完成状态（`/api/track/complete`）
3. **用户提交电话** → 记录转化（转化卡片组件）
4. **机构查看看板** → 聚合统计数据

## 测试建议

1. 创建测试机构
2. 生成 3-5 个 Demo 课程
3. 为每个课程创建分享链接
4. 模拟用户访问和转化
5. 查看数据看板验证数据准确性

## 后续优化建议

- 添加时间范围筛选（今日、本周、本月）
- 导出数据为 CSV/Excel
- 添加趋势图表
- 课堂对比分析
- 实时数据更新（WebSocket）
