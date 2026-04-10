-- 创建湖南弘知教育科技有限公司机构
-- 执行方式: psql -U openmaic -d openmaic -f scripts/create-organization.sql

-- 插入机构记录
INSERT INTO organizations (
  id,
  name,
  logo_data,
  logo_mime_type,
  phone,
  wechat_qr_url,
  primary_color,
  secondary_color,
  created_at,
  updated_at
) VALUES (
  'hongzhiedu-001',
  '湖南弘知教育科技有限公司',
  NULL, -- logo_data 稍后通过 API 更新
  NULL, -- logo_mime_type
  NULL, -- phone
  NULL, -- wechat_qr_url
  '#3B82F6', -- primary_color (蓝色)
  '#F59E0B', -- secondary_color (橙色)
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  primary_color = EXCLUDED.primary_color,
  secondary_color = EXCLUDED.secondary_color,
  updated_at = NOW();

-- 查询创建的机构
SELECT id, name, primary_color, secondary_color, created_at
FROM organizations
WHERE id = 'hongzhiedu-001';
