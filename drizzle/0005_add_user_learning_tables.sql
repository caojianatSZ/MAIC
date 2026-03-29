-- ============================================
-- Migration: Add User Learning System Tables
-- Description: 添加用户学习系统相关表
-- ============================================

-- 1. 扩展users表
ALTER TABLE users ADD COLUMN IF NOT EXISTS grade_level TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subjects TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);

-- 添加注释
COMMENT ON COLUMN users.grade_level IS '年级：PRIMARY_1~6, MIDDLE_1~3, HIGH_1~3';
COMMENT ON COLUMN users.subjects IS '科目数组：math, chinese, english, physics, chemistry, biology, history, geography, politics';
COMMENT ON COLUMN users.organization_id IS '所属机构ID';

-- 2. 创建用户知识点掌握情况表
CREATE TABLE IF NOT EXISTS user_knowledge_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  edukg_uri TEXT NOT NULL,
  knowledge_point_name TEXT NOT NULL,
  subject TEXT NOT NULL,

  mastery_level TEXT NOT NULL DEFAULT 'unknown',
  practice_count INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  wrong_count INTEGER DEFAULT 0,

  first_practiced_at TIMESTAMP,
  last_practiced_at TIMESTAMP,
  mastered_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  CONSTRAINT user_knowledge_mastery_mastery_level_check
    CHECK (mastery_level IN ('unknown', 'learning', 'familiar', 'mastered'))
);

-- 创建唯一约束和索引
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_kp ON user_knowledge_mastery(user_id, edukg_uri);
CREATE INDEX IF NOT EXISTS idx_user_knowledge_mastery_user ON user_knowledge_mastery(user_id);
CREATE INDEX IF NOT EXISTS idx_user_knowledge_mastery_uri ON user_knowledge_mastery(edukg_uri);
CREATE INDEX IF NOT EXISTS idx_user_knowledge_mastery_subject ON user_knowledge_mastery(subject);
CREATE INDEX IF NOT EXISTS idx_user_knowledge_mastery_mastery ON user_knowledge_mastery(mastery_level);

-- 添加触发器：自动更新updated_at
DROP TRIGGER IF EXISTS trigger_update_user_knowledge_mastery_updated_at ON user_knowledge_mastery;
CREATE TRIGGER trigger_update_user_knowledge_mastery_updated_at
  BEFORE UPDATE ON user_knowledge_mastery
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 添加注释
COMMENT ON TABLE user_knowledge_mastery IS '用户知识点掌握情况表';
COMMENT ON COLUMN user_knowledge_mastery.edukg_uri IS 'EduKG实体URI';
COMMENT ON COLUMN user_knowledge_mastery.mastery_level IS '掌握程度：unknown(未知) | learning(学习中) | familiar(熟悉) | mastered(已掌握)';

-- 3. 创建用户学习记录表
CREATE TABLE IF NOT EXISTS user_learning_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  record_type TEXT NOT NULL,
  content_type TEXT,
  content_id TEXT,

  edukg_uris TEXT[],

  action TEXT NOT NULL,
  duration_seconds INTEGER,
  completion_rate TEXT,

  is_correct BOOLEAN,
  score TEXT,

  created_at TIMESTAMP DEFAULT now(),

  CONSTRAINT user_learning_records_record_type_check
    CHECK (record_type IN ('homework', 'classroom', 'practice_question', 'wrong_question')),

  CONSTRAINT user_learning_records_action_check
    CHECK (action IN ('view', 'practice', 'complete', 'review'))
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_learning_records_user ON user_learning_records(user_id);
CREATE INDEX IF NOT EXISTS idx_user_learning_records_content ON user_learning_records(content_id);
CREATE INDEX IF NOT EXISTS idx_user_learning_records_uri ON user_learning_records(edukg_uris);
CREATE INDEX IF NOT EXISTS idx_user_learning_records_created ON user_learning_records(created_at DESC);

-- 添加注释
COMMENT ON TABLE user_learning_records IS '用户学习记录表';
COMMENT ON COLUMN user_learning_records.record_type IS '记录类型：homework(作业) | classroom(课程) | practice_question(练习题) | wrong_question(错题)';
COMMENT ON COLUMN user_learning_records.action IS '学习行为：view(浏览) | practice(练习) | complete(完成) | review(复习)';

-- 4. 创建错题本表
CREATE TABLE IF NOT EXISTS user_wrong_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  question_text TEXT NOT NULL,
  question_image_url TEXT,
  my_answer TEXT,
  correct_answer TEXT,
  explanation TEXT,

  subject TEXT,
  grade_level TEXT,
  difficulty TEXT,

  edukg_uri TEXT,
  edukg_uris TEXT[],

  wrong_count INTEGER DEFAULT 1,
  practice_count INTEGER DEFAULT 0,
  last_practiced_at TIMESTAMP,

  is_mastered BOOLEAN DEFAULT false,
  mastered_at TIMESTAMP,

  source_type TEXT NOT NULL,
  source_id TEXT,

  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  CONSTRAINT user_wrong_questions_source_type_check
    CHECK (source_type IN ('homework', 'classroom', 'practice'))
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_wrong_questions_user ON user_wrong_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wrong_questions_uri ON user_wrong_questions(edukg_uri);
CREATE INDEX IF NOT EXISTS idx_user_wrong_questions_subject ON user_wrong_questions(subject);
CREATE INDEX IF NOT EXISTS idx_user_wrong_questions_grade ON user_wrong_questions(grade_level);
CREATE INDEX IF NOT EXISTS idx_user_wrong_questions_mastered ON user_wrong_questions(is_mastered);

-- 添加触发器：自动更新updated_at
DROP TRIGGER IF EXISTS trigger_update_user_wrong_questions_updated_at ON user_wrong_questions;
CREATE TRIGGER trigger_update_user_wrong_questions_updated_at
  BEFORE UPDATE ON user_wrong_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 添加注释
COMMENT ON TABLE user_wrong_questions IS '错题本表';
COMMENT ON COLUMN user_wrong_questions.source_type IS '来源：homework(作业) | classroom(课程) | practice(练习)';

-- 5. 创建分享记录表
CREATE TABLE IF NOT EXISTS share_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  share_type TEXT NOT NULL,
  content_id TEXT NOT NULL,

  title TEXT NOT NULL,
  summary TEXT,
  image_url TEXT,

  organization_id UUID REFERENCES organizations(id),

  view_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,

  expires_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT now(),

  CONSTRAINT share_records_share_type_check
    CHECK (share_type IN ('homework', 'classroom'))
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_share_records_user ON share_records(user_id);
CREATE INDEX IF NOT EXISTS idx_share_records_org ON share_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_share_records_content ON share_records(content_id);
CREATE INDEX IF NOT EXISTS idx_share_records_created ON share_records(created_at DESC);

-- 添加注释
COMMENT ON TABLE share_records IS '分享记录表';
COMMENT ON COLUMN share_records.share_type IS '分享类型：homework(作业讲解) | classroom(课程)';
