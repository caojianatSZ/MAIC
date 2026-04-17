// lib/diagnosis/progress.ts

/**
 * 诊断任务进度管理
 * 用于存储和查询批改任务的进度
 */

export interface TaskProgress {
  taskId: string;
  status: 'processing' | 'completed' | 'failed';
  currentStep: number;
  totalSteps: number;
  stepMessage: string;
  result?: any;
  error?: string;
  timestamp: number;
}

// 内存存储（生产环境应使用 Redis）
const progressStore = new Map<string, TaskProgress>();

// 5分钟后自动清理
const CLEANUP_INTERVAL = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [taskId, progress] of progressStore.entries()) {
    if (now - progress.timestamp > CLEANUP_INTERVAL) {
      progressStore.delete(taskId);
    }
  }
}, CLEANUP_INTERVAL);

export function createTask(taskId: string, totalSteps: number = 8): TaskProgress {
  const progress: TaskProgress = {
    taskId,
    status: 'processing',
    currentStep: 0,
    totalSteps,
    stepMessage: '初始化...',
    timestamp: Date.now()
  };
  progressStore.set(taskId, progress);
  return progress;
}

export function updateProgress(taskId: string, currentStep: number, stepMessage: string): void {
  const progress = progressStore.get(taskId);
  if (progress) {
    progress.currentStep = currentStep;
    progress.stepMessage = stepMessage;
    progress.timestamp = Date.now();
  }
}

export function completeTask(taskId: string, result: any): void {
  const progress = progressStore.get(taskId);
  if (progress) {
    progress.status = 'completed';
    progress.currentStep = progress.totalSteps;
    progress.stepMessage = '完成';
    progress.result = result;
    progress.timestamp = Date.now();
  }
}

export function failTask(taskId: string, error: string): void {
  const progress = progressStore.get(taskId);
  if (progress) {
    progress.status = 'failed';
    progress.stepMessage = '处理失败';
    progress.error = error;
    progress.timestamp = Date.now();
  }
}

export function getProgress(taskId: string): TaskProgress | undefined {
  return progressStore.get(taskId);
}

export function deleteTask(taskId: string): void {
  progressStore.delete(taskId);
}
