// slide-03.js — Pain Points
const pptxgen = require("pptxgenjs");
const slideConfig = { type: 'content', index: 3, title: '现状痛点' };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.05, fill: { color: theme.primary } });
  slide.addText("现状痛点", { x: 0.6, y: 0.3, w: 3, h: 0.5, fontSize: 11, fontFace: "Microsoft YaHei", color: theme.secondary, bold: true, margin: 0 });
  slide.addText("老师现在怎么工作的？", { x: 0.6, y: 0.7, w: 8.5, h: 0.7, fontSize: 32, fontFace: "Microsoft YaHei", color: theme.primary, bold: true, margin: 0 });

  // 3 pain point cards
  const cards = [
    { icon: "\u{1F4CB}", title: "纸笔记录", desc: "试课学生信息记在本子上\n查找困难，容易丢失\n无法统计转化数据" },
    { icon: "\u{1F4F1}", title: "微信备注", desc: "支付状态用微信备注追踪\n消息滚动后找不到记录\n家长催费全靠记忆" },
    { icon: "\u{1F4CA}", title: "无法量化", desc: "不知道试课转化率\n不知道哪些学生快到期\n凭感觉判断教学效果" }
  ];

  cards.forEach((card, i) => {
    const x = 0.5 + i * 3.1;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: x, y: 1.7, w: 2.9, h: 3.3,
      fill: { color: i === 0 ? "F5F9FA" : (i === 1 ? "FEF9E7" : "FFF5F0") },
      rectRadius: 0.1
    });
    slide.addText(card.icon, { x: x + 0.3, y: 1.9, w: 0.6, h: 0.5, fontSize: 28, margin: 0 });
    slide.addText(card.title, { x: x + 1.1, y: 1.9, w: 1.5, h: 0.5, fontSize: 18, fontFace: "Microsoft YaHei", color: theme.primary, bold: true, margin: 0 });
    slide.addText(card.desc, { x: x + 0.3, y: 2.6, w: 2.3, h: 2.1, fontSize: 13, fontFace: "Microsoft YaHei", color: "525252", valign: "top", margin: 0 });
  });

  // Bottom impact statement
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 5.2, w: 9, h: 0.005, fill: { color: theme.secondary } });
  slide.addText("代价：信息散落、丢失率高、无法量化转化率、难以批量管理、无法向家长提供数据支撑", {
    x: 0.6, y: 5.25, w: 8.8, h: 0.3,
    fontSize: 13, fontFace: "Microsoft YaHei", color: theme.secondary, bold: true, margin: 0
  });

  slide.addShape(pres.shapes.OVAL, { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fill: { color: theme.accent } });
  slide.addText("3", { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fontSize: 12, fontFace: "Arial", color: "FFFFFF", bold: true, align: "center", valign: "middle" });
  return slide;
}

if (require.main === module) {
  const pres = new pptxgen(); pres.layout = 'LAYOUT_16x9';
  const theme = { primary: "264653", secondary: "2a9d8f", accent: "e9c46a", light: "f4a261", bg: "FFFFFF" };
  createSlide(pres, theme);
  pres.writeFile({ fileName: "slide-03-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
