/**
 * 增强版任务调度器
 *
 * 支持 Cron 表达式的定时任务
 */

import { parseCron, CRON_PRESETS, type ParsedCron } from './cron-parser'

export interface ScheduledTask {
  id: string
  name: string
  schedule: string // cron expression
  enabled: boolean
  handler: () => Promise<any>
  lastRun?: Date
  nextRun?: Date
  description?: string
}

interface ScheduledJob {
  task: ScheduledTask
  parsed: ParsedCron
  timeout?: NodeJS.Timeout
}

class EnhancedTaskScheduler {
  private tasks: Map<string, ScheduledTask> = new Map()
  private jobs: Map<string, ScheduledJob> = new Map()
  private running = false
  private checkInterval: NodeJS.Timeout | null = null
  private readonly CHECK_INTERVAL_MS = 60000 // 每分钟检查一次

  /**
   * 注册任务
   */
  register(task: ScheduledTask) {
    this.tasks.set(task.id, task)
    console.log(`[Scheduler] 任务已注册: ${task.name} (${task.schedule})`)
  }

  /**
   * 启动调度器
   */
  start() {
    if (this.running) {
      console.log('[Scheduler] 调度器已在运行')
      return
    }

    this.running = true
    console.log('[Scheduler] 启动增强版调度器')

    // 计算所有任务的下次运行时间
    this.tasks.forEach((task) => {
      if (task.enabled) {
        this.scheduleTask(task)
      }
    })

    // 启动定期检查
    this.checkInterval = setInterval(() => {
      this.checkAndExecute()
    }, this.CHECK_INTERVAL_MS)

    console.log(`[Scheduler] 已调度 ${this.jobs.size} 个任务`)
  }

  /**
   * 停止调度器
   */
  stop() {
    this.running = false

    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }

    // 清除所有定时任务
    this.jobs.forEach((job) => {
      if (job.timeout) {
        clearTimeout(job.timeout)
      }
    })
    this.jobs.clear()

    console.log('[Scheduler] 调度器已停止')
  }

  /**
   * 调度单个任务
   */
  private scheduleTask(task: ScheduledTask) {
    try {
      const parsed = parseCron(task.schedule)
      const nextRun = parsed.nextRun(new Date())

      const job: ScheduledJob = {
        task,
        parsed
      }

      this.jobs.set(task.id, job)
      task.nextRun = nextRun

      // 计算延迟时间
      const delay = nextRun.getTime() - Date.now()

      // 设置超时执行
      if (delay > 0 && delay < 365 * 24 * 60 * 60 * 1000) { // 不超过一年
        job.timeout = setTimeout(async () => {
          await this.executeTask(task.id)
          // 重新调度下次运行
          if (this.running && task.enabled) {
            this.scheduleTask(task)
          }
        }, delay)

        console.log(`[Scheduler] ${task.name} 下次运行: ${nextRun.toLocaleString('zh-CN')}`)
      }
    } catch (error) {
      console.error(`[Scheduler] 调度任务失败 ${task.name}:`, error)
    }
  }

  /**
   * 检查并执行到期任务
   */
  private async checkAndExecute() {
    const now = new Date()

    for (const [taskId, job] of this.jobs) {
      if (!job.task.enabled) continue

      if (job.task.nextRun && job.task.nextRun <= now) {
        await this.executeTask(taskId)
        // 重新调度
        this.scheduleTask(job.task)
      }
    }
  }

  /**
   * 执行任务
   */
  private async executeTask(taskId: string) {
    const job = this.jobs.get(taskId)
    if (!job || !job.task.enabled) return

    const task = job.task
    const startTime = Date.now()
    console.log(`[Scheduler] 开始执行任务: ${task.name}`)

    try {
      await task.handler()
      const duration = Date.now() - startTime
      console.log(`[Scheduler] 任务完成: ${task.name} (${duration}ms)`)

      // 更新最后执行时间
      task.lastRun = new Date()

      // 计算新的下次运行时间
      const nextRun = job.parsed.nextRun(new Date())
      task.nextRun = nextRun
    } catch (error) {
      console.error(`[Scheduler] 任务执行失败: ${task.name}`, error)

      // 仍然更新下次运行时间，避免因错误而中断调度
      const nextRun = job.parsed.nextRun(new Date())
      task.nextRun = nextRun
    }
  }

  /**
   * 手动触发任务
   */
  async trigger(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId)
    if (!task) {
      console.error(`[Scheduler] 任务不存在: ${taskId}`)
      return false
    }

    console.log(`[Scheduler] 手动触发任务: ${task.name}`)
    await this.executeTask(taskId)
    return true
  }

  /**
   * 获取所有任务状态
   */
  getStatus() {
    return Array.from(this.tasks.values()).map(task => {
      const job = this.jobs.get(task.id)
      return {
        id: task.id,
        name: task.name,
        enabled: task.enabled,
        schedule: task.schedule,
        description: task.description || job?.parsed.description || '',
        lastRun: task.lastRun?.toISOString(),
        nextRun: task.nextRun?.toISOString()
      }
    })
  }

  /**
   * 启用/禁用任务
   */
  toggle(taskId: string, enabled: boolean) {
    const task = this.tasks.get(taskId)
    if (!task) return

    task.enabled = enabled
    console.log(`[Scheduler] 任务${enabled ? '启用' : '禁用'}: ${task.name}`)

    if (enabled) {
      if (this.running) {
        this.scheduleTask(task)
      }
    } else {
      const job = this.jobs.get(taskId)
      if (job?.timeout) {
        clearTimeout(job.timeout)
      }
      this.jobs.delete(taskId)
    }
  }

  /**
   * 更新任务调度
   */
  reschedule(taskId: string, newSchedule: string) {
    const task = this.tasks.get(taskId)
    if (!task) return

    // 停止现有调度
    const job = this.jobs.get(taskId)
    if (job?.timeout) {
      clearTimeout(job.timeout)
    }

    // 更新调度
    task.schedule = newSchedule
    console.log(`[Scheduler] 重新调度: ${task.name} -> ${newSchedule}`)

    if (this.running && task.enabled) {
      this.scheduleTask(task)
    }
  }

  /**
   * 添加任务（运行时动态添加）
   */
  addTask(task: ScheduledTask) {
    this.register(task)
    if (this.running && task.enabled) {
      this.scheduleTask(task)
    }
  }

  /**
   * 移除任务
   */
  removeTask(taskId: string) {
    const job = this.jobs.get(taskId)
    if (job?.timeout) {
      clearTimeout(job.timeout)
    }

    this.jobs.delete(taskId)
    this.tasks.delete(taskId)
    console.log(`[Scheduler] 任务已移除: ${taskId}`)
  }
}

// 创建全局调度器实例
const globalScheduler = new EnhancedTaskScheduler()

export { globalScheduler }
export type { ScheduledTask }
export { CRON_PRESETS }
