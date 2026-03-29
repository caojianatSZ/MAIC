import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as schema from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * 基于模板生成课程
 * POST /api/generate-classroom/from-template
 *
 * 使用模板结构，填充新的内容
 */
export async function POST(req: NextRequest) {
  const body = await req.json();

  const { templateId, requirement } = body;

  if (!templateId || !requirement) {
    return NextResponse.json({
      error: 'Missing required fields: templateId, requirement',
    }, { status: 400 });
  }

  try {
    // 1. 获取模板
    const template = await db.query.classroomTemplates.findFirst({
      where: eq(schema.classroomTemplates.id, templateId),
    });

    if (!template) {
      return NextResponse.json({
        error: 'Template not found',
        templateId,
      }, { status: 404 });
    }

    // 2. 解析模板结构
    const outlineStructure = JSON.parse(template.outlineStructure);
    const sceneTemplates = JSON.parse(template.sceneTemplates);

    // 3. 使用模板生成课程
    // TODO: 集成到现有的课程生成流程中
    // 这里先返回模板信息，实际生成需要调用generateClassroom

    // 更新使用次数
    await db
      .update(schema.classroomTemplates)
      .set({
        usageCount: sql`${schema.classroomTemplates.usageCount} + 1`,
      })
      .where(eq(schema.classroomTemplates.id, templateId));

    return NextResponse.json({
      success: true,
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        outlineStructure,
        sceneTemplates,
        sceneCount: sceneTemplates.length,
      },
      requirement,
      message: 'Template loaded successfully. Use /api/generate-classroom with this template structure.',
    });
  } catch (error) {
    console.error('Error generating classroom from template:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
