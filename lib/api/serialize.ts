import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'

/**
 * 序列化 Prisma 对象，处理 Date、Decimal、BigInt 等类型
 */
export function serialize(data: any): any {
  if (data === null || data === undefined) {
    return data
  }

  if (data instanceof Date) {
    return data.toISOString()
  }

  if (data instanceof Prisma.Decimal) {
    return data.toNumber()
  }

  if (typeof data === 'bigint') {
    return data.toString()
  }

  if (Array.isArray(data)) {
    return data.map(serialize)
  }

  if (typeof data === 'object') {
    const result: Record<string, any> = {}
    for (const key in data) {
      // 跳过 Prisma 内部属性
      if (key.startsWith('_')) continue
      result[key] = serialize(data[key])
    }
    return result
  }

  return data
}

/**
 * 包装 NextResponse，自动序列化 Prisma 对象
 */
export function jsonResponse(data: any, status?: number) {
  return NextResponse.json(serialize(data), { status })
}
