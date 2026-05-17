// slide-02.js — Background & Problem
const pptxgen = require("pptxgenjs");
const slideConfig = { type: 'content', index: 2, title: '背景与问题' };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Top accent line
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.05, fill: { color: theme.primary } });

  // Section label
  slide.addText("背景与问题", {
    x: 0.6, y: 0.3, w: 3, h: 0.5,
    fontSize: 11, fontFace: "Microsoft YaHei",
    color: theme.secondary, bold: true, margin: 0
  });

  // Title
  slide.addText("从本地培训到远程教育", {
    x: 0.6, y: 0.7, w: 8.5, h: 0.7,
    fontSize: 32, fontFace: "Microsoft YaHei",
    color: theme.primary, bold: true, margin: 0
  });

  // Left column — The Shift
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 0.5, y: 1.7, w: 4.2, h: 3.2,
    fill: { color: "F5F9FA" },
    rectRadius: 0.1
  });

  slide.addText("之前：本地模式", {
    x: 0.8, y: 1.9, w: 3.6, h: 0.4,
    fontSize: 18, fontFace: "Microsoft YaHei",
    color: theme.primary, bold: true, margin: 0
  });

  slide.addText([
    { text: "老师坐在培训机构里", options: { bullet: true, breakLine: true, fontSize: 14, color: "525252" } },
    { text: "面对面教学、手工批改", options: { bullet: true, breakLine: true, fontSize: 14, color: "525252" } },
    { text: "学生来自机构分配", options: { bullet: true, breakLine: true, fontSize: 14, color: "525252" } },
    { text: "系统只覆盖诊断+进度追踪", options: { bullet: true, fontSize: 14, color: "525252" } }
  ], { x: 0.8, y: 2.4, w: 3.6, h: 2.3, valign: "top" });

  // Arrow
  slide.addText("→", {
    x: 4.3, y: 3.0, w: 1, h: 0.6,
    fontSize: 36, fontFace: "Arial",
    color: theme.accent, bold: true, align: "center", margin: 0
  });

  // Right column — The New Model
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 5.3, y: 1.7, w: 4.2, h: 3.2,
    fill: { color: theme.primary },
    rectRadius: 0.1
  });

  slide.addText("现在：远程模式", {
    x: 5.6, y: 1.9, w: 3.6, h: 0.4,
    fontSize: 18, fontFace: "Microsoft YaHei",
    color: theme.accent, bold: true, margin: 0
  });

  slide.addText([
    { text: "远程备课、组卷、获客、排课", options: { bullet: true, breakLine: true, fontSize: 14, color: "FFFFFF" } },
    { text: "远程阅卷诊断，学生组织管理", options: { bullet: true, breakLine: true, fontSize: 14, color: "FFFFFF" } },
    { text: "试课漏斗 + 支付追踪 + 约课", options: { bullet: true, breakLine: true, fontSize: 14, color: "FFFFFF" } },
    { text: "缺少商业运营模块支撑", options: { bullet: true, fontSize: 14, color: theme.accent, bold: true } }
  ], { x: 5.6, y: 2.4, w: 3.6, h: 2.3, valign: "top" });

  // Bottom callout
  slide.addText('核心挑战：系统需要从「诊断工具」升级为「运营平台」', {
    x: 0.6, y: 5.1, w: 8.8, h: 0.35,
    fontSize: 14, fontFace: "Microsoft YaHei",
    color: theme.secondary, bold: true, margin: 0
  });

  // Page badge
  slide.addShape(pres.shapes.OVAL, { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fill: { color: theme.accent } });
  slide.addText("2", { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fontSize: 12, fontFace: "Arial", color: "FFFFFF", bold: true, align: "center", valign: "middle" });

  return slide;
}

if (require.main === module) {
  const pres = new pptxgen(); pres.layout = 'LAYOUT_16x9';
  const theme = { primary: "264653", secondary: "2a9d8f", accent: "e9c46a", light: "f4a261", bg: "FFFFFF" };
  createSlide(pres, theme);
  pres.writeFile({ fileName: "slide-02-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
