// 媒体资源清单服务 - 追踪课程中的媒体文件
import type { Scene } from '@/lib/types/stage';
import type { Action } from '@/lib/types/action';

export interface MediaPaths {
  audioFiles: string[];
  imageFiles: string[];
  videoFiles: string[];
}

/**
 * 从场景中提取媒体文件路径
 */
export function extractMediaPaths(scenes: Scene[]): MediaPaths {
  const audioFiles: string[] = [];
  const imageFiles: string[] = [];
  const videoFiles: string[] = [];

  for (const scene of scenes) {
    // 检查actions中的媒体引用
    if (scene.actions) {
      for (const action of scene.actions) {
        extractFromAction(action, { audioFiles, imageFiles, videoFiles });
      }
    }

    // 检查whiteboards中的媒体引用
    if (scene.whiteboards) {
      for (const wb of scene.whiteboards) {
        extractFromWhiteboard(wb, { audioFiles, imageFiles, videoFiles });
      }
    }
  }

  // 去重
  return {
    audioFiles: Array.from(new Set(audioFiles)),
    imageFiles: Array.from(new Set(imageFiles)),
    videoFiles: Array.from(new Set(videoFiles)),
  };
}

/**
 * 从action中提取媒体路径
 */
function extractFromAction(action: Action, paths: MediaPaths): void {
  // Speech action - 可能有音频文件
  if (action.type === 'speech') {
    if ('audioFile' in action && action.audioFile) {
      paths.audioFiles.push(action.audioFile as string);
    }
    if ('audioUrl' in action && action.audioUrl) {
      paths.audioFiles.push(action.audioUrl as string);
    }
  }

  // PlayVideo action - 可能有视频文件
  if (action.type === 'play_video') {
    if ('videoFile' in action && action.videoFile) {
      paths.videoFiles.push(action.videoFile as string);
    }
    if ('videoUrl' in action && action.videoUrl) {
      paths.videoFiles.push(action.videoUrl as string);
    }
  }

  // Image elements in slides - 可能的图片文件
  // 这些通常在content.elements中，需要递归查找
}

/**
 * 从whiteboard中提取媒体路径
 */
function extractFromWhiteboard(wb: any, paths: MediaPaths): void {
  // 检查elements
  if (wb.elements) {
    for (const element of wb.elements) {
      if (element.type === 'image') {
        const src = (element as any).src;
        if (src && !src.startsWith('data:')) {
          // 如果不是data URL，添加到图片列表
          paths.imageFiles.push(src);
        }
      }
    }
  }
}

/**
 * 生成相对路径（用于存储）
 */
export function normalizeMediaPaths(paths: MediaPaths, classroomId: string): MediaPaths {
  const normalize = (path: string): string => {
    // 如果是绝对URL，保持不变
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    // 如果是相对路径，确保格式正确
    if (path.startsWith('/')) {
      return `.${path}`;
    }

    return path;
  };

  return {
    audioFiles: paths.audioFiles.map(normalize),
    imageFiles: paths.imageFiles.map(normalize),
    videoFiles: paths.videoFiles.map(normalize),
  };
}
