#!/usr/bin/env tsx
/**
 * 注册湖南弘知教育科技有限公司机构
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const API_BASE_URL = 'https://corp0.hz-college.com';

async function registerOrganization() {
  console.log('🏢 正在注册湖南弘知教育科技有限公司...\n');

  // 读取 Logo 文件
  const logoPath = join(process.cwd(), 'public/hz-logo-full.png');
  console.log('📸 读取 Logo 文件:', logoPath);

  const logoBuffer = readFileSync(logoPath);
  const logoBase64 = logoBuffer.toString('base64');
  console.log('✅ Logo 文件大小:', logoBuffer.length, 'bytes');
  console.log('✅ Base64 长度:', logoBase64.length, 'characters\n');

  // 构建机构数据
  const organizationData = {
    name: '湖南弘知教育科技有限公司',
    logoData: logoBase64,
    logoMimeType: 'image/png',
    phone: '', // 可选: 联系电话
    wechatQrUrl: '', // 可选: 微信公众号二维码 URL
    primaryColor: '#3B82F6', // 品牌主色: 蓝色
    secondaryColor: '#F59E0B', // 品牌辅色: 橙色
  };

  console.log('📝 机构信息:');
  console.log('  名称:', organizationData.name);
  console.log('  主色:', organizationData.primaryColor);
  console.log('  辅色:', organizationData.secondaryColor);
  console.log('');

  try {
    // 调用 API 注册机构
    console.log('🌐 正在调用 API...');
    const response = await fetch(`${API_BASE_URL}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(organizationData),
    });

    const result = await response.json();
    console.log('📡 API 响应状态:', response.status);
    console.log('');

    if (result.success) {
      console.log('✅ 机构注册成功!\n');
      console.log('📋 机构信息:');
      console.log('  ID:', result.id);
      console.log('  名称:', result.name);
      console.log('  主色:', result.primaryColor);
      console.log('  辅色:', result.secondaryColor);
      console.log('  消息:', result.message);
      console.log('');
      console.log('💡 提示: 请妥善保管您的机构 ID,用于品牌化课程生成');
    } else {
      console.error('❌ 注册失败');
      console.error('错误代码:', result.errorCode);
      console.error('错误消息:', result.message);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ API 调用失败:', error);
    process.exit(1);
  }
}

// 执行注册
registerOrganization();
