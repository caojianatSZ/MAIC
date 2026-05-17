// 学科网 API 签名工具
// 文档: https://www.xkw.com/open/doc

import { createHash } from 'crypto'

/**
 * 生成学科网 API 签名
 * @param params 请求参数
 * @param appSecret 应用密钥
 * @returns MD5 签名字符串
 */
export function generateSignature(params: Record<string, any>, appSecret: string): string {
  // 1. 过滤空值参数
  const filteredParams = Object.entries(params).filter(
    ([, value]) => value !== null && value !== undefined && value !== ''
  )

  // 2. 按参数名 ASCII 码升序排序
  filteredParams.sort(([a], [b]) => a.localeCompare(b))

  // 3. 拼接参数字符串: key1value1key2value2...
  const paramStr = filteredParams.map(([key, value]) => `${key}${value}`).join('')

  // 4. 拼接 appSecret: paramStr + appSecret
  const signStr = paramStr + appSecret

  // 5. MD5 加密并转大写
  return createHash('md5').update(signStr, 'utf-8').digest('hex').toUpperCase()
}

/**
 * 生成请求时间戳（秒级）
 */
export function generateTimestamp(): number {
  return Math.floor(Date.now() / 1000)
}

/**
 * 生成随机 nonce
 */
export function generateNonce(): string {
  return Math.random().toString(36).substring(2, 15)
}
