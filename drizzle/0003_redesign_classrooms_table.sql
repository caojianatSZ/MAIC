-- Migration: Redesign classrooms table - metadata only
-- Created: 2026-03-29
-- Description: 重新设计classrooms表，只存储元数据和知识点，不存完整内容

-- ============================================
-- 1. 删除旧表
-- ============================================

DROP TABLE IF EXISTS classroom_stats CASCADE;
DROP TABLE IF EXISTS classroom_knowledge_points CASCADE;
DROP TABLE IF EXISTS classrooms CASCADE;

-- ============================================
-- 2. 课程主表 - 只存储元数据
-- ============================================

CREATE TABLE IF NOT EXISTS classrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 基本信息
  title TEXT NOT NULL,
  description TEXT,
  requirement TEXT NOT NULL, -- 原始需求

  -- 分类信息
  subject TEXT, -- math/chinese/english...
  grade_level TEXT, -- PRIMARY_1~6, MIDDLE_1~3, HIGH_1~3
  difficulty TEXT, -- beginner/intermediate/advanced

  -- ⭐ 核心字段：知识点（用于搜索、推荐、重用）
  knowledge_point_uris TEXT[] NOT NULL DEFAULT '{}', -- EduKG URI数组
  primary_knowledge_point TEXT, -- 主要知识点

  -- 内容统计（不存完整内容）
  scenes_count INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER,

  -- 场景类型标记
  has_slides BOOLEAN DEFAULT FALSE,
  has_quiz BOOLEAN DEFAULT FALSE,
  has_interactive BOOLEAN DEFAULT FALSE,
  has_pbl BOOLEAN DEFAULT FALSE,
  has_tts BOOLEAN DEFAULT FALSE,

  -- 媒体资源清单（文件路径引用）
  main_json_file TEXT NOT NULL, -- data/classrooms/{id}.json
  audio_files TEXT[] DEFAULT '{}', -- 音频文件路径数组
  image_files TEXT[] DEFAULT '{}', -- 图片文件路径数组
  video_files TEXT[] DEFAULT '{}', -- 视频文件路径数组

  -- 搜索优化
  keywords TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
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

-- 索引：知识点搜索（核心！）
CREATE INDEX IF NOT EXISTS idx_classrooms_knowledge_points ON classrooms USING gin(knowledge_point_uris);
CREATE INDEX IF NOT EXISTS idx_classrooms_primary_kp ON classrooms(primary_knowledge_point);

-- 索引：全文搜索
CREATE INDEX IF NOT EXISTS idx_classrooms_search ON classrooms USING gin(search_vector);

-- ============================================
-- 3. 课程知识点关联表（保留）
-- ============================================

CREATE TABLE IF NOT EXISTS classroom_knowledge_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  edukg_uri TEXT NOT NULL, -- EduKG实体URI
  knowledge_point_name TEXT, -- 知识点名称（冗余，提升性能）
  is_primary BOOLEAN DEFAULT FALSE, -- 是否为主要知识点
  relevance_score INTEGER, -- 相关性评分 0-100

  created_at TIMESTAMP DEFAULT NOW(),

  -- 唯一约束：同一课程+知识点只能有一条记录
  CONSTRAINT unique_classroom_kp UNIQUE (classroom_id, edukg_uri)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_classroom_kp_classroom ON classroom_knowledge_points(classroom_id);
CREATE INDEX IF NOT EXISTS idx_classroom_kp_uri ON classroom_knowledge_points(edukg_uri);
CREATE INDEX IF NOT EXISTS idx_classroom_kp_primary ON classroom_knowledge_points(is_primary) WHERE is_primary = TRUE;

-- ============================================
-- 4. 课程使用统计表（保留）
-- ============================================

CREATE TABLE IF NOT EXISTS classroom_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,

  -- 浏览数据
  view_count INTEGER DEFAULT 0,
  unique_viewers INTEGER DEFAULT 0,
  avg_completion_rate NUMERIC(5, 2),
  avg_duration_seconds INTEGER,

  -- 互动数据
  share_count INTEGER DEFAULT 0,
  favorite_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,

  -- 转化数据
  conversion_count INTEGER DEFAULT 0,
  conversion_rate NUMERIC(5, 2),

  -- 质量评分
  avg_rating NUMERIC(3, 2),
  rating_count INTEGER DEFAULT 0,

  -- 时间维度
  last_viewed_at TIMESTAMP,
  last_shared_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- 唯一约束
  CONSTRAINT unique_classroom_stats UNIQUE (classroom_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_classroom_stats_views ON classroom_stats(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_classroom_stats_rating ON classroom_stats(avg_rating DESC) WHERE avg_rating IS NOT NULL;

-- ============================================
-- 5. 全文搜索触发器
-- ============================================

-- 自动更新search_vector的函数
CREATE OR REPLACE FUNCTION classrooms_search_trigger() RETURNS trigger AS $$
begin
  new.search_vector :=
    setweight(to_tsvector('simple', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.requirement, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(new.keywords, ' '), '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(new.primary_knowledge_point, '')), 'A');
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
-- 6. 更新时间触发器
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
-- 7. 添加注释
-- ============================================

COMMENT ON TABLE classrooms IS '课程元数据表 - 只存储元数据和知识点，完整内容在文件系统';
COMMENT ON TABLE classroom_knowledge_points IS '课程知识点关联表 - 存储详细的知识点信息';
COMMENT ON TABLE classroom_stats IS '课程使用统计表 - 追踪浏览、互动、转化数据';

COMMENT ON COLUMN classrooms.knowledge_point_uris IS 'EduKG知识图谱URI数组，核心字段，用于搜索、推荐、重用';
COMMENT ON COLUMN classrooms.main_json_file IS '主JSON文件路径（data/classrooms/{id}.json），完整内容在此文件';
COMMENT ON COLUMN classrooms.audio_files IS '音频文件路径数组，实际文件在文件系统';
COMMENT ON COLUMN classrooms.image_files IS '图片文件路径数组，实际文件在文件系统';
COMMENT ON COLUMN classrooms.video_files IS '视频文件路径数组，实际文件在文件系统';
