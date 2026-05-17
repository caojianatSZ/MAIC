// 学科网签名工具测试

import { describe, it, expect } from 'vitest'
import { generateSignature, generateTimestamp, generateNonce } from './signature'

describe('XKW Signature', () => {
  it('should generate consistent signature for same params', () => {
    const params = { a: '1', b: '2', c: '3' }
    const secret = 'test_secret'

    const sig1 = generateSignature(params, secret)
    const sig2 = generateSignature(params, secret)

    expect(sig1).toBe(sig2)
  })

  it('should generate different signature for different secret', () => {
    const params = { a: '1', b: '2' }

    const sig1 = generateSignature(params, 'secret1')
    const sig2 = generateSignature(params, 'secret2')

    expect(sig1).not.toBe(sig2)
  })

  it('should filter out null and undefined values', () => {
    const params1 = { a: '1', b: null, c: undefined }
    const params2 = { a: '1' }

    const sig1 = generateSignature(params1, 'secret')
    const sig2 = generateSignature(params2, 'secret')

    expect(sig1).toBe(sig2)
  })

  it('should generate timestamp as number', () => {
    const ts = generateTimestamp()
    expect(typeof ts).toBe('number')
    expect(ts).toBeGreaterThan(0)
  })

  it('should generate nonce as string', () => {
    const nonce = generateNonce()
    expect(typeof nonce).toBe('string')
    expect(nonce.length).toBeGreaterThan(0)
  })

  it('should sort params alphabetically', () => {
    // 相同参数不同顺序应产生相同签名
    const params1 = { z: '1', a: '2', m: '3' }
    const params2 = { a: '2', m: '3', z: '1' }

    const sig1 = generateSignature(params1, 'secret')
    const sig2 = generateSignature(params2, 'secret')

    expect(sig1).toBe(sig2)
  })
})
