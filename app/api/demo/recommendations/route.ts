import { NextRequest, NextResponse } from 'next/server'
import { getRecommendations } from '@/lib/edukg/recommendation'

/**
 * 智能推荐API
 * GET /api/demo/recommendations?grade=初三&subject=数学&limit=8
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const grade = searchParams.get('grade')
    const subject = searchParams.get('subject')
    const limit = parseInt(searchParams.get('limit') || '8', 10)

    // 调试日志 - 详细输出
    console.log('=== 推荐API调用 ===')
    console.log('原始URL:', request.url)
    console.log('解析参数:', { grade, subject, limit })
    console.log('grade === "初三":', grade === '初三')
    console.log('subject === "数学":', subject === '数学')
    if (grade) {
      console.log('grade字节:', Buffer.from(grade).toString('hex'))
      console.log('grade长度:', grade.length)
      console.log('grade charCodes:', Array.from(grade).map(c => c.charCodeAt(0)))
    }

    // 参数验证
    if (!grade || !subject) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数: grade 和 subject'
      }, { status: 400 })
    }

    // 获取推荐
    const recommendations = await getRecommendations(grade, subject, limit)

    console.log('推荐结果:', recommendations.length, '条')
    if (recommendations.length > 0) {
      console.log('第一个推荐:', recommendations[0].topic, recommendations[0].knowledgePointId)
    }

    return NextResponse.json({
      success: true,
      data: {
        grade,
        subject,
        count: recommendations.length,
        recommendations
      }
    })
  } catch (error) {
    console.error('推荐API错误:', error)
    return NextResponse.json({
      success: false,
      error: '获取推荐失败'
    }, { status: 500 })
  }
}
