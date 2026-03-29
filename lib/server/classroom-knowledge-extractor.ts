// 知识点提取服务 - 从课程内容中提取知识点
import type { Stage, Scene } from '@/lib/types/stage';

export interface KnowledgePoint {
  uri: string; // EduKG URI
  name: string; // 知识点名称
  isPrimary: boolean; // 是否为主要知识点
  relevanceScore: number; // 相关度评分 0-100
}

/**
 * 从课程中提取知识点（简化版，不调用AI）
 * TODO: 集成AI和EduKG API后增强此功能
 */
export async function extractKnowledgePointsFromClassroom(
  stage: Stage,
  scenes: Scene[],
  options?: {
    subject?: string;
    gradeLevel?: string;
    maxPoints?: number;
  }
): Promise<{
  knowledgePoints: KnowledgePoint[];
  primaryKnowledgePoint?: string;
}> {
  try {
    // 简化版：从标题提取知识点
    const knowledgePoints: KnowledgePoint[] = [];
    const primaryName = extractPrimaryKnowledgePoint(stage.name);

    // 添加主要知识点
    const primaryUri = generateTempUri(primaryName, options?.subject);
    knowledgePoints.push({
      uri: primaryUri,
      name: primaryName,
      isPrimary: true,
      relevanceScore: 100,
    });

    // 从场景标题提取次要知识点（最多5个）
    const sceneTitles = scenes
      .filter(s => s.title && s.title.length > 0)
      .slice(0, options?.maxPoints || 5);

    for (const scene of sceneTitles) {
      const kpName = extractKnowledgePointFromTitle(scene.title);
      if (kpName && kpName !== primaryName) {
        const uri = generateTempUri(kpName, options?.subject);
        knowledgePoints.push({
          uri,
          name: kpName,
          isPrimary: false,
          relevanceScore: 50,
        });
      }
    }

    return {
      knowledgePoints,
      primaryKnowledgePoint: primaryUri,
    };
  } catch (error) {
    console.error(`❌ Failed to extract knowledge points:`, error);
    return {
      knowledgePoints: [],
    };
  }
}

/**
 * 从标题中提取主要知识点
 */
function extractPrimaryKnowledgePoint(title: string): string {
  // 移除常见前缀
  const cleaned = title
    .replace(/^(什么是|如何|怎样|讲解|学习|掌握)[：：]?\s*/, '')
    .replace(/课程$/, '')
    .trim();

  // 提取第一个名词短语（简化处理）
  const words = cleaned.split(/\s+/);
  if (words.length > 0) {
    return words[0].substring(0, 20); // 限制长度
  }

  return cleaned.substring(0, 20);
}

/**
 * 从场景标题中提取知识点
 */
function extractKnowledgePointFromTitle(title: string): string | null {
  // 简化处理：提取标题中的关键名词
  const cleaned = title
    .replace(/^\d+\.\s*/, '') // 移除序号
    .replace(/的(定义|概念|特点|性质|应用|计算|方法)$/, '')
    .trim();

  if (cleaned.length < 2) return null;

  return cleaned.substring(0, 15);
}

/**
 * 生成临时URI（用于没有EduKG API的情况）
 * TODO: 替换为真实的EduKG API调用
 */
function generateTempUri(name: string, subject?: string): string {
  const normalized = name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '');

  const prefix = subject || 'general';
  return `temp:edu/kg/${prefix}:${normalized}`;
}

/**
 * 提取关键词（简化版，不调用AI）
 */
export async function extractKeywords(
  stage: Stage,
  scenes: Scene[],
  options?: {
    maxKeywords?: number;
  }
): Promise<string[]> {
  try {
    const keywords: string[] = [];

    // 从标题提取关键词
    const titleWords = stage.name.split(/\s+/).filter(w => w.length > 1);
    keywords.push(...titleWords.slice(0, 3));

    // 从场景标题提取关键词
    for (const scene of scenes.slice(0, 5)) {
      const words = scene.title.split(/\s+/).filter(w => w.length > 1);
      keywords.push(...words.slice(0, 2));
    }

    // 去重并限制数量
    return Array.from(new Set(keywords))
      .slice(0, options?.maxKeywords || 10);
  } catch (error) {
    console.error(`❌ Failed to extract keywords:`, error);
    return [];
  }
}
