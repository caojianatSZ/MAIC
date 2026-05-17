// slide-10.js — Phase 1a+1b (v4: 运营角色)
var pptxgen = require("pptxgenjs");
var slideConfig = { type: 'content', index: 10, title: '阶段 1：系统开发' };

function createSlide(pres, theme) {
  var slide = pres.addSlide();
  slide.background = { color: theme.bg };
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.05, fill: { color: theme.primary } });
  slide.addText("阶段 1a", { x: 0.6, y: 0.25, w: 3, h: 0.4, fontSize: 11, fontFace: "Microsoft YaHei", color: theme.secondary, bold: true, margin: 0 });
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.4, y: 0.55, w: 5.5, h: 0.55, fill: { color: theme.primary }, rectRadius: 0.08 });
  slide.addText("系统开发：角色 + 工作台 + 运营面板", { x: 0.7, y: 0.55, w: 5.0, h: 0.55, fontSize: 18, fontFace: "Microsoft YaHei", color: "FFFFFF", bold: true, margin: 0 });
  slide.addText("3-4 周", { x: 6.1, y: 0.62, w: 3, h: 0.4, fontSize: 15, fontFace: "Microsoft YaHei", color: theme.primary, bold: true, margin: 0 });

  var features = [
    { title: "AI 课程生成 + 角色系统", items: ["UserRole 扩展(TEACHER/CITY_PARTNER/HQ_OPS)", "City 模型 + 城市级数据隔离", "CourseSession + TrialLead + Booking"] },
    { title: "城市合伙人工作台", items: ["线索漏斗(新→已联系→试课→转化)", "待办：跟进线索 / 安排试课 / 分配老师", "转化数据看板(个人 vs 城市均值)"] },
    { title: "总部运营面板", items: ["全局概览：各城市线索、转化率、收入", "城市对比排名 + 老师绩效", "分账记录(PaymentRecord 扩展)"] },
    { title: "老师工作台(简化)", items: ["纯教学：课程生成 + 今日课程 + 诊断", "不再负责线索和获客", "课时统计 + 学生掌握度提升"] }
  ];

  features.forEach(function(f, i) {
    var x = 0.4 + (i % 2) * 4.7;
    var y = 1.3 + Math.floor(i / 2) * 1.95;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x, y: y, w: 4.4, h: 1.75, fill: { color: i === 0 ? "FEF9E7" : "F5F9FA" }, rectRadius: 0.08 });
    slide.addShape(pres.shapes.RECTANGLE, { x: x, y: y, w: 0.05, h: 1.75, fill: { color: i === 0 ? theme.accent : theme.secondary } });
    var prefix = (i === 0 || i === 1) ? "★ " : "";
    slide.addText(prefix + f.title, { x: x + 0.25, y: y + 0.1, w: 3.9, h: 0.3, fontSize: 14, fontFace: "Microsoft YaHei", color: theme.primary, bold: true, margin: 0 });
    var items = f.items.map(function(item, idx) { return { text: item, options: { bullet: true, breakLine: idx < f.items.length - 1, fontSize: 10, color: "525252" } }; });
    slide.addText(items, { x: x + 0.25, y: y + 0.5, w: 3.9, h: 1.1, valign: "top" });
  });

  slide.addShape(pres.shapes.OVAL, { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fill: { color: theme.accent } });
  slide.addText("10", { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fontSize: 12, fontFace: "Arial", color: "FFFFFF", bold: true, align: "center", valign: "middle" });
  return slide;
}

if (require.main === module) {
  var pres = new pptxgen(); pres.layout = 'LAYOUT_16x9';
  var theme = { primary: "264653", secondary: "2a9d8f", accent: "e9c46a", light: "f4a261", bg: "FFFFFF" };
  createSlide(pres, theme);
  pres.writeFile({ fileName: "slide-10-preview.pptx" });
}
module.exports = { createSlide: createSlide, slideConfig: slideConfig };
