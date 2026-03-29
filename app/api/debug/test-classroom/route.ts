import { NextRequest, NextResponse } from 'next/server';
import { readClassroom } from '@/lib/server/classroom-storage';
import { readClassroomMetadataFromDB } from '@/lib/server/classroom-db';
import { db } from '@/lib/db';
import * as schema from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * 测试课程双写逻辑
 * GET /api/debug/test-classroom?id={classroomId}
 *
 * 验证：
 * 1. 文件系统中的完整内容
 * 2. 数据库中的元数据
 * 3. 知识点是否正确提取
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const classroomId = searchParams.get('id');

  if (!classroomId) {
    return NextResponse.json({
      error: 'Missing classroom ID',
      usage: 'GET /api/debug/test-classroom?id={classroomId}',
    }, { status: 400 });
  }

  try {
    // 1. 从文件系统读取完整内容
    const fileContent = await readClassroom(classroomId);

    if (!fileContent) {
      return NextResponse.json({
        error: 'Classroom not found in file system',
        classroomId,
      }, { status: 404 });
    }

    // 2. 从数据库读取元数据
    const dbMetadata = await readClassroomMetadataFromDB(classroomId);

    if (!dbMetadata) {
      return NextResponse.json({
        error: 'Classroom metadata not found in database',
        classroomId,
        fileContent: {
          exists: true,
          sceneCount: fileContent.scenes?.length || 0,
        },
      }, { status: 404 });
    }

    // 3. 验证知识点
    const knowledgePoints = await db.query.classroomKnowledgePoints.findMany({
      where: eq(schema.classroomKnowledgePoints.classroomId, classroomId),
    });

    // 4. 返回完整信息
    return NextResponse.json({
      classroomId,
      fileSystem: {
        exists: true,
        sceneCount: fileContent.scenes?.length || 0,
        stageName: fileContent.stage?.name,
      },
      database: {
        exists: true,
        title: dbMetadata.title,
        description: dbMetadata.description,
        requirement: dbMetadata.requirement,
        subject: dbMetadata.subject,
        gradeLevel: dbMetadata.gradeLevel,
        knowledgePointUris: dbMetadata.knowledgePointUris,
        primaryKnowledgePoint: dbMetadata.primaryKnowledgePoint,
        scenesCount: dbMetadata.scenesCount,
        durationMinutes: dbMetadata.durationMinutes,
        hasTTS: dbMetadata.hasTTS,
        mainJsonFile: dbMetadata.mainJsonFile,
        mediaFiles: {
          audio: dbMetadata.audioFiles.length,
          images: dbMetadata.imageFiles.length,
          videos: dbMetadata.videoFiles.length,
        },
        createdAt: dbMetadata.createdAt,
      },
      knowledgePoints: {
        count: knowledgePoints.length,
        items: knowledgePoints.map(kp => ({
          uri: kp.edukgUri,
          name: kp.knowledgePointName,
          isPrimary: kp.isPrimary,
          relevanceScore: kp.relevanceScore,
        })),
      },
      validation: {
        scenesMatch: (fileContent.scenes?.length || 0) === dbMetadata.scenesCount,
        hasKnowledgePoints: dbMetadata.knowledgePointUris.length > 0,
        hasMediaFiles:
          dbMetadata.audioFiles.length > 0 ||
          dbMetadata.imageFiles.length > 0 ||
          dbMetadata.videoFiles.length > 0,
      },
    });
  } catch (error) {
    console.error('Error testing classroom dual-write:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
