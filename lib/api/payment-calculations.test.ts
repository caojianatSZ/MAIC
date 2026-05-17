// 支付计算测试

import { describe, it, expect } from 'vitest'

describe('Payment Calculations', () => {
  describe('amountToCents', () => {
    it('should convert yuan to cents', () => {
      expect(amountToCents(100)).toBe(10000)
      expect(amountToCents(99.99)).toBe(9999)
      expect(amountToCents(0.01)).toBe(1)
    })

    it('should handle zero', () => {
      expect(amountToCents(0)).toBe(0)
    })

    it('should round correctly', () => {
      expect(amountToCents(100.999)).toBe(10100)
      expect(amountToCents(100.494)).toBe(10049)
      expect(amountToCents(100.495)).toBe(10050)
    })
  })

  describe('centsToAmount', () => {
    it('should convert cents to yuan', () => {
      expect(centsToAmount(10000)).toBe(100)
      expect(centsToAmount(9999)).toBe(99.99)
      expect(centsToAmount(1)).toBe(0.01)
    })

    it('should handle zero', () => {
      expect(centsToAmount(0)).toBe(0)
    })
  })

  describe('calculatePlatformFee', () => {
    it('should calculate 20% platform fee', () => {
      expect(calculatePlatformFee(10000)).toBe(2000)
      expect(calculatePlatformFee(15000)).toBe(3000)
    })

    it('should handle small amounts', () => {
      expect(calculatePlatformFee(1)).toBe(0) // 0.2分四舍五入
      expect(calculatePlatformFee(5)).toBe(1)
    })

    it('should handle zero', () => {
      expect(calculatePlatformFee(0)).toBe(0)
    })
  })

  describe('calculateTeacherSalary', () => {
    it('should calculate 60% teacher salary', () => {
      expect(calculateTeacherSalary(10000)).toBe(6000)
      expect(calculateTeacherSalary(15000)).toBe(9000)
    })

    it('should handle small amounts', () => {
      expect(calculateTeacherSalary(1)).toBe(1) // 最小1分
      expect(calculateTeacherSalary(10)).toBe(6)
    })
  })

  describe('calculatePartnerCommission', () => {
    it('should calculate 20% partner commission', () => {
      expect(calculatePartnerCommission(10000)).toBe(2000)
      expect(calculatePartnerCommission(15000)).toBe(3000)
    })

    it('should handle small amounts', () => {
      expect(calculatePartnerCommission(1)).toBe(0)
      expect(calculatePartnerCommission(10)).toBe(2)
    })
  })

  describe('fullPaymentSplit', () => {
    it('should split payment correctly', () => {
      const split = fullPaymentSplit(10000)

      expect(split.total).toBe(10000)
      expect(split.teacherSalary).toBe(6000)
      expect(split.partnerCommission).toBe(2000)
      expect(split.platformRevenue).toBe(2000)
      // 验证总和一致
      expect(split.teacherSalary + split.partnerCommission + split.platformRevenue).toBe(split.total)
    })

    it('should handle rounding correctly', () => {
      const split = fullPaymentSplit(10001)

      // 余数归平台
      expect(split.total).toBe(10001)
      expect(split.teacherSalary).toBe(6000)
      expect(split.partnerCommission).toBe(2000)
      expect(split.platformRevenue).toBe(2001)
    })

    it('should handle zero amount with minimum salary', () => {
      const split = fullPaymentSplit(0)

      expect(split.total).toBe(0)
      // 教师工资有最小值1分
      expect(split.teacherSalary).toBe(1)
      expect(split.platformRevenue).toBe(-1) // 负数以平衡
    })
  })

  describe('formatMoney', () => {
    it('should format cents as currency', () => {
      expect(formatMoney(10000)).toBe('¥100.00')
      expect(formatMoney(9999)).toBe('¥99.99')
      expect(formatMoney(1)).toBe('¥0.01')
    })

    it('should format large amounts', () => {
      expect(formatMoney(1000000)).toBe('¥10,000.00')
      expect(formatMoney(123456789)).toBe('¥1,234,567.89')
    })

    it('should handle negative amounts', () => {
      expect(formatMoney(-10000)).toBe('-¥100.00')
    })
  })
})

// 测试辅助函数

function amountToCents(yuan: number): number {
  return Math.round(yuan * 100)
}

function centsToAmount(cents: number): number {
  return cents / 100
}

function calculatePlatformFee(amountInCents: number): number {
  return Math.floor(amountInCents * 0.2)
}

function calculateTeacherSalary(amountInCents: number): number {
  const salary = Math.floor(amountInCents * 0.6)
  return salary > 0 ? salary : 1
}

function calculatePartnerCommission(amountInCents: number): number {
  return Math.floor(amountInCents * 0.2)
}

interface PaymentSplit {
  total: number
  teacherSalary: number
  partnerCommission: number
  platformRevenue: number
}

function fullPaymentSplit(amountInCents: number): PaymentSplit {
  const teacherSalary = calculateTeacherSalary(amountInCents)
  const partnerCommission = calculatePartnerCommission(amountInCents)
  const platformRevenue = amountInCents - teacherSalary - partnerCommission

  return {
    total: amountInCents,
    teacherSalary,
    partnerCommission,
    platformRevenue
  }
}

function formatMoney(cents: number): string {
  const yuan = Math.abs(cents) / 100
  const sign = cents < 0 ? '-' : ''
  return `${sign}¥${yuan.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
