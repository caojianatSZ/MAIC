// slide-13.js — Product Architecture
var pptxgen = require("pptxgenjs");
var slideConfig = { type: 'content', index: 13, title: '产品架构' };

function createSlide(pres, theme) {
  var slide = pres.addSlide();
  slide.background = { color: theme.bg };
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.05, fill: { color: theme.primary } });
  slide.addText("产品架构", { x: 0.6, y: 0.3, w: 3, h: 0.5, fontSize: 11, fontFace: "Microsoft YaHei", color: theme.secondary, bold: true, margin: 0 });
  slide.addText("AI 驱动 · 微信小程序 + Next.js + PostgreSQL", { x: 0.6, y: 0.7, w: 8.5, h: 0.6, fontSize: 26, fontFace: "Microsoft YaHei", color: theme.primary, bold: true, margin: 0 });

  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.4, y: 1.45, w: 9.2, h: 0.9, fill: { color: "F5F9FA" }, rectRadius: 0.08 });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 1.45, w: 0.06, h: 0.9, fill: { color: theme.secondary } });
  slide.addText("微信小程序", { x: 0.7, y: 1.47, w: 2, h: 0.25, fontSize: 13, fontFace: "Microsoft YaHei", color: theme.secondary, bold: true, margin: 0 });
  slide.addText("AI 课程生成  ·  拍照诊断  ·  进度报告  ·  学生约课  ·  老师管理端  ·  家长端", { x: 0.7, y: 1.75, w: 8.6, h: 0.45, fontSize: 12, fontFace: "Microsoft YaHei", color: "525252", margin: 0 });

  slide.addText("▼", { x: 4.5, y: 2.3, w: 1, h: 0.35, fontSize: 14, fontFace: "Arial", color: theme.secondary, align: "center", margin: 0 });

  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.4, y: 2.6, w: 9.2, h: 1.15, fill: { color: theme.primary }, rectRadius: 0.08 });
  slide.addText("Next.js 后端 API", { x: 0.7, y: 2.62, w: 3, h: 0.25, fontSize: 13, fontFace: "Microsoft YaHei", color: theme.accent, bold: true, margin: 0 });
  var services = [
    { name: "AI 课程生成", desc: "教案+题目\n多智能体", color: "FFFFFF" },
    { name: "诊断服务", desc: "拍照识别\n答案对照", color: "FFFFFF" },
    { name: "追踪服务", desc: "知识点掌握\n进步趋势", color: "FFFFFF" },
    { name: "运营服务", desc: "试课/约课\n支付记录", color: "FFFFFF" }
  ];
  services.forEach(function(svc, i) {
    var x = 0.7 + i * 2.25;
    slide.addText(svc.name, { x: x, y: 2.95, w: 2.0, h: 0.25, fontSize: 12, fontFace: "Microsoft YaHei", color: svc.color, bold: true, margin: 0 });
    slide.addText(svc.desc, { x: x, y: 3.2, w: 2.0, h: 0.45, fontSize: 10, fontFace: "Microsoft YaHei", color: svc.color, margin: 0 });
  });

  slide.addText("▼", { x: 4.5, y: 3.7, w: 1, h: 0.35, fontSize: 14, fontFace: "Arial", color: theme.secondary, align: "center", margin: 0 });

  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.4, y: 4.0, w: 9.2, h: 0.55, fill: { color: "F5F9FA" }, rectRadius: 0.08 });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 4.0, w: 0.06, h: 0.55, fill: { color: theme.secondary } });
  slide.addText("PostgreSQL", { x: 0.7, y: 4.02, w: 2, h: 0.22, fontSize: 12, fontFace: "Microsoft YaHei", color: theme.secondary, bold: true, margin: 0 });
  slide.addText("User / StudentProfile / CourseSession / Question / TestPaper / DiagnosisResult / TrialLead / Booking / PaymentRecord", { x: 0.7, y: 4.28, w: 8.6, h: 0.22, fontSize: 9, fontFace: "Arial", color: "737373", margin: 0 });

  slide.addShape(pres.shapes.OVAL, { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fill: { color: theme.accent } });
  slide.addText("13", { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fontSize: 12, fontFace: "Arial", color: "FFFFFF", bold: true, align: "center", valign: "middle" });
  return slide;
}

if (require.main === module) {
  var pres = new pptxgen(); pres.layout = 'LAYOUT_16x9';
  var theme = { primary: "264653", secondary: "2a9d8f", accent: "e9c46a", light: "f4a261", bg: "FFFFFF" };
  createSlide(pres, theme);
  pres.writeFile({ fileName: "slide-13-preview.pptx" });
}
module.exports = { createSlide: createSlide, slideConfig: slideConfig };
