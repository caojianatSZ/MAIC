"""Append content operations slides to existing presentation."""
import copy
import os
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn

# ── Color constants (matching existing PPT) ──
PRIMARY = RGBColor(0x26, 0x46, 0x53)     # dark teal
ACCENT = RGBColor(0x2A, 0x9D, 0x8F)      # teal
GOLD = RGBColor(0xE9, 0xC4, 0x6A)        # warm gold
ORANGE = RGBColor(0xF4, 0xA2, 0x61)       # warm orange
BODY = RGBColor(0x52, 0x52, 0x52)         # gray body text
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT_BG = RGBColor(0xF5, 0xF7, 0xF8)     # light panel bg
DARK_BG = RGBColor(0x1A, 0x35, 0x40)      # dark section bg

FONT = 'Microsoft YaHei'

prs = Presentation('slides/output/presentation.pptx')
W = prs.slide_width   # 9144000
H = prs.slide_height  # 5143500
SW, SH = W, H

# ── Helper functions ──
def add_bg(slide, color):
    bg = slide.background
    fill = bg.fill
    fill.solid()
    fill.fore_color.rgb = color

def add_top_bar(slide, color=ACCENT):
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, SW, Emu(45720))
    bar.fill.solid()
    bar.fill.fore_color.rgb = color
    bar.line.fill.background()

def add_section_title(slide, title, subtitle=None, bg_color=None):
    if bg_color:
        add_bg(slide, bg_color)
    else:
        add_bg(slide, WHITE)
    add_top_bar(slide)
    # Section number
    txBox = slide.shapes.add_textbox(Emu(548640), Emu(274320), Emu(2743200), Emu(457200))
    tf = txBox.text_frame
    tf.paragraphs[0].text = title
    tf.paragraphs[0].font.size = Pt(11)
    tf.paragraphs[0].font.bold = True
    tf.paragraphs[0].font.color.rgb = ACCENT
    tf.paragraphs[0].font.name = FONT

def add_page_title(slide, category, title, bg_color=None):
    if bg_color:
        add_bg(slide, bg_color)
    else:
        add_bg(slide, WHITE)
    add_top_bar(slide)
    # Category label
    txBox = slide.shapes.add_textbox(Emu(548640), Emu(274320), Emu(2743200), Emu(457200))
    tf = txBox.text_frame
    tf.paragraphs[0].text = category
    tf.paragraphs[0].font.size = Pt(11)
    tf.paragraphs[0].font.bold = True
    tf.paragraphs[0].font.color.rgb = ACCENT
    tf.paragraphs[0].font.name = FONT
    # Main title
    txBox = slide.shapes.add_textbox(Emu(548640), Emu(640080), Emu(7772400), Emu(640080))
    tf = txBox.text_frame
    tf.paragraphs[0].text = title
    tf.paragraphs[0].font.size = Pt(32)
    tf.paragraphs[0].font.bold = True
    tf.paragraphs[0].font.color.rgb = PRIMARY
    tf.paragraphs[0].font.name = FONT

def add_page_badge(slide, num):
    badge = slide.shapes.add_shape(MSO_SHAPE.OVAL, Emu(8370000), Emu(4790000), Emu(360000), Emu(360000))
    badge.fill.solid()
    badge.fill.fore_color.rgb = ACCENT
    badge.line.fill.background()
    txBox = slide.shapes.add_textbox(Emu(8370000), Emu(4790000), Emu(360000), Emu(360000))
    tf = txBox.text_frame
    tf.paragraphs[0].text = str(num)
    tf.paragraphs[0].font.size = Pt(10)
    tf.paragraphs[0].font.bold = True
    tf.paragraphs[0].font.color.rgb = WHITE
    tf.paragraphs[0].font.name = FONT
    tf.paragraphs[0].alignment = PP_ALIGN.CENTER

def add_panel(slide, left, top, width, height, color=LIGHT_BG):
    panel = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, top, width, height)
    panel.fill.solid()
    panel.fill.fore_color.rgb = color
    panel.line.fill.background()
    return panel

def add_card(slide, left, top, width, height, title, items, title_color=ACCENT):
    """Add a card with title and bullet items."""
    card = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, top, width, height)
    card.fill.solid()
    card.fill.fore_color.rgb = WHITE
    card.line.color.rgb = RGBColor(0xE0, 0xE0, 0xE0)
    card.line.width = Pt(1)
    # Card title
    txBox = slide.shapes.add_textbox(Emu(left + Emu(182880)), Emu(top + Emu(137160)),
                                      Emu(width - Emu(365760)), Emu(274320))
    tf = txBox.text_frame
    tf.word_wrap = True
    tf.paragraphs[0].text = title
    tf.paragraphs[0].font.size = Pt(14)
    tf.paragraphs[0].font.bold = True
    tf.paragraphs[0].font.color.rgb = title_color
    tf.paragraphs[0].font.name = FONT
    # Items
    txBox2 = slide.shapes.add_textbox(Emu(left + Emu(182880)), Emu(top + Emu(457200)),
                                       Emu(width - Emu(365760)), Emu(height - Emu(594360)))
    tf2 = txBox2.text_frame
    tf2.word_wrap = True
    for j, item in enumerate(items):
        if j == 0:
            p = tf2.paragraphs[0]
        else:
            p = tf2.add_paragraph()
        p.text = item
        p.font.size = Pt(10)
        p.font.color.rgb = BODY
        p.font.name = FONT
        p.space_after = Pt(6)

def add_bottom_bar(slide):
    bar = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, Emu(H - 297180), SW, Emu(297180))
    bar.fill.solid()
    bar.fill.fore_color.rgb = DARK_BG
    bar.line.fill.background()

# ── Slide N: Section Divider ──
slide_idx = len(prs.slides) + 1

slide = prs.slides.add_slide(prs.slide_layouts[0])
add_bg(slide, DARK_BG)
# Big number
txBox = slide.shapes.add_textbox(Emu(731520), Emu(1097280), Emu(822960), Emu(1097280))
tf = txBox.text_frame
tf.paragraphs[0].text = "03"
tf.paragraphs[0].font.size = Pt(72)
tf.paragraphs[0].font.bold = True
tf.paragraphs[0].font.color.rgb = GOLD
tf.paragraphs[0].font.name = FONT
# Vertical line
line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Emu(731520), Emu(2286000), Emu(54864), Emu(1645920))
line.fill.solid()
line.fill.fore_color.rgb = GOLD
line.line.fill.background()
# Title
txBox = slide.shapes.add_textbox(Emu(1097280), Emu(1188720), Emu(6858000), Emu(1097280))
tf = txBox.text_frame
tf.paragraphs[0].text = "内容运营策略"
tf.paragraphs[0].font.size = Pt(52)
tf.paragraphs[0].font.bold = True
tf.paragraphs[0].font.color.rgb = WHITE
tf.paragraphs[0].font.name = FONT
# Subtitle
txBox = slide.shapes.add_textbox(Emu(1097280), Emu(2194560), Emu(6858000), Emu(640080))
tf = txBox.text_frame
tf.paragraphs[0].text = "品牌+渠道双线 · 小红书+视频号+公众号 · AI辅助生产"
tf.paragraphs[0].font.size = Pt(24)
tf.paragraphs[0].font.color.rgb = GOLD
tf.paragraphs[0].font.name = FONT
# Bottom bar
add_bottom_bar(slide)
txBox = slide.shapes.add_textbox(Emu(457200), Emu(H - 274320), Emu(2743200), Emu(228600))
tf = txBox.text_frame
tf.paragraphs[0].text = "学迹 · 内容运营方案"
tf.paragraphs[0].font.size = Pt(10)
tf.paragraphs[0].font.color.rgb = WHITE
tf.paragraphs[0].font.name = FONT

print(f"Slide {slide_idx}: Section Divider")
slide_idx += 1

# ── Slide: 运营目标与优先级 ──
slide = prs.slides.add_slide(prs.slide_layouts[0])
add_page_title(slide, "内容运营", "运营目标与优先级")
add_page_badge(slide, slide_idx)

# Four goal cards
goals = [
    ("🥇 渠道招募", "第一优先", "招募城市合伙人\n由渠道驱动获客", GOLD),
    ("🥈 用户获客", "第二优先", "内容吸引家长\n扫码使用小程序", ACCENT),
    ("🥉 品牌认知", "第三优先", "建立\"精准提分\"\n专业认知和差异化", ORANGE),
    ("🏅 转化付费", "后续阶段", "内容推动免费\n到付费的转化", RGBColor(0x90, 0x90, 0x90)),
]
for j, (title, pri, desc, color) in enumerate(goals):
    left = Emu(457200 + j * 2100000)
    card = add_panel(slide, left, Emu(1463040), Emu(1920240), Emu(2834640), LIGHT_BG)
    # Priority badge
    badge = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Emu(left + Emu(137160)),
                                     Emu(1554480), Emu(1645920), Emu(274320))
    badge.fill.solid()
    badge.fill.fore_color.rgb = color
    badge.line.fill.background()
    txBox = slide.shapes.add_textbox(Emu(left + Emu(137160)), Emu(1554480),
                                      Emu(1645920), Emu(274320))
    tf = txBox.text_frame
    tf.paragraphs[0].text = pri
    tf.paragraphs[0].font.size = Pt(10)
    tf.paragraphs[0].font.bold = True
    tf.paragraphs[0].font.color.rgb = WHITE
    tf.paragraphs[0].font.name = FONT
    tf.paragraphs[0].alignment = PP_ALIGN.CENTER
    # Title
    txBox = slide.shapes.add_textbox(Emu(left + Emu(182880)), Emu(1920240),
                                      Emu(1554480), Emu(365760))
    tf = txBox.text_frame
    tf.paragraphs[0].text = title
    tf.paragraphs[0].font.size = Pt(16)
    tf.paragraphs[0].font.bold = True
    tf.paragraphs[0].font.color.rgb = PRIMARY
    tf.paragraphs[0].font.name = FONT
    # Desc
    txBox = slide.shapes.add_textbox(Emu(left + Emu(182880)), Emu(2377440),
                                      Emu(1554480), Emu(914400))
    tf = txBox.text_frame
    tf.paragraphs[0].text = desc
    tf.paragraphs[0].font.size = Pt(11)
    tf.paragraphs[0].font.color.rgb = BODY
    tf.paragraphs[0].font.name = FONT

add_bottom_bar(slide)
print(f"Slide {slide_idx}: Goals & Priority")
slide_idx += 1

# ── Slide: 平台策略 ──
slide = prs.slides.add_slide(prs.slide_layouts[0])
add_page_title(slide, "内容运营", "三平台策略 · 品牌+渠道双线")
add_page_badge(slide, slide_idx)

platforms = [
    ("小红书", "品牌认知 + 用户获客", "主战场", "日更 · 30篇/月",
     ["教育知识图文（知识点自查/薄弱点分析）",
      "诊断报告解读（让家长看懂数据）",
      "学习方法卡片（可保存转发）",
      "合伙人故事（招募+信任）"], ACCENT),
    ("微信视频号", "获客 + 渠道招募", "转化枢纽", "隔日更 · 15条/月",
     ["产品demo短视频（诊断→课程→提分）",
      "知识点讲解切片（30秒一个概念）",
      "家长访谈（真实案例）",
      "城市合伙人转发到家长群"], ORANGE),
    ("微信公众号", "渠道招募 + 品牌深度", "信任锚点", "周双更 · 8篇/月",
     ["招商案例长文（转化潜在合伙人）",
      "学习方法论深度文章",
      "产品解读（多智能体/知识图谱）",
      "季度学习报告白皮书"], GOLD),
]
for j, (name, goal, role, freq, items, color) in enumerate(platforms):
    left = Emu(320000 + j * 2880000)
    add_card(slide, left, Emu(1463040), Emu(2692400), Emu(3240000), f"{name} · {role}", items, color)
    # Goal subtitle
    txBox = slide.shapes.add_textbox(Emu(left + Emu(182880)), Emu(1463040 + 274320),
                                      Emu(2692400 - Emu(365760)), Emu(228600))
    tf = txBox.text_frame
    # Frequency badge
    fbadge = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Emu(left + Emu(2692400 - 1645920 - 182880)),
                                      Emu(4663440), Emu(1645920), Emu(228600))
    fbadge.fill.solid()
    fbadge.fill.fore_color.rgb = color
    fbadge.line.fill.background()
    txBox = slide.shapes.add_textbox(Emu(left + Emu(2692400 - 1645920 - 182880)), Emu(4663440),
                                      Emu(1645920), Emu(228600))
    tf = txBox.text_frame
    tf.paragraphs[0].text = freq
    tf.paragraphs[0].font.size = Pt(9)
    tf.paragraphs[0].font.bold = True
    tf.paragraphs[0].font.color.rgb = WHITE
    tf.paragraphs[0].font.name = FONT
    tf.paragraphs[0].alignment = PP_ALIGN.CENTER

add_bottom_bar(slide)
print(f"Slide {slide_idx}: Platform Strategy")
slide_idx += 1

# ── Slide: 首月内容日历 ──
slide = prs.slides.add_slide(prs.slide_layouts[0])
add_page_title(slide, "内容运营", "首月内容日历 · 加速版")
add_page_badge(slide, slide_idx)

weeks = [
    ("Week 1", "品牌引爆 + 产品认知", GOLD,
     ["前3天集中轰炸：小红书双更（6篇）",
      "视频号每天1条（7条）",
      "公众号品牌故事+产品深度（2篇）",
      "周末：首波合伙人招募内容上线"]),
    ("Week 2", "效果验证 + 渠道转化", ACCENT,
     ["小红书日更（10篇）：案例+方法+合伙人",
      "视频号隔日更（8条）：家长访谈+成绩变化",
      "公众号招商+报告（2篇）",
      "周末：首月内容数据复盘"]),
    ("Week 3-4", "持续运营 + 迭代优化", RGBColor(0x90, 0x90, 0x90),
     ["保持日更/隔日更/周双更节奏",
      "淘汰低效内容模板",
      "加码高效内容模板",
      "启动合伙人内容工具包分发"]),
]
for j, (week, theme, color, items) in enumerate(weeks):
    left = Emu(365760 + j * 2810000)
    # Week header
    header = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, left, Emu(1371600), Emu(2641600), Emu(502920))
    header.fill.solid()
    header.fill.fore_color.rgb = color
    header.line.fill.background()
    txBox = slide.shapes.add_textbox(Emu(left + Emu(137160)), Emu(1371600),
                                      Emu(2377440), Emu(274320))
    tf = txBox.text_frame
    tf.paragraphs[0].text = week
    tf.paragraphs[0].font.size = Pt(18)
    tf.paragraphs[0].font.bold = True
    tf.paragraphs[0].font.color.rgb = WHITE
    tf.paragraphs[0].font.name = FONT
    txBox = slide.shapes.add_textbox(Emu(left + Emu(137160)), Emu(1645920),
                                      Emu(2377440), Emu(228600))
    tf = txBox.text_frame
    tf.paragraphs[0].text = theme
    tf.paragraphs[0].font.size = Pt(12)
    tf.paragraphs[0].font.color.rgb = WHITE
    tf.paragraphs[0].font.name = FONT
    # Items
    txBox = slide.shapes.add_textbox(Emu(left + Emu(137160)), Emu(2057400),
                                      Emu(2377440), Emu(2194560))
    tf = txBox.text_frame
    for k, item in enumerate(items):
        if k == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()
        p.text = f"• {item}"
        p.font.size = Pt(10)
        p.font.color.rgb = BODY
        p.font.name = FONT
        p.space_after = Pt(8)

add_bottom_bar(slide)
print(f"Slide {slide_idx}: Content Calendar")
slide_idx += 1

# ── Slide: 内容生产体系 ──
slide = prs.slides.add_slide(prs.slide_layouts[0])
add_page_title(slide, "内容运营", "内容生产体系 · 模板化 + AI辅助")
add_page_badge(slide, slide_idx)

# Three pillars
pillars = [
    ("模板化生产", "小红书4种固定格式", ACCENT,
     ["知识点卡片：标题+知识点名+3个要点+CTA",
      "诊断报告解读：报告截图+3色标注+解读文字",
      "家长误区：常见错误观念+数据反驳+正确做法",
      "合伙人故事：人物+经历+收益+招募CTA"]),
    ("AI辅助撰稿", "知识图谱驱动选题", ORANGE,
     ["每个知识点 = 现成选题",
      "\"<知识点>孩子为什么总是错\"",
      "公众号长文AI初稿 + 人工润色",
      "批量生成标题和结构，人工把关"]),
    ("多平台分发", "一次制作·三平台复用", GOLD,
     ["公众号长文 → 拆3篇小红书图文",
      "视频号内容 → 截关键帧做图文素材",
      "产品demo → 公众号嵌入+视频号+小红书截图",
      "核心效率：1个选题 = 3平台内容"]),
]
for j, (title, subtitle, color, items) in enumerate(pillars):
    left = Emu(320000 + j * 2880000)
    add_card(slide, left, Emu(1463040), Emu(2692400), Emu(3240000), title, items, color)
    txBox = slide.shapes.add_textbox(Emu(left + Emu(182880)), Emu(1463040 + 274320),
                                      Emu(2692400 - Emu(365760)), Emu(228600))

add_bottom_bar(slide)
print(f"Slide {slide_idx}: Content Production System")
slide_idx += 1

# ── Slide: 工作量估算 ──
slide = prs.slides.add_slide(prs.slide_layouts[0])
add_page_title(slide, "内容运营", "工作量与资源估算 · AI辅助后")
add_page_badge(slide, slide_idx)

# Table-like layout
table_data = [
    ("内容类型", "单条耗时", "月产出", "月总耗时", ACCENT),
    ("小红书图文", "30-45 min", "30 条", "15-22 h", WHITE),
    ("视频号短视频", "1-1.5 h", "15 条", "15-22 h", LIGHT_BG),
    ("公众号长文", "2-3 h", "8 篇", "16-24 h", WHITE),
    ("合计", "—", "—", "46-68 h/月", GOLD),
]

y_start = Emu(1463040)
row_h = Emu(457200)
col_widths = [Emu(2286000), Emu(1828800), Emu(1645920), Emu(2286000)]

for row_idx, (c1, c2, c3, c4, bg) in enumerate(table_data):
    y = y_start + row_idx * row_h
    x_pos = Emu(548640)
    for col_idx, (text, width) in enumerate(zip([c1, c2, c3, c4], col_widths)):
        if bg != WHITE or row_idx == 0:
            cell_bg = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x_pos, y, width, row_h)
            cell_bg.fill.solid()
            cell_bg.fill.fore_color.rgb = bg if row_idx > 0 else ACCENT
            cell_bg.line.fill.background()
        txBox = slide.shapes.add_textbox(Emu(x_pos + Emu(91440)), Emu(y + Emu(91440)),
                                          Emu(width - Emu(182880)), Emu(row_h - Emu(182880)))
        tf = txBox.text_frame
        tf.paragraphs[0].text = text
        tf.paragraphs[0].font.size = Pt(12) if row_idx == 0 or row_idx == 4 else Pt(11)
        tf.paragraphs[0].font.bold = True if row_idx == 0 or row_idx == 4 else False
        tf.paragraphs[0].font.color.rgb = WHITE if row_idx == 0 else (PRIMARY if row_idx == 4 else BODY)
        tf.paragraphs[0].font.name = FONT
        x_pos += width

# Summary note
txBox = slide.shapes.add_textbox(Emu(548640), Emu(4200000), Emu(7772400), Emu(457200))
tf = txBox.text_frame
tf.paragraphs[0].text = "≈ 每天 1.5-2 小时 · 一人全职绰绰有余 · 提前备好 Week 1 内容再启动"
tf.paragraphs[0].font.size = Pt(11)
tf.paragraphs[0].font.color.rgb = ACCENT
tf.paragraphs[0].font.name = FONT

add_bottom_bar(slide)
print(f"Slide {slide_idx}: Workload Estimate")
slide_idx += 1

# ── Slide: 关键指标 ──
slide = prs.slides.add_slide(prs.slide_layouts[0])
add_page_title(slide, "内容运营", "首月关键指标")
add_page_badge(slide, slide_idx)

metrics = [
    ("小红书", ACCENT, [
        "总曝光 ≥ 50,000",
        "粉丝 ≥ 500",
        "笔记平均互动 ≥ 50",
    ]),
    ("视频号", ORANGE, [
        "总播放 ≥ 20,000",
        "视频号→小程序转化 ≥ 100",
        "合伙人转发率 ≥ 80%",
    ]),
    ("公众号", GOLD, [
        "订阅 ≥ 300",
        "文章平均阅读 ≥ 500",
        "招商文章咨询转化 ≥ 10",
    ]),
    ("渠道", PRIMARY, [
        "合伙人咨询 ≥ 20",
        "签约 ≥ 5",
        "合伙人内容分发率 ≥ 60%",
    ]),
]
for j, (name, color, items) in enumerate(metrics):
    left = Emu(365760 + j * 2100000)
    # Header
    header = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, left, Emu(1463040),
                                      Emu(1920240), Emu(457200))
    header.fill.solid()
    header.fill.fore_color.rgb = color
    header.line.fill.background()
    txBox = slide.shapes.add_textbox(left, Emu(1463040), Emu(1920240), Emu(457200))
    tf = txBox.text_frame
    tf.paragraphs[0].text = name
    tf.paragraphs[0].font.size = Pt(18)
    tf.paragraphs[0].font.bold = True
    tf.paragraphs[0].font.color.rgb = WHITE
    tf.paragraphs[0].font.name = FONT
    tf.paragraphs[0].alignment = PP_ALIGN.CENTER
    # Items
    panel = add_panel(slide, left, Emu(1920240), Emu(1920240), Emu(1920240), LIGHT_BG)
    txBox = slide.shapes.add_textbox(Emu(left + Emu(137160)), Emu(2011680),
                                      Emu(1645920), Emu(1645920))
    tf = txBox.text_frame
    for k, item in enumerate(items):
        if k == 0:
            p = tf.paragraphs[0]
        else:
            p = tf.add_paragraph()
        p.text = f"✓ {item}"
        p.font.size = Pt(12)
        p.font.bold = True
        p.font.color.rgb = PRIMARY
        p.font.name = FONT
        p.space_after = Pt(12)

add_bottom_bar(slide)
print(f"Slide {slide_idx}: Key Metrics")
slide_idx += 1

# ── Slide: 总结 ──
slide = prs.slides.add_slide(prs.slide_layouts[0])
add_bg(slide, DARK_BG)

txBox = slide.shapes.add_textbox(Emu(731520), Emu(1097280), Emu(7315200), Emu(914400))
tf = txBox.text_frame
tf.paragraphs[0].text = "品牌+渠道双线驱动"
tf.paragraphs[0].font.size = Pt(44)
tf.paragraphs[0].font.bold = True
tf.paragraphs[0].font.color.rgb = WHITE
tf.paragraphs[0].font.name = FONT

line = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Emu(731520), Emu(2103120), Emu(914400), Emu(54864))
line.fill.solid()
line.fill.fore_color.rgb = GOLD
line.line.fill.background()

summary_items = [
    "小红书日更 + 视频号隔日更 + 公众号周双更",
    "内容模板化 · AI辅助生产 · 一次制作多平台分发",
    "日均 1.5-2h 工作量 · 一人全职可覆盖",
    "渠道优先 → 品牌认知 → 用户获客 → 转化付费",
]
for j, item in enumerate(summary_items):
    txBox = slide.shapes.add_textbox(Emu(731520), Emu(2286000 + j * 457200),
                                      Emu(7315200), Emu(365760))
    tf = txBox.text_frame
    tf.paragraphs[0].text = f"•  {item}"
    tf.paragraphs[0].font.size = Pt(16)
    tf.paragraphs[0].font.color.rgb = RGBColor(0xCC, 0xCC, 0xCC)
    tf.paragraphs[0].font.name = FONT

add_bottom_bar(slide)
txBox = slide.shapes.add_textbox(Emu(457200), Emu(H - 274320), Emu(2743200), Emu(228600))
tf = txBox.text_frame
tf.paragraphs[0].text = "学迹 · 让每个孩子有自己的AI老师"
tf.paragraphs[0].font.size = Pt(10)
tf.paragraphs[0].font.color.rgb = WHITE
tf.paragraphs[0].font.name = FONT

print(f"Slide {slide_idx}: Summary")

# ── Save ──
output_path = 'slides/output/presentation.pptx'
prs.save(output_path)
print(f"\nSaved: {output_path} ({slide_idx} slides total)")
