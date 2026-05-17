import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('开始创建运营平台测试数据...')

  // 1. 创建总部运营账号
  const hqOps = await prisma.user.upsert({
    where: { openid: 'hq_ops_test' },
    update: {},
    create: {
      openid: 'hq_ops_test',
      nickname: '总部运营',
      role: 'HQ_OPS',
      isActive: true
    }
  })
  console.log('✓ 总部运营账号创建完成')

  // 2. 创建测试城市
  const cities = await Promise.all([
    prisma.city.upsert({
      where: { name: '西安' },
      update: {},
      create: { name: '西安', status: 'ACTIVE' }
    }),
    prisma.city.upsert({
      where: { name: '成都' },
      update: {},
      create: { name: '成都', status: 'ACTIVE' }
    }),
    prisma.city.upsert({
      where: { name: '武汉' },
      update: {},
      create: { name: '武汉', status: 'ACTIVE' }
    })
  ])
  console.log(`✓ 创建了 ${cities.length} 个城市`)

  // 3. 为每个城市创建合伙人和老师
  for (const city of cities) {
    // 城市合伙人
    const partner = await prisma.user.upsert({
      where: { openid: `partner_${city.name}_test` },
      update: {},
      create: {
        openid: `partner_${city.name}_test`,
        nickname: `${city.name}合伙人`,
        phoneNumber: `138${city.name.charCodeAt(0)}000001`,
        role: 'CITY_PARTNER',
        cityId: city.id,
        isActive: true
      }
    })

    // 关联合伙人和城市
    await prisma.city.update({
      where: { id: city.id },
      data: { partnerId: partner.id }
    })

    // 创建 2-3 个老师
    const teachers = await Promise.all([
      prisma.user.upsert({
        where: { openid: `teacher_${city.name}_1_test` },
        update: {},
        create: {
          openid: `teacher_${city.name}_1_test`,
          nickname: `${city.name}老师A`,
          phoneNumber: `138${city.name.charCodeAt(0)}000101`,
          role: 'TEACHER',
          cityId: city.id,
          isActive: true
        }
      }),
      prisma.user.upsert({
        where: { openid: `teacher_${city.name}_2_test` },
        update: {},
        create: {
          openid: `teacher_${city.name}_2_test`,
          nickname: `${city.name}老师B`,
          phoneNumber: `138${city.name.charCodeAt(0)}000102`,
          role: 'TEACHER',
          cityId: city.id,
          isActive: true
        }
      }),
      prisma.user.upsert({
        where: { openid: `teacher_${city.name}_3_test` },
        update: {},
        create: {
          openid: `teacher_${city.name}_3_test`,
          nickname: `${city.name}老师C`,
          phoneNumber: `138${city.name.charCodeAt(0)}000103`,
          role: 'TEACHER',
          cityId: city.id,
          isActive: true
        }
      })
    ])

    console.log(`✓ ${city.name}: 合伙人 + ${teachers.length} 个老师`)

    // 4. 为每个城市创建测试线索
    const leads = await Promise.all([
      prisma.trialLead.upsert({
        where: { id: `lead_${city.id}_1` },
        update: {},
        create: {
          id: `lead_${city.id}_1`,
          studentName: `${city.name}学生A`,
          parentName: '张先生',
          phoneNumber: `139${city.name.charCodeAt(0)}000001`,
          grade: '初二',
          cityId: city.id,
          cityPartnerId: partner.id,
          status: 'NEW',
          sourceChannel: '线上投放',
          notes: [{ time: new Date().toISOString(), content: '新线索', author: 'system' }]
        }
      }),
      prisma.trialLead.upsert({
        where: { id: `lead_${city.id}_2` },
        update: {},
        create: {
          id: `lead_${city.id}_2`,
          studentName: `${city.name}学生B`,
          parentName: '李女士',
          phoneNumber: `139${city.name.charCodeAt(0)}000002`,
          grade: '初三',
          cityId: city.id,
          cityPartnerId: partner.id,
          status: 'CONTACTED',
          sourceChannel: '地推',
          notes: [{ time: new Date().toISOString(), content: '已电话联系', author: 'system' }]
        }
      }),
      prisma.trialLead.upsert({
        where: { id: `lead_${city.id}_3` },
        update: {},
        create: {
          id: `lead_${city.id}_3`,
          studentName: `${city.name}学生C`,
          parentName: '王先生',
          phoneNumber: `139${city.name.charCodeAt(0)}000003`,
          grade: '初一',
          cityId: city.id,
          cityPartnerId: partner.id,
          status: 'SCHEDULED',
          scheduledTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2天后
          assignedTeacherId: teachers[0].id,
          sourceChannel: '转介绍',
          notes: [{ time: new Date().toISOString(), content: '已安排试课', author: 'system' }]
        }
      }),
      prisma.trialLead.upsert({
        where: { id: `lead_${city.id}_4` },
        update: {},
        create: {
          id: `lead_${city.id}_4`,
          studentName: `${city.name}学生D`,
          parentName: '赵女士',
          phoneNumber: `139${city.name.charCodeAt(0)}000004`,
          grade: '初二',
          cityId: city.id,
          cityPartnerId: partner.id,
          status: 'CONVERTED',
          sourceChannel: '线上投放',
          convertedAt: new Date(),
          notes: [
            { time: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), content: '新线索', author: 'system' },
            { time: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), content: '试课完成', author: 'system' },
            { time: new Date().toISOString(), content: '已转化付费', author: 'system' }
          ]
        }
      })
    ])

    // 为已安排试课的线索创建约课记录
    if (leads[2].status === 'SCHEDULED') {
      await prisma.booking.upsert({
        where: { id: `booking_${leads[2].id}` },
        update: {},
        create: {
          id: `booking_${leads[2].id}`,
          studentId: partner.id, // 临时使用
          teacherId: teachers[0].id,
          trialLeadId: leads[2].id,
          cityId: city.id,
          cityPartnerId: partner.id,
          classType: 'ONE_V1',
          subject: 'math',
          grade: '初一',
          scheduledAt: leads[2].scheduledTime!,
          duration: 60,
          status: 'CONFIRMED'
        }
      })
    }

    // 为已转化的线索创建支付记录
    if (leads[3].status === 'CONVERTED') {
      const booking = await prisma.booking.upsert({
        where: { id: `booking_${leads[3].id}` },
        update: {},
        create: {
          id: `booking_${leads[3].id}`,
          studentId: partner.id,
          teacherId: teachers[0].id,
          trialLeadId: leads[3].id,
          cityId: city.id,
          cityPartnerId: partner.id,
          classType: 'ONE_V1',
          subject: 'math',
          grade: '初二',
          scheduledAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          duration: 60,
          status: 'COMPLETED',
          attendanceStatus: 'ATTENDED'
        }
      })

      await prisma.paymentRecord.upsert({
        where: { id: `payment_${booking.id}` },
        update: {},
        create: {
          id: `payment_${booking.id}`,
          studentId: partner.id,
          bookingId: booking.id,
          cityId: city.id,
          amount: 30000,
          paidAmount: 30000,
          teacherSalary: 18000,
          partnerCommission: 6000,
          platformRevenue: 6000,
          status: 'PAID',
          settlementStatus: 'SETTLED',
          paymentChannel: 'wechat',
          paidAt: new Date()
        }
      })
    }

    console.log(`✓ ${city.name}: ${leads.length} 条线索`)
  }

  console.log('\n✅ 测试数据创建完成!')
  console.log('\n测试账号信息:')
  console.log('  总部运营: openid = hq_ops_test')
  cities.forEach(city => {
    console.log(`  ${city.name}合伙人: openid = partner_${city.name}_test`)
    console.log(`  ${city.name}老师A: openid = teacher_${city.name}_1_test`)
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
