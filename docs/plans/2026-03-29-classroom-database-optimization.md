# 后台课程数据库优化方案

**问题**：现有课程存储在文件系统中，缺少元数据和索引，难以搜索和重用
**目标**：建立完整的课程元数据体系，支持全文搜索、智能推荐和课程重用
**日期**：2026-03-29

---

## 1. 现状分析

### 1.1 当前数据结构

**课程文件存储** (`data/classrooms/{id}.json`)：
```json
{
  "id": "abc123",
  "stage": { /* 完整舞台数据 */ },
  "scenes": [ /* 完整场景数组 */ ],
  "createdAt": "2026-03-29T10:00:00Z"
}
```

**数据库表** (`organization_classrooms`)：
```sql
organizationClassrooms
├─ id
├─ organizationId
├─ classroomId          -- 关联到文件
├─ shareToken
├─ subject             -- 科目（简单文本）
├─ grade               -- 年级（简单文本）
└─ createdAt
```

### 1.2 存在的问题

| 问题 | 影响 | 原因 |
|------|------|------|
| **无法搜索内容** | 用户找不到相关课程 | 课程内容在文件中，数据库没有索引 |
| **无法按知识点筛选** | 无法找到特定知识点的课程 | 没有知识点关联 |
| **无法推荐相似课程** | 每次都要重新生成 | 没有课程相似度计算 |
| **缺少标题和描述** | 课程列表不直观 | 只有ID，没有可读信息 |
| **无法统计课程质量** | 不知道哪些课程受欢迎 | 没有使用数据追踪 |

---

## 2. 优化方案设计

### 2.1 核心思路

**重要变更**：将课程内容从文件系统迁移到数据库存储

1. **课程内容数据库化**：将stage和scenes存储在数据库中，不再使用文件系统
2. **添加课程元数据表**：存储课程的可搜索信息
3. **建立知识点关联**：关联EduKG知识图谱
4. **支持全文搜索**：使用PostgreSQL全文搜索能力
5. **添加使用统计**：追踪课程使用情况
6. **实现课程模板**：允许保存和重用课程结构

### 2.2 迁移策略

- **双写期**：新课程同时写入数据库和文件（保持兼容）
- **灰度迁移**：后台任务逐步迁移现有课程
- **切换**：验证后，完全切换到数据库
- **清理**：删除文件系统中的课程文件

### 2.2 数据库设计

#### 2.2.0 课程主表（核心变更）⭐

**Drizzle ORM定义**：

```typescript
// drizzle/schema.ts (新增)

import { pgTable, uuid, text, timestamp, boolean, integer, jsonb, index } from 'drizzle-orm/pg-core';

// 课程主表 - 替代文件系统存储
export const classrooms = pgTable('classrooms', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 基本信息
  title: text('title').notNull(),
  description: text('description'),
  language: text('language').default('zh-CN'),

  // 分类信息
  subject: text('subject'), // math/chinese/english...
  gradeLevel: text('grade_level'), // PRIMARY_1~6, MIDDLE_1~3, HIGH_1~3
  difficulty: text('difficulty'), // beginner/intermediate/advanced

  // 生成参数
  requirement: text('requirement').notNull(),
  generationConfig: jsonb('generation_config').$type<{
    language?: string;
    enableWebSearch?: boolean;
    enableImageGeneration?: boolean;
    enableVideoGeneration?: boolean;
    enableTTS?: boolean;
    agentMode?: 'default' | 'generate';
    organizationId?: string;
    clonedVoiceId?: string;
  }>(),

  // 课程内容（JSONB存储）
  stageData: jsonb('stage_data').notNull().$type<Stage>(),
  scenesData: jsonb('scenes_data').notNull().$type<Scene[]>(),
  mediaResources: jsonb('media_resources'),

  // 内容统计
  scenesCount: integer('scenes_count'),
  durationMinutes: integer('duration_minutes'),
  hasSlides: boolean('has_slides').default(false),
  hasQuiz: boolean('has_quiz').default(false),
  hasInteractive: boolean('has_interactive').default(false),
  hasPBL: boolean('has_pbl').default(false),
  hasTTS: boolean('has_tts').default(false),
  hasImageGeneration: boolean('has_image_generation').default(false),
  hasVideoGeneration: boolean('has_video_generation').default(false),

  // 搜索优化
  keywords: jsonb('keywords').$type<string[]>(),
  tags: jsonb('tags').$type<string[]>(),
  searchVector: text('search_vector'),

  // 所属机构
  organizationId: uuid('organization_id').references(() => organizations.id),

  // 状态
  status: text('status').default('completed'), // pending/processing/completed/failed
  errorMessage: text('error_message'),

  // 元数据
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // 索引
  orgIdx: index('idx_classrooms_org').on(table.organizationId),
  subjectIdx: index('idx_classrooms_subject').on(table.subject),
  gradeIdx: index('idx_classrooms_grade').on(table.gradeLevel),
  difficultyIdx: index('idx_classrooms_difficulty').on(table.difficulty),
  statusIdx: index('idx_classrooms_status').on(table.status),
  createdAtIdx: index('idx_classrooms_created').on(table.createdAt),
}));
```

**SQL原始定义**：

```sql
-- 课程主表 - 替代文件系统存储
CREATE TABLE classrooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 基本信息
  title VARCHAR(500) NOT NULL,                  -- 课程标题
  description TEXT,                             -- 课程描述
  language VARCHAR(10) DEFAULT 'zh-CN',         -- 语言

  -- 分类信息
  subject VARCHAR(50),                          -- 科目：math/chinese/english...
  grade_level VARCHAR(50),                      -- 年级：PRIMARY_1~6, MIDDLE_1~3, HIGH_1~3
  difficulty VARCHAR(20),                       -- 难度：beginner/intermediate/advanced

  -- 生成参数（用于重用和调试）
  requirement TEXT NOT NULL,                    -- 用户原始需求
  generation_config JSONB,                      -- 生成配置（AI模型、媒体选项等）

  -- 课程内容（替代文件存储）
  stage_data JSONB NOT NULL,                    -- 完整的Stage数据
  scenes_data JSONB NOT NULL,                   -- 完整的Scenes数组

  -- 媒体资源（可选，如果需要单独管理）
  media_resources JSONB,                        -- 媒体资源清单

  -- 内容统计
  scenes_count INTEGER GENERATED ALWAYS AS (jsonb_array_length(scenes_data, 1)) STORED,
  duration_minutes INTEGER,                     -- 预计时长（分钟）
  has_slides BOOLEAN GENERATED ALWAYS AS (scenes_data ? 'slides') STORED,
  has_quiz BOOLEAN GENERATED ALWAYS AS (scenes_data ? 'quiz') STORED,
  has_interactive BOOLEAN GENERATED ALWAYS AS (scenes_data ? 'interactive') STORED,
  has_pbl BOOLEAN GENERATED ALWAYS AS (scenes_data ? 'pbl') STORED,
  has_tts BOOLEAN,                              -- 是否包含TTS
  has_image_generation BOOLEAN,                -- 是否包含AI生成图片
  has_video_generation BOOLEAN,                -- 是否包含AI生成视频

  -- 搜索优化
  keywords TEXT[],                              -- 关键词数组
  tags TEXT[],                                  -- 标签数组
  search_vector tsvector,                       -- 全文搜索向量

  -- 所属机构
  organization_id UUID REFERENCES organizations(id),

  -- 状态
  status VARCHAR(20) DEFAULT 'completed',       -- pending/processing/completed/failed
  error_message TEXT,                           -- 生成错误信息

  -- 元数据
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- 约束
  CONSTRAINT chk_classrooms_fields CHECK (
    title IS NOT NULL AND
    requirement IS NOT NULL AND
    stage_data IS NOT NULL AND
    scenes_data IS NOT NULL
  )
);

-- 索引
CREATE INDEX idx_classrooms_org ON classrooms(organization_id);
CREATE INDEX idx_classrooms_subject ON classrooms(subject);
CREATE INDEX idx_classrooms_grade ON classrooms(grade_level);
CREATE INDEX idx_classrooms_difficulty ON classrooms(difficulty);
CREATE INDEX idx_classrooms_status ON classrooms(status);
CREATE INDEX idx_classrooms_created ON classrooms(created_at DESC);

-- 全文搜索索引
CREATE INDEX idx_classrooms_search ON classrooms USING gin(search_vector);

-- 标签索引
CREATE INDEX idx_classrooms_tags ON classrooms USING gin(tags);

-- 自动更新search_vector的触发器
CREATE OR REPLACE FUNCTION classrooms_search_trigger() RETURNS trigger AS $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.requirement, '')), 'B') ||
    setweight(to_tsvector('simple', array_to_string(new.keywords, ' ')), 'C');
  return new;
end
$$ LANGUAGE plpgsql;

CREATE TRIGGER classrooms_search_update
  BEFORE INSERT OR UPDATE ON classrooms
  FOR EACH ROW
  EXECUTE FUNCTION classrooms_search_trigger();

-- GIN索引优化JSONB查询
CREATE INDEX idx_classrooms_scenes ON classrooms USING gin(scenes_data);
CREATE INDEX idx_classrooms_stage ON classrooms USING gin(stage_data);
```

**重要说明**：
- ✅ **stage_data** 和 **scenes_data** 使用PostgreSQL的JSONB类型存储完整的课程数据
- ✅ JSONB支持高效的查询和索引（GIN索引）
- ✅ 使用GENERATED ALWAYS自动计算统计字段
- ✅ search_vector自动更新，支持全文搜索
- ✅ 完全替代文件系统存储

#### 2.2.1 课程元数据表（核心）

```sql
-- 课程元数据表
CREATE TABLE classroom_metadata (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  classroom_id VARCHAR(255) UNIQUE NOT NULL,    -- 关联文件系统中的课程

  -- 基本信息
  title VARCHAR(500) NOT NULL,                  -- 课程标题
  description TEXT,                             -- 课程描述
  language VARCHAR(10) DEFAULT 'zh-CN',         -- 语言

  -- 分类信息
  subject VARCHAR(50),                          -- 科目：math/chinese/english...
  grade_level VARCHAR(50),                      -- 年级：PRIMARY_1~6, MIDDLE_1~3, HIGH_1~3
  difficulty VARCHAR(20),                       -- 难度：beginner/intermediate/advanced

  -- 内容统计
  scenes_count INTEGER DEFAULT 0,               -- 场景数量
  duration_minutes INTEGER,                     -- 预计时长（分钟）
  has_slides BOOLEAN DEFAULT FALSE,             -- 是否包含幻灯片
  has_quiz BOOLEAN DEFAULT FALSE,               -- 是否包含测验
  has_interactive BOOLEAN DEFAULT FALSE,        -- 是否包含互动
  has_pbl BOOLEAN DEFAULT FALSE,                -- 是否包含项目式学习

  -- 媒体信息
  has_tts BOOLEAN DEFAULT FALSE,                -- 是否包含TTS
  has_image_generation BOOLEAN DEFAULT FALSE,   -- 是否包含AI生成图片
  has_video_generation BOOLEAN DEFAULT FALSE,   -- 是否包含AI生成视频

  -- 搜索优化
  keywords TEXT[],                              -- 关键词数组
  tags TEXT[],                                  -- 标签数组

  -- 全文搜索向量（PostgreSQL tsvector）
  search_vector tsvector,

  -- 向量嵌入（用于语义搜索，可选）
  embedding vector(1536),                       -- OpenAI embedding维度

  -- 元数据
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- 索引
  CONSTRAINT chk_classroom_metadata_fields CHECK (
    title IS NOT NULL AND
    classroom_id IS NOT NULL
  )
);

-- 索引：基础查询
CREATE INDEX idx_classroom_metadata_org ON classroom_metadata(organization_id);
CREATE INDEX idx_classroom_metadata_subject ON classroom_metadata(subject);
CREATE INDEX idx_classroom_metadata_grade ON classroom_metadata(grade_level);
CREATE INDEX idx_classroom_metadata_difficulty ON classroom_metadata(difficulty);

-- 索引：全文搜索
CREATE INDEX idx_classroom_metadata_search ON classroom_metadata USING gin(search_vector);

-- 索引：标签搜索
CREATE INDEX idx_classroom_metadata_tags ON classroom_metadata USING gin(tags);

-- 索引：向量搜索（如果使用pgvector）
-- CREATE INDEX idx_classroom_metadata_embedding ON classroom_metadata USING ivfflat(embedding vector_cosine_ops);

-- 触发器：自动更新search_vector
CREATE OR REPLACE FUNCTION classroom_metadata_search_trigger() RETURNS trigger AS $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('simple', array_to_string(new.keywords, ' ')), 'C');
  return new;
end
$$ LANGUAGE plpgsql;

CREATE TRIGGER classroom_metadata_search_update
  BEFORE INSERT OR UPDATE ON classroom_metadata
  FOR EACH ROW
  EXECUTE FUNCTION classroom_metadata_search_trigger();
```

#### 2.2.2 课程知识点关联表

```sql
-- 课程知识点关联表（多对多）
CREATE TABLE classroom_knowledge_points (
  id UUID PRIMARY KEY,
  classroom_metadata_id UUID REFERENCES classroom_metadata(id) ON DELETE CASCADE,
  edukg_uri VARCHAR(500) NOT NULL,             -- EduKG实体URI
  knowledge_point_name VARCHAR(200),           -- 知识点名称（冗余，提升性能）
  is_primary BOOLEAN DEFAULT FALSE,            -- 是否为主要知识点
  relevance_score FLOAT,                       -- 相关性评分 0-1

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(classroom_metadata_id, edukg_uri)
);

-- 索引
CREATE INDEX idx_classroom_kp_metadata ON classroom_knowledge_points(classroom_metadata_id);
CREATE INDEX idx_classroom_kp_uri ON classroom_knowledge_points(edukg_uri);
CREATE INDEX idx_classroom_kp_primary ON classroom_knowledge_points(is_primary) WHERE is_primary = TRUE;
```

#### 2.2.3 课程使用统计表

```sql
-- 课程使用统计表
CREATE TABLE classroom_stats (
  id UUID PRIMARY KEY,
  classroom_metadata_id UUID REFERENCES classroom_metadata(id) ON DELETE CASCADE,

  -- 浏览数据
  view_count INTEGER DEFAULT 0,                -- 总浏览次数
  unique_viewers INTEGER DEFAULT 0,            -- 独立访客数
  avg_completion_rate FLOAT,                  -- 平均完成率
  avg_duration_seconds INTEGER,               -- 平均观看时长（秒）

  -- 互动数据
  share_count INTEGER DEFAULT 0,               -- 分享次数
  favorite_count INTEGER DEFAULT 0,            -- 收藏次数
  comment_count INTEGER DEFAULT 0,             -- 评论数（如果有）

  -- 转化数据（针对机构）
  conversion_count INTEGER DEFAULT 0,          -- 转化次数（留资等）
  conversion_rate FLOAT,                       -- 转化率

  -- 质量评分
  avg_rating FLOAT,                            -- 平均评分
  rating_count INTEGER DEFAULT 0,              -- 评分人数

  -- 时间维度
  last_viewed_at TIMESTAMP,
  last_shared_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(classroom_metadata_id)
);

-- 索引
CREATE INDEX idx_classroom_stats_views ON classroom_stats(view_count DESC);
CREATE INDEX idx_classroom_stats_rating ON classroom_stats(avg_rating DESC) WHERE avg_rating IS NOT NULL;
```

#### 2.2.4 课程模板表

```sql
-- 课程模板表（用于重用）
CREATE TABLE classroom_templates (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  created_by_user_id UUID,                     -- 创建者用户ID（可选）

  -- 模板信息
  name VARCHAR(500) NOT NULL,                  -- 模板名称
  description TEXT,                            -- 模板描述
  category VARCHAR(100),                       -- 模板分类

  -- 课程结构（不包含具体内容，只包含结构）
  outline_structure JSONB,                     -- 大纲结构
  scene_templates JSONB,                       -- 场景模板数组
  agent_configuration JSONB,                   -- Agent配置

  -- 适用范围
  applicable_subjects TEXT[],                  -- 适用科目
  applicable_grades TEXT[],                    -- 适用年级
  difficulty VARCHAR(20),

  -- 使用统计
  usage_count INTEGER DEFAULT 0,               -- 使用次数

  -- 状态
  is_public BOOLEAN DEFAULT FALSE,             -- 是否公开（其他机构可用）
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_classroom_templates_org ON classroom_templates(organization_id);
CREATE INDEX idx_classroom_templates_public ON classroom_templates(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_classroom_templates_category ON classroom_templates(category);
```

#### 2.2.5 课程收藏与历史表

```sql
-- 用户课程收藏表
CREATE TABLE user_classroom_favorites (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,                       -- 用户ID（可以是微信用户）
  classroom_metadata_id UUID REFERENCES classroom_metadata(id) ON DELETE CASCADE,

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, classroom_metadata_id)
);

-- 索引
CREATE INDEX idx_user_favorites_user ON user_classroom_favorites(user_id);
CREATE INDEX idx_user_favorites_classroom ON user_classroom_favorites(classroom_metadata_id);

-- 用户课程历史表
CREATE TABLE user_classroom_history (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  classroom_metadata_id UUID REFERENCES classroom_metadata(id) ON DELETE CASCADE,

  -- 浏览信息
  viewed_at TIMESTAMP DEFAULT NOW(),
  completion_rate FLOAT DEFAULT 0,             -- 完成率 0-1
  duration_seconds INTEGER DEFAULT 0,          -- 观看时长

  -- 来源
  source VARCHAR(50),                          -- search/recommend/share/direct

  created_at TIMESTAMP DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_user_history_user ON user_classroom_history(user_id, viewed_at DESC);
CREATE INDEX idx_user_history_classroom ON user_classroom_history(classroom_metadata_id);
```

---

## 3. 功能实现

### 3.1 课程生成与保存（核心变更）⭐

**新的课程保存流程**：

```typescript
// lib/server/classroom-storage.ts (新版)

import { db } from '@/lib/db';
import { classrooms } from '@/lib/db/schema';
import { nanoid } from 'nanoid';

export interface PersistClassroomInput {
  title: string;
  description?: string;
  requirement: string;
  subject?: string;
  gradeLevel?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  generationConfig: {
    language?: string;
    enableWebSearch?: boolean;
    enableImageGeneration?: boolean;
    enableVideoGeneration?: boolean;
    enableTTS?: boolean;
    agentMode?: 'default' | 'generate';
    organizationId?: string;
    clonedVoiceId?: string;
  };
  stage: Stage;
  scenes: Scene[];
}

export async function persistClassroomToDB(
  input: PersistClassroomInput
): Promise<{ id: string; url: string }> {
  const id = nanoid();

  // 1. 提取元数据
  const metadata = await extractMetadata(input);

  // 2. 保存到数据库
  await db.insert(classrooms).values({
    id,
    title: input.title,
    description: input.description,
    requirement: input.requirement,
    subject: input.subject,
    gradeLevel: input.gradeLevel,
    difficulty: input.difficulty || 'intermediate',
    generationConfig: input.generationConfig as any,
    stageData: input.stage as any,
    scenesData: input.scenes as any,
    keywords: metadata.keywords,
    tags: metadata.tags,
    organizationId: input.generationConfig.organizationId,
    hasTTS: input.generationConfig.enableTTS || false,
    hasImageGeneration: input.generationConfig.enableImageGeneration || false,
    hasVideoGeneration: input.generationConfig.enableVideoGeneration || false,
    durationMinutes: estimateDuration(input.scenes),
  });

  // 3. 保存知识点关联
  await saveKnowledgePoints(id, metadata.knowledgePoints);

  // 4. 返回URL
  const url = `/classroom/${id}`;
  return { id, url };
}

// 读取课程（从数据库）
export async function readClassroomFromDB(
  id: string
): Promise<PersistedClassroomData | null> {
  const classroom = await db.query.classrooms.findFirst({
    where: eq(classrooms.id, id),
  });

  if (!classroom) return null;

  return {
    id: classroom.id,
    stage: classroom.stageData as Stage,
    scenes: classroom.scenesData as Scene[],
    createdAt: classroom.createdAt.toISOString(),
  };
}

// 兼容旧API：保留文件系统读取作为fallback
export async function readClassroom(id: string): Promise<PersistedClassroomData | null> {
  // 先尝试从数据库读取
  const fromDB = await readClassroomFromDB(id);
  if (fromDB) return fromDB;

  // fallback到文件系统（迁移期）
  return readClassroomFromFile(id);
}
```

### 3.2 元数据提取（保持不变）

**生成课程时自动提取元数据**：

```typescript
// lib/server/classroom-metadata-extractor.ts

export interface ClassroomMetadata {
  title: string;
  description: string;
  subject?: string;
  gradeLevel?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  keywords: string[];
  tags: string[];

  // 统计信息
  scenesCount: number;
  durationMinutes: number;
  hasSlides: boolean;
  hasQuiz: boolean;
  hasInteractive: boolean;
  hasPBL: boolean;
  hasTTS: boolean;
  hasImageGeneration: boolean;
  hasVideoGeneration: boolean;

  // 知识点
  knowledgePoints: Array<{
    edukgUri: string;
    name: string;
    isPrimary: boolean;
    relevanceScore: number;
  }>;
}

export async function extractMetadataFromClassroom(
  classroom: PersistedClassroomData,
  userRequirements: GenerateClassroomInput
): Promise<ClassroomMetadata> {
  const { stage, scenes } = classroom;

  // 1. 提取标题（从stage或AI生成）
  const title = stage.title || userRequirements.requirement.slice(0, 100);

  // 2. 生成描述（AI总结）
  const description = await generateDescription(classroom);

  // 3. 分类信息
  const subject = userRequirements.subject || inferSubject(scenes);
  const gradeLevel = userRequirements.grade || inferGradeLevel(scenes);
  const difficulty = inferDifficulty(scenes);

  // 4. 提取关键词（AI或NLP）
  const keywords = await extractKeywords(classroom);

  // 5. 生成标签
  const tags = generateTags(scenes, userRequirements);

  // 6. 统计信息
  const scenesCount = scenes.length;
  const durationMinutes = estimateDuration(scenes);
  const hasSlides = scenes.some(s => s.type === 'slides');
  const hasQuiz = scenes.some(s => s.type === 'quiz');
  const hasInteractive = scenes.some(s => s.type === 'interactive');
  const hasPBL = scenes.some(s => s.type === 'pbl');
  const hasTTS = scenes.some(s => s.actions?.some(a => a.type === 'speech'));
  const hasImageGeneration = scenes.some(s => s.actions?.some(a => a.type === 'image'));
  const hasVideoGeneration = scenes.some(s => s.actions?.some(a => a.type === 'video'));

  // 7. 知识点关联（调用EduKG）
  const knowledgePoints = await extractKnowledgePoints(classroom, subject);

  return {
    title,
    description,
    subject,
    gradeLevel,
    difficulty,
    keywords,
    tags,
    scenesCount,
    durationMinutes,
    hasSlides,
    hasQuiz,
    hasInteractive,
    hasPBL,
    hasTTS,
    hasImageGeneration,
    hasVideoGeneration,
    knowledgePoints,
  };
}

// 辅助函数
async function generateDescription(classroom: PersistedClassroomData): Promise<string> {
  // 使用LLM总结课程内容
  const prompt = `请为以下课程生成一个简短的描述（50字以内）：\n${JSON.stringify(classroom.stage)}`;
  const result = await callLLM(prompt);
  return result.slice(0, 200);
}

function inferSubject(scenes: Scene[]): string {
  // 从场景内容推断科目
  // ...
  return 'math';
}

function inferGradeLevel(scenes: Scene[]): string {
  // 从内容难度推断年级
  // ...
  return 'MIDDLE_2';
}

function inferDifficulty(scenes: Scene[]): 'beginner' | 'intermediate' | 'advanced' {
  // 根据内容复杂度推断难度
  // ...
  return 'intermediate';
}

async function extractKeywords(classroom: PersistedClassroomData): Promise<string[]> {
  // 使用NLP提取关键词
  // ...
  return [];
}

function generateTags(scenes: Scene[], requirements: GenerateClassroomInput): string[] {
  const tags: string[] = [];

  if (requirements.enableWebSearch) tags.push('web-search');
  if (requirements.enableImageGeneration) tags.push('with-images');
  if (requirements.enableVideoGeneration) tags.push('with-videos');
  if (requirements.enableTTS) tags.push('with-tts');

  return tags;
}

function estimateDuration(scenes: Scene[]): number {
  // 估算总时长（每个场景平均5分钟）
  return scenes.length * 5;
}

async function extractKnowledgePoints(
  classroom: PersistedClassroomData,
  subject?: string
): Promise<Array<{ edukgUri: string; name: string; isPrimary: boolean; relevanceScore: number }>> {
  // 调用EduKG API识别知识点
  const edukgService = new EduKGService();

  // 从课程内容中提取关键词
  const keywords = await extractKeywords(classroom);

  // 搜索相关的知识点
  const knowledgePoints: Array<{ edukgUri: string; name: string; isPrimary: boolean; relevanceScore: number }> = [];

  for (const keyword of keywords.slice(0, 5)) {
    const results = await edukgService.searchInstances(keyword, subject || 'math');

    for (const result of results.slice(0, 2)) {
      knowledgePoints.push({
        edukgUri: result.uri,
        name: result.name,
        isPrimary: result.score > 0.8,
        relevanceScore: result.score,
      });
    }
  }

  return knowledgePoints;
}
```

### 3.2 保存元数据

```typescript
// lib/server/classroom-metadata-service.ts

export async function saveClassroomMetadata(
  classroomId: string,
  metadata: ClassroomMetadata,
  organizationId?: string
): Promise<void> {
  await db.insert(classroomMetadataTable).values({
    id: uuid(),
    organizationId,
    classroomId,
    title: metadata.title,
    description: metadata.description,
    subject: metadata.subject,
    gradeLevel: metadata.gradeLevel,
    difficulty: metadata.difficulty,
    keywords: metadata.keywords,
    tags: metadata.tags,
    scenesCount: metadata.scenesCount,
    durationMinutes: metadata.durationMinutes,
    hasSlides: metadata.hasSlides,
    hasQuiz: metadata.hasQuiz,
    hasInteractive: metadata.hasInteractive,
    hasPBL: metadata.hasPBL,
    hasTTS: metadata.hasTTS,
    hasImageGeneration: metadata.hasImageGeneration,
    hasVideoGeneration: metadata.hasVideoGeneration,
  }).onConflictDoNothing(); // 如果已存在则不插入

  // 获取刚插入的metadata_id
  const metadataRecord = await db.query.classroomMetadataTable.findFirst({
    where: eq(classroomMetadataTable.classroomId, classroomId),
  });

  if (!metadataRecord) return;

  // 保存知识点关联
  for (const kp of metadata.knowledgePoints) {
    await db.insert(classroomKnowledgePointsTable).values({
      id: uuid(),
      classroomMetadataId: metadataRecord.id,
      edukgUri: kp.edukgUri,
      knowledgePointName: kp.name,
      isPrimary: kp.isPrimary,
      relevanceScore: kp.relevanceScore,
    }).onConflictDoNothing();
  }
}
```

### 3.3 全文搜索API

```typescript
// app/api/classrooms/search/route.ts

import { db } from '@/lib/db';
import { classroomMetadataTable, classroomStatsTable } from '@/lib/db/schema';
import { sql, ilike, and, or, desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || '';
  const subject = searchParams.get('subject');
  const gradeLevel = searchParams.get('gradeLevel');
  const organizationId = searchParams.get('organizationId');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  // 构建查询条件
  const conditions = [];

  // 1. 全文搜索（优先级最高）
  if (query) {
    conditions.push(
      sql`classroom_metadata.search_vector @@ plainto_tsquery('simple', ${query})`
    );
  }

  // 2. 精确筛选
  if (subject) {
    conditions.push(eq(classroomMetadataTable.subject, subject));
  }
  if (gradeLevel) {
    conditions.push(eq(classroomMetadataTable.gradeLevel, gradeLevel));
  }
  if (organizationId) {
    conditions.push(eq(classroomMetadataTable.organizationId, organizationId));
  }

  // 执行查询
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [classrooms, total] = await Promise.all([
    db
      .select({
        metadata: classroomMetadataTable,
        stats: classroomStatsTable,
      })
      .from(classroomMetadataTable)
      .leftJoin(classroomStatsTable, eq(classroomStatsTable.classroomMetadataId, classroomMetadataTable.id))
      .where(where)
      .orderBy(desc(classroomStatsTable.viewCount), desc(classroomMetadataTable.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),

    db
      .select({ count: sql<number>`count(*)` })
      .from(classroomMetadataTable)
      .where(where),
  ]);

  return Response.json({
    classrooms: classrooms.map(c => ({
      id: c.metadata.classroomId,
      title: c.metadata.title,
      description: c.metadata.description,
      subject: c.metadata.subject,
      gradeLevel: c.metadata.gradeLevel,
      difficulty: c.metadata.difficulty,
      scenesCount: c.metadata.scenesCount,
      durationMinutes: c.metadata.durationMinutes,
      viewCount: c.stats?.viewCount || 0,
      avgRating: c.stats?.avgRating || null,
      createdAt: c.metadata.createdAt,
    })),
    pagination: {
      page,
      limit,
      total: total[0].count,
      totalPages: Math.ceil(total[0].count / limit),
    },
  });
}
```

### 3.4 相似课程推荐

```typescript
// app/api/classrooms/[id]/similar/route.ts

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const classroomId = params.id;
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '10');

  // 获取当前课程的元数据
  const currentClassroom = await db.query.classroomMetadataTable.findFirst({
    where: eq(classroomMetadataTable.classroomId, classroomId),
    with: {
      knowledgePoints: true,
    },
  });

  if (!currentClassroom) {
    return Response.json({ error: 'Classroom not found' }, { status: 404 });
  }

  // 基于知识点的相似度推荐
  const kpUris = currentClassroom.knowledgePoints.map(kp => kp.edukgUri);

  const similarClassrooms = await db
    .select({
      metadata: classroomMetadataTable,
      similarityCount: sql<number>`count(*)`,
    })
    .from(classroomKnowledgePointsTable)
    .innerJoin(
      classroomMetadataTable,
      eq(classroomMetadataTable.id, classroomKnowledgePointsTable.classroomMetadataId)
    )
    .where(
      and(
        eq(classroomKnowledgePointsTable.edukgUri, sql.any(kpUris)), // 至少有一个共同知识点
        sql`${classroomMetadataTable.classroomId} != ${classroomId}`, // 排除自己
        currentClassroom.subject ? eq(classroomMetadataTable.subject, currentClassroom.subject) : undefined, // 同一科目
        currentClassroom.gradeLevel ? eq(classroomMetadataTable.gradeLevel, currentClassroom.gradeLevel) : undefined, // 同一年级
      )
    )
    .groupBy(classroomMetadataTable.id)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  return Response.json({
    similar: similarClassrooms.map(c => ({
      id: c.metadata.classroomId,
      title: c.metadata.title,
      description: c.metadata.description,
      similarityCount: c.similarityCount,
      viewCount: c.metadata.viewCount,
    })),
  });
}
```

### 3.5 课程模板功能

```typescript
// app/api/classrooms/[id]/save-as-template/route.ts

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const classroomId = params.id;
  const { name, description, category, organizationId } = await req.json();

  // 读取课程数据
  const classroom = await readClassroom(classroomId);
  if (!classroom) {
    return Response.json({ error: 'Classroom not found' }, { status: 404 });
  }

  // 提取结构（不包含具体内容）
  const template = {
    outlineStructure: classroom.stage.outline,
    sceneTemplates: classroom.scenes.map(s => ({
      type: s.type,
      outline: s.outline,
      // 不包含具体的 content/actions
    })),
    agentConfiguration: classroom.stage.agentConfiguration,
  };

  // 保存模板
  const templateId = uuid();
  await db.insert(classroomTemplatesTable).values({
    id: templateId,
    organizationId,
    name,
    description,
    category,
    outlineStructure: template.outlineStructure,
    sceneTemplates: template.sceneTemplates,
    agentConfiguration: template.agentConfiguration,
  });

  return Response.json({ templateId });
}

// app/api/classrooms/templates/route.ts

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const organizationId = searchParams.get('organizationId');
  const category = searchParams.get('category');

  const templates = await db.query.classroomTemplatesTable.findMany({
    where: and(
      organizationId ? eq(classroomTemplatesTable.organizationId, organizationId) : undefined,
      eq(classroomTemplatesTable.isPublic, true),
      category ? eq(classroomTemplatesTable.category, category) : undefined,
    ),
    orderBy: desc(classroomTemplatesTable.usageCount),
  });

  return Response.json({ templates });
}

// app/api/generate-classroom/from-template/route.ts

export async function POST(req: NextRequest) {
  const { templateId, requirement } = await req.json();

  // 获取模板
  const template = await db.query.classroomTemplatesTable.findFirst({
    where: eq(classroomTemplatesTable.id, templateId),
  });

  if (!template) {
    return Response.json({ error: 'Template not found' }, { status: 404 });
  }

  // 基于模板生成课程（复用结构，填充新内容）
  const result = await generateClassroomFromTemplate(
    template,
    requirement
  );

  // 更新使用次数
  await db.update(classroomTemplatesTable)
    .set({ usageCount: sql`${classroomTemplatesTable.usageCount} + 1` })
    .where(eq(classroomTemplatesTable.id, templateId));

  return Response.json(result);
}
```

---

## 4. API路由设计

```
app/api/
├── classrooms/
│   ├── search/
│   │   └── GET /           # 全文搜索课程
│   ├── :id/
│   │   ├── metadata/
│   │   │   └── GET /       # 获取课程元数据
│   │   ├── similar/
│   │   │   └── GET /       # 获取相似课程
│   │   ├── save-as-template/
│   │   │   └── POST /      # 保存为模板
│   │   └── favorite/
│   │       ├── POST /      # 收藏课程
│   │       └── DELETE /    # 取消收藏
│   └── templates/
│       ├── GET /           # 获取模板列表
│       └── from-template/
│           └── POST /      # 基于模板生成
│
├── organizations/
│   └── :id/
│       └── classrooms/
│           ├── GET /       # 获取机构课程列表（支持筛选、排序）
│           └── stats/
│               └── GET /   # 机构课程统计
│
└── user/
    └── favorites/
        └── GET /           # 获取用户收藏列表
```

---

## 5. 前端界面优化

### 5.1 课程搜索页面

```tsx
// app/classrooms/search/page.tsx

export default function ClassroomSearchPage() {
  return (
    <div className="container">
      <SearchBar placeholder="搜索课程标题、描述、关键词..." />

      <FilterPanel>
        <FilterGroup label="科目">
          <FilterOption value="math">数学</FilterOption>
          <FilterOption value="chinese">语文</FilterOption>
          <FilterOption value="english">英语</FilterOption>
        </FilterGroup>

        <FilterGroup label="年级">
          <FilterOption value="PRIMARY_1">小学一年级</FilterOption>
          {/* ... */}
        </FilterGroup>

        <FilterGroup label="难度">
          <FilterOption value="beginner">入门</FilterOption>
          <FilterOption value="intermediate">中等</FilterOption>
          <FilterOption value="advanced">进阶</FilterOption>
        </FilterGroup>

        <SortBy>
          <Option value="relevance">相关度</Option>
          <Option value="views">浏览量</Option>
          <Option value="rating">评分</Option>
          <Option value="latest">最新</Option>
        </SortBy>
      </FilterPanel>

      <ClassroomList>
        {classrooms.map(c => (
          <ClassroomCard
            key={c.id}
            title={c.title}
            description={c.description}
            subject={c.subject}
            gradeLevel={c.gradeLevel}
            difficulty={c.difficulty}
            scenesCount={c.scenesCount}
            durationMinutes={c.durationMinutes}
            viewCount={c.viewCount}
            avgRating={c.avgRating}
            tags={c.tags}
          />
        ))}
      </ClassroomList>

      <Pagination />
    </div>
  );
}
```

### 5.2 课程详情页增强

```tsx
// app/classroom/[id]/page.tsx

export default function ClassroomDetailPage({ params }: { params: { id: string } }) {
  const classroom = useClassroom(params.id);
  const metadata = useClassroomMetadata(params.id);
  const similarClassrooms = useSimilarClassrooms(params.id);

  return (
    <div>
      {/* 课程播放器 */}
      <ClassroomPlayer classroom={classroom} />

      {/* 课程信息 */}
      <ClassroomInfo
        title={metadata.title}
        description={metadata.description}
        subject={metadata.subject}
        gradeLevel={metadata.gradeLevel}
        difficulty={metadata.difficulty}
        durationMinutes={metadata.durationMinutes}
      />

      {/* 知识点 */}
      <KnowledgePointsList
        knowledgePoints={metadata.knowledgePoints}
      />

      {/* 统计数据 */}
      <ClassroomStats
        viewCount={metadata.viewCount}
        favoriteCount={metadata.favoriteCount}
        avgRating={metadata.avgRating}
      />

      {/* 相似课程推荐 */}
      <SimilarClassrooms classrooms={similarClassrooms} />

      {/* 操作按钮 */}
      <ActionBar>
        <FavoriteButton />
        <ShareButton />
        <SaveAsTemplateButton />
      </ActionBar>
    </div>
  );
}
```

### 5.3 机构课程管理页面

```tsx
// app/organization/[organizationId]/classrooms/page.tsx

export default function OrganizationClassroomsPage() {
  return (
    <div>
      <h1>课程管理</h1>

      {/* 统计卡片 */}
      <StatsGrid>
        <StatCard label="总课程数" value={totalClassrooms} />
        <StatCard label="总浏览量" value={totalViews} />
        <StatCard label="平均评分" value={avgRating} />
        <StatCard label="转化率" value={conversionRate} />
      </StatsGrid>

      {/* 课程列表 */}
      <ClassroomTable
        columns={[
          { key: 'title', label: '课程标题' },
          { key: 'subject', label: '科目' },
          { key: 'gradeLevel', label: '年级' },
          { key: 'viewCount', label: '浏览量' },
          { key: 'avgRating', label: '评分' },
          { key: 'createdAt', label: '创建时间' },
          { key: 'actions', label: '操作' },
        ]}
        data={classrooms}
        sortable
        filterable
      />

      {/* 批量操作 */}
      <BatchActions>
        <Button>批量编辑</Button>
        <Button>批量删除</Button>
        <Button>导出数据</Button>
      </BatchActions>
    </div>
  );
}
```

---

## 6. 数据迁移方案

### 6.1 迁移策略

**三阶段迁移**：

1. **双写期**（1-2周）：新课程同时写入数据库和文件
2. **灰度迁移期**（2-4周）：后台任务迁移现有课程
3. **完全切换**（1周）：验证后，完全使用数据库

### 6.2 迁移脚本

```typescript
// scripts/migrate-classrooms-to-db.ts

import { promises as fs } from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { classrooms } from '@/lib/db/schema';
import { readClassroomFromFile } from '@/lib/server/classroom-storage';
import { extractMetadata } from '@/lib/server/classroom-metadata-extractor';

const CLASSROOMS_DIR = path.join(process.cwd(), 'data', 'classrooms');

async function migrateAllClassrooms() {
  // 1. 读取所有课程文件
  const files = await fs.readdir(CLASSROOMS_DIR);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  console.log(`Found ${jsonFiles.length} classroom files to migrate`);

  let migrated = 0;
  let failed = 0;

  for (const file of jsonFiles) {
    const classroomId = file.replace('.json', '');

    try {
      // 2. 从文件读取课程
      const classroom = await readClassroomFromFile(classroomId);
      if (!classroom) {
        console.log(`Skipping ${classroomId}: not found`);
        continue;
      }

      // 3. 提取元数据
      const metadata = await extractMetadata(classroom, {
        requirement: 'migrated', // 简化处理
      });

      // 4. 写入数据库
      await db.insert(classrooms).values({
        id: classroom.id,
        title: metadata.title,
        description: metadata.description,
        requirement: 'migrated',
        subject: metadata.subject,
        gradeLevel: metadata.gradeLevel,
        difficulty: metadata.difficulty,
        stageData: classroom.stage as any,
        scenesData: classroom.scenes as any,
        keywords: metadata.keywords,
        tags: metadata.tags,
        hasSlides: metadata.hasSlides,
        hasQuiz: metadata.hasQuiz,
        hasInteractive: metadata.hasInteractive,
        hasPBL: metadata.hasPBL,
        durationMinutes: metadata.durationMinutes,
      }).onConflictDoNothing(); // 如果已存在则跳过

      migrated++;
      console.log(`✅ Migrated ${classroomId} (${migrated}/${jsonFiles.length})`);

    } catch (error) {
      failed++;
      console.error(`❌ Failed to migrate ${classroomId}:`, error);
    }
  }

  console.log(`\nMigration complete: ${migrated} succeeded, ${failed} failed`);
}

// 运行迁移
migrateAllClassrooms().catch(console.error);
```

### 6.3 双写实现（迁移期）

```typescript
// lib/server/classroom-generation.ts (修改)

export async function generateClassroom(
  input: GenerateClassroomInput
): Promise<GenerateClassroomResult> {
  // ... 生成逻辑 ...

  const result = {
    id: classroomId,
    stage,
    scenes,
    createdAt: new Date().toISOString(),
  };

  const url = `${baseUrl}/classroom/${classroomId}`;

  // 双写：同时保存到文件和数据库
  try {
    // 1. 保存到文件（保持兼容）
    await persistClassroomToFile(result, baseUrl);

    // 2. 保存到数据库（新方式）
    await persistClassroomToDB({
      title: input.requirement.slice(0, 100),
      requirement: input.requirement,
      generationConfig: {
        language: input.language,
        enableWebSearch: input.enableWebSearch,
        enableImageGeneration: input.enableImageGeneration,
        enableVideoGeneration: input.enableVideoGeneration,
        enableTTS: input.enableTTS,
        agentMode: input.agentMode,
        organizationId: input.organizationId,
        clonedVoiceId: input.clonedVoiceId,
      },
      stage: result.stage,
      scenes: result.scenes,
    });

    console.log(`✅ Classroom saved to both file and DB: ${classroomId}`);
  } catch (error) {
    console.error(`❌ Failed to save classroom:`, error);
    // 至少保证文件保存成功
    await persistClassroomToFile(result, baseUrl);
  }

  return {
    id: classroomId,
    url,
    stage: result.stage,
    scenes: result.scenes,
    scenesCount: result.scenes.length,
    createdAt: result.createdAt,
  };
}
```

### 6.4 验证脚本

```typescript
// scripts/verify-migration.ts

async function verifyMigration() {
  // 1. 统计文件数量
  const files = await fs.readdir(CLASSROOMS_DIR);
  const fileCount = files.filter(f => f.endsWith('.json')).length;

  // 2. 统计数据库数量
  const dbResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(classrooms);
  const dbCount = dbResult[0].count;

  // 3. 抽样对比
  const sampleFiles = files.slice(0, 10);
  for (const file of sampleFiles) {
    const classroomId = file.replace('.json', '');

    const fromFile = await readClassroomFromFile(classroomId);
    const fromDB = await readClassroomFromDB(classroomId);

    if (!fromFile && !fromDB) continue;
    if (!fromFile || !fromDB) {
      console.error(`❌ Mismatch for ${classroomId}`);
      continue;
    }

    // 对比关键字段
    const scenesMatch = fromFile.scenes.length === fromDB.scenes.length;
    if (!scenesMatch) {
      console.error(`❌ Scene count mismatch for ${classroomId}`);
    }
  }

  console.log(`\nVerification:`);
  console.log(`- Files: ${fileCount}`);
  console.log(`- Database: ${dbCount}`);
  console.log(`- Match rate: ${dbCount / fileCount * 100}%`);
}

verifyMigration().catch(console.error);
```

---

## 7. 实施计划

### Phase 1: 数据库迁移（1周）

- [ ] 创建classrooms表结构（Drizzle schema）
- [ ] 编写数据库迁移脚本
- [ ] 实现双写逻辑（文件+数据库）
- [ ] 测试新课程生成流程

### Phase 2: 灰度迁移（2-4周）

- [ ] 编写迁移脚本（文件→数据库）
- [ ] 后台任务：批量迁移现有课程
- [ ] 运行验证脚本，确保数据一致性
- [ ] 监控性能和错误率

### Phase 3: 元数据增强（2周）

- [ ] 实现元数据提取服务
- [ ] 集成EduKG知识点关联
- [ ] 为已迁移课程补充元数据
- [ ] 建立搜索向量

### Phase 4: 完全切换（1周）

- [ ] 灰度验证：所有功能正常
- [ ] 移除文件系统写入逻辑
- [ ] 更新所有读取逻辑使用数据库
- [ ] 备份并删除旧文件（可选）

### Phase 5: 搜索与推荐（2周）

- [ ] 实现全文搜索API
- [ ] 实现相似课程推荐
- [ ] 前端搜索界面

### Phase 6: 统计与模板（2周）

- [ ] 实现使用统计追踪
- [ ] 实现课程模板功能
- [ ] 机构课程管理界面

**总工期**：10-14周

---

## 8. 预期效果

### 7.1 搜索效率提升

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 搜索响应时间 | N/A（无法搜索） | <200ms |
| 搜索准确率 | N/A | >80% |
| 支持的搜索维度 | 2个（科目、年级） | 10+个 |

### 7.2 课程重用率提升

- **课程模板使用率**：预计30%的课程使用模板生成
- **相似课程参考**：减少50%的重复生成
- **开发效率**：课程生成时间减少30%

### 7.3 用户体验提升

- **搜索到相关课程的概率**：从0%提升到>70%
- **课程满意度**：通过推荐和评分提升15%
- **留存率**：提升20%

---

## 8. 风险与挑战

| 风险 | 缓解措施 |
|------|---------|
| 现有课程元数据缺失 | 后台任务自动提取+人工审核 |
| EduKG API限制 | 本地缓存+请求合并 |
| 全文搜索性能 | PostgreSQL GIN索引优化 |
| 数据迁移影响服务 | 灰度迁移，双写新旧表 |

---

## 9. 总结

### 核心变更 ⭐

**从文件系统迁移到数据库存储**：

| 方面 | 旧方案 | 新方案 |
|------|--------|--------|
| **存储位置** | `data/classrooms/{id}.json` | PostgreSQL数据库 |
| **数据格式** | JSON文件 | JSONB列 |
| **可搜索性** | ❌ 无法搜索 | ✅ 全文搜索、多维度筛选 |
| **可扩展性** | ❌ 难以扩展 | ✅ 添加字段、关联表 |
| **性能** | ❌ 文件I/O慢 | ✅ 数据库查询+缓存 |
| **可靠性** | ❌ 文件可能丢失 | ✅ 数据库事务+备份 |
| **分布式** | ❌ 单机文件 | ✅ 数据库集群 |

### 解决的问题

✅ **搜索困难** → 支持全文搜索（标题、描述、内容）
✅ **无法重用** → 相似课程推荐+模板功能
✅ **缺少元数据** → 完整的元数据体系（科目、年级、难度、知识点）
✅ **质量不明** → 使用统计和评分系统
✅ **性能瓶颈** → 数据库查询优化+索引
✅ **难以维护** → 结构化存储+关联查询

### 技术亮点

- **JSONB存储**：保留JSON灵活性，同时获得数据库性能
- **全文搜索**：PostgreSQL tsvector + GIN索引
- **知识点关联**：集成EduKG知识图谱
- **向量嵌入**：（可选）支持语义搜索
- **平滑迁移**：双写+灰度，确保零停机

---

**文档状态**：✅ 待确认
**下一步**：评审方案，开始实施
