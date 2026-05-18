import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/students/lifecycle - 学生生命周期数据
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cityId = searchParams.get('cityId');
    const cityPartnerId = searchParams.get('cityPartnerId');
    const status = searchParams.get('status'); // active, at_risk, lost, potential

    const where: any = {};
    if (cityId) where.cityId = cityId;
    if (cityPartnerId) where.cityPartnerId = cityPartnerId;

    // 获取所有试课线索
    const leads = await prisma.trialLead.findMany({
      where,
      include: {
        city: { select: { id: true, name: true } },
        cityPartner: { select: { id: true, nickname: true } },
        assignedTeacher: { select: { id: true, nickname: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 计算每个学生的生命周期状态
    const studentsWithLifecycle = leads.map(lead => {
      const status = getLifecycleStatus(lead);
      const lastActivity = getLastActivityTime(lead);
      const daysSinceActivity = lastActivity
        ? Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      return {
        ...lead,
        lifecycleStatus: status,
        daysSinceLastActivity: daysSinceActivity,
        atRisk: status === 'at_risk',
        renewalReminder: status === 'active' && needsRenewalReminder(lead)
      };
    });

    // 按状态筛选
    let filtered = studentsWithLifecycle;
    if (status) {
      filtered = studentsWithLifecycle.filter(s => s.lifecycleStatus === status);
    }

    // 统计数据
    const stats = {
      total: leads.length,
      new: studentsWithLifecycle.filter(s => s.lifecycleStatus === 'new').length,
      contacted: studentsWithLifecycle.filter(s => s.lifecycleStatus === 'contacted').length,
      active: studentsWithLifecycle.filter(s => s.lifecycleStatus === 'active').length,
      at_risk: studentsWithLifecycle.filter(s => s.lifecycleStatus === 'at_risk').length,
      lost: studentsWithLifecycle.filter(s => s.lifecycleStatus === 'lost').length,
      converted: studentsWithLifecycle.filter(s => s.lifecycleStatus === 'converted').length
    };

    return NextResponse.json({
      students: filtered,
      stats,
      funnel: {
        conversionRate: stats.total > 0 ? ((stats.converted / stats.total) * 100).toFixed(1) : '0.0',
        atRiskRate: stats.total > 0 ? ((stats.at_risk / stats.total) * 100).toFixed(1) : '0.0'
      }
    });
  } catch (error) {
    console.error('获取学生生命周期失败:', error);
    return NextResponse.json({ error: '获取数据失败' }, { status: 500 });
  }
}

// GET /api/students/lifecycle/alerts - 流失预警和续费提醒
export async function ALERTS(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cityId = searchParams.get('cityId');
    const cityPartnerId = searchParams.get('cityPartnerId');

    const where: any = {};
    if (cityId) where.cityId = cityId;
    if (cityPartnerId) where.cityPartnerId = cityPartnerId;

    const leads = await prisma.trialLead.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    const alerts = {
      atRisk: [] as any[],
      renewalNeeded: [] as any[],
      uncontacted: [] as any[]
    };

    const now = Date.now();
    const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    for (const lead of leads) {
      const lastActivity = getLastActivityTime(lead);
      const daysSinceActivity = lastActivity
        ? Math.floor((now - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      // 流失预警：3-7天无活动且状态不是 LOST/CONVERTED
      if (daysSinceActivity >= 3 && daysSinceActivity < 7 &&
          !['LOST', 'CONVERTED'].includes(lead.status)) {
        alerts.atRisk.push({
          lead,
          reason: `${daysSinceActivity}天未跟进`,
          lastActivity
        });
      }

      // 严重流失：7天以上无活动
      if (daysSinceActivity >= 7 && lead.status === 'CONTACTED') {
        alerts.atRisk.push({
          lead,
          reason: `${daysSinceActivity}天未跟进，建议标记为流失`,
          lastActivity,
          severe: true
        });
      }

      // 续费提醒：已完成多节课但无续费记录
      const bookingCount = await prisma.booking.count({
        where: {
          studentId: lead.cityPartnerId,
          status: 'COMPLETED'
        }
      });
      if (bookingCount >= 8 && lead.status === 'CONVERTED') {
        alerts.renewalNeeded.push({
          lead,
          completedLessons: bookingCount,
          message: '已完成8节课，建议跟进续费'
        });
      }

      // 未联系的新线索
      if (lead.status === 'NEW' && (now - lead.createdAt.getTime()) > 24 * 60 * 60 * 1000) {
        alerts.uncontacted.push({
          lead,
          waitingHours: Math.floor((now - lead.createdAt.getTime()) / (1000 * 60 * 60))
        });
      }
    }

    return NextResponse.json(alerts);
  } catch (error) {
    console.error('获取预警失败:', error);
    return NextResponse.json({ error: '获取数据失败' }, { status: 500 });
  }
}

// 辅助函数：获取生命周期状态
function getLifecycleStatus(lead: any): string {
  switch (lead.status) {
    case 'NEW': return 'new';
    case 'CONTACTED': return 'contacted';
    case 'SCHEDULED': return 'active';
    case 'COMPLETED': return 'active';
    case 'CONVERTED': return 'converted';
    case 'LOST': return 'lost';
    default: return 'new';
  }
}

// 辅助函数：获取最后活动时间
function getLastActivityTime(lead: any): Date | null {
  const times = [
    lead.createdAt,
    lead.scheduledTime,
    lead.convertedAt
  ].filter(Boolean);
  return times.length > 0 ? new Date(Math.max(...times.map(t => new Date(t).getTime()))) : null;
}

// 辅助函数：是否需要续费提醒
function needsRenewalReminder(lead: any): boolean {
  // CONVERTED 状态且转化时间超过30天
  if (lead.status === 'CONVERTED' && lead.convertedAt) {
    const daysSinceConversion = (Date.now() - new Date(lead.convertedAt).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceConversion > 30;
  }
  return false;
}
