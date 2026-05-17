// 标识符生成工具测试

import { describe, it, expect } from 'vitest'
import { generateIdentifier, generatePaperCode } from './identifier'

describe('Identifier Utils', () => {
  describe('generateIdentifier', () => {
    it('should generate string with correct format', () => {
      const id = generateIdentifier()
      const parts = id.split('-')

      expect(parts).toHaveLength(3)
      expect(parts[2]).toMatch(/^\d{4}$/) // 4位数字
    })

    it('should generate unique identifiers', () => {
      const ids = new Set()

      for (let i = 0; i < 500; i++) {
        ids.add(generateIdentifier())
      }

      // 500个标识符应该基本不重复（容许少量碰撞是正常的）
      expect(ids.size).toBeGreaterThanOrEqual(495)
    })
  })

  describe('generatePaperCode', () => {
    it('should generate 6 character code', () => {
      const code = generatePaperCode()
      expect(code).toHaveLength(6)
    })

    it('should only contain uppercase letters and numbers', () => {
      const code = generatePaperCode()
      expect(code).toMatch(/^[A-Z0-9]+$/)
    })

    it('should not contain ambiguous characters', () => {
      // 排除 I, O, 0, 1
      const codes = Array.from({ length: 100 }, () => generatePaperCode())
      const allChars = codes.join('')

      expect(allChars).not.toContain('I')
      expect(allChars).not.toContain('O')
      expect(allChars).not.toContain('0')
      expect(allChars).not.toContain('1')
    })

    it('should generate unique codes', () => {
      const codes = new Set()

      for (let i = 0; i < 1000; i++) {
        codes.add(generatePaperCode())
      }

      // 1000个6位码应该基本不重复（容许少量碰撞）
      expect(codes.size).toBeGreaterThan(990)
    })
  })
})
