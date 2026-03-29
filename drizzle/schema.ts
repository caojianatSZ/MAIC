import { pgTable, uuid, text, timestamp, boolean, integer, index, unique, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 组织表 - 存储B2B客户的基本信息
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  logoData: text('logo_data'),
  logoMimeType: text('logo_mime_type'),
  phone: text('phone'),
  wechatQrUrl: text('wechat_qr_url'),
  primaryColor: text('primary_color'),
  secondaryColor: text('secondary_color'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 组织课堂表 - 存储组织分享的课堂及其分享token
export const organizationClassrooms = pgTable('organization_classrooms', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  classroomId: text('classroom_id').notNull(),
  shareToken: text('share_token').notNull().unique(),
  subject: text('subject'),
  grade: text('grade'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  // 索引：按组织ID查询课堂
  orgIdx: index('idx_organization_classrooms_org').on(table.organizationId),
  // 索引：按分享token查询课堂
  tokenIdx: index('idx_organization_classrooms_token').on(table.shareToken),
}));

// 课堂浏览记录表 - 记录每个session对课堂的浏览情况（同一session只记录一次）
export const classroomViews = pgTable('classroom_views', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationClassroomId: uuid('organization_classroom_id').notNull().references(() => organizationClassrooms.id),
  sessionId: text('session_id').notNull(),
  completed: boolean('completed').default(false),
  durationSeconds: integer('duration_seconds').default(0),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  // 唯一约束：同一课堂下，每个session只能有一条浏览记录
  uniqueSession: unique('unique_classroom_session')
    .on(table.organizationClassroomId, table.sessionId),
  // 索引：按组织课堂ID查询浏览记录
  orgClassIdx: index('idx_classroom_views_org_class')
    .on(table.organizationClassroomId),
}));

// 课堂转化表 - 记录通过课堂分享产生的电话号码线索（同一课堂下同一号码只记录一次）
export const classroomConversions = pgTable('classroom_conversions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationClassroomId: uuid('organization_classroom_id').notNull().references(() => organizationClassrooms.id),
  phone: text('phone').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  // 唯一约束：同一课堂下，每个电话号码只能有一条转化记录
  uniquePhone: unique('unique_classroom_phone')
    .on(table.organizationClassroomId, table.phone),
  // 索引：按组织课堂ID查询转化记录
  orgClassIdx: index('idx_classroom_conversions_org_class')
    .on(table.organizationClassroomId),
}));

// 克隆音色表 - 保存用户克隆的音色
export const clonedVoices = pgTable('cloned_voices', {
  id: uuid('id').defaultRandom().primaryKey(),
  voiceId: text('voice_id').notNull().unique(), // GLM返回的voice_id
  voiceName: text('voice_name').notNull(), // 音色名称
  fileId: text('file_id'), // 上传的音频文件ID
  description: text('description'), // 描述
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  // 索引：按创建时间倒序查询
  createdAtIdx: index('idx_cloned_voices_created_at').on(table.createdAt),
}));

// ============================================
// MAIC C端 MVP - 家长作业辅导助手
// ============================================

// 用户表 - 微信小程序用户
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  openid: text('openid').notNull().unique(), // 微信 openid
  unionid: text('unionid'), // 微信 unionid（开放平台唯一标识）
  nickName: text('nick_name'), // 昵称
  avatarUrl: text('avatar_url'), // 头像URL

  // 用户档案
  gradeLevel: text('grade_level'), // 年级：PRIMARY_1~6, MIDDLE_1~3, HIGH_1~3
  subjects: text('subjects').array(), // 科目：math, chinese, english, physics, chemistry, biology, history, geography, politics
  organizationId: uuid('organization_id').references(() => organizations.id), // 所属机构

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // 索引：按 openid 查询用户
  openidIdx: index('idx_users_openid').on(table.openid),
  // 索引：按机构查询用户
  orgIdx: index('idx_users_org').on(table.organizationId),
}));

// 作业提交表 - 家长提交的作业题目
export const homeworkSubmissions = pgTable('homework_submissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  questionText: text('question_text').notNull(), // 题目内容
  questionImageUrl: text('question_image_url'), // 题目图片（可选）
  grade: text('grade'), // 年级
  subject: text('subject'), // 科目
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  // 索引：按用户ID查询作业提交记录
  userIdIdx: index('idx_homework_submissions_user').on(table.userId),
  // 索引：按创建时间倒序查询
  createdAtIdx: index('idx_homework_submissions_created').on(table.createdAt),
}));

// 作业结果表 - AI生成的讲解内容
export const homeworkResults = pgTable('homework_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  submissionId: uuid('submission_id').notNull().references(() => homeworkSubmissions.id),
  explanationText: text('explanation_text').notNull(), // 讲解内容
  explanationAudioUrl: text('explanation_audio_url'), // 音频URL
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  // 索引：按提交ID查询结果
  submissionIdIdx: index('idx_homework_results_submission').on(table.submissionId),
}));

// 练习题表 - 针对作业题目生成的练习题
export const practiceQuestions = pgTable('practice_questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  resultId: uuid('result_id').notNull().references(() => homeworkResults.id),
  questionText: text('question_text').notNull(), // 题目内容
  options: jsonb('options').notNull().$type<string[]>(), // 选项数组 ["A", "B", "C", "D"]
  correctAnswer: text('correct_answer').notNull(), // 正确答案
  explanation: text('explanation'), // 解析
  questionNumber: integer('question_number').notNull(), // 题号（1, 2, 3）
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  // 索引：按结果ID查询练习题
  resultIdIdx: index('idx_practice_questions_result').on(table.resultId),
}));

// ============================================
// 课程数据库化 - 只存元数据和知识点
// ============================================

// 课程主表 - 只存储元数据，完整内容在文件系统
export const classrooms = pgTable('classrooms', {
  id: uuid('id').defaultRandom().primaryKey(),

  // 基本信息
  title: text('title').notNull(),
  description: text('description'),
  requirement: text('requirement').notNull(), // 原始需求

  // 分类信息
  subject: text('subject'), // math/chinese/english...
  gradeLevel: text('grade_level'), // PRIMARY_1~6, MIDDLE_1~3, HIGH_1~3
  difficulty: text('difficulty'), // beginner/intermediate/advanced

  // ⭐ 核心字段：知识点（用于搜索、推荐、重用）
  knowledgePointUris: text('knowledge_point_uris').array().notNull(), // EduKG URI数组
  primaryKnowledgePoint: text('primary_knowledge_point'), // 主要知识点（冗余，提升查询性能）

  // 内容统计（不存完整内容）
  scenesCount: integer('scenes_count').notNull(),
  durationMinutes: integer('duration_minutes'),

  // 场景类型标记
  hasSlides: boolean('has_slides').default(false),
  hasQuiz: boolean('has_quiz').default(false),
  hasInteractive: boolean('has_interactive').default(false),
  hasPBL: boolean('has_pbl').default(false),
  hasTTS: boolean('has_tts').default(false),

  // 媒体资源清单（文件路径引用，不存实际内容）
  mainJsonFile: text('main_json_file').notNull(), // data/classrooms/{id}.json
  audioFiles: text('audio_files').array(), // 音频文件路径数组
  imageFiles: text('image_files').array(), // 图片文件路径数组
  videoFiles: text('video_files').array(), // 视频文件路径数组

  // 搜索优化
  keywords: text('keywords').array(),
  tags: text('tags').array(),
  searchVector: text('search_vector'), // PostgreSQL tsvector

  // 所属机构
  organizationId: uuid('organization_id').references(() => organizations.id),

  // 状态
  status: text('status').default('completed'), // pending/processing/completed/failed
  errorMessage: text('error_message'),

  // 元数据
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // 索引：基础查询
  orgIdx: index('idx_classrooms_org').on(table.organizationId),
  subjectIdx: index('idx_classrooms_subject').on(table.subject),
  gradeIdx: index('idx_classrooms_grade').on(table.gradeLevel),
  difficultyIdx: index('idx_classrooms_difficulty').on(table.difficulty),
  statusIdx: index('idx_classrooms_status').on(table.status),
  createdAtIdx: index('idx_classrooms_created').on(table.createdAt),

  // 索引：知识点搜索（核心！）
  knowledgePointsIdx: index('idx_classrooms_knowledge_points').on(table.knowledgePointUris),
  primaryKnowledgePointIdx: index('idx_classrooms_primary_kp').on(table.primaryKnowledgePoint),
}));

// 课程知识点关联表（多对多）
export const classroomKnowledgePoints = pgTable('classroom_knowledge_points', {
  id: uuid('id').defaultRandom().primaryKey(),
  classroomId: uuid('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),
  edukgUri: text('edukg_uri').notNull(), // EduKG实体URI
  knowledgePointName: text('knowledge_point_name'), // 知识点名称（冗余，提升性能）
  isPrimary: boolean('is_primary').default(false), // 是否为主要知识点
  relevanceScore: text('relevance_score'), // 相关性评分（存储为text，因为drizzle不支持float类型）

  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  // 唯一约束：同一课程+知识点只能有一条记录
  uniqueClassroomKp: unique('unique_classroom_kp').on(table.classroomId, table.edukgUri),
  // 索引
  classroomIdx: index('idx_classroom_kp_classroom').on(table.classroomId),
  uriIdx: index('idx_classroom_kp_uri').on(table.edukgUri),
  primaryIdx: index('idx_classroom_kp_primary').on(table.isPrimary).where(sql`${table.isPrimary} = true`),
}));

// 课程使用统计表
export const classroomStats = pgTable('classroom_stats', {
  id: uuid('id').defaultRandom().primaryKey(),
  classroomId: uuid('classroom_id').notNull().references(() => classrooms.id, { onDelete: 'cascade' }),

  // 浏览数据
  viewCount: integer('view_count').default(0), // 总浏览次数
  uniqueViewers: integer('unique_viewers').default(0), // 独立访客数
  avgCompletionRate: text('avg_completion_rate'), // 平均完成率（存储为text）
  avgDurationSeconds: integer('avg_duration_seconds'), // 平均观看时长（秒）

  // 互动数据
  shareCount: integer('share_count').default(0), // 分享次数
  favoriteCount: integer('favorite_count').default(0), // 收藏次数
  commentCount: integer('comment_count').default(0), // 评论数

  // 转化数据（针对机构）
  conversionCount: integer('conversion_count').default(0), // 转化次数
  conversionRate: text('conversion_rate'), // 转化率

  // 质量评分
  avgRating: text('avg_rating'), // 平均评分
  ratingCount: integer('rating_count').default(0), // 评分人数

  // 时间维度
  lastViewedAt: timestamp('last_viewed_at'),
  lastSharedAt: timestamp('last_shared_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // 唯一约束：每个课程只有一条统计记录
  uniqueClassroom: unique('unique_classroom_stats').on(table.classroomId),
  // 索引
  viewsIdx: index('idx_classroom_stats_views').on(table.viewCount),
  ratingIdx: index('idx_classroom_stats_rating').on(table.avgRating),
}));

// 课程模板表 - 保存可重用的课程结构
export const classroomTemplates = pgTable('classroom_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id),
  createdById: uuid('created_by_id'),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),
  outlineStructure: jsonb('outline_structure').$type<any>(),
  sceneTemplates: jsonb('scene_templates').$type<any[]>(),
  agentConfiguration: jsonb('agent_configuration').$type<any>(),
  applicableSubjects: text('applicable_subjects').array(),
  applicableGrades: text('applicable_grades').array(),
  difficulty: text('difficulty'),
  usageCount: integer('usage_count').default(0),
  isPublic: boolean('is_public').default(false),
  isDefault: boolean('is_default').default(false),
  isActive: boolean('is_active').default(true),
  created_at: timestamp('created_at').defaultNow(),
  updated_at: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // 索引：按组织查询模板
  orgIdx: index('idx_classroom_templates_org').on(table.organizationId),
  // 索引：按使用次数排序
  usageIdx: index('idx_classroom_templates_usage').on(table.usageCount),
  // 索引：按创建时间排序
  createdAtIdx: index('idx_classroom_templates_created').on(table.created_at),
}));

// ============================================
// 微信小程序增强 - 用户学习系统
// ============================================

// 用户知识点掌握情况表
export const userKnowledgeMastery = pgTable('user_knowledge_mastery', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  edukgUri: text('edukg_uri').notNull(), // EduKG实体URI
  knowledgePointName: text('knowledge_point_name').notNull(), // 知识点名称（冗余，提升性能）
  subject: text('subject').notNull(), // 科目：math, chinese, english等

  // 掌握程度
  masteryLevel: text('mastery_level').notNull(), // unknown(未知) | learning(学习中) | familiar(熟悉) | mastered(已掌握)
  practiceCount: integer('practice_count').default(0), // 练习次数
  correctCount: integer('correct_count').default(0), // 正确次数
  wrongCount: integer('wrong_count').default(0), // 错误次数

  // 时间追踪
  firstPracticedAt: timestamp('first_practiced_at'), // 首次练习时间
  lastPracticedAt: timestamp('last_practiced_at'), // 最后练习时间
  masteredAt: timestamp('mastered_at'), // 掌握时间

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // 唯一约束：同一用户+知识点只能有一条记录
  uniqueUserKp: unique('unique_user_kp').on(table.userId, table.edukgUri),
  // 索引：按用户查询知识点掌握情况
  userIdx: index('idx_user_knowledge_mastery_user').on(table.userId),
  // 索引：按知识点查询掌握情况
  uriIdx: index('idx_user_knowledge_mastery_uri').on(table.edukgUri),
  // 索引：按科目查询
  subjectIdx: index('idx_user_knowledge_mastery_subject').on(table.subject),
  // 索引：按掌握程度查询
  masteryIdx: index('idx_user_knowledge_mastery_mastery').on(table.masteryLevel),
}));

// 用户学习记录表
export const userLearningRecords = pgTable('user_learning_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // 学习内容
  recordType: text('record_type').notNull(), // homework(作业) | classroom(课程) | practice_question(练习题) | wrong_question(错题)
  contentType: text('content_type'), // 当type是classroom时：slide/quiz/interactive/pbl
  contentId: text('content_id'), // 内容ID：homework_submission_id, classroom_id, practice_question_id等

  // 知识点关联
  edukgUris: text('edukg_uris').array(), // 相关的知识点URIs

  // 学习行为
  action: text('action').notNull(), // view(浏览) | practice(练习) | complete(完成) | review(复习)
  durationSeconds: integer('duration_seconds'), // 学习时长（秒）
  completionRate: text('completion_rate'), // 完成率（存储为text）

  // 结果
  isCorrect: boolean('is_correct'), // 是否正确（练习题）
  score: text('score'), // 得分（存储为text）

  // 时间
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  // 索引：按用户查询学习记录
  userIdx: index('idx_user_learning_records_user').on(table.userId),
  // 索引：按内容ID查询
  contentIdx: index('idx_user_learning_records_content').on(table.contentId),
  // 索引：按知识点查询
  uriIdx: index('idx_user_learning_records_uri').on(table.edukgUris),
  // 索引：按创建时间倒序
  createdAtIdx: index('idx_user_learning_records_created').on(table.createdAt),
}));

// 错题本表
export const userWrongQuestions = pgTable('user_wrong_questions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // 题目信息
  questionText: text('question_text').notNull(), // 题目内容
  questionImageUrl: text('question_image_url'), // 题目图片
  myAnswer: text('my_answer'), // 我的答案
  correctAnswer: text('correct_answer'), // 正确答案
  explanation: text('explanation'), // AI讲解

  // 题目元数据
  subject: text('subject'), // 科目
  gradeLevel: text('grade_level'), // 年级
  difficulty: text('difficulty'), // 难度

  // 知识点关联
  edukgUri: text('edukg_uri'), // 主知识点（EduKG URI）
  edukgUris: text('edukg_uris').array(), // 所有相关知识点

  // 错误追踪
  wrongCount: integer('wrong_count').default(1), // 错误次数
  practiceCount: integer('practice_count').default(0), // 练习次数（错题本练习）
  lastPracticedAt: timestamp('last_practiced_at'), // 最后练习时间

  // 状态
  isMastered: boolean('is_mastered').default(false), // 是否已掌握
  masteredAt: timestamp('mastered_at'), // 掌握时间

  // 来源
  sourceType: text('source_type').notNull(), // homework(作业) | classroom(课程) | practice(练习)
  sourceId: text('source_id'), // 来源ID

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // 索引：按用户查询错题
  userIdx: index('idx_user_wrong_questions_user').on(table.userId),
  // 索引：按知识点查询错题
  uriIdx: index('idx_user_wrong_questions_uri').on(table.edukgUri),
  // 索引：按科目查询
  subjectIdx: index('idx_user_wrong_questions_subject').on(table.subject),
  // 索引：按年级查询
  gradeIdx: index('idx_user_wrong_questions_grade').on(table.gradeLevel),
  // 索引：按掌握状态查询
  masteredIdx: index('idx_user_wrong_questions_mastered').on(table.isMastered),
}));

// 分享记录表
export const shareRecords = pgTable('share_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

  // 分享内容
  shareType: text('share_type').notNull(), // homework(作业讲解) | classroom(课程)
  contentId: text('content_id').notNull(), // 内容ID：homework_result_id, classroom_id

  // 分享元数据
  title: text('title').notNull(), // 分享标题
  summary: text('summary'), // 分享摘要
  imageUrl: text('image_url'), // 分享图片

  // 机构信息（用于品牌化）
  organizationId: uuid('organization_id').references(() => organizations.id),

  // 统计
  viewCount: integer('view_count').default(0), // 浏览次数
  shareCount: integer('share_count').default(0), // 被二次分享次数

  // 过期时间（可选）
  expiresAt: timestamp('expires_at'),

  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  // 索引：按用户查询分享记录
  userIdx: index('idx_share_records_user').on(table.userId),
  // 索引：按机构查询分享记录
  orgIdx: index('idx_share_records_org').on(table.organizationId),
  // 索引：按内容ID查询
  contentIdx: index('idx_share_records_content').on(table.contentId),
  // 索引：按创建时间倒序
  createdAtIdx: index('idx_share_records_created').on(table.createdAt),
}));
