-- ============================================
-- Migration: Add classroom_templates table
-- Description: 课程模板表，用于保存可重用的课程结构
-- ============================================

-- 创建课程模板表
CREATE TABLE IF NOT EXISTS classroom_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  created_by_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  outline_structure JSONB,
  scene_templates JSONB,
  agent_configuration JSONB,
  applicable_subjects TEXT[],
  applicable_grades TEXT[],
  difficulty TEXT,
  usage_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_classroom_templates_org ON classroom_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_classroom_templates_usage ON classroom_templates(usage_count);
CREATE INDEX IF NOT EXISTS idx_classroom_templates_created ON classroom_templates(created_at);

-- 添加自动更新 updated_at 的触发器
CREATE OR REPLACE FUNCTION update_classroom_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_classroom_templates_updated_at ON classroom_templates;
CREATE TRIGGER trigger_update_classroom_templates_updated_at
  BEFORE UPDATE ON classroom_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_classroom_templates_updated_at();

-- 添加注释
COMMENT ON TABLE classroom_templates IS '课程模板表，保存可重用的课程结构（只保存结构，不保存具体内容）';
COMMENT ON COLUMN classroom_templates.outline_structure IS '课程大纲结构（JSON）';
COMMENT ON COLUMN classroom_templates.scene_templates IS '场景模板列表（只包含类型、标题、大纲，不包含具体内容）';
COMMENT ON COLUMN classroom_templates.usage_count IS '使用次数（按使用次数排序时使用）';
