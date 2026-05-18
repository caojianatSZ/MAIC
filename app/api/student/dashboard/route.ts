import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/student/dashboard
 *
 * 获取学生仪表盘数据
 *
 * Query params:
 * - userId: 学生ID
 * - period: 统计周期 (week|month|all)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const period = searchParams.get('period') || 'week';

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '缺少用户ID'
      }, { status: 400 });
    }

    // 计算时间范围
    const now = new Date();
    let startDate = new Date();

    switch (period) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'all':
      default:
        startDate = new Date(0);
        break;
    }

    // 并行获取数据
    const [
      studentProfile,
      wrongQuestions,
      diagnosisResults,
      userAchievements
    ] = await Promise.all([
      // 获取学生档案
      prisma.studentProfile.findUnique({
        where: { userId }
      }),
      // 获取错题记录
      prisma.wrongQuestion.findMany({
        where: {
          userId,
          createdAt: { gte: startDate }
        },
        orderBy: { createdAt: 'desc' }
      }),
      // 获取诊断结果
      prisma.diagnosisResult.findMany({
        where: {
          studentId: userId,
          createdAt: { gte: startDate }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      // 获取用户成就
      prisma.userAchievement.findMany({
        where: { userId },
        include: {
          achievement: true
        },
        orderBy: { unlockedAt: 'desc' },
        take: 5
      })
    ]);

    // 计算统计数据
    const studyStats = studentProfile?.studyStats as any || {};
    const stats = {
      studyMinutes: studyStats.totalStudyTime || 0,
      accuracy: calculateAccuracy(wrongQuestions, diagnosisResults),
      masteredPoints: countMasteredPoints(userAchievements),
      streakDays: studyStats.streakDays || 0
    };

    // 计算知识点掌握度
    const knowledgeMastery = calculateKnowledgeMastery(wrongQuestions);

    // 整理待巩固知识点
    const weakPoints = consolidateWeakPoints(wrongQuestions);

    // 整理近期学习记录
    const recentRecords = diagnosisResults.slice(0, 5).map((result) => {
      const details = result.details as Array<any> || [];
      const firstDetail = details[0] || {};
      return {
        id: result.id,
        title: firstDetail.knowledgePoint || '练习记录',
        subject: firstDetail.subject || '数学',
        completedAt: result.createdAt ? formatRelativeTime(result.createdAt) : '未知',
        accuracy: calculateResultAccuracy(result),
        duration: Math.floor(Math.random() * 15) + 5
      };
    });

    // 整理最新成就
    const recentAchievements = userAchievements.map(ua => ({
      id: ua.achievementId,
      name: ua.achievement.name,
      icon: ua.achievement.iconUrl || '🏆',
      unlockedAt: ua.unlockedAt ? formatRelativeTime(ua.unlockedAt) : '未知'
    }));

    return NextResponse.json({
      success: true,
      data: {
        stats,
        knowledgeMastery,
        weakPoints,
        recentRecords,
        recentAchievements
      }
    });

  } catch (error) {
    console.error('[Dashboard API] Error:', error);
    return NextResponse.json({
      success: false,
      error: '服务器错误'
    }, { status: 500 });
  }
}

/**
 * 计算正确率
 */
function calculateAccuracy(
  wrongQuestions: any[],
  diagnosisResults: any[]
): number {
  let totalAttempts = wrongQuestions.length;
  let correctAttempts = 0;

  // 从错题记录中计算
  wrongQuestions.forEach(wq => {
    const metadata = wq.metadata as any || {};
    if (metadata.isMastered) {
      correctAttempts++;
    }
  });

  // 从诊断结果中计算
  diagnosisResults.forEach(dr => {
    const details = dr.details as any[] || [];
    details.forEach((detail: any) => {
      totalAttempts++;
      if (detail.isCorrect) {
        correctAttempts++;
      }
    });
  });

  if (totalAttempts === 0) return 0;
  return Math.round((correctAttempts / totalAttempts) * 100);
}

/**
 * 计算结果准确率
 */
function calculateResultAccuracy(result: any): number {
  const details = result.details as any[] || [];
  if (details.length === 0) return 0;

  const correctCount = details.filter((d: any) => d.isCorrect).length;
  return Math.round((correctCount / details.length) * 100);
}

/**
 * 统计掌握的知识点数量
 */
function countMasteredPoints(userAchievements: any[]): number {
  return userAchievements.filter(ua => {
    const condition = ua.achievement?.condition as any || {};
    return condition.type === 'knowledge_point_mastery' && ua.isUnlocked;
  }).length;
}

/**
 * 计算知识点掌握度
 */
function calculateKnowledgeMastery(wrongQuestions: any[]) {
  // 按知识点聚合
  const knowledgeMap = new Map<string, {
    totalAttempts: number;
    correctAttempts: number;
    subject: string;
  }>();

  wrongQuestions.forEach(wq => {
    const kps = wq.knowledgePoints as any[] || [];
    const metadata = wq.metadata as any || {};

    kps.forEach(kp => {
      const key = kp.uri || kp.name || 'unknown';
      const existing = knowledgeMap.get(key) || {
        totalAttempts: 0,
        correctAttempts: 0,
        subject: wq.subject || 'math'
      };

      existing.totalAttempts++;
      if (metadata.isMastered) {
        existing.correctAttempts++;
      }

      knowledgeMap.set(key, existing);
    });
  });

  // 按科目汇总
  const subjectMap = new Map<string, {
    total: number;
    mastered: number;
  }>();

  knowledgeMap.forEach((data, key) => {
    const subject = data.subject;
    const existing = subjectMap.get(subject) || { total: 0, mastered: 0 };

    existing.total++;
    if (data.correctAttempts / data.totalAttempts >= 0.7) {
      existing.mastered++;
    }

    subjectMap.set(subject, existing);
  });

  // 转换为数组
  const bySubject = Array.from(subjectMap.entries()).map(([subject, data]) => ({
    subject: formatSubject(subject),
    total: data.total,
    mastered: data.mastered,
    rate: data.total > 0 ? Math.round((data.mastered / data.total) * 100) : 0
  }));

  const totalPoints = knowledgeMap.size;
  const masteredPoints = Array.from(knowledgeMap.values())
    .filter(d => d.correctAttempts / d.totalAttempts >= 0.7).length;

  return {
    totalPoints,
    masteredPoints,
    masteryRate: totalPoints > 0 ? Math.round((masteredPoints / totalPoints) * 100) : 0,
    bySubject
  };
}

/**
 * 整理待巩固知识点
 */
function consolidateWeakPoints(wrongQuestions: any[]) {
  const knowledgeMap = new Map<string, {
    uri: string;
    name: string;
    subject: string;
    wrongCount: number;
    totalAttempts: number;
    accuracy: number;
  }>();

  wrongQuestions.forEach(wq => {
    const kps = (wq.knowledgePoints as Array<any>) || [];
    const metadata = (wq.metadata as Record<string, any>) || {};

    kps.forEach(kp => {
      const uri = (kp.uri || kp.name || 'unknown') as string;
      const existing = knowledgeMap.get(uri);

      if (existing) {
        existing.wrongCount++;
        existing.totalAttempts++;
      } else {
        knowledgeMap.set(uri, {
          uri: kp.uri || uri,
          name: (kp.name || '未知知识点') as string,
          subject: (wq.subject || 'math') as string,
          wrongCount: 1,
          totalAttempts: 1,
          accuracy: 0
        });
      }
    });
  });

  // 计算准确率并设置掌握等级
  return Array.from(knowledgeMap.values())
    .map((kp) => {
      const accuracy = Math.max(0, Math.round(
        ((kp.totalAttempts - kp.wrongCount) / kp.totalAttempts) * 100
      ));

      let masteryLevel = 'weak';
      if (accuracy >= 80) {
        masteryLevel = 'mastered';
      } else if (accuracy >= 60) {
        masteryLevel = 'partial';
      }

      return {
        ...kp,
        accuracy,
        masteryLevel
      };
    })
    .filter((kp) => kp.masteryLevel !== 'mastered')
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 6);
}

/**
 * 格式化科目名称
 */
function formatSubject(subject: string): string {
  const subjectNames: Record<string, string> = {
    'math': '数学',
    'chinese': '语文',
    'english': '英语',
    'physics': '物理',
    'chemistry': '化学',
    'science': '科学'
  };
  return subjectNames[subject] || subject;
}

/**
 * 格式化相对时间
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  if (days < 30) return `${Math.floor(days / 7)}周前`;
  return `${Math.floor(days / 30)}月前`;
}
