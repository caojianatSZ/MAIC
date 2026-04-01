/**
 * 成就引擎 - 核心逻辑
 * 负责检查成就条件、计算进度、解锁成就
 */

import { PrismaClient } from '@prisma/client'
import {
  AchievementEvent,
  AchievementResult,
  AchievementProgress,
  KnowledgePointStats,
  AchievementLevel
} from './types'

// 使用全局变量避免在开发环境中创建多个 Prisma Client 实例
const globalForPrisma = global as unknown as { prisma: PrismaClient }

const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export class AchievementEngine {
  /**
   * 处理学习事件并检查成就
   */
  async processEvent(event: AchievementEvent): Promise<AchievementResult[]> {
    console.log('处理成就事件:', event)

    // 1. 记录学习行为
    await this.recordStudyEvent(event)

    // 2. 获取相关成就
    const relevantAchievements = await this.getRelevantAchievements(event)

    console.log(`找到 ${relevantAchievements.length} 个相关成就`)

    // 3. 检查每个成就的进度
    const results: AchievementResult[] = []

    for (const achievement of relevantAchievements) {
      const result = await this.checkAchievement(achievement, event)
      if (result) {
        results.push(result)
      }
    }

    // 4. 更新用户成就进度
    await this.updateAchievementProgress(event.userId, results)

    // 5. 更新学生画像
    await this.updateStudentProfile(event.userId)

    return results.filter(r => r.unlocked)
  }

  /**
   * 记录学习事件
   */
  private async recordStudyEvent(event: AchievementEvent): Promise<void> {
    try {
      await prisma.studyRecord.create({
        data: {
          userId: event.userId,
          type: event.type,
          subject: event.subject || null,
          knowledgePointId: event.knowledgePointId || null,
          score: event.data.score || null,
          timeSpent: event.data.timeSpent || null,
          metadata: event.data as any
        }
      })
    } catch (error) {
      console.error('记录学习事件失败:', error)
      // 不抛出错误，继续执行
    }
  }

  /**
   * 获取与事件相关的成就
   */
  private async getRelevantAchievements(event: AchievementEvent): Promise<any[]> {
    const where: any = {
      isActive: true
    }

    // 根据科目筛选
    if (event.subject) {
      where.subject = event.subject
    }

    // 根据知识点筛选
    if (event.knowledgePointId) {
      where.knowledgePointId = event.knowledgePointId
    }

    const achievements = await prisma.achievement.findMany({
      where,
      include: {
        userAchievements: {
          where: {
            userId: event.userId
          }
        }
      }
    })

    return achievements
  }

  /**
   * 检查单个成就
   */
  private async checkAchievement(
    achievement: any,
    event: AchievementEvent
  ): Promise<AchievementResult | null> {
    const condition = achievement.condition as any
    const userAchievement = achievement.userAchievements[0]

    // 计算当前进度
    const progress = await this.calculateProgress(achievement, event)

    // 判断是否解锁
    const unlocked = progress >= 100

    console.log(`成就 ${achievement.name}: 进度 ${progress}%, 解锁: ${unlocked}`)

    return {
      achievementId: achievement.id,
      level: achievement.level,
      name: achievement.name,
      description: achievement.description || '',
      icon: achievement.iconUrl || undefined,
      progress,
      unlocked,
      previousLevel: userAchievement?.level || undefined
    }
  }

  /**
   * 计算成就进度
   */
  private async calculateProgress(
    achievement: any,
    event: AchievementEvent
  ): Promise<number> {
    const condition = achievement.condition

    switch (condition.type) {
      case 'knowledge_point_mastery':
        return await this.calculateKnowledgePointProgress(achievement, event)

      case 'study_streak':
        return await this.calculateStreakProgress(achievement, event)

      case 'questions_completed':
        return await this.calculateQuestionsProgress(achievement, event)

      case 'lessons_learned':
        return await this.calculateLessonsProgress(achievement, event)

      default:
        return 0
    }
  }

  /**
   * 计算知识点掌握度进度
   */
  private async calculateKnowledgePointProgress(
    achievement: any,
    event: AchievementEvent
  ): Promise<number> {
    const { knowledgePointId } = achievement
    const { userId } = event

    if (!knowledgePointId) return 0

    // 获取该知识点的学习记录
    const stats = await this.getKnowledgePointStats(userId, knowledgePointId)

    const { accuracy_threshold = 80, min_questions = 5 } = achievement.condition

    // 计算完成度
    const completionProgress = Math.min(
      (stats.totalAttempts / min_questions) * 50,
      50
    )

    // 计算正确率进度
    const accuracyProgress = Math.min(
      (stats.accuracy / accuracy_threshold) * 50,
      50
    )

    const progress = Math.round(completionProgress + accuracyProgress)

    // 处理NaN和Infinity情况
    return isNaN(progress) || !isFinite(progress) ? 0 : progress
  }

  /**
   * 计算学习打卡进度
   */
  private async calculateStreakProgress(
    achievement: any,
    event: AchievementEvent
  ): Promise<number> {
    const { streak_days = 7 } = achievement.condition
    const { userId } = event

    // 计算当前连续学习天数
    const currentStreak = await this.calculateCurrentStreak(userId)

    return Math.min(Math.round((currentStreak / streak_days) * 100), 100)
  }

  /**
   * 计算完成题目进度
   */
  private async calculateQuestionsProgress(
    achievement: any,
    event: AchievementEvent
  ): Promise<number> {
    const { min_questions = 100 } = achievement.condition
    const { userId } = event

    const totalCount = await prisma.studyRecord.count({
      where: {
        userId,
        type: 'quiz'
      }
    })

    return Math.min(Math.round((totalCount / min_questions) * 100), 100)
  }

  /**
   * 计算学习课程进度
   */
  private async calculateLessonsProgress(
    achievement: any,
    event: AchievementEvent
  ): Promise<number> {
    const { min_lessons = 5 } = achievement.condition
    const { userId } = event

    const totalCount = await prisma.studyRecord.count({
      where: {
        userId,
        type: 'lesson'
      }
    })

    return Math.min(Math.round((totalCount / min_lessons) * 100), 100)
  }

  /**
   * 获取知识点统计
   */
  async getKnowledgePointStats(
    userId: string,
    knowledgePointId: string
  ): Promise<KnowledgePointStats> {
    const records = await prisma.studyRecord.findMany({
      where: {
        userId,
        knowledgePointId,
        type: 'quiz'
      },
      orderBy: {
        createdAt: 'asc'
      }
    })

    const totalAttempts = records.length
    const correctAttempts = records.filter((r: any) => {
      const metadata = r.metadata as any
      return metadata.isCorrect === true
    }).length

    return {
      knowledgePointId,
      knowledgePointName: '', // 需要从知识点表获取
      totalAttempts,
      correctAttempts,
      accuracy: totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0,
      firstLearnedAt: records[0]?.createdAt,
      lastPracticedAt: records[records.length - 1]?.createdAt
    }
  }

  /**
   * 计算当前连续学习天数
   */
  private async calculateCurrentStreak(userId: string): Promise<number> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let streak = 0
    let checkDate = today

    while (true) {
      const nextDay = new Date(checkDate)
      nextDay.setDate(nextDay.getDate() + 1)

      const count = await prisma.studyRecord.count({
        where: {
          userId,
          createdAt: {
            gte: checkDate,
            lt: nextDay
          }
        }
      })

      if (count > 0) {
        streak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }

    return streak
  }

  /**
   * 更新用户成就进度
   */
  private async updateAchievementProgress(
    userId: string,
    results: AchievementResult[]
  ): Promise<void> {
    try {
      // 检查用户是否存在
      const user = await prisma.user.findUnique({
        where: { id: userId }
      })

      if (!user) {
        console.log(`用户 ${userId} 不存在，跳过成就进度更新`)
        return
      }

      for (const result of results) {
        await prisma.userAchievement.upsert({
          where: {
            userId_achievementId: {
              userId,
              achievementId: result.achievementId
            }
          },
          create: {
            userId,
            achievementId: result.achievementId,
            progress: result.progress,
            unlockedAt: result.unlocked ? new Date() : null,
            notified: false
          },
          update: {
            progress: result.progress,
            unlockedAt: result.unlocked && !result.previousLevel ? new Date() : undefined
          }
        })
      }
    } catch (error) {
      console.error('更新成就进度失败:', error)
      // 不抛出错误，继续执行
    }
  }

  /**
   * 更新学生画像
   */
  private async updateStudentProfile(userId: string): Promise<void> {
    try {
      // 检查用户是否存在
      const user = await prisma.user.findUnique({
        where: { id: userId }
      })

      if (!user) {
        console.log(`用户 ${userId} 不存在，跳过学生画像更新`)
        return
      }

      // 获取学习统计
      const studyStats = await this.getStudyStats(userId)

      // 分析学习风格（简化版）
      const learningStyle = await this.analyzeLearningStyle(userId)

      // 识别强项弱项
      const { strongPoints, weakPoints } = await this.identifyStrengthsWeaknesses(userId)

      await prisma.studentProfile.upsert({
        where: { userId },
        create: {
          userId,
          learningStyle: learningStyle as any,
          strongPoints: strongPoints as any,
          weakPoints: weakPoints as any,
          studyStats: studyStats as any
        },
        update: {
          learningStyle: learningStyle as any,
          strongPoints: strongPoints as any,
          weakPoints: weakPoints as any,
          studyStats: studyStats as any
        }
      })
    } catch (error) {
      console.error('更新学生画像失败:', error)
      // 不抛出错误，继续执行
    }
  }

  /**
   * 获取学习统计
   */
  private async getStudyStats(userId: string): Promise<any> {
    const records = await prisma.studyRecord.findMany({
      where: { userId }
    })

    const totalStudyTime = records.reduce((sum: number, r: any) => sum + (r.timeSpent || 0), 0)
    const questionsCompleted = records.filter((r: any) => r.type === 'quiz').length
    const lessonsLearned = records.filter((r: any) => r.type === 'lesson').length

    const currentStreak = await this.calculateCurrentStreak(userId)

    // TODO: 计算最长连续天数
    const longestStreak = currentStreak

    return {
      totalStudyTime: Math.round(totalStudyTime / 60), // 转换为分钟
      questionsCompleted,
      lessonsLearned,
      currentStreak,
      longestStreak
    }
  }

  /**
   * 分析学习风格（简化实现）
   */
  private async analyzeLearningStyle(userId: string): Promise<any> {
    // 简化实现：根据学习行为类型分析
    const records = await prisma.studyRecord.findMany({
      where: { userId }
    })

    // TODO: 实现更复杂的学习风格分析算法
    return {
      visual: 0.6,
      auditory: 0.4,
      kinesthetic: 0.5
    }
  }

  /**
   * 识别强项和弱项
   */
  private async identifyStrengthsWeaknesses(userId: string): Promise<{
    strongPoints: string[]
    weakPoints: string[]
  }> {
    // 获取所有知识点的统计数据
    const learningProgress = await prisma.learningProgress.findMany({
      where: { userId }
    })

    // 按掌握度排序
    const sorted = learningProgress.sort((a: any, b: any) => b.masteryLevel - a.masteryLevel)

    // 前20%为强项，后20%为弱项
    const strongCount = Math.max(1, Math.floor(sorted.length * 0.2))
    const weakCount = Math.max(1, Math.floor(sorted.length * 0.2))

    const strongPoints = sorted.slice(0, strongCount).map((p: any) => p.knowledgePointName)
    const weakPoints = sorted.slice(-weakCount).map((p: any) => p.knowledgePointName)

    return { strongPoints, weakPoints }
  }
}
