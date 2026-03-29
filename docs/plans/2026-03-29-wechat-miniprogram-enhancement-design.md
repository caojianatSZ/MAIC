# 微信小程序增强设计方案

**项目**：OpenMAIC 微信小程序端功能完善
**日期**：2026-03-29
**设计者**：Claude + 用户协作
**状态**：✅ 已确认

---

## 1. 项目概述

### 1.1 背景与目标

OpenMAIC 是一个基于多智能体的AI课程生成系统，现有微信小程序端功能单一，仅支持基础的拍照答疑。为满足C端用户（K12学生、家长、成人学习者）的需求，需要全面增强小程序功能。

### 1.2 产品定位

**B2B2C 模式**：
- OpenMAIC 是平台，机构（培训机构/学校）入驻
- 机构的C端用户（学生/家长）使用小程序
- 所有品牌露出为机构品牌，而非 OpenMAIC

**轻量辅助工具**：
- 小程序作为轻量级入口，便捷访问和快速操作
- 核心生成能力依赖主平台（Next.js后端）
- 小程序负责用户输入、内容展示、基础交互、本地缓存

### 1.3 目标用户

**混合人群**：
- K12学生：自主学习、作业辅导
- 家长：辅导孩子作业、查看学习报告
- 成人学习者：终身学习、知识巩固

---

## 2. 核心功能设计

### 2.1 快速答疑增强

#### 2.1.1 多模态输入通道

| 输入方式 | 功能描述 | 技术实现 |
|---------|---------|---------|
| **拍照识别** | 支持连续拍照（一次性拍多道题） | `wx.chooseImage` 多图选择 |
| **相册选择** | 批量选择已有图片（最多9张） | 复用现有 OCR 能力 |
| **语音输入** | 按住说话，语音转文字提问 | `wx.getRecorderManager` |
| **文字输入** | 保留原有文本框，支持粘贴 | 原有输入框 |
| **智能识别** | 自动识别题目、公式、图表 | 复用 PDF 解析能力 |

#### 2.1.2 用户体验优化

- **实时预览**：拍照后立即显示OCR识别结果，可手动修正
- **题目提取**：自动提取题目编号（如"1.""2."），分别处理
- **公式支持**：MathJax 渲染数学公式
- **历史复用**：快速复用最近的题目文字

#### 2.1.3 批量处理模式

- 一次性提交多个题目
- 后台并行生成
- 完成后逐个通知查看
- 支持生成"作业讲解合集"

#### 2.1.4 API 设计

```typescript
// 图片识别
POST /api/miniprogram/ocr
{
  images: string[]      // 图片URL数组
}
→ {
    questions: {
      text: string
      boundingBox?: Rect
    }[]
  }

// 批量提交
POST /api/miniprogram/batch-submit
{
  questions: string[]
  gradeLevel?: string
  subject?: string
}
→ {
    jobId: string
    estimatedTime: number
  }
```

---

### 2.2 课程分享与传播（无打扰设计）

#### 2.2.1 设计原则

**分享是自然的延伸，而不是额外的负担。**

#### 2.2.2 分享入口的"隐形"设计

**✅ 推荐**：
- 结果页右上角：低调的"分享"图标（与收藏、下载并列）
- 长按卡片触发：在历史记录/错题本中长按弹出分享选项
- 完成后的自然提示：一次性轻提示"讲解已完成，可以分享给需要的人"，2秒后自动消失
- 个人中心入口：我的 → 邀请好友（非核心路径）

**❌ 避免**：
- 首页弹窗"邀请好友"
- 结果页强制分享才能查看
- 频繁的分享引导提示

#### 2.2.3 分享时机的"顺势"设计

| 时机 | 触发条件 | 分享提示 |
|------|---------|---------|
| ✅ 查看完讲解 | 用户滑动到页面底部 | "觉得有用？可以分享给同学"（小字，非阻断） |
| ✅ 全部答对练习题 | 练习题正确率100% | "太棒了！分享你的成绩"（可选，点×即消失） |
| ✅ 收藏题目时 | 点击收藏按钮后 | 同时出现分享图标，但不强制 |
| ❌ 刚进入结果页 | - | 不提示分享，让用户先体验内容 |
| ❌ 题目答错时 | - | 绝不提示分享，避免挫败感干扰 |

#### 2.2.4 分享内容的"克制"设计

**分享卡片**：
- 标题：用户可编辑（默认生成好的）
- 图片：自动截取内容首屏，不加营销水印
- 跳转：直接进入内容，无需启动页/欢迎页
- **底部小字**："由**[机构名称]**生成"（B2B2C品牌化）

**分享到朋友圈（海报）**：
- 底部小字："由**[机构名称]**生成"
- 二维码：位于右下角，小且不突兀
- 品牌露出：通过内容质量体现，而非硬广

#### 2.2.5 API 设计

```typescript
// 获取分享内容（无需登录可访问）
GET /api/share/:id
→ {
    question: string
    explanation: string
    organization: {
      name: string
      logo: string
    }
    shareCode: string
  }

// 记录分享行为
POST /api/share/track
{
  shareId: string
  action: 'view' | 'register' | 'share'
  userId?: string
}

// 分享数据统计
GET /api/share/stats/:id
→ {
    viewCount: number
    shareCount: number
    registerCount: number
  }

// 邀请码生成与验证
POST /api/miniprogram/invite
{
  inviteCode: string
}
```

---

### 2.3 学习进度管理（基于知识点）

#### 2.3.1 集成 EduKG 知识图谱

**清华大学 EduKG**：
- 2.52亿实体、38.6亿三元组
- 覆盖K12全学科（数学、语文、英语、物理、化学等）
- 提供开放平台 API：https://edukg.cn/

**架构调整**：
```
小程序 ←→ Next.js API ←→ EduKG API
                 ↓
          用户数据（掌握程度）
```

**不在本地存储知识点树**，改为：
1. 本地存储用户与EduKG知识点的关联关系
2. 通过EduKG API获取知识点详情、层级关系
3. 缓存常用知识点到本地（提升性能）

#### 2.3.2 学生档案

**必填信息**：
- **年级**：小学1-6年级、初中1-3年级、高中1-3年级
- **主修科目**：数学、语文、英语、物理、化学、生物、历史、地理、政治（可多选）
- **机构信息**：通过邀请链接/二维码注册时，自动关联机构

**可选信息**：
- 学校名称（方便机构老师了解）
- 家长联系方式（机构老师可联系）

#### 2.3.3 学习进度可视化

**小程序界面**：
```
学习进度
├─ [切换科目] 数学 ▼
│
├─ 总体进度：65% 📊
│   └─ 已掌握 26/40 个知识点
│
├─ [知识点树形图]
│   ├─ ✅ 数与代数          80% (8/10)
│   │   ├─ ✅ 实数          100% (3/3)
│   │   ├─ ⏳ 代数式        67% (2/3)
│   │   └─ ⏳ 方程与不等式  75% (3/4)
│   ├─ ⏳ 函数              50% (2/4)
│   └─ ⭕ 图形与几何        33% (1/3)
│
└─ [查看详情] 查看薄弱知识点 →
```

**图例说明**：
- ✅ 已掌握：正确率>80%，练习≥5题
- ⏳ 学习中：正确率60-80%，或练习<5题
- ⭕ 未学习：练习=0题

#### 2.3.4 薄弱知识点分析

```
需要加强的知识点

1. ⚠️ 方程与不等式 - 一元二次方程
   正确率：40% (2/5)
   状态：错误次数较多，建议重点练习
   [立即练习] [查看讲解]

2. ⚠️ 代数式 - 二次根式
   正确率：0% (0/1)
   状态：尚未学习
   [开始学习]

3. 💡 函数 - 一次函数
   提示：您已掌握"函数基础"，可以学习"一次函数"了
   [开始学习]
```

#### 2.3.5 家长报告（基于知识点）

**周报/月报**：
```
📊 本周学习报告
2026.03.22 - 2026.03.28

【学习概况】
• 学习天数：5天
• 完成题目：23题
• 正确率：83%

【知识点掌握情况】
✅ 新掌握 2 个知识点：
  • 三角形 - 全等三角形 (100%)
  • 代数式 - 分式 (90%)

⏳ 复习了 3 个知识点：
  • 实数 - 有理数 (保持稳定)
  • 方程 - 一元一次方程 (85% ↗️)
  • 函数 - 函数基础 (80%)

⚠️ 需要加强：
  • 方程 - 二元一次方程组 (50%)
    建议：本周重点练习这个知识点

【学习建议】
本周孩子在"图形与几何"模块进步明显，
建议下周加强"方程与不等式"的练习。

[查看详细报告] [分享给家人]
```

#### 2.3.6 数据结构

```sql
-- 用户档案
users
├─ id
├─ wechat_openid
├─ organization_id          -- 所属机构
├─ grade_level              -- 年级
├─ subjects                 -- 科目数组（JSON）
├─ school_name              -- 学校名称（可选）
├─ parent_phone             -- 家长联系方式（可选）
└─ created_at

-- 用户知识点掌握记录
user_knowledge_mastery
├─ id
├─ user_id
├─ organization_id
├─ edukg_uri                -- EduKG实体的URI
├─ edukg_category           -- 学科：math/chinese/english...
├─ mastery_level            -- 掌握程度：0未学/1学习中/2基本掌握/3熟练/4精通
├─ practice_count           -- 练习次数
├─ correct_count            -- 正确次数
├─ first_practiced_at
├─ last_practiced_at
├─ cached_data              -- 缓存的知识点信息（JSON）
│   ├─ name: "一元一次方程"
│   ├─ level: "初中"
│   └─ parent_uri: "xxx"
└─ updated_at

-- 学习记录
user_learning_records
├─ id
├─ user_id
├─ organization_id
├─ question_id
├─ edukg_uri                -- 关联知识点
├─ grade_level
├─ subject
├─ difficulty
├─ is_correct
├─ time_spent
├─ practiced_at
└─ created_at
```

#### 2.3.7 API 设计

```typescript
// 设置年级科目
POST /api/miniprogram/user/profile
{
  gradeLevel: string
  subjects: string[]
}

// 获取学习进度
GET /api/miniprogram/user/learning-progress
?gradeLevel=MIDDLE_2
&subject=math

// 获取薄弱知识点
GET /api/miniprogram/user/weak-points
?gradeLevel=MIDDLE_2
&subject=math
&limit=5

// 获取学习报告（周报/月报）
GET /api/miniprogram/user/learning-report
?type=weekly
&gradeLevel=MIDDLE_2
&subject=math

// AI识别题目知识点
POST /api/miniprogram/ai/recognize-knowledge-point
{
  question: string
  userContext?: {
    gradeLevel: string
    subjects: string[]
  }
}
→ {
    edukgUri: string
    name: string
    confidence: number
  }

// EduKG 集成服务
GET /api/miniprogram/knowledge/:uri
GET /api/miniprogram/knowledge/search
?keyword=一元一次方程
&category=math
```

---

### 2.4 错题本（核心功能）

#### 2.4.1 错题收集

- **自动收集**：练习题答错时，自动加入错题本
- **手动添加**：用户可手动标记题目（即使答对了）
- **智能识别**：通过EduKG识别知识点，同类题目归为一类

#### 2.4.2 错题整理

**按年级+科目+知识点分类**：
```
错题本
├─ 初二数学 (5题)
│   ├─ 代数 - 方程 (3题)
│   │   ├─ 一元一次方程 (2题)
│   │   └─ 二元一次方程组 (1题)
│   └─ 几何 - 三角形 (2题)
├─ 初二英语 (3题)
│   ├─ 语法 - 时态 (2题)
│   └─ 词汇 - 单词拼写 (1题)
└─ 初一数学 (2题)  # 历史年级错题
```

**按掌握程度**：
- 未掌握、练习中、已掌握

**按错误次数**：
- 错2次以上的重点标注

#### 2.4.3 错题练习

- **错题重练**：只看题目，重新作答
- **智能推荐**：优先推荐错误次数多的知识点
- **举一反三**：针对错题，生成同类题目巩固
- **消灭错题**：连续答对3次，从错题本移除

#### 2.4.4 小程序界面

```
错题本
├─ [筛选] 全部 ▼  [排序] 错误次数 ▼
│
├─ ┌──────────────────────┐
│   │ 数学 · 加法运算      │
│   │ 1 + 1 = ?           │
│   │ 错误3次 │ 未掌握     │
│   └──────────────────────┘
│
├─ ┌──────────────────────┐
│   │ 英语 · 单词拼写      │
│   │ apple的中文意思是... │
│   │ 错误2次 │ 练习中     │
│   └──────────────────────┘
│
└─ [开始错题练习]
```

**错题详情页**：
- 原题展示
- 我的错误答案
- 正确答案
- AI讲解（复用原讲解）
- 错误原因分析（可选，AI生成）
- "举一反三"按钮 → 生成同类题
- "移出错题本"按钮（标记为已掌握）

#### 2.4.5 数据结构

```sql
-- 错题本表
user_wrong_questions
├─ id
├─ user_id
├─ organization_id
├─ question_id              -- 原题目ID
├─ question_snapshot        -- 题目快照（JSON）
├─ edukg_uri                -- 知识点URI
├─ grade_level              -- 错题时的年级
├─ subject                  -- 科目
├─ wrong_answer             -- 错误答案
├─ wrong_count              -- 错误次数
├─ practice_count           -- 练习次数
├─ mastery_level            -- 0未掌握/1练习中/2已掌握
├─ is_archived              -- 年级升级后归档
├─ last_practiced_at
└─ created_at

-- 错题练习记录
wrong_question_practices
├─ id
├─ wrong_question_id
├─ is_correct
├─ practiced_at
└─ created_at
```

#### 2.4.6 API 设计

```typescript
// 获取错题列表
GET /api/miniprogram/wrong-questions
?gradeLevel=MIDDLE_2
&subject=math
&edukgUri=xxx
&sortBy=wrong_count

// 练习错题
POST /api/miniprogram/wrong-questions/:id/practice
{
  answer: string
}
→ {
    isCorrect: boolean
    explanation: string
  }

// 标记为已掌握
POST /api/miniprogram/wrong-questions/:id/master

// 举一反三生成同类题
POST /api/miniprogram/wrong-questions/:id/generate-similar
→ {
    questions: Question[]
  }

// 错题统计数据
GET /api/miniprogram/wrong-questions/stats
→ {
    total: number
    bySubject: { [key: string]: number }
    byKnowledgePoint: { [uri: string]: number }
  }
```

---

### 2.5 音色复刻（机构特色）

#### 2.5.1 功能定位

**核心价值**：用熟悉的声音讲解知识，增强学习体验和亲切感。

#### 2.5.2 使用场景

- **家长复刻声音**：用自己的声音给孩子讲解作业
- **老师复刻声音**：统一音色为班级学生生成讲解
- **学生复刻声音**：个性化学习体验

#### 2.5.3 功能流程

```
1. 用户进入"音色管理"
   ↓
2. 录制/上传声音样本（10-30秒）
   ↓
3. 提交到后端生成音色模型
   ↓
4. 等待处理（异步，3-5分钟）
   ↓
5. 音色就绪，可选择使用
   ↓
6. 生成讲解时使用该音色
```

#### 2.5.4 小程序界面

```
音色设置
├─ 当前音色：🔊 系统默认 - 晓梦 [切换]
│
├─ 我的音色
│   ├─ ✅ 爸爸的声音 (已创建)
│   │   ├─ 创建时间：2026-03-20
│   │   ├─ 使用次数：12次
│   │   └─ [设置为默认] [删除]
│   │
│   ├─ ✅ 李老师的声音 (已创建)
│   │   ├─ 创建时间：2026-03-18
│   │   ├─ 使用次数：28次
│   │   └─ [设置为默认] [删除]
│   │
│   └─ ➕ 创建新音色
│
└─ 音色样本库（机构提供）
    ├─ 亲切女声
    ├─ 磁性男声
    └─ 活泼童声
```

**创建音色流程**：
```
创建新音色

请录制10-30秒的声音样本

[🎤 按住说话]
或者
📁 上传音频文件

💡 提示：
• 选择安静环境
• 清晰朗读一段文字
• 推荐内容："春眠不觉晓，处处闻啼鸟..."

[开始录制]  [播放示例文本]

录制中... 00:08 / 00:30
[完成]  [重新录制]

处理中，预计需要3-5分钟
完成后将通知您
```

#### 2.5.5 技术实现

**小程序端**：
```javascript
const recorderManager = wx.getRecorderManager()

// 上传音频样本
wx.uploadFile({
  url: `${app.globalData.baseUrl}/api/miniprogram/voice/clone`,
  filePath: audioPath,
  name: 'audio',
  formData: {
    voiceName: '爸爸的声音',
    organizationId: 'xxx'
  }
})
```

**后端API**：
```typescript
// 复用 lib/audio/tts-providers.ts 的音色克隆功能

POST /api/miniprogram/voice/clone
{
  audioFile: File
  voiceName: string
  organizationId: string
}
→ {
    voiceId: string
    status: 'processing' | 'completed' | 'failed'
    estimatedTime: number
  }

GET /api/miniprogram/voice/:id/status
GET /api/miniprogram/voice/list
POST /api/miniprogram/voice/:id/set-default
DELETE /api/miniprogram/voice/:id
```

---

### 2.6 个人学习库

#### 2.6.1 功能模块

**1. 收藏夹**
- 收藏题目及讲解
- 按科目/年级分类
- 添加个人笔记

**2. 学习笔记**
- 关联题目的笔记
- 支持文字、语音、图片
- 笔记可搜索

**3. 离线下载**
- 下载讲解音频
- 下载练习题
- 支持离线查看

**4. 学习日历**
- 查看学习历史
- 计划学习任务
- 学习提醒

**5. 知识卡片**
- 重点知识摘录
- 错题知识点卡片
- 可生成复习卡片

#### 2.6.2 小程序界面

```
我的
├─ 📚 学习库
│   ├─ ⭐ 收藏夹 (23)
│   ├─ 📝 学习笔记 (8)
│   ├─ 📥 离线内容 (5)
│   ├─ 📅 学习日历
│   └─ 🗂️ 知识卡片 (12)
└─ ...
```

---

## 3. 数据库设计

### 3.1 核心表结构

```sql
-- 用户表（扩展）
CREATE TABLE users (
  id UUID PRIMARY KEY,
  wechat_openid VARCHAR(255) UNIQUE,
  wechat_unionid VARCHAR(255),
  organization_id UUID REFERENCES organizations(id),
  grade_level VARCHAR(50),                    -- 年级
  subjects JSONB,                             -- 科目数组
  school_name VARCHAR(255),
  parent_phone VARCHAR(20),
  nickname VARCHAR(100),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 用户知识点掌握记录
CREATE TABLE user_knowledge_mastery (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  edukg_uri VARCHAR(500),                     -- EduKG实体URI
  edukg_category VARCHAR(50),                 -- 学科
  mastery_level INT DEFAULT 0,                -- 0未学/1学习中/2基本掌握/3熟练/4精通
  practice_count INT DEFAULT 0,
  correct_count INT DEFAULT 0,
  first_practiced_at TIMESTAMP,
  last_practiced_at TIMESTAMP,
  cached_data JSONB,                          -- 缓存知识点信息
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, edukg_uri)
);

-- 学习记录
CREATE TABLE user_learning_records (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  question_id UUID REFERENCES questions(id),
  edukg_uri VARCHAR(500),
  grade_level VARCHAR(50),
  subject VARCHAR(50),
  knowledge_point VARCHAR(200),
  difficulty VARCHAR(20),
  is_correct BOOLEAN,
  time_spent INT,
  practiced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 错题本
CREATE TABLE user_wrong_questions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  question_id UUID REFERENCES questions(id),
  question_snapshot JSONB,
  edukg_uri VARCHAR(500),
  grade_level VARCHAR(50),
  subject VARCHAR(50),
  knowledge_point VARCHAR(200),
  wrong_answer TEXT,
  wrong_count INT DEFAULT 1,
  practice_count INT DEFAULT 0,
  mastery_level INT DEFAULT 0,                -- 0未掌握/1练习中/2已掌握
  is_archived BOOLEAN DEFAULT FALSE,
  last_practiced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 错题练习记录
CREATE TABLE wrong_question_practices (
  id UUID PRIMARY KEY,
  wrong_question_id UUID REFERENCES user_wrong_questions(id),
  is_correct BOOLEAN,
  practiced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 用户音色
CREATE TABLE user_voices (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  organization_id UUID REFERENCES organizations(id),
  voice_name VARCHAR(100),
  voice_id VARCHAR(255),                      -- TTS provider返回的ID
  status VARCHAR(20),                         -- processing/completed/failed
  audio_sample_url TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  use_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 收藏夹
CREATE TABLE user_favorites (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  question_id UUID REFERENCES questions(id),
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, question_id)
);

-- 学习笔记
CREATE TABLE user_notes (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  question_id UUID REFERENCES questions(id),
  content TEXT,
  media_urls JSONB,                            -- 图片/语音附件
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 邀请记录
CREATE TABLE user_invites (
  id UUID PRIMARY KEY,
  inviter_id UUID REFERENCES users(id),
  invitee_id UUID REFERENCES users(id),
  invite_code VARCHAR(20) UNIQUE,
  status VARCHAR(20),                         -- pending/completed
  reward_claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- 机构知识点配置
CREATE TABLE organization_knowledge_config (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  edukg_uri VARCHAR(500),
  priority INT DEFAULT 0,                     -- 优先级
  is_required BOOLEAN DEFAULT FALSE,          -- 是否必学
  suggested_order INT,
  custom_note TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 分享记录
CREATE TABLE share_records (
  id UUID PRIMARY KEY,
  share_id VARCHAR(50) UNIQUE,
  user_id UUID REFERENCES users(id),
  question_id UUID REFERENCES questions(id),
  organization_id UUID REFERENCES organizations(id),
  view_count INT DEFAULT 0,
  share_count INT DEFAULT 0,
  register_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3.2 索引设计

```sql
-- 性能优化索引
CREATE INDEX idx_user_knowledge_mastery_user ON user_knowledge_mastery(user_id);
CREATE INDEX idx_user_knowledge_mastery_org ON user_knowledge_mastery(organization_id);
CREATE INDEX idx_user_knowledge_mastery_uri ON user_knowledge_mastery(edukg_uri);
CREATE INDEX idx_user_learning_records_user ON user_learning_records(user_id, practiced_at DESC);
CREATE INDEX idx_user_wrong_questions_user ON user_wrong_questions(user_id, is_archived);
CREATE INDEX idx_user_wrong_questions_org ON user_wrong_questions(organization_id);
CREATE INDEX idx_user_voices_user ON user_voices(user_id);
CREATE INDEX idx_share_records_share_id ON share_records(share_id);
```

---

## 4. API 路由设计

### 4.1 小程序专用API路由

```
app/api/miniprogram/
├── user/
│   ├── profile/
│   │   ├── POST /           # 设置年级科目
│   │   ├── PUT /            # 更新档案
│   │   └── GET /            # 获取档案
│   ├── stats/
│   │   └── GET /            # 获取统计数据
│   ├── learning-progress/
│   │   └── GET /            # 获取学习进度
│   ├── weak-points/
│   │   └── GET /            # 获取薄弱知识点
│   ├── learning-report/
│   │   └── GET /            # 获取学习报告
│   └── invite/
│       └── POST /           # 邀请码生成与验证
│
├── homework/
│   ├── ocr/
│   │   └── POST /           # 图片识别
│   ├── submit/
│   │   └── POST /           # 提交题目
│   └── batch-submit/
│       └── POST /           # 批量提交
│
├── wrong-questions/
│   ├── GET /                # 获取错题列表
│   ├── :id/
│   │   ├── practice/
│   │   │   └── POST /       # 练习错题
│   │   ├── master/
│   │   │   └── POST /       # 标记已掌握
│   │   ├── generate-similar/
│   │   │   └── POST /       # 举一反三
│   │   └── DELETE /         # 删除错题
│   └── stats/
│       └── GET /            # 错题统计
│
├── voice/
│   ├── clone/
│   │   └── POST /           # 创建音色
│   ├── list/
│   │   └── GET /            # 获取音色列表
│   ├── :id/
│   │   ├── status/
│   │   │   └── GET /        # 获取处理状态
│   │   ├── set-default/
│   │   │   └── POST /       # 设置默认
│   │   └── DELETE /         # 删除音色
│
├── knowledge/
│   ├── :uri/
│   │   └── GET /            # 获取知识点详情
│   ├── search/
│   │   └── GET /            # 搜索知识点
│   └── children/
│       └── GET /            # 获取子知识点
│
├── ai/
│   └── recognize-knowledge-point/
│       └── POST /           # AI识别题目知识点
│
├── favorites/
│   ├── GET /                # 获取收藏列表
│   ├── POST /               # 添加收藏
│   ├── :id/
│   │   └── DELETE /         # 取消收藏
│
├── notes/
│   ├── GET /                # 获取笔记列表
│   ├── POST /               # 创建笔记
│   ├── :id/
│   │   ├── PUT /            # 更新笔记
│   │   └── DELETE /         # 删除笔记
│
└── share/
    ├── :id/
    │   └── GET /            # 获取分享内容
    ├── track/
    │   └── POST /           # 记录分享行为
    └── stats/
        └── GET /            # 分享数据统计
```

---

## 5. 技术实现要点

### 5.1 EduKG 集成服务

```typescript
// lib/services/edukg.ts

class EduKGService {
  private baseUrl = 'https://edukg.cn/openapi'
  private apiKey = process.env.EDUKG_API_KEY

  async getInstanceInfo(uri: string) {
    const res = await fetch(
      `${this.baseUrl}/graph/getInstanceInfo?uri=${encodeURIComponent(uri)}&id=${this.apiKey}`
    )
    return res.json()
  }

  async searchInstances(keyword: string, category: string) {
    const res = await fetch(
      `${this.baseUrl}/graph/searchInstances?keyword=${keyword}&category=${category}&id=${this.apiKey}`
    )
    return res.json()
  }

  async getChildNodes(parentUri: string) {
    // 根据EduKG API文档实现
  }

  async getRelations(uri: string) {
    // 获取前置知识点、相关知识点
  }
}
```

### 5.2 AI识别题目知识点

```typescript
// 提交题目时的处理流程
POST /api/miniprogram/homework/submit

处理流程：
1. 接收题目文本
2. AI分析题目内容（使用现有LLM）
3. 提取关键词和题意
4. 调用EduKG.searchInstances()匹配知识点
5. 返回最匹配的知识点URI
6. 保存到user_learning_records和user_knowledge_mastery
```

### 5.3 音色克隆集成

复用现有 `lib/audio/tts-providers.ts`：
- 检查是否有支持音色克隆的provider
- 提交音频样本，获取voice_id
- 生成讲解时使用该voice_id

### 5.4 小程序性能优化

**本地缓存策略**：
- 用户档案：本地存储
- 知识点信息：首次从EduKG获取后缓存
- 学习记录：离线存储，联网后同步
- 错题本：本地缓存，定期同步

**请求优化**：
- 批量请求合并
- 防抖/节流
- 图片懒加载

---

## 6. 机构品牌化设计

### 6.1 品牌露出

**小程序配置**：
- 小程序名称：`[机构名称]智能辅导`
- 小程序头像：机构Logo
- 分享内容：底部显示"由**[机构名称]**生成"

**自定义选项**（机构后台）：
- 主题色
- 欢迎语
- 机构推荐知识点
- 音色样本库

### 6.2 机构数据隔离

所有数据都关联`organization_id`：
- 用户只能看到所属机构的内容
- 统计数据按机构聚合
- 分享内容携带机构标识

---

## 7. 开发计划

### 7.1 MVP版本（第一阶段）

**目标**：核心功能可用，验证产品方向

**功能列表**：
- ✅ 用户注册登录（微信登录+机构关联）
- ✅ 设置年级科目
- ✅ 拍照/输入题目
- ✅ AI识别题目知识点（EduKG集成）
- ✅ 生成讲解（复用现有能力）
- ✅ 错题本（基础功能：自动收集、按知识点分类、错题练习）
- ✅ 学习进度查看（基于知识点树）
- ✅ 分享功能（无打扰设计）
- ✅ 机构品牌化基础

**预计工期**：4-6周

### 7.2 增强版本（第二阶段）

**目标**：完善体验，增加粘性

**功能列表**：
- ✅ 音色复刻
- ✅ 批量题目处理
- ✅ 学习报告（周报/月报）
- ✅ 薄弱知识点分析
- ✅ 举一反三（生成同类题）
- ✅ 个人学习库（收藏、笔记）
- ✅ 邀请机制
- ✅ 离线下载

**预计工期**：4-6周

### 7.3 完整版本（第三阶段）

**目标**：精细化运营，数据驱动

**功能列表**：
- ✅ 机构教师后台（查看学生进度、发布任务）
- ✅ 学习日历和计划
- ✅ 知识卡片生成
- ✅ 学习提醒
- ✅ 家长报告增强
- ✅ 数据分析dashboard
- ✅ A/B测试框架

**预计工期**：6-8周

---

## 8. 成功指标

### 8.1 产品指标

- **用户留存**：次日留存>40%，7日留存>20%
- **使用频次**：日均使用次数>3次
- **功能渗透**：错题本使用率>60%，分享率>20%
- **学习效果**：知识点掌握度提升，错题减少

### 8.2 业务指标

- **机构满意度**：机构续费率>80%
- **裂变效果**：每个用户平均邀请0.5个新用户
- **付费转化**：免费用户到付费用户转化率>10%

---

## 9. 风险与挑战

### 9.1 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| EduKG API限制 | 性能瓶颈 | 本地缓存、请求合并、申请合作账号 |
| 音色克隆处理慢 | 用户体验差 | 异步处理+通知、音色样本库 |
| 小程序性能 | 卡顿、崩溃 | 分包加载、懒优化、本地缓存 |

### 9.2 产品风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 功能太复杂 | 用户流失 | 渐进式展示、新手引导 |
| 机构定制需求多 | 开发压力大 | 配置化、机构后台自助设置 |
| 知识点匹配不准 | 学习效果差 | 人工校验、持续优化AI模型 |

---

## 10. 附录

### 10.1 参考文档

- EduKG开放平台：https://edukg.cn/
- 微信小程序文档：https://developers.weixin.qq.com/miniprogram/dev/framework/
- OpenMAIC主平台：/README.md

### 10.2 设计变更记录

| 日期 | 变更内容 | 原因 |
|------|---------|------|
| 2026-03-29 | 初版设计完成 | 用户需求确认 |
| - | 集成EduKG知识图谱 | 使用专业教育知识图谱 |
| - | 增加年级科目维度 | 更精准的学习进度跟踪 |
| - | 强调机构品牌化 | B2B2C模式定位 |

---

**文档状态**：✅ 已确认，等待实施
**下一步**：制定详细实施计划，开始技术实现
