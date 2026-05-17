/**
 * Cron 表达式解析器
 *
 * 支持简化的 Cron 格式: 分 时 日 月 周
 * 例如: "0 9 * * *" = 每天早上9点
 */

export interface CronSchedule {
  minute: number[] // 0-59
  hour: number[]   // 0-23
  dayOfMonth: number[] // 1-31
  month: number[]  // 1-12
  dayOfWeek: number[]  // 0-6 (0=周日)
}

export interface ParsedCron {
  raw: string
  schedule: CronSchedule
  nextRun(date: Date): Date
  description: string
}

/**
 * 解析 Cron 表达式
 */
export function parseCron(cronExpression: string): ParsedCron {
  const parts = cronExpression.trim().split(/\s+/)
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: ${cronExpression}`)
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts

  const schedule: CronSchedule = {
    minute: parseField(minute, 0, 59),
    hour: parseField(hour, 0, 23),
    dayOfMonth: parseField(dayOfMonth, 1, 31),
    month: parseField(month, 1, 12),
    dayOfWeek: parseField(dayOfWeek, 0, 6)
  }

  return {
    raw: cronExpression,
    schedule,
    nextRun: (date: Date) => getNextRun(schedule, date),
    description: describeSchedule(schedule)
  }
}

/**
 * 解析单个字段
 */
function parseField(field: string, min: number, max: number): number[] {
  const values: number[] = []

  // 通配符
  if (field === '*') {
    for (let i = min; i <= max; i++) {
      values.push(i)
    }
    return values
  }

  // 步长
  if (field.includes('/')) {
    const [base, step] = field.split('/')
    const start = base === '*' ? min : parseInt(base)
    const stepValue = parseInt(step)
    for (let i = start; i <= max; i += stepValue) {
      values.push(i)
    }
    return values
  }

  // 范围
  if (field.includes('-')) {
    const [start, end] = field.split('-').map(v => parseInt(v))
    for (let i = start; i <= end; i++) {
      values.push(i)
    }
    return values
  }

  // 列表
  if (field.includes(',')) {
    return field.split(',').map(v => parseInt(v))
  }

  // 单个值
  values.push(parseInt(field))
  return values
}

/**
 * 计算下次运行时间
 */
function getNextRun(schedule: CronSchedule, fromDate: Date = new Date()): Date {
  const date = new Date(fromDate)
  date.setSeconds(0, 0)

  // 尝试在接下来的一年内找到匹配的时间
  for (let i = 0; i < 365 * 24 * 60; i++) {
    date.setMinutes(date.getMinutes() + 1)

    const minute = date.getMinutes()
    const hour = date.getHours()
    const dayOfMonth = date.getDate()
    const month = date.getMonth() + 1
    const dayOfWeek = date.getDay()

    if (
      schedule.minute.includes(minute) &&
      schedule.hour.includes(hour) &&
      schedule.dayOfMonth.includes(dayOfMonth) &&
      schedule.month.includes(month) &&
      schedule.dayOfWeek.includes(dayOfWeek)
    ) {
      // 找到匹配时间，且必须晚于传入时间
      if (date > fromDate) {
        return new Date(date)
      }
    }
  }

  // 如果找不到，返回一年后
  const nextYear = new Date(fromDate)
  nextYear.setFullYear(nextYear.getFullYear() + 1)
  return nextYear
}

/**
 * 生成调度描述
 */
function describeSchedule(schedule: CronSchedule): string {
  const minuteDesc = describeField(schedule.minute, '分')
  const hourDesc = describeField(schedule.hour, '点')
  const dayDesc = schedule.dayOfMonth.length === 31 ? '每天' : `每月${schedule.dayOfMonth.join(',')}日`
  const monthDesc = schedule.month.length === 12 ? '' : `${schedule.month.join(',')}月`

  return `${dayDesc}${monthDesc}${hourDesc}${minuteDesc}`
}

function describeField(values: number[], unit: string): string {
  if (values.length === 1) {
    return `${values[0]}${unit}`
  }
  if (values.length === 60 || values.length === 24 || values.length === 31 || values.length === 12 || values.length === 7) {
    return '每' + unit
  }
  if (isConsecutive(values)) {
    return `${values[0]}-${values[values.length - 1]}${unit}`
  }
  return `${values.join(',')}${unit}`
}

function isConsecutive(arr: number[]): boolean {
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] !== arr[i - 1] + 1) {
      return false
    }
  }
  return true
}

/**
 * Cron 预设
 */
export const CRON_PRESETS = {
  EVERY_MINUTE: '* * * * *',
  EVERY_5_MINUTES: '*/5 * * * *',
  EVERY_15_MINUTES: '*/15 * * * *',
  EVERY_30_MINUTES: '*/30 * * * *',
  HOURLY: '0 * * * *',
  DAILY_MIDNIGHT: '0 0 * * *',
  DAILY_9AM: '0 9 * * *',
  DAILY_6PM: '0 18 * * *',
  WEEKLY_MONDAY_9AM: '0 9 * * 1',
  WEEKLY_SUNDAY_10AM: '0 10 * * 0',
  MONTHLY_1ST: '0 0 1 * *',
  HOURLY_BUSINESS: '0 9-17 * * 1-5'
}

/**
 * 快速创建 Cron 表达式
 */
export function createCron(
  minute: number | string = 0,
  hour: number | string = 0,
  dayOfMonth: number | string = '*',
  month: number | string = '*',
  dayOfWeek: number | string = '*'
): string {
  return `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`
}
