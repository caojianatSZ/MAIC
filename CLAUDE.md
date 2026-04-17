# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**OpenMAIC** (Open Multi-Agent Interactive Classroom) 是一个开源的 AI 教学平台，支持从自然语言生成课程。本项目包含：
- **Web 应用** (Next.js 16 + React 19) - 课程生成和播放的完整系统
- **微信小程序** - 用于吸引和引导客户的诊断和学习工具
- **成就系统** - 游戏化学习体验，追踪学生进度和成就
- **多智能体协作** - 基于 LangGraph 的 AI 教师和学生代理系统

## 技术栈

### 后端
- **框架**: Next.js 16 (App Router)
- **ORM**: Prisma 6
- **数据库**: PostgreSQL
- **AI SDK**: Vercel AI SDK (@ai-sdk/react)
- **多智能体**: LangGraph 1.1
- **语言**: TypeScript 5

### 前端
- **框架**: Next.js 16 + React 19
- **样式**: Tailwind CSS 4
- **UI 组件**: shadcn/ui, Radix UI
- **状态管理**: Zustand
- **图表**: ECharts (微信小程序)

### 微信小程序
- **语言**: JavaScript (CommonJS)
- **组件**: 自定义组件
- **API**: RESTful (调用 Next.js 后端)

## 开发命令

### 基础命令
```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 生产构建
pnpm build

# 启动生产服务器
pnpm start

# 代码检查
pnpm lint

# 代码格式化
pnpm format
```

### 数据库命令
```bash
# 生成 Prisma Client
pnpm prisma generate

# 运行数据库迁移
pnpm prisma migrate dev

# 推送 schema 到数据库
pnpm prisma db push

# 打开 Prisma Studio
pnpm prisma studio
```

### 测试相关
```bash
# 当前项目使用手动测试
# 主要测试场景：
# 1. 诊断流程测试 - miniprogram/pages/diagnosis/
# 2. 成就系统测试 - miniprogram/pages/profile/
# 3. 学习打卡测试 - miniprogram/pages/checkin/
```

## 代码架构

### 项目结构

```
OpenMAIC/
├── app/                           # Next.js App Router 应用
│   ├── api/                        # API 路由
│   │   ├── achievements/           #   成就系统 API
│   │   ├── auth/                   #   认证相关
│   │   ├── chat/                  #   多智能体聊天 (SSE)
│   │   ├── diagnosis/            #   诊断相关
│   │   ├── generate/             #   课程生成
│   │   ├── student/               #   学生画像
│   │   └── ...
│   ├── classroom/[id]/           #   教室播放页面
│   └── page.tsx                   #   首页
│
├── miniprogram/                   # 微信小程序
│   ├── pages/                     #   页面
│   │   ├── diagnosis/            #   诊断页面
│   │   ├── profile/              #   个人中心（成就展示）
│   │   ├── checkin/              #   学习打卡
│   │   ├── progress/             #   学习路径
│   │   └── player/               #   播放器
│   ├── components/                #   自定义组件
│   │   ├── achievement/          #   成就徽章组件
│   │   ├── growth-chart/         #   成长曲线组件
│   │   └── knowledge-graph/       #   知识图谱组件
│   ├── utils/                     #   工具函数
│   │   ├── user.js               #   用户相关工具
│   │   ├── config.js             #   配置相关工具
│   │   └── subscription.js       #   订阅消息工具
│   └── constants/                #   常量定义
│       └── eventTypes.js         #   事件类型和配置常量
│
├── lib/                          # 核心业务逻辑
│   ├── achievements/             #   成就系统
│   │   ├── engine.ts             #   成就引擎（核心逻辑）
│   │   └── types.ts              #   类型定义
│   ├── generation/               #   课程生成
│   ├── orchestration/           #   多智能体编排
│   ├── playback/                 #   播放引擎
│   └── ai/                       #   LLM 提供商抽象
│
├── prisma/                      # Prisma ORM
│   └── schema.prisma            #   数据库模型定义
│
└── docs/                        # 项目文档
    ├── ACHIEVEMENT_SYSTEM_SUMMARY.md
    └── ACHIEVEMENT_SYSTEM_PHASE2_REPORT.md
```

### 成就系统架构

**核心组件**:
1. **AchievementEngine** (`lib/achievements/engine.ts`)
   - 处理学习事件
   - 计算成就进度
   - 解锁成就
   - 更新学生画像

2. **事件类型** (`constants/eventTypes.js`)
   - EVENT_TYPES: `quiz_finished`, `diagnosis_finished`, `lesson_learned`, `streak`
   - ACHIEVEMENT_LEVELS: `bronze`, `silver`, `gold`, `diamond`, `king`
   - MASTERY_LEVELS: `mastered`, `partial`, `weak`

3. **工具函数** (小程序)
   - `getUserId()` - 获取用户ID
   - `getBaseUrl()` - 获取API基础URL
   - `isLoggedIn()` - 检查登录状态

### 多智能体系统

**编排层**: `lib/orchestration/`
- LangGraph 状态机管理
- 控制AI教师和AI学生的对话
- 处理实时交互和讨论

**动作执行**: `lib/action/`
- 28+ 动作类型（语音、白板绘制、聚光灯、激光笔等）
- 实时执行AI代理的动作

### 诊断系统

**流程**:
1. 用户完成诊断题目
2. 后端分析知识掌握情况
3. 触发成就检查
4. 生成学习建议
5. 展示结果页面

**关键文件**:
- `miniprogram/pages/diagnosis/diagnosis.js` - 诊断页面逻辑
- `app/api/diagnosis/analyze/route.ts` - 诊断分析API
- `lib/achievements/engine.ts` - 成就检查引擎

### 试卷拍照批改 V2（防幻觉增强版）

**技术架构**:
- **GLM-OCR**: 专业 OCR，返回印刷内容和手写答案识别
- **后处理校验层**: 题号连续性、答案区域、文本长度验证
- **GLM-4V-Plus**: 逻辑批改和答案解析
- **防幻觉校验层**: 答案合理性检查、置信度过滤、人工复核标记

**API 端点**:
```
POST /api/diagnosis/photo
```

**响应格式（含复核标记）**:
```typescript
{
  questions: [{
    judgment: {
      needsReview: boolean,    // 是否需要人工复核
      reviewReason: string,    // 复核原因
      confidence: number,      // 调整后置信度
      warnings: string[]       // 警告信息
    }
  }],
  summary: {
    needsReview: boolean,     // 整体是否需要复核
    lowConfidenceCount: number // 低置信度题目数量
  },
  ocrValidation: {
    isValid: boolean,
    warnings: string[],
    errors: string[]
  }
}
```

**核心模块**:
- `lib/glm/ocr.ts` - GLM-OCR 客户端
- `lib/glm/judge.ts` - GLM-4V-Plus 批改客户端
- `lib/validation/ocr.ts` - OCR 后处理校验
- `lib/wrong-questions/` - 错题服务

**小程序页面**:
- `pages/review-list/` - 待复核列表
- `pages/wrong-questions/` - 错题本

## 重要约定

### 用户ID管理
- **测试用户**: `demo_user_id` (在 `app.js` globalData 中配置)
- **生产环境**: 从微信登录获取真实用户ID
- **统一获取**: 始终使用 `getUserId()` 工具函数，避免硬编码

### API调用规范
- **baseUrl获取**: 使用 `getBaseUrl()` 工具函数
- **事件类型**: 使用 `EVENT_TYPES` 常量，避免硬编码字符串
- **错误处理**: 所有API调用必须包含 fail 回调

### 成就触发时机
- `quiz_finished` - 完成测验后
- `diagnosis_finished` - 完成诊断后
- `lesson_learned` - 完成课程学习后
- `streak` - 连续学习打卡

### 微信小程序开发
- **组件引用**: 使用 `require()` 引入自定义组件和工具函数
- **setData**: 批量更新状态，减少调用次数
- **可选链**: 使用 `?.` 操作符简化空值检查
- **常量使用**: 优先使用 `constants/eventTypes.js` 中的常量

## 关键配置

### 环境变量 (.env.local)
```env
# LLM Providers (至少配置一个)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# 数据库
DATABASE_URL=postgresql://user:password@localhost:5432/openmaic

# 默认模型（可选）
DEFAULT_MODEL=google:gemini-3-flash-preview
```

### Prisma Client 全局变量
**问题**: Next.js 热重载会创建多个 Prisma Client 实例
**解决**: 使用全局变量重用实例 (已在 `lib/achievements/engine.ts` 中实现)

```typescript
const globalForPrisma = global as unknown as { prisma: PrismaClient }
const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

### 数据库外键约束
**问题**: 插入记录时用户可能不存在
**解决**: 在插入前检查用户是否存在，使用 try-catch 处理错误

## 常见任务

### 添加新的成就类型
1. 在 `prisma/schema.prisma` 定义数据模型
2. 创建 seed 文件初始化成就数据
3. 在 `lib/achievements/engine.ts` 添加计算逻辑
4. 在 `constants/eventTypes.js` 添加事件类型常量

### 扩展小程序功能
1. 创建新页面: `miniprogram/pages/[pageName]/`
2. 在 `miniprogram/app.json` 注册页面
3. 创建对应的 `.js`, `.wxml`, `.wxss`, `.json` 文件
4. 使用工具函数: `require('../../utils/user')`, `require('../../utils/config')`

### 调试成就系统
```bash
# 查看成就数据
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const achievements = await prisma.achievement.findMany({ take: 5 });
console.log(achievements);
await prisma.\$disconnect();
"

# 测试成就引擎API
curl -X POST http://localhost:3000/api/achievements/check \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "demo_user_id",
    "event": {
      "type": "quiz_finished",
      "subject": "math",
      "knowledgePointId": "kp_quadratic_function",
      "data": {
        "score": 90,
        "correctCount": 5,
        "totalCount": 5
      }
    }
  }'
```

## 工作模式

### 第一性原理工作模式
从原始需求和问题本身出发思考：
- **目标模糊时** → 先停下确认，不要猜测意图
- **路径非最佳时** → 直接建议更直接、更低成本的方案
- **识别XY问题** → 追问真实目标

### 回答结构（非 trivial 任务）
1. **直接执行** - 按要求给出结果
2. **审慎挑战**（如有必要）- 质疑动机偏离、分析路径弊端

### 开发流程
1. **理解需求** - 确认用户真实目标
2. **检查现有代码** - 使用 Glob/Grep 搜索相关实现
3. **优先复用** - 使用现有工具函数和组件
4. **保持简洁** - 避免过度工程化
5. **测试验证** - 确保功能正常工作
6. **提交代码** - 清晰的 commit message

## 项目特性

### 已实现功能
- ✅ 成就系统 (83个成就，3个科目)
- ✅ 学生画像管理
- ✅ 学习打卡系统
- ✅ 成长曲线可视化
- ✅ 家长端通知
- ✅ 诊断和学习路径
- ✅ 知识图谱展示

### 核心竞争力
- **游戏化学习** - 5级成就体系激励学习
- **个性化推荐** - 基于诊断结果推荐学习路径
- **实时反馈** - 即时显示学习进度和成就
- **家长参与** - 微信订阅消息通知家长

## 注意事项

### 数据库操作
- 使用 Prisma Client 时注意全局变量模式
- 检查外键约束，避免违反约束
- 使用 try-catch 处理数据库错误

### 微信小程序
- 使用 CommonJS 模块系统（require/module.exports）
- 页面生命周期: onLoad, onShow, onReady, onHide, onUnload
- 事件绑定: bindtap, catchtap, bindinput
- 数据更新: setData（异步，批量更新）

### 成就系统
- 事件类型必须与 `constants/eventTypes.js` 中定义的一致
- 知识点ID命名规范: `kp_[knowledgePointName]`
- 成就等级: bronze → silver → gold → diamond → king
- 进度计算: 0-100，达到100时解锁

### 性能优化
- 避免在循环中进行数据库查询
- 使用 Promise.all 并行执行独立操作
- 减少 setData 调用次数，批量更新状态
- 使用可选链操作符简化空值检查

## 文档资源

- **成就系统总结**: `docs/ACHIEVEMENT_SYSTEM_SUMMARY.md`
- **Phase 2 报告**: `docs/ACHIEVEMENT_SYSTEM_PHASE2_REPORT.md`
- **测试报告**: `docs/ACHIEVEMENT_SYSTEM_TEST_REPORT.md`
- **项目 README**: `README.md`
- **小程序 Demo**: `miniprogram/README_DEMO.md`
