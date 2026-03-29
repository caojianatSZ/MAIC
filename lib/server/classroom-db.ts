// 课程数据库操作服务 - 只存储元数据
import { db } from '@/lib/db';
import * as schema from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import type { Stage, Scene } from '@/lib/types/stage';

export interface ClassroomMetadata {
  title: string;
  description?: string;
  subject?: string;
  gradeLevel?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  keywords?: string[];
  tags?: string[];
  durationMinutes?: number;
  knowledgePointUris?: string[]; // ⭐ 知识点URI数组
  primaryKnowledgePoint?: string; // ⭐ 主要知识点
  audioFiles?: string[];
  imageFiles?: string[];
  videoFiles?: string[];
}

export interface PersistClassroomToDBInput {
  id: string;
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
  stage: Stage; // 保留，用于知识点提取和媒体追踪
  scenes: Scene[]; // 保留，用于知识点提取和媒体追踪
  metadata?: ClassroomMetadata;
}

/**
 * 保存课程元数据到数据库
 * 注意：只保存元数据，完整内容仍在文件系统
 */
export async function persistClassroomToDB(
  input: PersistClassroomToDBInput
): Promise<void> {
  try {
    // 计算统计信息
    const scenesCount = input.scenes.length;
    const hasSlides = input.scenes.some(s => s.type === 'slide');
    const hasQuiz = input.scenes.some(s => s.type === 'quiz');
    const hasInteractive = input.scenes.some(s => s.type === 'interactive');
    const hasPBL = input.scenes.some(s => s.type === 'pbl');
    const hasTTS = input.scenes.some(s =>
      s.actions?.some(a => a.type === 'speech')
    );

    // 估算时长（每个场景平均5分钟）
    const durationMinutes = input.metadata?.durationMinutes || scenesCount * 5;

    // 主JSON文件路径
    const mainJsonFile = `data/classrooms/${input.id}.json`;

    await db.insert(schema.classrooms).values({
      id: input.id,
      title: input.title,
      description: input.description,
      requirement: input.requirement,
      subject: input.subject,
      gradeLevel: input.gradeLevel,
      difficulty: input.difficulty || 'intermediate',
      knowledgePointUris: input.metadata?.knowledgePointUris || [],
      primaryKnowledgePoint: input.metadata?.primaryKnowledgePoint,
      scenesCount,
      durationMinutes,
      hasSlides,
      hasQuiz,
      hasInteractive,
      hasPBL,
      hasTTS,
      mainJsonFile,
      audioFiles: input.metadata?.audioFiles || [],
      imageFiles: input.metadata?.imageFiles || [],
      videoFiles: input.metadata?.videoFiles || [],
      keywords: input.metadata?.keywords || [],
      tags: input.metadata?.tags || [],
      organizationId: input.generationConfig.organizationId,
    });

    console.log(`✅ Classroom metadata saved to database: ${input.id}`);
  } catch (error) {
    console.error(`❌ Failed to save classroom metadata to database:`, error);
    throw error;
  }
}

/**
 * 从数据库读取课程元数据
 * 注意：只读取元数据，完整内容需要从文件系统读取
 */
export async function readClassroomMetadataFromDB(
  id: string
): Promise<{
  id: string;
  title: string;
  description: string | null;
  requirement: string;
  subject: string | null;
  gradeLevel: string | null;
  difficulty: string | null;
  knowledgePointUris: string[];
  primaryKnowledgePoint: string | null;
  scenesCount: number;
  durationMinutes: number | null;
  hasSlides: boolean;
  hasQuiz: boolean;
  hasInteractive: boolean;
  hasPBL: boolean;
  hasTTS: boolean;
  mainJsonFile: string;
  audioFiles: string[];
  imageFiles: string[];
  videoFiles: string[];
  createdAt: Date;
} | null> {
  try {
    const classroom = await db.query.classrooms.findFirst({
      where: eq(schema.classrooms.id, id),
    });

    if (!classroom) return null;

    return {
      id: classroom.id,
      title: classroom.title,
      description: classroom.description,
      requirement: classroom.requirement,
      subject: classroom.subject,
      gradeLevel: classroom.gradeLevel,
      difficulty: classroom.difficulty,
      knowledgePointUris: classroom.knowledgePointUris || [],
      primaryKnowledgePoint: classroom.primaryKnowledgePoint,
      scenesCount: classroom.scenesCount,
      durationMinutes: classroom.durationMinutes,
      hasSlides: classroom.hasSlides || false,
      hasQuiz: classroom.hasQuiz || false,
      hasInteractive: classroom.hasInteractive || false,
      hasPBL: classroom.hasPBL || false,
      hasTTS: classroom.hasTTS || false,
      mainJsonFile: classroom.mainJsonFile,
      audioFiles: classroom.audioFiles || [],
      imageFiles: classroom.imageFiles || [],
      videoFiles: classroom.videoFiles || [],
      createdAt: classroom.createdAt || new Date(),
    };
  } catch (error) {
    console.error(`❌ Failed to read classroom metadata from database:`, error);
    return null;
  }
}

/**
 * 获取课程元数据（简化版）
 */
export async function getClassroomMetadata(
  id: string
): Promise<{
  title: string;
  description: string | null;
  subject: string | null;
  gradeLevel: string | null;
  difficulty: string | null;
  scenesCount: number;
  durationMinutes: number | null;
  createdAt: Date;
} | null> {
  try {
    const classroom = await db.query.classrooms.findFirst({
      where: eq(schema.classrooms.id, id),
      columns: {
        title: true,
        description: true,
        subject: true,
        gradeLevel: true,
        difficulty: true,
        scenesCount: true,
        durationMinutes: true,
        createdAt: true,
      },
    });

    if (!classroom) return null;

    return {
      title: classroom.title,
      description: classroom.description,
      subject: classroom.subject,
      gradeLevel: classroom.gradeLevel,
      difficulty: classroom.difficulty,
      scenesCount: classroom.scenesCount,
      durationMinutes: classroom.durationMinutes,
      createdAt: classroom.createdAt || new Date(),
    };
  } catch (error) {
    console.error(`❌ Failed to get classroom metadata:`, error);
    return null;
  }
}
