// slide-11.js — Teaching + Operations Dual Loop (v3: 测→学→练 框架)
var pptxgen = require("pptxgenjs");
var slideConfig = { type: 'content', index: 11, title: '教学 + 运营双闭环' };

function createSlide(pres, theme) {
  var slide = pres.addSlide();
  slide.background = { color: theme.primary };
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.05, fill: { color: theme.accent } });
  slide.addText("教学 + 运营双闭环", { x: 0.6, y: 0.3, w: 5, h: 0.5, fontSize: 11, fontFace: "Microsoft YaHei", color: theme.accent, bold: true, margin: 0 });
  slide.addText("测 → 学 → 练", { x: 0.6, y: 0.6, w: 8.5, h: 0.6, fontSize: 30, fontFace: "Microsoft YaHei", color: "FFFFFF", bold: true, margin: 0 });

  // Top row: 测 → 学 → 练
  var teachSteps = [
    { phase: "测", label: "诊断找弱项", desc: "AI 出题 · 拍照批改 · 知识图谱定位", color: theme.accent },
    { phase: "学", label: "AI 生成教案", desc: "LLM 生成互动课件 · 个性化出题", color: theme.accent },
    { phase: "练", label: "随堂验证", desc: "自动批改 · 掌握度更新 · 下次推荐", color: theme.accent }
  ];

  teachSteps.forEach(function(step, i) {
    var x = 0.7 + i * 3.1;
    var y = 1.45;

    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x, y: y, w: 2.6, h: 1.55, fill: { color: "1F3D47" }, rectRadius: 0.08 });

    // Phase badge
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.15, y: y + 0.1, w: 0.65, h: 0.4, fill: { color: step.color }, rectRadius: 0.06 });
    slide.addText(step.phase, { x: x + 0.15, y: y + 0.1, w: 0.65, h: 0.4, fontSize: 16, fontFace: "Microsoft YaHei", color: theme.primary, bold: true, align: "center", valign: "middle" });

    slide.addText(step.label, { x: x + 0.95, y: y + 0.1, w: 1.5, h: 0.4, fontSize: 16, fontFace: "Microsoft YaHei", color: "FFFFFF", bold: true, margin: 0 });
    slide.addText(step.desc, { x: x + 0.15, y: y + 0.65, w: 2.3, h: 0.7, fontSize: 10, fontFace: "Microsoft YaHei", color: "BBBBBB", valign: "top", margin: 0 });

    if (i < 2) slide.addText("→", { x: x + 2.55, y: y + 0.4, w: 0.5, h: 0.5, fontSize: 24, fontFace: "Arial", color: theme.accent, bold: true, align: "center", valign: "middle" });
  });

  // Feedback cycle indicator
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.7, y: 3.15, w: 8.6, h: 0.3, fill: { color: theme.primary }, rectRadius: 0.04 });
  slide.addText("⟳ 反馈循环：掌握度更新 → 诊断重新定位 → AI 调整出题策略", { x: 0.7, y: 3.15, w: 8.6, h: 0.3, fontSize: 11, fontFace: "Microsoft YaHei", color: theme.accent, align: "center", valign: "middle", margin: 0 });

  // Divider
  slide.addShape(pres.shapes.RECTANGLE, { x: 1.5, y: 3.6, w: 7, h: 0.005, fill: { color: theme.accent } });

  // Bottom row: Operations loop
  var opsSteps = [
    { label: "试课线索", desc: "录入跟进" },
    { label: "学生约课", desc: "选时/班型" },
    { label: "记录支付", desc: "套餐/到期" },
    { label: "家长报告", desc: "续费转化" }
  ];

  opsSteps.forEach(function(step, i) {
    var x = 0.7 + i * 2.4;
    var y = 3.85;
    slide.addShape(pres.shapes.OVAL, { x: x + 0.7, y: y, w: 0.45, h: 0.45, fill: { color: theme.secondary } });
    slide.addText(String(i + 4), { x: x + 0.7, y: y, w: 0.45, h: 0.45, fontSize: 14, fontFace: "Arial", color: "FFFFFF", bold: true, align: "center", valign: "middle" });
    slide.addText(step.label, { x: x, y: y + 0.48, w: 1.9, h: 0.25, fontSize: 12, fontFace: "Microsoft YaHei", color: "FFFFFF", bold: true, align: "center", margin: 0 });
    slide.addText(step.desc, { x: x, y: y + 0.72, w: 1.9, h: 0.2, fontSize: 9, fontFace: "Microsoft YaHei", color: "BBBBBB", align: "center", margin: 0 });
    if (i < 3) slide.addText("→", { x: x + 1.8, y: y + 0.02, w: 0.5, h: 0.35, fontSize: 14, fontFace: "Arial", color: theme.secondary, align: "center", margin: 0 });
  });

  // Reference note
  slide.addText("教学闭环参考华为「AI精准学」测→学→练框架。OpenMAIC 差异：AI 辅助老师而非替代老师", { x: 0.4, y: 5.1, w: 8.5, h: 0.2, fontSize: 8, fontFace: "Microsoft YaHei", color: "666666", align: "center", margin: 0 });

  slide.addShape(pres.shapes.OVAL, { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fill: { color: theme.accent } });
  slide.addText("11", { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fontSize: 12, fontFace: "Arial", color: theme.primary, bold: true, align: "center", valign: "middle" });
  return slide;
}

if (require.main === module) {
  var pres = new pptxgen(); pres.layout = 'LAYOUT_16x9';
  var theme = { primary: "264653", secondary: "2a9d8f", accent: "e9c46a", light: "f4a261", bg: "FFFFFF" };
  createSlide(pres, theme);
  pres.writeFile({ fileName: "slide-11-preview.pptx" });
}
module.exports = { createSlide: createSlide, slideConfig: slideConfig };
