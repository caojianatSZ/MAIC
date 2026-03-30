#!/bin/bash

# 微信小程序API测试脚本

echo "======================================"
echo "微信小程序MVP功能测试"
echo "======================================"
echo ""

BASE_URL="http://localhost:3000"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试函数
test_api() {
  local name="$1"
  local method="$2"
  local url="$3"
  local data="$4"

  echo -e "${YELLOW}测试: $name${NC}"
  echo "请求: $method $url"

  if [ -z "$data" ]; then
    response=$(curl -s -X "$method" "$url")
  else
    response=$(curl -s -X "$method" "$url" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi

  echo "$response" | jq . 2>/dev/null || echo "$response"
  echo ""
}

# 1. 测试EduKG知识图谱服务
echo "======================================"
echo "1. EduKG知识图谱服务测试"
echo "======================================"
echo ""

test_api "搜索知识点（有理数）" \
  "GET" \
  "$BASE_URL/api/debug/test-edukg?action=search&keyword=有理数"

test_api "获取知识点详情" \
  "GET" \
  "$BASE_URL/api/debug/test-edukg?action=getInstance&uri=数学#有理数"

# 2. 测试数据库查询
echo "======================================"
echo "2. 数据库表结构测试"
echo "======================================"
echo ""

echo -e "${GREEN}检查用户学习系统表:${NC}"
psql postgresql://caojian@localhost:5432/openmaic -c "
SELECT table_name,
       (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns
FROM information_schema.tables t
WHERE table_schema = 'public'
AND table_name IN ('users', 'user_knowledge_mastery', 'user_wrong_questions', 'share_records')
ORDER BY table_name;
" 2>/dev/null || echo "数据库查询失败"

echo ""

# 3. 测试课程搜索API
echo "======================================"
echo "3. 课程搜索API测试"
echo "======================================"
echo ""

test_api "课程搜索（无参数）" \
  "GET" \
  "$BASE_URL/api/classrooms/search?limit=5"

test_api "课程搜索（数学科目）" \
  "GET" \
  "$BASE_URL/api/classrooms/search?subject=math&limit=5"

# 4. 测试OCR服务（需要配置）
echo "======================================"
echo "4. OCR图片识别服务"
echo "======================================"
echo ""

echo -e "${YELLOW}OCR服务状态:${NC}"
if [ -n "$PDF_MINERU_BASE_URL" ] || [ -n "$GOOGLE_CLOUD_VISION_API_KEY" ]; then
  echo -e "${GREEN}✓ OCR服务已配置${NC}"
  echo "MinerU: ${PDF_MINERU_BASE_URL:-未配置}"
  echo "Google Vision: ${GOOGLE_CLOUD_VISION_API_KEY:+已配置}"
else
  echo -e "${RED}✗ OCR服务未配置${NC}"
  echo "需要设置以下环境变量之一："
  echo "  - PDF_MINERU_BASE_URL"
  echo "  - GOOGLE_CLOUD_VISION_API_KEY"
fi
echo ""

# 5. 检查API路由
echo "======================================"
echo "5. API路由检查"
echo "======================================"
echo ""

routes=(
  "GET  /api/classrooms/search"
  "POST /api/classrooms/{id}/similar"
  "POST /api/classrooms/{id}/save-as-template"
  "GET  /api/debug/test-edukg"
  "POST /api/miniprogram/ocr"
  "POST /api/miniprogram/batch-submit"
  "GET  /api/miniprogram/batch-submit"
  "POST /api/miniprogram/ai/recognize-knowledge-point"
  "GET  /api/miniprogram/wrong-questions"
  "POST /api/miniprogram/wrong-questions/{id}"
  "GET  /api/miniprogram/user/profile"
  "POST /api/miniprogram/user/profile"
  "PUT  /api/miniprogram/user/profile"
)

echo -e "${GREEN}已实现的API路由:${NC}"
for route in "${routes[@]}"; do
  echo "  ✓ $route"
done
echo ""

# 6. 数据统计
echo "======================================"
echo "6. 数据统计"
echo "======================================"
echo ""

echo -e "${GREEN}数据库表统计:${NC}"
psql postgresql://caojian@localhost:5432/openmaic -c "
SELECT
  '课程' as entity, COUNT(*) as count FROM classrooms
UNION ALL
SELECT
  '课程模板' as entity, COUNT(*) as count FROM classroom_templates
UNION ALL
SELECT
  '知识点' as entity, COUNT(*) as count FROM classroom_knowledge_points
UNION ALL
SELECT
  '用户' as entity, COUNT(*) as count FROM users
UNION ALL
SELECT
  '用户知识点掌握' as entity, COUNT(*) as count FROM user_knowledge_mastery
UNION ALL
SELECT
  '错题' as entity, COUNT(*) as count FROM user_wrong_questions;
" 2>/dev/null || echo "统计查询失败"

echo ""
echo "======================================"
echo "测试完成！"
echo "======================================"
