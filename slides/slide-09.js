// slide-09.js — Phase 1a
var pptxgen = require("pptxgenjs");
var slideConfig = { type: 'content', index: 9, title: '阶段 1a：课程生成 + 试课 + 约课' };

function createSlide(pres, theme) {
  var slide = pres.addSlide();
  slide.background = { color: theme.bg };
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.05, fill: { color: theme.primary } });
  slide.addText("阶段 1a", { x: 0.6, y: 0.3, w: 3, h: 0.5, fontSize: 11, fontFace: "Microsoft YaHei", color: theme.secondary, bold: true, margin: 0 });
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.4, y: 0.75, w: 4.8, h: 0.65, fill: { color: theme.primary }, rectRadius: 0.08 });
  slide.addText("课程生成 + 试课 + 约课", { x: 0.7, y: 0.75, w: 4.4, h: 0.65, fontSize: 20, fontFace: "Microsoft YaHei", color: "FFFFFF", bold: true, margin: 0 });
  slide.addText("3-4 周 · 核心交付", { x: 5.4, y: 0.85, w: 3, h: 0.5, fontSize: 16, fontFace: "Microsoft YaHei", color: theme.primary, bold: true, margin: 0 });

  var features = [
    { title: "AI 课程生成", items: ["输入主题/知识点 → 生成教案+随堂题", "通用模式 + 诊断驱动个性化", "复用 OpenMAIC 课程生成能力", "结果保存为 CourseSession"] },
    { title: "试课线索管理", items: ["录入学生/家长信息、来源渠道", "状态流：新线索→已联系→已试课→转化", "转化后自动创建学生档案"] },
    { title: "约课系统", items: ["1V1/1V2/1V3/1V4/1V* 班型", "45分钟/节，支持90分钟连堂", "预约→确认→完成→出勤记录"] },
    { title: "数据模型 + 认证", items: ["CourseSession / TrialLead / Booking", "UserRole 角色系统", "认证中间件 + 权限检查"] }
  ];

  features.forEach(function(f, i) {
    var x = 0.4 + (i % 2) * 4.7;
    var y = 1.7 + Math.floor(i / 2) * 1.8;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x, y: y, w: 4.4, h: 1.6, fill: { color: i === 0 ? "FEF9E7" : "F5F9FA" }, rectRadius: 0.08 });
    slide.addShape(pres.shapes.RECTANGLE, { x: x, y: y, w: 0.05, h: 1.6, fill: { color: i === 0 ? theme.accent : theme.secondary } });
    slide.addText((i === 0 ? "★ " : "") + f.title, { x: x + 0.25, y: y + 0.1, w: 3.9, h: 0.35, fontSize: 15, fontFace: "Microsoft YaHei", color: theme.primary, bold: true, margin: 0 });
    var items = f.items.map(function(item, idx) { return { text: item, options: { bullet: true, breakLine: idx < f.items.length - 1, fontSize: 11, color: "525252" } }; });
    slide.addText(items, { x: x + 0.25, y: y + 0.5, w: 3.9, h: 1.0, valign: "top" });
  });

  slide.addShape(pres.shapes.OVAL, { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fill: { color: theme.accent } });
  slide.addText("9", { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fontSize: 12, fontFace: "Arial", color: "FFFFFF", bold: true, align: "center", valign: "middle" });
  return slide;
}

if (require.main === module) {
  var pres = new pptxgen(); pres.layout = 'LAYOUT_16x9';
  var theme = { primary: "264653", secondary: "2a9d8f", accent: "e9c46a", light: "f4a261", bg: "FFFFFF" };
  createSlide(pres, theme);
  pres.writeFile({ fileName: "slide-09-preview.pptx" });
}
module.exports = { createSlide: createSlide, slideConfig: slideConfig };
