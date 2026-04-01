/**
 * 成就解锁通知API
 * POST /api/notify/achievement
 * 当孩子解锁成就时，向家长发送订阅消息通知
 */

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 微信订阅消息模板ID（需要在微信公众平台配置）
const TEMPLATE_IDS = {
  achievement_unlock: 'YOUR_TEMPLATE_ID_HERE' // 替换为实际的模板ID
}

/**
 * POST 发送成就解锁通知
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      userId,
      achievementId,
      openId, // 家长的微信openId
      accessToken
    } = body

    if (!userId || !achievementId || !openId) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数'
      }, { status: 400 })
    }

    // 获取成就信息
    const achievement = await prisma.achievement.findUnique({
      where: { id: achievementId }
    })

    if (!achievement) {
      return NextResponse.json({
        success: false,
        error: '成就不存在'
      }, { status: 404 })
    }

    // 获取用户信息
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        wechatUserInfo: true
      }
    })

    if (!user) {
      return NextResponse.json({
        success: false,
        error: '用户不存在'
      }, { status: 404 })
    }

    // 获取学生画像中的学习统计
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId }
    })

    const studyStats = studentProfile?.studyStats as any || {}

    // 调用微信订阅消息API
    const notifyResult = await sendWechatSubscribeMessage({
      openId,
      templateId: TEMPLATE_IDS.achievement_unlock,
      data: {
        thing1: { // 成就名称
          value: achievement.name
        },
        thing2: { // 孩子昵称
          value: user.nickname || '孩子'
        },
        character_string3: { // 掌握度
          value: achievement.level === 'king' ? '王者' :
                  achievement.level === 'diamond' ? '精通' :
                  achievement.level === 'gold' ? '熟练' :
                  achievement.level === 'silver' ? '进阶' : '初识'
        },
        number4: { // 学习天数
          value: studyStats.currentStreak || 0
        },
        thing5: { // 科目
          value: achievement.subject === 'math' ? '数学' :
                  achievement.subject === 'english' ? '英语' :
                  achievement.subject === 'physics' ? '物理' : '学习'
        }
      },
      accessToken
    })

    if (!notifyResult.success) {
      return NextResponse.json({
        success: false,
        error: '发送通知失败',
        detail: notifyResult.error
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        message: '通知发送成功',
        achievement: achievement.name
      }
    })

  } catch (error) {
    console.error('发送成就通知失败:', error)
    return NextResponse.json({
      success: false,
      error: '发送成就通知失败'
    }, { status: 500 })
  }
}

/**
 * 调用微信订阅消息API
 */
async function sendWechatSubscribeMessage(params: {
  openId: string
  templateId: string
  data: Record<string, any>
  accessToken: string
}) {
  const { openId, templateId, data, accessToken } = params

  try {
    const response = await fetch(`https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        touser: openId,
        template_id: templateId,
        page: 'pages/profile/profile',
        data
      })
    })

    const result = await response.json()

    if (result.errcode === 0) {
      return { success: true }
    } else {
      return {
        success: false,
        error: {
          errcode: result.errcode,
          errmsg: result.errmsg
        }
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '发送消息失败'
    }
  }
}
