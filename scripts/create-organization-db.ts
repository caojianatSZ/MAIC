import { pg } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

// 数据库连接配置
const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'openmaic',
  user: 'openmaic',
  password: 'openmaic_password',
};

async function createOrganization() {
  console.log('🏢 正在创建湖南弘知教育科技有限公司机构...\n');

  // 创建数据库连接
  const client = new pg(dbConfig);

  try {
    // 连接数据库
    await client.connect();
    console.log('✅ 数据库连接成功\n');

    // 读取 Logo 文件
    const logoPath = join(process.cwd(), 'public/hz-logo-full.png');
    console.log('📸 读取 Logo 文件:', logoPath);

    const logoBuffer = readFileSync(logoPath);
    const logoBase64 = logoBuffer.toString('base64');
    console.log('✅ Logo 文件大小:', logoBuffer.length, 'bytes\n');

    // 插入机构数据
    const query = `
      INSERT INTO organizations (
        id,
        name,
        logo_data,
        logo_mime_type,
        primary_color,
        secondary_color,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        logo_data = EXCLUDED.logo_data,
        logo_mime_type = EXCLUDED.logo_mime_type,
        primary_color = EXCLUDED.primary_color,
        secondary_color = EXCLUDED.secondary_color,
        updated_at = NOW()
      RETURNING id, name, primary_color, secondary_color
    `;

    const values = [
      'hongzhiedu-001', // 机构 ID
      '湖南弘知教育科技有限公司', // 机构名称
      logoBase64, // Logo base64 数据
      'image/png', // MIME 类型
      '#3B82F6', // 主色: 蓝色
      '#F59E0B', // 辅色: 橙色
    ];

    const result = await client.query(query, values);

    console.log('✅ 机构创建成功!\n');
    console.log('📋 机构信息:');
    console.log('  ID:', result.rows[0].id);
    console.log('  名称:', result.rows[0].name);
    console.log('  主色:', result.rows[0].primary_color);
    console.log('  辅色:', result.rows[0].secondary_color);
    console.log('');
    console.log('💡 现在可以在主页上使用这个机构进行课程生成了!');

  } catch (error) {
    console.error('❌ 创建机构失败:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// 执行创建
createOrganization();
