// 线索状态转换测试

import { describe, it, expect } from 'vitest'

describe('Lead Status Transitions', () => {
  describe('isValidTransition', () => {
    it('should allow valid forward transitions', () => {
      expect(canTransition('NEW', 'CONTACTED')).toBe(true)
      expect(canTransition('CONTACTED', 'SCHEDULED')).toBe(true)
      expect(canTransition('SCHEDULED', 'COMPLETED')).toBe(true)
      expect(canTransition('COMPLETED', 'CONVERTED')).toBe(true)
      expect(canTransition('COMPLETED', 'LOST')).toBe(true)
    })

    it('should reject backward transitions', () => {
      expect(canTransition('CONTACTED', 'NEW')).toBe(false)
      expect(canTransition('SCHEDULED', 'CONTACTED')).toBe(false)
      expect(canTransition('COMPLETED', 'SCHEDULED')).toBe(false)
    })

    it('should allow transition from any state to LOST', () => {
      expect(canTransition('NEW', 'LOST')).toBe(true)
      expect(canTransition('CONTACTED', 'LOST')).toBe(true)
      expect(canTransition('SCHEDULED', 'LOST')).toBe(true)
      expect(canTransition('COMPLETED', 'LOST')).toBe(true)
    })

    it('should reject transitions from terminal states', () => {
      expect(canTransition('CONVERTED', 'CONTACTED')).toBe(false)
      expect(canTransition('CONVERTED', 'SCHEDULED')).toBe(false)
      expect(canTransition('LOST', 'CONTACTED')).toBe(false)
      expect(canTransition('LOST', 'SCHEDULED')).toBe(false)
    })

    it('should reject invalid state transitions', () => {
      expect(canTransition('NEW', 'CONVERTED')).toBe(false)
      expect(canTransition('CONTACTED', 'COMPLETED')).toBe(false)
      expect(canTransition('NEW', 'LOST')).toBe(true) // 但这可能是业务决策
    })
  })

  describe('conversionRate', () => {
    it('should calculate conversion rate correctly', () => {
      const stats = {
        totalLeads: 100,
        convertedLeads: 25
      }
      expect(calculateConversionRate(stats)).toBe(25)
    })

    it('should handle zero total leads', () => {
      const stats = {
        totalLeads: 0,
        convertedLeads: 0
      }
      expect(calculateConversionRate(stats)).toBe(0)
    })

    it('should handle fractional rates', () => {
      const stats = {
        totalLeads: 3,
        convertedLeads: 1
      }
      expect(calculateConversionRate(stats)).toBe(33) // 33.33% 四舍五入
    })
  })

  describe('funnelMetrics', () => {
    it('should calculate funnel stage conversion rates', () => {
      const leads = [
        { status: 'NEW' },
        { status: 'NEW' },
        { status: 'CONTACTED' },
        { status: 'CONTACTED' },
        { status: 'CONTACTED' },
        { status: 'SCHEDULED' },
        { status: 'SCHEDULED' },
        { status: 'COMPLETED' },
        { status: 'CONVERTED' }
      ]

      const metrics = calculateFunnelMetrics(leads)

      expect(metrics.total).toBe(9)
      expect(metrics.byStatus.NEW).toBe(2)
      expect(metrics.byStatus.CONTACTED).toBe(3)
      expect(metrics.byStatus.SCHEDULED).toBe(2)
      expect(metrics.byStatus.COMPLETED).toBe(1)
      expect(metrics.byStatus.CONVERTED).toBe(1)
    })

    it('should calculate drop-off rates', () => {
      const metrics = {
        total: 100,
        byStatus: {
          NEW: 100,
          CONTACTED: 60,
          SCHEDULED: 40,
          COMPLETED: 25,
          CONVERTED: 10
        }
      }

      const dropOff = calculateDropOffRates(metrics)

      expect(dropOff.NEW_TO_CONTACTED).toBe(40) // 40% 丢失
      expect(dropOff.CONTACTED_TO_SCHEDULED).toBe(33) // ~33% 丢失
      expect(dropOff.SCHEDULED_TO_COMPLETED).toBe(38) // ~38% 丢失
      expect(dropOff.COMPLETED_TO_CONVERTED).toBe(60) // 60% 丢失
    })
  })
})

// 测试辅助函数

type LeadStatus = 'NEW' | 'CONTACTED' | 'SCHEDULED' | 'COMPLETED' | 'CONVERTED' | 'LOST'

const VALID_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW: ['CONTACTED', 'LOST'],
  CONTACTED: ['SCHEDULED', 'LOST'],
  SCHEDULED: ['COMPLETED', 'LOST'],
  COMPLETED: ['CONVERTED', 'LOST'],
  CONVERTED: [], // 终态
  LOST: [] // 终态
}

function canTransition(from: LeadStatus, to: LeadStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to)
}

interface LeadStats {
  totalLeads: number
  convertedLeads: number
}

function calculateConversionRate(stats: LeadStats): number {
  if (stats.totalLeads === 0) return 0
  return Math.round((stats.convertedLeads / stats.totalLeads) * 100)
}

interface Lead {
  status: LeadStatus
}

interface FunnelMetrics {
  total: number
  byStatus: Record<string, number>
}

function calculateFunnelMetrics(leads: Lead[]): FunnelMetrics {
  const byStatus: Record<string, number> = {}

  for (const lead of leads) {
    byStatus[lead.status] = (byStatus[lead.status] || 0) + 1
  }

  return {
    total: leads.length,
    byStatus
  }
}

function calculateDropOffRates(metrics: FunnelMetrics): Record<string, number> {
  const { byStatus } = metrics

  return {
    NEW_TO_CONTACTED: Math.round((1 - (byStatus.CONTACTED || 0) / (byStatus.NEW || 1)) * 100),
    CONTACTED_TO_SCHEDULED: Math.round((1 - (byStatus.SCHEDULED || 0) / (byStatus.CONTACTED || 1)) * 100),
    SCHEDULED_TO_COMPLETED: Math.round((1 - (byStatus.COMPLETED || 0) / (byStatus.SCHEDULED || 1)) * 100),
    COMPLETED_TO_CONVERTED: Math.round((1 - (byStatus.CONVERTED || 0) / (byStatus.COMPLETED || 1)) * 100)
  }
}
