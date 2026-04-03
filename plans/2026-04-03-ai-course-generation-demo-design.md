# AI智能课程生成演示系统设计方案

**版本**: v1.0
**日期**: 2026-04-03
**目标受众**: 学校和教育机构（潜在客户）
**设计者**: Claude + 用户

---

## 📋 设计概述

### 核心目标
使用OpenMAIC平台实际生成AI课程，展示从自然语言到完整课程的全流程能力，替代静态录屏演示。

### 演示策略
- **3个独立微课**：数学（二次函数最值）、物理（力的分解）、语文（议论文写作）
- **线性流程展示**：完整展示第一个微课，然后展示第二、三个
- **流式生成体验**：边生成边播放，首屏30秒就绪
- **多版本展示**：每个主题生成4个版本（2种风格 × 2种难度）

---

## 🏗️ 系统架构

### 1. 简化Prompt输入层
**组件**: 小程序输入页面 + API接口
**功能**:
- 用户输入核心主题（如"二次函数最值"）
- 系统自动识别：学科、年级、知识点、难度等级
- 调用 `/api/demo/generate-course` API

### 2. AI辅助扩展引擎
**组件**: `lib/generation/outline-generator.ts`
**功能**:
- 接收简化prompt
- 通过EduKG知识图谱分析知识点结构
- 识别先修知识、关联知识点、易错点
- 生成5-7个场景的课程大纲

### 3. 流式课程生成器
**组件**: `lib/generation/scene-generator.ts` + SSE推送
**功能**:
- 优先生成前2个场景（导入+概念讲解）
- 生成完成后立即通过SSE推送到小程序
- 后台继续生成剩余场景
- 实时推送进度：`scene_progress` → `scene_ready` → `generation_complete`

### 4. 多版本自动生成系统
**组件**: 并发生成器 + 数据库存储
**功能**:
- 并发生成4个版本：2种风格（基础型×应用型）× 2种难度（标准×进阶）
- 每个版本独立调用generation pipeline
- 生成完成后存入 `Classroom` 表
- 返回课程库供用户选择

---

## 📱 前端交互设计

### 页面1：智能推荐输入 (`pages/demo-input/`)

**顶部：用户信息卡片**
- 当前登录用户
- 年级选择器（初一~高三）
- 科目选择器（数/理/化/生/语/英/史/地/政）

**中部：智能推荐区域**
- 标题："为你推荐的主题"
- 根据年级+科目展示6-8个推荐卡片
- 每个卡片显示：
  - 主题名称（如"二次函数最值"）
  - 难度标签（基础/重点/难点）
  - 知识点关联（如"关联3个知识点"）
  - 预计时长（如"10分钟"）
- 点击卡片 → 自动填充到输入框

**下部：自定义输入**
- 大号文本输入框
- "开始生成"按钮
- 底部提示："平均生成时间：2-3分钟"

**推荐示例**（初三数学）：
1. "二次函数最值" [重点] [5分钟]
2. "一元二次方程解法" [基础] [8分钟]
3. "相似三角形判定" [重点] [12分钟]
4. "圆的性质与切线" [难点] [15分钟]
5. "二次函数应用题" [难点] [10分钟]
6. "概率计算方法" [基础] [6分钟]

### 页面2：生成进度 (`pages/demo-generating/`)

**顶部**: 当前步骤文字
- "正在分析知识点结构..."
- "基于知识图谱规划教学路径..."
- "生成课程大纲：6个场景"
- "正在生成场景1：什么是二次函数最值"

**中间**: 进度条 + 场景卡片
- 进度条：基于SSE推送的百分比更新
- 已生成场景：✓ 场景1、✓ 场景2
- 生成中场景：⏳ 场景3
- 待生成场景：⚪ 场景4、⚪ 场景5、⚪ 场景6

**底部按钮**:
- 主按钮："立即播放"（前2个场景就绪后启用）
- 次要按钮："继续等待完整版"

### 页面3：课程库 (`pages/demo-library/`)

**顶部**: "已为'二次函数最值'生成4个版本"

**课程卡片网格**（2×2）:
```
[基础型×标准]  [基础型×进阶]
[应用型×标准]  [应用型×进阶]
```

每个卡片显示：
- 风格标签（蓝色"基础型" / 绿色"应用型"）
- 难度标签（灰色"标准" / 橙色"进阶"）
- 时长（如"12分钟"）
- 场景数（如"5个场景"）

点击卡片 → 预览弹窗 → 选择"播放此版本"

### 页面4：播放器增强 (`pages/player/`)

**新增面板**：
- "生成信息"：显示 `generationProcess`、`agentsInvolved`、`knowledgePointIds`
- "版本切换"：如果存在其他版本，显示切换按钮

**保持现有功能**：
- 播放控制、场景导航、白板等

---

## 🔌 API端点设计

### 1. 智能推荐API
```
GET /api/demo/recommendations?grade=初三&subject=数学

Response:
{
  success: true,
  data: {
    recommendations: [
      {
        topic: "二次函数最值",
        knowledgePointId: "kp_quadratic_max_min",
        difficulty: "重点",
        estimatedDuration: 600,
        relatedTopics: ["配方法", "顶点式"],
        popularity: 85
      },
      ...
    ]
  }
}
```

### 2. 课程生成API（修改现有）
```
POST /api/demo/generate-course

Request:
{
  topic: string,
  grade: string,
  subject: string,
  generateVersions?: boolean // 默认true
}

Response (流式SSE):
event: progress
data: { stage: "analyzing", percent: 10 }

event: scene_ready
data: { sceneIndex: 0, scene: {...} }

event: partial_ready
data: {
  courseId: "xxx",
  scenes: [scene0, scene1],
  progress: 40,
  canPlay: true
}

event: generation_complete
data: {
  courseId: "xxx",
  versions: [{ classroomId, style, difficulty, ... }]
}
```

### 3. 课程库查询API
```
GET /api/demo/library?topic=二次函数最值

Response:
{
  success: true,
  data: {
    topic: "二次函数最值",
    versions: [
      {
        classroomId: "xxx",
        style: "basic",
        difficulty: "standard",
        title: "二次函数最值 - 基础型×标准",
        duration: 600,
        sceneCount: 6
      },
      ...
    ]
  }
}
```

### 4. 版本预览API
```
GET /api/demo/preview/:classroomId

Response:
{
  success: true,
  data: {
    classroomId: "xxx",
    title: "...",
    outline: [...],
    firstScene: { ... }
  }
}
```

---

## 🗄️ 数据库Schema

### Classroom表（新增字段）
```prisma
model Classroom {
  id                String   @id
  title             String
  description       String?
  subject           String
  grade             String?
  difficulty        String?  // standard/advanced
  style             String?  // basic/applied
  scenes            Json
  createdAt         DateTime @default(now())

  metadata          Json?
  versionType       String?  // "basic_standard"
  parentTopic       String?
  generationMethod  String?  // "ai_generated"

  // 关联知识点
  knowledgePoints   ClassroomKnowledgePoint[]

  @@index([subject, grade])
  @@index([parentTopic])
  @@index([versionType])
}
```

### ClassroomKnowledgePoint关联表（新增）
```prisma
model ClassroomKnowledgePoint {
  id               String   @id @default(cuid())
  classroomId      String
  knowledgePointId String

  classroom        Classroom @relation(fields: [classroomId], references: [id], onDelete: Cascade)

  @@unique([classroomId, knowledgePointId])
  @@index([knowledgePointId])
}
```

### KnowledgePoint表（更新）
```prisma
model KnowledgePoint {
  id              String   @id @default(cuid())
  identifier      String   @unique
  name            String
  subject         String?
  grade           String?

  classrooms      ClassroomKnowledgePoint[]

  @@index([subject, grade])
}
```

---

## ⚙️ 实现步骤

### 第一阶段：Prompt智能扩展（2-3秒）

1. **接收简化输入**
   ```typescript
   const input = { topic: "二次函数最值" }
   ```

2. **调用EduKG知识图谱**
   - 查询"二次函数最值"的：
     - 先修知识点
     - 关联知识点
     - 常见易错点
     - 典型例题标签

3. **构建详细需求**
   ```typescript
   const requirements = {
     topic: "二次函数最值",
     subject: "math",
     grade: "初三",
     difficulty: "standard",
     knowledgePoints: ["kf_quadratic_function", "kf_vertex_form", "kf_max_min"],
     prerequisites: ["配方法", "二次函数概念"],
     learningGoals: [...],
     estimatedDuration: 600
   }
   ```

4. **生成场景大纲**
   - 调用 `generateSceneOutlinesFromRequirements(requirements)`
   - 返回5-7个场景的大纲

### 第二阶段：流式生成场景（每个场景20-30秒）

1. **优先生成前2个场景**
   ```typescript
   const firstTwoScenes = await Promise.all([
     generateSceneContent(outlines[0]),
     generateSceneContent(outlines[1])
   ])
   ```

2. **立即返回初版课程**
   ```typescript
   return {
     courseId: "course_xxx",
     status: "partial",
     scenes: firstTwoScenes,
     totalScenes: outlines.length,
     progress: 40
   }
   ```

3. **后台继续生成剩余场景**
   - 使用异步任务继续生成
   - 每完成一个场景通过SSE推送

### 第三阶段：并发生成4个版本（总计1-2分钟）

1. **构建4个生成任务**
   ```typescript
   const versions = [
     { style: 'basic', difficulty: 'standard' },
     { style: 'basic', difficulty: 'advanced' },
     { style: 'applied', difficulty: 'standard' },
     { style: 'applied', difficulty: 'advanced' }
   ]
   ```

2. **并行执行生成**
   ```typescript
   const results = await Promise.all(
     tasks.map(task => task.catch(err => null))
   )
   ```

3. **存储到数据库**
   ```typescript
   const classrooms = await Promise.all(
     results.filter(Boolean).map((course, idx) =>
       prisma.classroom.create({
         data: { ... }
       })
     )
   )
   ```

---

## 🎯 完整用户体验流程

### 场景一：现场演示（第一个微课 - 数学）

1. **观众进入小程序** → 看到"AI智能课程生成"入口
2. **选择"初三"+"数学"** → 查看推荐主题
3. **点击"二次函数最值"** → 点击"开始生成"
4. **观察AI处理过程**（实时展示）：
   - ✓ "正在分析知识点结构..."（0.5秒）
   - ✓ "基于知识图谱规划教学路径..."（1秒）
   - ✓ "生成课程大纲：6个场景"（1.5秒）
   - ✓ "正在生成场景1：什么是二次函数最值"（25秒）
   - ✓ "正在生成场景2：配方法求最值"（28秒）
   - ✓ "初版课程就绪！"（总计30秒）
5. **点击"立即播放"** → 跳转到播放器
6. **播放前2个场景** → 后台继续生成剩余场景
7. **播放结束** → 自动跳转到课程库页面
8. **展示4个版本** → 选择"应用型×进阶"预览
9. **讲解员介绍**："大家看到，AI为同一个主题生成了4个不同版本，老师可以根据学生水平选择最合适的版本"

### 场景二：展示第二个微课（物理）

1. **返回输入页面** → 选择"高一"+"物理"
2. **点击"力的分解与合成"** → 重复上述流程
3. **重点展示**：不同学科的适应性（物理的矢量分析、图解法）

### 场景三：展示第三个微课（语文）

1. **返回输入页面** → 选择"初三"+"语文"
2. **点击"议论文写作方法"** → 重复上述流程
3. **重点展示**：AI对话式教学（教师示例→学生尝试→点评改进）

### 总结环节

展示"生成历史"页面，说明：
- "刚才演示的3个微课，总生成时间不到3分钟"
- "如果老师手动制作，至少需要6-8小时"
- "AI课程生成让优质教学内容规模化成为可能"

---

## 🛡️ 错误处理和降级策略

### 1. 生成失败处理
```typescript
async function generateSceneWithFallback(outline) {
  try {
    return await generateSceneContent(outline)
  } catch (error) {
    return getTemplateScene({ type: outline.type, subject: outline.subject })
  }
}
```

### 2. API超时控制
```typescript
export const maxDuration = 480 // 8分钟总超时

// 阶段1：需求分析和大纲（60秒）
// 阶段2：首屏场景（90秒）
// 后台任务：剩余场景（6分钟）
```

### 3. 用户体验保障
- 确保至少返回3个可播放场景
- 失败场景使用模板补充
- 实时推送进度，不让用户焦虑等待

### 4. 错误日志和监控
- 记录每次生成的成功率、耗时、错误信息
- 失败率超过10%时发送告警
- 定期分析失败原因，优化生成质量

---

## 📦 交付物

### 功能模块
1. ✅ 智能推荐输入页面
2. ✅ 生成进度实时展示页面
3. ✅ 多版本课程库页面
4. ✅ 播放器增强（生成信息、版本切换）
5. ✅ 4个API端点（推荐、生成、查询、预览）
6. ✅ 流式生成和SSE推送
7. ✅ 多版本并发生成系统
8. ✅ 数据库Schema更新

### 演示内容
1. ✅ 3个微课实际生成（数学、物理、语文）
2. ✅ 每个微课4个版本
3. ✅ 完整演示脚本和流程
4. ✅ 用户使用指南

### 技术文档
1. ✅ API接口文档
2. ✅ 数据库设计文档
3. ✅ 部署和配置指南
4. ✅ 故障排查手册

---

## 🎬 演示效果预期

**观众看到的价值**：
- ✅ 从"二次函数最值"6个字到完整微课，只需30秒首屏
- ✅ 同一个主题自动生成4个不同版本，适应不同学生水平
- ✅ 三个不同学科都能高质量生成，展示平台通用性
- ✅ 边生成边播放，体验流畅无等待

**与传统方式对比**：
- 📊 制作时间：8小时 → 3分钟（**99%时间节省**）
- 📊 人力成本：1名教师+1名教研员 → 0（**完全自动化**）
- 📊 内容质量：依赖个人经验 → 知识图谱驱动（**质量标准化**）
- 📊 产出数量：1个版本 → 4个版本（**4倍产出**）

---

## ✅ 下一步

是否准备好开始实施此设计方案？
