import { pgTable, uuid, text, timestamp, boolean, integer, index, unique } from 'drizzle-orm/pg-core';

// 组织表 - 存储B2B客户的基本信息
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  logoData: text('logo_data'),
  logoMimeType: text('logo_mime_type'),
  phone: text('phone'),
  wechatQrUrl: text('wechat_qr_url'),
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
