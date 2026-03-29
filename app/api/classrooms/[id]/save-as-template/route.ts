import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as schema from '@/drizzle/schema';
import { eq, desc, asc } from 'drizzle-orm';

/**
 * 保存课程为模板
 * POST /api/classrooms/{id}/save-as-template
 *
 * 只保存结构（outline），不保存具体内容
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const classroomId = params.id;
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

    // 3. 提取结构（只保存outline，不保存具体内容）
    const outlineStructure = content.stage;
    const sceneTemplates = content.scenes.map((scene) => ({
      type: scene.type,
      title: scene.title,
      outline: scene.outline,
      // 不包含具体的content和actions
    }));

    // 4. 保存模板
    const templateId = crypto.randomUUID();
    await db.insert(schema.classroomTemplates).values({
      id: templateId,
      organizationId: classroom.organizationId,
      name,
      description,
      category: category || 'custom',
      outlineStructure: JSON.stringify(outlineStructure),
      sceneTemplates: JSON.stringify(sceneTemplates),
      agentConfiguration: JSON.stringify({}), // TODO: 提取agent配置
      applicableSubjects: classroom.subject ? [classroom.subject] : [],
      applicableGrades: classroom.gradeLevel ? [classroom.gradeLevel] : [],
      difficulty: classroom.difficulty || 'intermediate',
      isPublic: false,
      isDefault: false,
      usageCount: 0,
      isActive: true,
    });

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
      orderBy: [desc(schema.classroomTemplates.usageCount), desc(schema.classroomTemplates.createdAt)],
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
        createdAt: t.createdAt,
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
