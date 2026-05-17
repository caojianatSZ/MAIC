import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/hq-ops/cities - 获取城市列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: any = {}
    if (status) where.status = status

    const cities = await prisma.city.findMany({
      where,
      include: {
        partner: {
          select: { id: true, nickname: true, phoneNumber: true }
        },
        _count: {
          select: {
            trialLeads: true,
            bookings: true,
            users: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json({ cities })
  } catch (error) {
    console.error('获取城市列表失败:', error)
    return NextResponse.json(
      { error: '获取数据失败' },
      { status: 500 }
    )
  }
}

// POST /api/hq-ops/cities - 创建新城市
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, partnerId } = body

    if (!name) {
      return NextResponse.json(
        { error: '缺少城市名称' },
        { status: 400 }
      )
    }

    // 检查城市名是否已存在
    const existing = await prisma.city.findUnique({
      where: { name }
    })

    if (existing) {
      return NextResponse.json(
        { error: '城市名称已存在' },
        { status: 400 }
      )
    }

    // 如果指定了合伙人，验证其角色
    if (partnerId) {
      const partner = await prisma.user.findFirst({
        where: {
          id: partnerId,
          role: 'CITY_PARTNER'
        }
      })

      if (!partner) {
        return NextResponse.json(
          { error: '指定的用户不是城市合伙人' },
          { status: 400 }
        )
      }

      // 检查该合伙人是否已管理其他城市
      const existingCity = await prisma.city.findUnique({
        where: { partnerId }
      })

      if (existingCity) {
        return NextResponse.json(
          { error: '该合伙人已管理其他城市' },
          { status: 400 }
        )
      }
    }

    const city = await prisma.city.create({
      data: {
        name,
        partnerId,
        status: 'ACTIVE'
      },
      include: {
        partner: {
          select: { id: true, nickname: true, phoneNumber: true }
        }
      }
    })

    return NextResponse.json(city, { status: 201 })
  } catch (error) {
    console.error('创建城市失败:', error)
    return NextResponse.json(
      { error: '创建失败' },
      { status: 500 }
    )
  }
}
