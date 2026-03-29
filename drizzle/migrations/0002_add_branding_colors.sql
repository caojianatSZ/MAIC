-- 添加品牌颜色字段到 organizations 表
ALTER TABLE organizations ADD COLUMN primary_color VARCHAR(7);
ALTER TABLE organizations ADD COLUMN secondary_color VARCHAR(7);
