// 收入分配计算测试

import { describe, it, expect } from 'vitest'

describe('Revenue Settlement Calculation', () => {
  describe('calculateSplit', () => {
    it('should split revenue correctly for standard amount', () => {
      const totalRevenue = 10000 // 100元 (分为单位)
      const splits = calculateRevenueSplit(totalRevenue)

      // 60/20/20 分配
      expect(splits.teacher).toBe(6000)
      expect(splits.partner).toBe(2000)
      expect(splits.platform).toBe(2000)
      expect(splits.teacher + splits.partner + splits.platform).toBe(totalRevenue)
    })

    it('should handle odd amounts with rounding', () => {
      const totalRevenue = 10001 // 100.01元
      const splits = calculateRevenueSplit(totalRevenue)

      // 总和应该等于原始金额
      expect(splits.teacher + splits.partner + splits.platform).toBe(totalRevenue)
      // 平台获得余数
      expect(splits.platform).toBe(2001)
    })

    it('should handle zero amount', () => {
      const totalRevenue = 0
      const splits = calculateRevenueSplit(totalRevenue)

      expect(splits.teacher).toBe(0)
      expect(splits.partner).toBe(0)
      expect(splits.platform).toBe(0)
    })

    it('should handle very large amounts', () => {
      const totalRevenue = 100000000 // 1,000,000元
      const splits = calculateRevenueSplit(totalRevenue)

      expect(splits.teacher).toBe(60000000)
      expect(splits.partner).toBe(20000000)
      expect(splits.platform).toBe(20000000)
    })
  })

  describe('settlementStatus', () => {
    it('should determine settlement eligibility', () => {
      expect(canSettle({ status: 'PAID', settlementStatus: 'UNSETTLED' })).toBe(true)
      expect(canSettle({ status: 'PAID', settlementStatus: 'SETTLED' })).toBe(false)
      expect(canSettle({ status: 'PENDING', settlementStatus: 'UNSETTLED' })).toBe(false)
      expect(canSettle({ status: 'REFUNDED', settlementStatus: 'UNSETTLED' })).toBe(false)
    })
  })

  describe('teacherCommission', () => {
    it('should calculate base commission correctly', () => {
      const revenue = 10000
      const commission = calculateTeacherCommission(revenue, 'BASE')
      expect(commission).toBe(6000)
    })

    it('should apply senior teacher bonus', () => {
      const revenue = 10000
      const commission = calculateTeacherCommission(revenue, 'SENIOR')
      // 高级教师可能获得额外 5% 奖励
      expect(commission).toBe(6500)
    })

    it('should apply expert teacher bonus', () => {
      const revenue = 10000
      const commission = calculateTeacherCommission(revenue, 'EXPERT')
      // 专家教师可能获得额外 10% 奖励
      expect(commission).toBe(7000)
    })
  })
})

// 测试辅助函数

interface RevenueSplit {
  teacher: number
  partner: number
  platform: number
}

function calculateRevenueSplit(totalRevenue: number): RevenueSplit {
  const teacherShare = Math.floor(totalRevenue * 0.6)
  const partnerShare = Math.floor(totalRevenue * 0.2)
  const platformShare = totalRevenue - teacherShare - partnerShare

  return {
    teacher: teacherShare,
    partner: partnerShare,
    platform: platformShare
  }
}

interface PaymentStatus {
  status: string
  settlementStatus: string
}

function canSettle(payment: PaymentStatus): boolean {
  return payment.status === 'PAID' && payment.settlementStatus === 'UNSETTLED'
}

function calculateTeacherCommission(revenue: number, level: string): number {
  const baseRate = 0.6
  let rate = baseRate

  if (level === 'SENIOR') {
    rate = 0.65
  } else if (level === 'EXPERT') {
    rate = 0.7
  }

  return Math.floor(revenue * rate)
}
