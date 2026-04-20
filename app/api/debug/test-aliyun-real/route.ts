// app/api/debug/test-aliyun-real/route.ts
/**
 * 使用真实图片测试阿里云EduTutor API
 */

import { NextRequest, NextResponse } from 'next/server';
import { cutQuestions } from '@/lib/aliyun/edututor-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json({
        error: '缺少imageUrl参数'
      }, { status: 400 });
    }

    console.log('========================================');
    console.log('使用真实图片测试阿里云EduTutor API');
    console.log('========================================');
    console.log('图片URL:', imageUrl);
    console.log('');

    const result = await cutQuestions(imageUrl, {
      struct: true,
      extract_images: true
    });

    console.log('✅ API调用成功');
    console.log('题目数量:', result.questions.length);
    console.log('');

    // 显示前3道题的详细信息
    result.questions.slice(0, 3).forEach((q, index) => {
      console.log(`第${index + 1}题:`);
      console.log(`  类型: ${q.info.type}`);
      console.log(`  题干: ${q.info.stem?.text?.substring(0, 50)}...`);
      console.log(`  选项数: ${q.info.option?.length || 0}`);
      console.log(`  插图数: ${q.info.figure?.length || 0}`);
      if (q.info.answer && q.info.answer.length > 0) {
        console.log(`  答案: ${q.info.answer[0].text}`);
      }
      console.log('');
    });

    return NextResponse.json({
      success: true,
      message: '测试成功',
      data: {
        questionCount: result.questions.length,
        questions: result.questions.map(q => ({
          type: q.info.type,
          stem: q.info.stem?.text?.substring(0, 100),
          optionCount: q.info.option?.length || 0,
          figureCount: q.info.figure?.length || 0,
          hasAnswer: q.info.answer && q.info.answer.length > 0
        }))
      }
    });

  } catch (error) {
    console.error('❌ 测试失败:', error);

    return NextResponse.json({
      error: '测试失败',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    name: '阿里云EduTutor API真实图片测试',
    usage: 'POST /api/debug/test-aliyun-real',
    parameters: {
      imageUrl: '图片的完整URL（必需）'
    },
    example: {
      imageUrl: 'https://corp0.hz-college.com/temp/images/xxx.jpg'
    }
  });
}
