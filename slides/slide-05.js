// slide-05.js — AI Capability Foundation
var pptxgen = require("pptxgenjs");
var slideConfig = { type: 'content', index: 5, title: 'AI 能力底座' };

function createSlide(pres, theme) {
  var slide = pres.addSlide();
  slide.background = { color: theme.primary };

  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.05, fill: { color: theme.accent } });
  slide.addText("AI 能力底座", { x: 0.6, y: 0.25, w: 4, h: 0.4, fontSize: 11, fontFace: "Microsoft YaHei", color: theme.accent, bold: true, margin: 0 });
  slide.addText("LLM + 多智能体 + 视觉识别", { x: 0.6, y: 0.6, w: 8.5, h: 0.6, fontSize: 30, fontFace: "Microsoft YaHei", color: "FFFFFF", bold: true, margin: 0 });
  slide.addText("AI 引擎驱动全部能力模块", { x: 0.6, y: 1.1, w: 8.5, h: 0.35, fontSize: 15, fontFace: "Microsoft YaHei", color: "BBBBBB", margin: 0 });

  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 3.5, y: 1.65, w: 3.0, h: 0.85, fill: { color: theme.accent }, rectRadius: 0.08 });
  slide.addText("AI 引擎", { x: 3.5, y: 1.68, w: 3.0, h: 0.4, fontSize: 22, fontFace: "Microsoft YaHei", color: theme.primary, bold: true, align: "center", margin: 0 });
  slide.addText("LLM · 多智能体 · 视觉识别", { x: 3.5, y: 2.1, w: 3.0, h: 0.3, fontSize: 11, fontFace: "Microsoft YaHei", color: theme.primary, align: "center", margin: 0 });

  var modules = [
    { title: "课程生成", desc: "教案 + 随堂题\nAI 生成互动内容\n提升课堂参与度", x: 0.5, y: 3.0 },
    { title: "诊断批改", desc: "拍照识别 + 自动判题\nAI 对照标准答案\n量化知识掌握度", x: 2.7, y: 3.0 },
    { title: "知识图谱", desc: "掌握度评估\nAI 识别薄弱环节\n理清学习路径", x: 5.0, y: 3.0 },
    { title: "运营沟通", desc: "排课 + 营销话术\nAI 辅助约课建议\n家长跟进沟通", x: 7.2, y: 3.0 }
  ];

  modules.forEach(function(m) {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: m.x, y: m.y, w: 2.0, h: 1.9, fill: { color: "1F3D47" }, rectRadius: 0.08 });
    slide.addText("▲", { x: m.x + 0.8, y: 2.55, w: 0.4, h: 0.3, fontSize: 12, fontFace: "Arial", color: theme.accent, align: "center", margin: 0 });
    slide.addText(m.title, { x: m.x + 0.15, y: m.y + 0.12, w: 1.7, h: 0.35, fontSize: 15, fontFace: "Microsoft YaHei", color: theme.accent, bold: true, margin: 0 });
    slide.addText(m.desc, { x: m.x + 0.15, y: m.y + 0.52, w: 1.7, h: 1.2, fontSize: 11, fontFace: "Microsoft YaHei", color: "CCCCCC", valign: "top", margin: 0 });
  });

  slide.addShape(pres.shapes.OVAL, { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fill: { color: theme.accent } });
  slide.addText("5", { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fontSize: 12, fontFace: "Arial", color: "FFFFFF", bold: true, align: "center", valign: "middle" });
  return slide;
}

if (require.main === module) {
  var pres = new pptxgen(); pres.layout = 'LAYOUT_16x9';
  var theme = { primary: "264653", secondary: "2a9d8f", accent: "e9c46a", light: "f4a261", bg: "FFFFFF" };
  createSlide(pres, theme);
  pres.writeFile({ fileName: "slide-05-preview.pptx" });
}
module.exports = { createSlide: createSlide, slideConfig: slideConfig };
