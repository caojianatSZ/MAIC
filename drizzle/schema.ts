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
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  // 索引：按 openid 查询用户
  openidIdx: index('idx_users_openid').on(table.openid),
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
// 课程数据库化 - 存储课程内容到数据库
// ============================================

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
  stageData: jsonb('stage_data').notNull(),
  scenesData: jsonb('scenes_data').notNull(),
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
  // 索引：基础查询
  orgIdx: index('idx_classrooms_org').on(table.organizationId),
  subjectIdx: index('idx_classrooms_subject').on(table.subject),
  gradeIdx: index('idx_classrooms_grade').on(table.gradeLevel),
  difficultyIdx: index('idx_classrooms_difficulty').on(table.difficulty),
  statusIdx: index('idx_classrooms_status').on(table.status),
  createdAtIdx: index('idx_classrooms_created').on(table.createdAt),
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
