-- Migration: Add classrooms tables
-- Created: 2026-03-29
-- Description: Migrate classrooms from file system to database storage

-- ============================================
-- 1. 课程主表 - 替代文件系统存储
-- ============================================

CREATE TABLE IF NOT EXISTS classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 基本信息
  title TEXT NOT NULL,
  description TEXT,
  language TEXT DEFAULT 'zh-CN',

  -- 分类信息
  subject TEXT, -- math/chinese/english...
  grade_level TEXT, -- PRIMARY_1~6, MIDDLE_1~3, HIGH_1~3
  difficulty TEXT, -- beginner/intermediate/advanced

  -- 生成参数
  requirement TEXT NOT NULL,
  generation_config JSONB,

  -- 课程内容（JSONB存储）
  stage_data JSONB NOT NULL,
  scenes_data JSONB NOT NULL,
  media_resources JSONB,

  -- 内容统计
  scenes_count INTEGER,
  duration_minutes INTEGER,
  has_slides BOOLEAN DEFAULT FALSE,
  has_quiz BOOLEAN DEFAULT FALSE,
  has_interactive BOOLEAN DEFAULT FALSE,
  has_pbl BOOLEAN DEFAULT FALSE,
  has_tts BOOLEAN DEFAULT FALSE,
  has_image_generation BOOLEAN DEFAULT FALSE,
  has_video_generation BOOLEAN DEFAULT FALSE,

  -- 搜索优化
  keywords JSONB,
  tags JSONB,
  search_vector TEXT,

  -- 所属机构
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- 状态
  status TEXT DEFAULT 'completed', -- pending/processing/completed/failed
  error_message TEXT,

  -- 元数据
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 索引：基础查询
CREATE INDEX IF NOT EXISTS idx_classrooms_org ON classrooms(organization_id);
CREATE INDEX IF NOT EXISTS idx_classrooms_subject ON classrooms(subject);
CREATE INDEX IF NOT EXISTS idx_classrooms_grade ON classrooms(grade_level);
CREATE INDEX IF NOT EXISTS idx_classrooms_difficulty ON classrooms(difficulty);
CREATE INDEX IF NOT EXISTS idx_classrooms_status ON classrooms(status);
CREATE INDEX IF NOT EXISTS idx_classrooms_created ON classrooms(created_at DESC);

-- 全文搜索索引（PostgreSQL tsvector）
CREATE INDEX IF NOT EXISTS idx_classrooms_search ON classrooms USING gin(search_vector);

-- JSONB索引（优化JSON查询）
CREATE INDEX IF NOT EXISTS idx_classrooms_scenes ON classrooms USING gin(scenes_data);
CREATE INDEX IF NOT EXISTS idx_classrooms_stage ON classrooms USING gin(stage_data);

-- ============================================
-- 2. 课程知识点关联表
-- ============================================

CREATE TABLE IF NOT EXISTS classroom_knowledge_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  edukg_uri TEXT NOT NULL, -- EduKG实体URI
  knowledge_point_name TEXT, -- 知识点名称（冗余，提升性能）
  is_primary BOOLEAN DEFAULT FALSE, -- 是否为主要知识点
  relevance_score TEXT, -- 相关性评分

  created_at TIMESTAMP DEFAULT NOW(),

  -- 唯一约束：同一课程+知识点只能有一条记录
  CONSTRAINT unique_classroom_kp UNIQUE (classroom_id, edukg_uri)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_classroom_kp_classroom ON classroom_knowledge_points(classroom_id);
CREATE INDEX IF NOT EXISTS idx_classroom_kp_uri ON classroom_knowledge_points(edukg_uri);
CREATE INDEX IF NOT EXISTS idx_classroom_kp_primary ON classroom_knowledge_points(is_primary) WHERE is_primary = TRUE;

-- ============================================
-- 3. 课程使用统计表
-- ============================================

CREATE TABLE IF NOT EXISTS classroom_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,

  -- 浏览数据
  view_count INTEGER DEFAULT 0, -- 总浏览次数
  unique_viewers INTEGER DEFAULT 0, -- 独立访客数
  avg_completion_rate TEXT, -- 平均完成率
  avg_duration_seconds INTEGER, -- 平均观看时长（秒）

  -- 互动数据
  share_count INTEGER DEFAULT 0, -- 分享次数
  favorite_count INTEGER DEFAULT 0, -- 收藏次数
  comment_count INTEGER DEFAULT 0, -- 评论数

  -- 转化数据（针对机构）
  conversion_count INTEGER DEFAULT 0, -- 转化次数
  conversion_rate TEXT, -- 转化率

  -- 质量评分
  avg_rating TEXT, -- 平均评分
  rating_count INTEGER DEFAULT 0, -- 评分人数

  -- 时间维度
  last_viewed_at TIMESTAMP,
  last_shared_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- 唯一约束：每个课程只有一条统计记录
  CONSTRAINT unique_classroom_stats UNIQUE (classroom_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_classroom_stats_views ON classroom_stats(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_classroom_stats_rating ON classroom_stats(avg_rating DESC) WHERE avg_rating IS NOT NULL;

-- ============================================
-- 4. 全文搜索触发器
-- ============================================

-- 自动更新search_vector的函数
CREATE OR REPLACE FUNCTION classrooms_search_trigger() RETURNS trigger AS $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.requirement, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(new.keywords::TEXT[], ' '), '')), 'C');
  return new;
end
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS classrooms_search_update ON classrooms;
CREATE TRIGGER classrooms_search_update
  BEFORE INSERT OR UPDATE ON classrooms
  FOR EACH ROW
  EXECUTE FUNCTION classrooms_search_trigger();

-- ============================================
-- 5. 更新时间触发器
-- ============================================

-- 自动更新updated_at的函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
DROP TRIGGER IF EXISTS update_classrooms_updated_at ON classrooms;
CREATE TRIGGER update_classrooms_updated_at
  BEFORE UPDATE ON classrooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_classroom_stats_updated_at ON classroom_stats;
CREATE TRIGGER update_classroom_stats_updated_at
  BEFORE UPDATE ON classroom_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. 添加注释
-- ============================================

COMMENT ON TABLE classrooms IS '课程主表 - 替代文件系统存储完整课程数据';
COMMENT ON TABLE classroom_knowledge_points IS '课程知识点关联表 - 关联EduKG知识图谱';
COMMENT ON TABLE classroom_stats IS '课程使用统计表 - 追踪课程使用情况和质量评分';

COMMENT ON COLUMN classrooms.stage_data IS '完整的Stage数据（JSONB）';
COMMENT ON COLUMN classrooms.scenes_data IS '完整的Scenes数组（JSONB）';
COMMENT ON COLUMN classrooms.search_vector IS '全文搜索向量（tsvector）';
COMMENT ON COLUMN classroom_knowledge_points.edukg_uri IS 'EduKG知识图谱实体URI';
