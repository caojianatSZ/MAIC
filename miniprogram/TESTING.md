# 小程序测试指南

## 环境准备

### 1. 启动后端服务
```bash
cd /Users/caojian/Projects/OpenMAIC
pnpm dev
```
后端运行在 http://localhost:3000

### 2. 配置小程序
- 打开微信开发者工具
- 导入项目：`miniprogram/` 目录
- 开启「不校验合法域名」
- 开启「不校验 web-view (业务域名)」

### 3. 设置测试用户ID
在调试器 Console 中执行：
```javascript
wx.setStorageSync('userId', 'demo_teacher_001')
```

## 页面测试路径

### 老师仪表盘
- 路径：`pages/teacher-dashboard/teacher-dashboard`
- 测试点：今日数据、课程列表、待办事项、统计概览

### 试课线索管理
- 路径：`pages/trial-leads-list/trial-leads-list`
- 测试点：
  - 状态筛选（全部、新线索、已联系、已预约、已完成）
  - 创建新线索 → `pages/trial-lead-create/trial-lead-create`
  - 查看详情 → `pages/trial-lead-detail/trial-lead-detail`
  - 转化成交 → `pages/trial-lead-convert/trial-lead-convert`
  - 添加备注 → `pages/note-add/note-add`

### 约课管理
- 路径：`pages/bookings-list/bookings-list`
- 测试点：
  - 列表/日历视图切换
  - 创建约课 → `pages/booking-create/booking-create`
  - 选择学生 → `pages/student-select/student-select`
  - 查看详情 → `pages/booking-detail/booking-detail`
  - 取消预约 → `pages/booking-cancel/booking-cancel`
  - 完成课程 → `pages/booking-complete/booking-complete`

### 时间段设置
- 路径：`pages/teacher-slots/teacher-slots`
- 测试点：周选择、时间段增删改

### 通知
- 路径：`pages/notifications/notifications`
- 测试点：分类筛选、标记已读、跳转

## API 接口测试

### 使用 curl 测试后端
```bash
# 仪表盘
curl http://localhost:3000/api/teacher/dashboard?teacherId=demo_teacher_001

# 试课线索列表
curl http://localhost:3000/api/trial-leads

# 创建线索
curl -X POST http://localhost:3000/api/trial-leads \
  -H "Content-Type: application/json" \
  -H "x-user-id: demo_teacher_001" \
  -d '{
    "studentName": "测试学生",
    "phoneNumber": "13800138000",
    "cityId": "default",
    "cityPartnerId": "demo_teacher_001"
  }'

# 约课列表
curl http://localhost:3000/api/bookings?teacherId=demo_teacher_001

# 设置时间段
curl -X POST http://localhost:3000/api/teacher/slots \
  -H "Content-Type: application/json" \
  -H "x-user-id: demo_teacher_001" \
  -d '{
    "teacherId": "demo_teacher_001",
    "dayOfWeek": 1,
    "startTime": "09:00",
    "endTime": "10:00",
    "classTypes": ["ONE_V1"],
    "isAvailable": true
  }'
```

## 已知问题

### 1. 学生选择页
- `pages/student-select/student-select` 依赖 `/api/students` 接口
- 如果接口不存在，需要先添加学生或使用模拟数据

### 2. 通知页
- 当前使用模拟数据，需要对接实际通知服务

### 3. 图片资源
- 图标路径需要实际图片文件，或使用 CSS 绘制替代

## 快速验证流程

1. 启动后端 `pnpm dev`
2. 微信开发者工具打开小程序
3. Console 设置 `wx.setStorageSync('userId', 'demo_teacher_001')`
4. 导航到 `pages/teacher-dashboard/teacher-dashboard`
5. 验证数据显示正常
6. 依次测试各功能模块
