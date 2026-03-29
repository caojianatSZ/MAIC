// 课程数据库操作服务
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
  stage: Stage;
  scenes: Scene[];
  metadata?: ClassroomMetadata;
}

/**
 * 保存课程到数据库
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

    // 检查是否包含TTS
    const hasTTS = input.scenes.some(s =>
      s.actions?.some(a => a.type === 'speech')
    );

    // 检查是否包含AI生成媒体
    // 注意：Action类型中没有image和video，这些可能通过其他方式实现
    // 这里暂时设置为false，后续可以根据实际Action类型调整
    const hasImageGeneration = false;
    const hasVideoGeneration = false;

    // 估算时长（每个场景平均5分钟）
    const durationMinutes = input.metadata?.durationMinutes || scenesCount * 5;

    await db.insert(schema.classrooms).values({
      id: input.id,
      title: input.title,
      description: input.description,
      requirement: input.requirement,
      subject: input.subject,
      gradeLevel: input.gradeLevel,
      difficulty: input.difficulty || 'intermediate',
      generationConfig: input.generationConfig as any,
      stageData: input.stage as any,
      scenesData: input.scenes as any,
      keywords: input.metadata?.keywords || [],
      tags: input.metadata?.tags || [],
      organizationId: input.generationConfig.organizationId,
      hasTTS,
      hasImageGeneration,
      hasVideoGeneration,
      scenesCount,
      durationMinutes,
      hasSlides,
      hasQuiz,
      hasInteractive,
      hasPBL,
    });

    console.log(`✅ Classroom saved to database: ${input.id}`);
  } catch (error) {
    console.error(`❌ Failed to save classroom to database:`, error);
    throw error;
  }
}

/**
 * 从数据库读取课程
 */
export async function readClassroomFromDB(
  id: string
): Promise<{ id: string; stage: Stage; scenes: Scene[]; createdAt: string } | null> {
  try {
    const classroom = await db.query.classrooms.findFirst({
      where: eq(schema.classrooms.id, id),
    });

    if (!classroom) return null;

    return {
      id: classroom.id,
      stage: classroom.stageData as Stage,
      scenes: classroom.scenesData as Scene[],
      createdAt: (classroom.createdAt || new Date()).toISOString(),
    };
  } catch (error) {
    console.error(`❌ Failed to read classroom from database:`, error);
    return null;
  }
}

/**
 * 获取课程元数据
 */
export async function getClassroomMetadata(
  id: string
): Promise<{
  title: string;
  description: string | null;
  subject: string | null;
  gradeLevel: string | null;
  difficulty: string | null;
  scenesCount: number | null;
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
      ...classroom,
      createdAt: classroom.createdAt || new Date(), // 确保createdAt不为null
    };
  } catch (error) {
    console.error(`❌ Failed to get classroom metadata:`, error);
    return null;
  }
}
