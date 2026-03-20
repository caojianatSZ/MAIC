import { pgTable, uuid, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

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

export const organizationClassrooms = pgTable('organization_classrooms', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  classroomId: text('classroom_id').notNull(),
  shareToken: text('share_token').notNull().unique(),
  subject: text('subject'),
  grade: text('grade'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const classroomViews = pgTable('classroom_views', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationClassroomId: uuid('organization_classroom_id').notNull().references(() => organizationClassrooms.id),
  sessionId: text('session_id').notNull(),
  completed: boolean('completed').default(false),
  durationSeconds: integer('duration_seconds').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const classroomConversions = pgTable('classroom_conversions', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationClassroomId: uuid('organization_classroom_id').notNull().references(() => organizationClassrooms.id),
  phone: text('phone').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
