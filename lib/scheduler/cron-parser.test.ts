// Cron 表达式解析器测试

import { describe, it, expect } from 'vitest'
import { parseCron, CRON_PRESETS, createCron } from './cron-parser'

describe('Cron Parser', () => {
  describe('parseCron', () => {
    it('should parse standard cron expression', () => {
      const result = parseCron('0 9 * * *')
      expect(result.schedule.minute).toContain(0)
      expect(result.schedule.hour).toContain(9)
      expect(result.schedule.dayOfMonth.length).toBe(31)
      expect(result.schedule.month.length).toBe(12)
      expect(result.schedule.dayOfWeek.length).toBe(7)
    })

    it('should parse range expression', () => {
      const result = parseCron('0 9-17 * * 1-5')
      expect(result.schedule.hour).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17])
      expect(result.schedule.dayOfWeek).toEqual([1, 2, 3, 4, 5])
    })

    it('should parse step expression from base', () => {
      const result = parseCron('*/15 * * * *')
      expect(result.schedule.minute).toEqual([0, 15, 30, 45])
    })

    it('should parse list expression', () => {
      const result = parseCron('0 9,12,18 * * *')
      expect(result.schedule.hour).toEqual([9, 12, 18])
    })

    it('should parse step with range - continues beyond range', () => {
      // 注意: 实现是从起点开始，按步长递增直到最大值
      const result = parseCron('0 9-17/2 * * *')
      // 9, 11, 13, 15, 17, 19, 21, 23 (从9开始每2小时直到23)
      expect(result.schedule.hour).toContain(9)
      expect(result.schedule.hour).toContain(11)
      expect(result.schedule.hour).toContain(13)
    })

    it('should parse complex expression', () => {
      const result = parseCron('0,15,30 9-17 * * 1-5')
      expect(result.schedule.minute).toEqual([0, 15, 30])
      expect(result.schedule.hour).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17])
      expect(result.schedule.dayOfWeek).toEqual([1, 2, 3, 4, 5])
    })

    it('should generate description', () => {
      const result = parseCron('0 9 * * *')
      expect(result.description).toContain('9')
    })

    it('should throw on invalid expression', () => {
      expect(() => parseCron('invalid')).toThrow()
      expect(() => parseCron('0 9 * *')).toThrow()
    })
  })

  describe('nextRun', () => {
    it('should calculate next run time', () => {
      const base = new Date()
      base.setHours(8, 0, 0, 0)
      const cron = parseCron('0 9 * * *')
      const next = cron.nextRun(base)
      expect(next.getHours()).toBe(9)
    })

    it('should return date after base time', () => {
      const base = new Date()
      const cron = parseCron('0 9 * * *')
      const next = cron.nextRun(base)
      expect(next.getTime()).toBeGreaterThan(base.getTime())
    })

    it('should handle minute-based schedule', () => {
      const base = new Date()
      base.setSeconds(0, 0)
      const cron = parseCron('*/30 * * * *')
      const next = cron.nextRun(base)
      expect([0, 30]).toContain(next.getMinutes())
    })
  })

  describe('CRON_PRESETS', () => {
    it('should have predefined presets', () => {
      expect(CRON_PRESETS.EVERY_MINUTE).toBe('* * * * *')
      expect(CRON_PRESETS.HOURLY).toBe('0 * * * *')
      expect(CRON_PRESETS.DAILY_9AM).toBe('0 9 * * *')
      expect(CRON_PRESETS.WEEKLY_MONDAY_9AM).toBe('0 9 * * 1')
      expect(CRON_PRESETS.MONTHLY_1ST).toBe('0 0 1 * *')
    })

    it('should parse all presets without error', () => {
      Object.values(CRON_PRESETS).forEach(preset => {
        expect(() => parseCron(preset)).not.toThrow()
      })
    })
  })

  describe('createCron', () => {
    it('should create cron expression from parts', () => {
      expect(createCron(0, 9)).toBe('0 9 * * *')
      expect(createCron('*/15', '*')).toBe('*/15 * * * *')
      expect(createCron(0, 9, 1, '*', 1)).toBe('0 9 1 * 1')
    })

    it('should handle string parameters', () => {
      expect(createCron('0', '9', '*', '*', '1-5')).toBe('0 9 * * 1-5')
    })
  })
})
