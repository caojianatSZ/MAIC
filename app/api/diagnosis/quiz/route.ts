import { NextRequest, NextResponse } from 'next/server';
import { edukgAdapter } from '@/lib/edukg/adapter';
import { diagnosisQuestions } from '@/lib/data/questions/quadratic-function';

/**
 * 获取诊断题目
 * GET /api/diagnosis/quiz?subject=math&topic=二次函数&grade=初三&count=5
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const subject = searchParams.get('subject') || 'math';
    const topic = searchParams.get('topic') || '二次函数';
    const grade = searchParams.get('grade') || '初三';
    const count = parseInt(searchParams.get('count') || '5');
    const useEduKG = searchParams.get('useEduKG') === 'true';  // 是否使用 EduKG

    console.log(`[诊断] 获取题目: ${subject} - ${topic} - ${grade} - ${count}道`);

    let selectedQuestions: any[] = [];

    if (useEduKG) {
      // 使用 EduKG 获取真实习题
      console.log(`[诊断] 从 EduKG 获取习题: ${subject} - ${topic}`);

      // 直接使用中文主题作为搜索关键词
      const searchText = topic;

      try {
        const edukgQuestions = await edukgAdapter.getQuestions(searchText, {
          type: '选择题',
          pageSize: count * 2,  // 获取更多题目，然后筛选
        });

        // 格式化题目
        selectedQuestions = edukgQuestions.slice(0, count).map((q, idx) => ({
          id: q.id,
          question: q.question,
          options: q.options,
          answer: q.answer,
          explanation: q.analysis,
          knowledgePointId: `kp_${topic}_${idx}`,
          knowledgePoint: searchText,
          difficulty: q.difficulty || 1,
        }));

        console.log(`[诊断] 从 EduKG 获取了 ${selectedQuestions.length} 道题目`);
      } catch (error) {
        console.error('[诊断] 从 EduKG 获取题目失败，使用本地题库:', error);
        selectedQuestions = getRandomQuestions(diagnosisQuestions, count);
      }
    } else {
      // 使用本地题库
      selectedQuestions = getRandomQuestions(diagnosisQuestions, count);
    }

    // 如果没有获取到足够的题目，使用本地题库补充
    if (selectedQuestions.length < count) {
      const backupQuestions = getRandomQuestions(diagnosisQuestions, count - selectedQuestions.length);
      selectedQuestions = [...selectedQuestions, ...backupQuestions];
    }

    const quiz = {
      quizId: `quiz_${topic}_${Date.now()}`,
      subject,
      topic,
      questions: selectedQuestions,
      estimatedDuration: Math.ceil(selectedQuestions.length * 1.5), // 每题约1.5分钟
      source: useEduKG ? 'EduKG基础教育知识图谱' : '本地题库'
    };

    return NextResponse.json({
      success: true,
      data: quiz
    });
  } catch (error) {
    console.error('获取诊断题目失败:', error);
    return NextResponse.json({
      success: false,
      error: '获取诊断题目失败'
    }, { status: 500 });
  }
}

/**
 * 从题库中随机选择题目
 */
function getRandomQuestions(questions: any[], count: number) {
  const shuffled = [...questions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, questions.length));
}
