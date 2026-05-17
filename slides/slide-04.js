// slide-04.js — Core Insight (v2: 帮学生管理成绩、提升成绩)
var pptxgen = require("pptxgenjs");
var slideConfig = { type: 'content', index: 4, title: '核心洞察' };

function createSlide(pres, theme) {
  var slide = pres.addSlide();
  slide.background = { color: theme.bg };

  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.05, fill: { color: theme.primary } });
  slide.addText("核心洞察", { x: 0.6, y: 0.25, w: 3, h: 0.4, fontSize: 11, fontFace: "Microsoft YaHei", color: theme.secondary, bold: true, margin: 0 });

  // Big quote
  slide.addText("帮学生管理成绩、提升成绩", {
    x: 0.6, y: 0.7, w: 8.5, h: 0.7,
    fontSize: 32, fontFace: "Microsoft YaHei",
    color: theme.primary, bold: true, margin: 0
  });
  slide.addText("真正的产品是学生的纵向状态 —— 知道什么、什么变了、接下来学什么", {
    x: 0.6, y: 1.3, w: 8.5, h: 0.35,
    fontSize: 15, fontFace: "Microsoft YaHei",
    color: "737373", margin: 0
  });

  // 4 capability cards
  var cards = [
    { title: "课程生成", desc: "LLM 生成交互式教案\n和随堂测试题\n帮助老师提升课堂互动\n加深学生理解" },
    { title: "知识图谱", desc: "评估知识点掌握度\n识别薄弱环节\n理清个性化学习路径\n精准定位问题" },
    { title: "组卷诊断", desc: "题库选题组卷\n拍照自动批改\n对照标准答案检验成果\n量化知识掌握" },
    { title: "进度报告", desc: "掌握趋势可视化\n进步/退步自动标记\n家长周报一键生成\n量化成绩变化" }
  ];

  cards.forEach(function(card, i) {
    var x = 0.4 + i * 2.35;

    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: x, y: 1.9, w: 2.15, h: 2.3,
      fill: { color: i === 1 ? theme.primary : "F5F9FA" },
      rectRadius: 0.08
    });

    var titleColor = i === 1 ? theme.accent : theme.primary;
    slide.addText(card.title, {
      x: x + 0.2, y: 2.05, w: 1.75, h: 0.35,
      fontSize: 16, fontFace: "Microsoft YaHei",
      color: titleColor, bold: true, margin: 0
    });

    var descColor = i === 1 ? "DDDDDD" : "525252";
    slide.addText(card.desc, {
      x: x + 0.2, y: 2.45, w: 1.75, h: 1.5,
      fontSize: 11, fontFace: "Microsoft YaHei",
      color: descColor, valign: "top", margin: 0
    });
  });

  // Bottom unifying statement
  slide.addShape(pres.shapes.RECTANGLE, { x: 1.2, y: 4.5, w: 7.6, h: 0.005, fill: { color: theme.secondary } });

  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: 1.8, y: 4.7, w: 6.4, h: 0.45,
    fill: { color: theme.primary },
    rectRadius: 0.06
  });
  slide.addText("四个能力，一个目的：帮学生管理成绩、提升成绩", {
    x: 1.8, y: 4.7, w: 6.4, h: 0.45,
    fontSize: 15, fontFace: "Microsoft YaHei",
    color: theme.accent, bold: true, align: "center", valign: "middle", margin: 0
  });

  slide.addShape(pres.shapes.OVAL, { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fill: { color: theme.accent } });
  slide.addText("4", { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fontSize: 12, fontFace: "Arial", color: "FFFFFF", bold: true, align: "center", valign: "middle" });
  return slide;
}

if (require.main === module) {
  var pres = new pptxgen(); pres.layout = 'LAYOUT_16x9';
  var theme = { primary: "264653", secondary: "2a9d8f", accent: "e9c46a", light: "f4a261", bg: "FFFFFF" };
  createSlide(pres, theme);
  pres.writeFile({ fileName: "slide-04-preview.pptx" });
}
module.exports = { createSlide: createSlide, slideConfig: slideConfig };
