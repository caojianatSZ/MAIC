// slide-08.js — Recommended Approach
var pptxgen = require("pptxgenjs");
var slideConfig = { type: 'content', index: 8, title: '推荐方案' };

function createSlide(pres, theme) {
  var slide = pres.addSlide();
  slide.background = { color: theme.bg };
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.05, fill: { color: theme.primary } });
  slide.addText("推荐方案", { x: 0.6, y: 0.3, w: 3, h: 0.5, fontSize: 11, fontFace: "Microsoft YaHei", color: theme.secondary, bold: true, margin: 0 });
  slide.addText("方案 C：分阶段验证", { x: 0.6, y: 0.7, w: 8.5, h: 0.7, fontSize: 32, fontFace: "Microsoft YaHei", color: theme.primary, bold: true, margin: 0 });
  slide.addText("降低风险，快速迭代 — 先验证远程模式能跑通，再投入完整平台建设", { x: 0.6, y: 1.3, w: 8.5, h: 0.35, fontSize: 15, fontFace: "Microsoft YaHei", color: "737373", margin: 0 });

  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 1.9, w: 4.3, h: 3.1, fill: { color: "F5F9FA" }, rectRadius: 0.1 });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 1.9, w: 4.3, h: 0.55, fill: { color: theme.primary } });
  slide.addText("阶段 1 · 核心运营闭环", { x: 0.8, y: 1.95, w: 3.7, h: 0.45, fontSize: 18, fontFace: "Microsoft YaHei", color: "FFFFFF", bold: true, margin: 0 });
  slide.addText([
    { text: "AI 课程生成（教案+随堂题）", options: { bullet: true, breakLine: true, fontSize: 13, color: "404040" } },
    { text: "试课线索管理（从微信→系统）", options: { bullet: true, breakLine: true, fontSize: 13, color: "404040" } },
    { text: "简单约课系统（1V1~1V*班型）", options: { bullet: true, breakLine: true, fontSize: 13, color: "404040" } },
    { text: "手动支付记录 + 诊断增强", options: { bullet: true, breakLine: true, fontSize: 13, color: "404040" } },
    { text: "老师仪表盘", options: { bullet: true, fontSize: 13, color: "404040" } }
  ], { x: 0.8, y: 2.65, w: 3.7, h: 2.1, valign: "top" });
  slide.addText("5~6月开发 · 6月运营准备 · 7月验证成果", { x: 0.8, y: 4.65, w: 3.7, h: 0.3, fontSize: 12, fontFace: "Microsoft YaHei", color: theme.secondary, bold: true, margin: 0 });

  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 5.2, y: 1.9, w: 4.3, h: 3.1, fill: { color: "FEF9E7" }, rectRadius: 0.1 });
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.2, y: 1.9, w: 4.3, h: 0.55, fill: { color: theme.secondary } });
  slide.addText("阶段 2 · 完整商业能力", { x: 5.5, y: 1.95, w: 3.7, h: 0.45, fontSize: 18, fontFace: "Microsoft YaHei", color: "FFFFFF", bold: true, margin: 0 });
  slide.addText([
    { text: "在线支付集成（微信+支付宝）", options: { bullet: true, breakLine: true, fontSize: 13, color: "404040" } },
    { text: "完整约课系统（模板/批量排课）", options: { bullet: true, breakLine: true, fontSize: 13, color: "404040" } },
    { text: "学生生命周期管理", options: { bullet: true, breakLine: true, fontSize: 13, color: "404040" } },
    { text: "转化率统计和报表", options: { bullet: true, breakLine: true, fontSize: 13, color: "404040" } },
    { text: "流失预警+续费提醒", options: { bullet: true, fontSize: 13, color: "404040" } }
  ], { x: 5.5, y: 2.65, w: 3.7, h: 2.1, valign: "top" });
  slide.addText("阶段1验证后启动，4-6周交付", { x: 5.5, y: 4.65, w: 3.7, h: 0.3, fontSize: 12, fontFace: "Microsoft YaHei", color: theme.secondary, bold: true, margin: 0 });

  slide.addText("→", { x: 4.5, y: 2.9, w: 1, h: 0.8, fontSize: 40, fontFace: "Arial", color: theme.accent, bold: true, align: "center", valign: "middle" });
  slide.addShape(pres.shapes.OVAL, { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fill: { color: theme.accent } });
  slide.addText("8", { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fontSize: 12, fontFace: "Arial", color: "FFFFFF", bold: true, align: "center", valign: "middle" });
  return slide;
}

if (require.main === module) {
  var pres = new pptxgen(); pres.layout = 'LAYOUT_16x9';
  var theme = { primary: "264653", secondary: "2a9d8f", accent: "e9c46a", light: "f4a261", bg: "FFFFFF" };
  createSlide(pres, theme);
  pres.writeFile({ fileName: "slide-08-preview.pptx" });
}
module.exports = { createSlide: createSlide, slideConfig: slideConfig };
