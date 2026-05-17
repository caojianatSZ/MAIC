// slide-01.js — Cover Page
const pptxgen = require("pptxgenjs");

const slideConfig = { type: 'cover', index: 1, title: '远程教育运营平台' };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.primary };

  // Top decorative bar
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.06,
    fill: { color: theme.accent }
  });

  // Left accent stripe
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.8, y: 1.2, w: 0.06, h: 2.8,
    fill: { color: theme.accent }
  });

  // Main title
  slide.addText("远程教育运营平台", {
    x: 1.2, y: 1.3, w: 7.5, h: 1.2,
    fontSize: 52, fontFace: "Microsoft YaHei",
    color: "FFFFFF", bold: true, margin: 0
  });

  // Subtitle
  slide.addText("AI 驱动的远程教育运营平台", {
    x: 1.2, y: 2.4, w: 7.5, h: 0.7,
    fontSize: 24, fontFace: "Microsoft YaHei",
    color: theme.accent, margin: 0
  });

  // Description line
  slide.addText("产品方案 · 内部汇报", {
    x: 1.2, y: 3.15, w: 7.5, h: 0.5,
    fontSize: 16, fontFace: "Microsoft YaHei",
    color: theme.light, margin: 0
  });

  // Bottom bar
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 5.3, w: 10, h: 0.325,
    fill: { color: theme.secondary }
  });

  // Date
  slide.addText("2026年5月", {
    x: 0.5, y: 5.35, w: 3, h: 0.25,
    fontSize: 10, fontFace: "Microsoft YaHei",
    color: "FFFFFF", margin: 0
  });

  return slide;
}

if (require.main === module) {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';
  const theme = { primary: "264653", secondary: "2a9d8f", accent: "e9c46a", light: "f4a261", bg: "FFFFFF" };
  createSlide(pres, theme);
  pres.writeFile({ fileName: "slide-01-preview.pptx" });
}

module.exports = { createSlide, slideConfig };
