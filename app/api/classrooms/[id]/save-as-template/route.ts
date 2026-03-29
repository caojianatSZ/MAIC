import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as schema from '@/drizzle/schema';
import { eq, desc, asc, and } from 'drizzle-orm';

/**
 * 保存课程为模板
 * POST /api/classrooms/{id}/save-as-template
 *
 * 只保存结构（outline），不保存具体内容
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: classroomId } = await params;
  const body = await req.json();

  const { name, description, category } = body;

  if (!name) {
    return NextResponse.json({
      error: 'Missing required field: name',
    }, { status: 400 });
  }

  try {
    // 1. 读取课程元数据
    const classroom = await db.query.classrooms.findFirst({
      where: eq(schema.classrooms.id, classroomId),
    });

    if (!classroom) {
      return NextResponse.json({
        error: 'Classroom not found',
        classroomId,
      }, { status: 404 });
    }

    // 2. 读取完整课程内容
    const { readClassroom } = await import('@/lib/server/classroom-storage');
    const content = await readClassroom(classroomId);

    if (!content) {
      return NextResponse.json({
        error: 'Classroom content not found',
        classroomId,
      }, { status: 404 });
    }

    // 3. 提取结构（只保存基本信息，不保存具体内容）
    const outlineStructure = {
      name: content.stage.name,
      description: content.stage.description,
      language: content.stage.language,
      style: content.stage.style,
    };

    const sceneTemplates = content.scenes.map((scene) => ({
      type: scene.type,
      title: scene.title,
      order: scene.order,
      // 不包含具体的content和actions
    }));

    // 4. 保存模板
    const templateResult = await db.insert(schema.classroomTemplates).values({
      organizationId: classroom.organizationId,
      name,
      description,
      category: category || 'custom',
      outlineStructure: outlineStructure,
      sceneTemplates: sceneTemplates,
      agentConfiguration: {}, // TODO: 提取agent配置
      applicableSubjects: classroom.subject ? [classroom.subject] : [],
      applicableGrades: classroom.gradeLevel ? [classroom.gradeLevel] : [],
      difficulty: classroom.difficulty || 'intermediate',
      isPublic: false,
      isDefault: false,
      usageCount: 0,
      isActive: true,
    }).returning({ id: schema.classroomTemplates.id });

    const templateId = templateResult[0].id;

    return NextResponse.json({
      success: true,
      templateId,
      message: 'Template saved successfully',
    });
  } catch (error) {
    console.error('Error saving classroom as template:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * 获取模板列表
 * GET /api/classrooms/templates?organizationId={organizationId}&category={category}
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const organizationId = searchParams.get('organizationId');
  const category = searchParams.get('category');

  try {
    // 构建查询条件
    const conditions = [];

    if (organizationId) {
      conditions.push(eq(schema.classroomTemplates.organizationId, organizationId));
    }

    if (category) {
      conditions.push(eq(schema.classroomTemplates.category, category));
    }

    conditions.push(eq(schema.classroomTemplates.isActive, true));
    conditions.push(eq(schema.classroomTemplates.isPublic, true)); // 或当前机构的

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // 查询模板
    const templates = await db.query.classroomTemplates.findMany({
      where,
      orderBy: [desc(schema.classroomTemplates.usageCount), desc(schema.classroomTemplates.created_at)],
    });

    return NextResponse.json({
      success: true,
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        applicableSubjects: t.applicableSubjects,
        applicableGrades: t.applicableGrades,
        difficulty: t.difficulty,
        usageCount: t.usageCount,
        createdAt: t.created_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching classroom templates:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
