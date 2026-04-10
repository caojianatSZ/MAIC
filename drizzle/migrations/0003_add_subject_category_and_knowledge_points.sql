-- 添加 subject_category 和 knowledge_points 列到 organization_classrooms 表
-- 执行时间: 2026-04-10

ALTER TABLE organization_classrooms ADD COLUMN IF NOT EXISTS subject_category VARCHAR(50);
ALTER TABLE organization_classrooms ADD COLUMN IF NOT EXISTS knowledge_points JSONB DEFAULT '[]'::jsonb;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_organization_classrooms_subject_category ON organization_classrooms(subject_category);
CREATE INDEX IF NOT EXISTS idx_organization_classrooms_knowledge_points ON organization_classrooms USING GIN(knowledge_points);

-- 添加注释
COMMENT ON COLUMN organization_classrooms.subject_category IS '科目分类：math, chinese, english等';
COMMENT ON COLUMN organization_classrooms.knowledge_points IS '知识点列表，包含 uri, name, isPrimary, relevanceScore';
