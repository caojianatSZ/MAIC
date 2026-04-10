import { NextRequest } from 'next/server';
import { createLogger } from '@/lib/logger';
import { generateTTSForClassroom } from '@/lib/server/classroom-media-generation';
import { CLASSROOMS_DIR } from '@/lib/server/classroom-storage';
import { promises as fs } from 'fs';
import path from 'path';
import { apiSuccess, apiError, API_ERROR_CODES } from '@/lib/server/api-response';

const log = createLogger('RegenerateTTS');

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 读取课程数据
    const stagePath = path.join(CLASSROOMS_DIR, id, 'stage.json');
    let stageData: any;

    try {
      const stageContent = await fs.readFile(stagePath, 'utf-8');
      stageData = JSON.parse(stageContent);
    } catch (err) {
      return apiError(
        API_ERROR_CODES.INVALID_REQUEST,
        404,
        '课程不存在'
      );
    }

    // 检查课程是否有场景数据
    if (!stageData.scenes || !Array.isArray(stageData.scenes)) {
      return apiError(
        API_ERROR_CODES.INVALID_REQUEST,
        400,
        '课程数据格式无效'
      );
    }

    const scenes = stageData.scenes;
    const baseUrl = `${req.nextUrl.protocol}//${req.nextUrl.host}`;

    log.info(`Regenerating TTS for classroom ${id} (${scenes.length} scenes)`);

    // 重新生成 TTS
    await generateTTSForClassroom(scenes, id, baseUrl);

    // 读取更新后的 stage.json
    const updatedStageContent = await fs.readFile(stagePath, 'utf-8');
    const updatedStageData = JSON.parse(updatedStageContent);

    // 统计生成的音频数量
    let audioCount = 0;
    for (const scene of scenes) {
      if (scene.actions) {
        for (const action of scene.actions) {
          if (action.type === 'speech' && action.audioUrl) {
            audioCount++;
          }
        }
      }
    }

    return apiSuccess({
      success: true,
      classroomId: id,
      audioCount,
      message: `成功生成 ${audioCount} 个语音片段`
    });
  } catch (error) {
    log.error('Failed to regenerate TTS:', error);
    return apiError(
      API_ERROR_CODES.INTERNAL_ERROR,
      500,
      '重新生成语音失败'
    );
  }
}
