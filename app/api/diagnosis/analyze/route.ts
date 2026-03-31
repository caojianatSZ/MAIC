import { NextRequest, NextResponse } from 'next/server';

/**
 * 提交诊断答案并分析
 * POST /api/diagnosis/analyze
 *
 * 请求体:
 * {
 *   "quizId": string,
 *   "questions": [
 *     {
 *       "id": string,
 *       "question": string,
 *       "options": string[],
 *       "answer": number,  // 正确答案索引
 *       "userAnswer": number,  // 用户答案索引
 *       "knowledgePointId": string,
 *       "knowledgePoint": string
 *     }
 *   ]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { quizId, questions } = body;

    console.log('[诊断分析] 收到数据:', {
      quizId,
      questionsCount: questions?.length || 0
    });

    // 验证输入
    if (!quizId || !questions || !Array.isArray(questions)) {
      return NextResponse.json({
        success: false,
        error: '参数错误'
      }, { status: 400 });
    }

    // 分析答案
    let correctCount = 0;
    const knowledgePointScores: Record<string, {
      correct: number;
      total: number;
      name: string;
    }> = {};

    questions.forEach((q: any) => {
      const isCorrect = q.userAnswer === q.answer;
      if (isCorrect) {
        correctCount++;
      }

      const kpId = q.knowledgePointId;
      if (!knowledgePointScores[kpId]) {
        knowledgePointScores[kpId] = {
          correct: 0,
          total: 0,
          name: q.knowledgePoint || '知识点'
        };
      }

      knowledgePointScores[kpId].total++;
      if (isCorrect) {
        knowledgePointScores[kpId].correct++;
      }
    });

    // 计算每个知识点的掌握程度
    const knowledgePointAnalysis = Object.keys(knowledgePointScores).map(kpId => {
      const scores = knowledgePointScores[kpId];
      const accuracy = scores.correct / scores.total;

      let masteryLevel: 'mastered' | 'partial' | 'weak' = 'weak';
      if (accuracy >= 0.8) {
        masteryLevel = 'mastered';
      } else if (accuracy >= 0.5) {
        masteryLevel = 'partial';
      }

      return {
        knowledgePointId: kpId,
        knowledgePointName: scores.name,
        level: 0,  // 暂时设为0，可以根据需要调整
        masteryLevel,
        description: '',  // 可以从题库或EduKG获取
        prerequisites: [],  // 可以从EduKG获取前置依赖
        accuracy: Math.round(accuracy * 100),
        correctCount: scores.correct,
        totalCount: scores.total
      };
    });

    const totalScore = Math.round((correctCount / questions.length) * 100);

    const analysis = {
      subject: 'math',
      totalScore,
      correctCount,
      totalCount: questions.length,
      knowledgePoints: knowledgePointAnalysis,
      recommendations: generateRecommendations(knowledgePointAnalysis)
    };

    console.log('[诊断分析] 完成分析:', {
      totalScore,
      correctCount,
      totalCount: questions.length,
      knowledgePointsCount: knowledgePointAnalysis.length
    });

    return NextResponse.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('分析诊断答案失败:', error);
    return NextResponse.json({
      success: false,
      error: '分析诊断答案失败'
    }, { status: 500 });
  }
}

/**
 * 生成学习建议
 */
function generateRecommendations(analysis: any[]): string[] {
  const weakPoints = analysis.filter(kp => kp.masteryLevel === 'weak');
  const partialPoints = analysis.filter(kp => kp.masteryLevel === 'partial');

  const recommendations: string[] = [];

  if (weakPoints.length > 0) {
    recommendations.push(`建议重点学习：${weakPoints.map(p => p.knowledgePointName).join('、')}`);
  }

  if (partialPoints.length > 0) {
    recommendations.push(`需要巩固：${partialPoints.map(p => p.knowledgePointName).join('、')}`);
  }

  if (recommendations.length === 0) {
    recommendations.push('太棒了！你已经掌握了这些知识点');
  } else {
    recommendations.push('我们已经为你生成了个性化学习路径');
  }

  return recommendations;
}
