// slide-16.js — Progress Plan (v4: 3-phase ops)
var pptxgen = require("pptxgenjs");
var slideConfig = { type: 'content', index: 16, title: '进度计划' };

function createSlide(pres, theme) {
  var slide = pres.addSlide();
  slide.background = { color: theme.primary };
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.05, fill: { color: theme.accent } });
  slide.addText("进度计划", { x: 0.6, y: 0.25, w: 4, h: 0.4, fontSize: 11, fontFace: "Microsoft YaHei", color: theme.accent, bold: true, margin: 0 });
  slide.addText("2026年 5月 — 7月", { x: 0.6, y: 0.55, w: 8.5, h: 0.55, fontSize: 30, fontFace: "Microsoft YaHei", color: "FFFFFF", bold: true, margin: 0 });

  var milestones = [
    { month: "5月 → 6月", title: "1a 系统开发", w: 3.3, color: theme.secondary, items: [
      "City模型+UserRole扩展+DB迁移",
      "城市合伙人工作台(线索漏斗+试课管理)",
      "总部运营面板(全局对比+收入分析)",
      "老师工作台(课程生成+诊断中心)",
      "PaymentRecord扩展(分账字段)",
      "联调：录线索→分配→上课→诊断→支付"
    ]},
    { month: "6月", title: "1b 运营准备", w: 2.8, color: theme.light, items: [
      "确定2-3个试点城市+合伙人",
      "城市合伙人培训(系统+话术+流程)",
      "AI课程模板打磨+参数调优",
      "家长端通知配置",
      "灰度部署(1个城市先跑1周)"
    ]},
    { month: "7月", title: "1c 运营验证", w: 3.3, color: theme.accent, items: [
      "2-3城市正式运营",
      "每城市1合伙人+2-5老师",
      "目标：线索>100 到场率>60%",
      "目标：线索→付费转化率>30%",
      "周报+月度复盘",
      "检验成果→决定阶段2启动"
    ], textColor: theme.primary }
  ];

  var xPos = 0.25;
  milestones.forEach(function(m, i) {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: xPos, y: 1.3, w: m.w, h: 3.6, fill: { color: "1F3D47" }, rectRadius: 0.1 });
    slide.addShape(pres.shapes.RECTANGLE, { x: xPos, y: 1.3, w: m.w, h: 0.65, fill: { color: m.color } });
    slide.addText(m.title, { x: xPos + 0.15, y: 1.33, w: m.w - 0.3, h: 0.32, fontSize: 18, fontFace: "Microsoft YaHei", color: i === 2 ? (m.textColor || theme.primary) : "FFFFFF", bold: true, margin: 0 });
    slide.addText(m.month, { x: xPos + 0.15, y: 1.62, w: m.w - 0.3, h: 0.22, fontSize: 10, fontFace: "Microsoft YaHei", color: i === 2 ? (m.textColor || theme.primary) : "FFFFFF", margin: 0 });
    var items = m.items.map(function(item, idx) { return { text: item, options: { bullet: true, breakLine: idx < m.items.length - 1, fontSize: 9, color: "CCCCCC" } }; });
    slide.addText(items, { x: xPos + 0.15, y: 2.1, w: m.w - 0.3, h: 2.6, valign: "top" });
    if (i < 2) { slide.addText("→", { x: xPos + m.w, y: 2.7, w: 0.25, h: 0.5, fontSize: 20, fontFace: "Arial", color: "FFFFFF", align: "center", valign: "middle" }); }
    xPos += m.w + 0.1;
  });

  slide.addShape(pres.shapes.RECTANGLE, { x: 1.5, y: 5.05, w: 7, h: 0.005, fill: { color: theme.accent } });
  slide.addText("关键决策点：7月底根据运营数据决定是否启动阶段 2", { x: 0.4, y: 5.12, w: 9.2, h: 0.22, fontSize: 10, fontFace: "Microsoft YaHei", color: theme.accent, align: "center", margin: 0 });

  slide.addShape(pres.shapes.OVAL, { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fill: { color: theme.accent } });
  slide.addText("16", { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fontSize: 12, fontFace: "Arial", color: "FFFFFF", bold: true, align: "center", valign: "middle" });
  return slide;
}

if (require.main === module) {
  var pres = new pptxgen(); pres.layout = 'LAYOUT_16x9';
  var theme = { primary: "264653", secondary: "2a9d8f", accent: "e9c46a", light: "f4a261", bg: "FFFFFF" };
  createSlide(pres, theme);
  pres.writeFile({ fileName: "slide-16-preview.pptx" });
}
module.exports = { createSlide: createSlide, slideConfig: slideConfig };
