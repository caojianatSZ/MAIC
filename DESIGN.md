# Design System — 学迹

## Product Context
- **What this is:** 学迹 — AI 拍照诊断 + 互动课程学习平台。核心流程「测学练」：拍照诊断定位薄弱知识点 → AI 多智能体生成互动课程因材施教 → 靶向练习巩固直到掌握
- **Who it's for:** 初中学生家长，关心孩子成绩，想知道"到底是哪个知识点不会"
- **Space/industry:** 教育科技（K12 AI 学习诊断）
- **Project type:** 微信小程序（核心产品）+ 品牌官网（桌面端优先、自适应手机）

## Brand
- **品牌名:** 学迹
- **出品方:** 弘知
- **记忆锚点:** "能帮助孩子提分"
- **品牌调性:** 专业、可信、结果导向。不是题库工具，是 AI 老师

## Aesthetic Direction
- **Direction:** 精准诊断风（Diagnostic Refined）
- **Decoration level:** 克制的（Intentional）— 大量留白，每个元素有呼吸空间
- **Mood:** Apple 官网式的克制——少即是多。像一份高端体检报告：干净、有品质感、让人信服
- **Key differentiator:** 不跟竞品走"可爱玩伴"路线。学迹是专业诊断工具，视觉语言强调精准和可信度

## Typography
- **Display/Hero:** Noto Sans SC（思源黑体）— 清晰现代，大字重（Bold/Black），标题有力
- **Body:** PingFang SC（苹方）— 系统原生，阅读舒适，中小字重（Regular/Medium）
- **UI/Labels:** PingFang SC Medium — 与正文同族，统一视觉
- **Data/Tables:** DM Sans — 表格数字对齐（tabular-nums），现代几何感，用于知识点分数、进度百分比
- **Code:** JetBrains Mono — 开发相关页面用
- **Loading:** Google Fonts CDN（Noto Sans SC + DM Sans），PingFang 系统自带无需加载
- **Scale (rem):** 0.75(xs) / 0.875(sm) / 1(base) / 1.125(lg) / 1.25(xl) / 1.5(2xl) / 2(3xl) / 2.5(4xl) / 3(5xl)

## Color
- **Approach:** 克制的（Restrained）— 深蓝为主，琥珀仅用于关键交互和数据高亮
- **Primary:** `#1E5B8A` — 品牌色，标题、导航、主要按钮
- **Primary hover:** `#256BA0`
- **Accent:** `#F59E0B` — 琥珀，仅用于 CTA 按钮、知识点薄弱标记、重要数据高亮
- **Neutrals (cool gray):**
  - `#F8FAFC` — 页面背景
  - `#F1F5F9` — 卡片背景
  - `#E2E8F0` — 边框
  - `#94A3B8` — 辅助文字
  - `#475569` — 正文次级
  - `#1E293B` — 正文主色
  - `#0F172A` — 标题
- **Semantic:**
  - 掌握 (mastered): `#22C55E` (green-500)
  - 部分掌握 (partial): `#F59E0B` (amber-400)
  - 薄弱 (weak): `#EF4444` (red-400)
- **Dark mode:** 深蓝灰底色 `#0F172A`，白色卡片 `#1E293B`，语义色饱和度降低 15%

## Spacing
- **Base unit:** 8px（Tailwind 默认）
- **Density:** 舒适（Comfortable）— 大量留白，内容不拥挤
- **Scale:** 2(0.5) / 4(1) / 8(2) / 12(3) / 16(4) / 24(6) / 32(8) / 48(12) / 64(16) / 96(24)
- **Section gap:** min 64px，推荐 96px
- **Content max-width:** 1200px（官网）/ 100% 小程序

## Layout
- **Approach:** Hybrid — 品牌官网用创意编辑布局（不对称、杂志感），小程序内用严格网格（诊断信息清晰）
- **Grid:** 12 列（官网）/ 4 列（小程序）
- **Max content width:** 1200px（官网）/ 100vw - 32px（小程序）
- **Border radius:** sm:4px / md:8px / lg:12px / xl:16px / full:9999px
- **Desktop-first:** 官网以 1440px 为设计基准，通过 Tailwind `lg:` `md:` `sm:` 断点向下适配

## Motion
- **Approach:** 功能性微动效（Minimal-Functional）— 只在对理解有帮助的地方用动效
- **Easing:** enter: ease-out / exit: ease-in / move: ease-in-out
- **Duration:** micro:100ms / short:200ms / medium:350ms / long:500ms
- **Uses:** 知识点图谱展开、诊断得分揭晓、学习进度推进、页面切换
- **No:** 装饰动画、滚动视差、悬停放大（保持克制）

## Brand Website — Page Spec

### 首页 (`/`)
- 顶部：Logo + 导航（功能 / 关于 / 隐私）
- Hero：大字标题 + 副标题 + CTA 按钮（琥珀色，仅一个）
- 核心流程展示：「测学练」三步闭环图解
- AI 互动课堂差异化展示（区别于拍照搜题的关键）
- 底部：版权信息 + 隐私政策链接

### 功能介绍 (`/features`)
- 测：拍照诊断流程说明
- 学：AI 互动课堂能力展示（多智能体实时教学）
- 练：靶向练习 + 知识点掌握度追踪

### 隐私政策 (`/privacy`)
- 微信小程序审核刚需
- 参考微信小程序官方模板

### 用户协议 (`/terms`)
- 法律合规
- 标准模板 + 学迹具体服务描述

## Anti-Patterns (never use)
- 紫色/品红渐变
- 3 列图标网格
- 卡通插图 / 吉祥物 IP
- 居中一切
- 装饰性动画 / 滚动视差
- 均匀圆角 bubble 风格
- 小程序码在官网首页（放功能页或 footer）

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-16 | 品牌名定为「学迹」 | 经多轮讨论，"学迹"精准、差异化强、契合诊断+学习路径产品形态 |
| 2026-05-16 | 设计方向：精准诊断风 | 与竞品"可爱玩伴"路线形成区隔，定位"专业学习诊断工具" |
| 2026-05-16 | Apple 式克制 + 大量留白 | 教育类产品普遍视觉拥挤，留白形成差异化和精致感 |
| 2026-05-16 | 深蓝+琥珀配色 | 深蓝=信任/专业，琥珀=高亮标记（像诊断报告里标记"需要关注"的荧光笔） |
| 2026-05-16 | 桌面端优先、自适应手机 | 官网是品牌门面，家长通常在电脑上了解产品后在手机上使用小程序 |
| 2026-05-16 | 核心流程：测学练 | 区别于拍照搜题工具，AI 互动课堂是核心竞争力 |
