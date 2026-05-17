// slide-07.js — Approach Comparison
var pptxgen = require("pptxgenjs");
var slideConfig = { type: 'content', index: 7, title: '方案对比' };

function createSlide(pres, theme) {
  var slide = pres.addSlide();
  slide.background = { color: theme.bg };
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.05, fill: { color: theme.primary } });
  slide.addText("方案对比", { x: 0.6, y: 0.3, w: 3, h: 0.5, fontSize: 11, fontFace: "Microsoft YaHei", color: theme.secondary, bold: true, margin: 0 });
  slide.addText("三种实施方案", { x: 0.6, y: 0.7, w: 8.5, h: 0.7, fontSize: 32, fontFace: "Microsoft YaHei", color: theme.primary, bold: true, margin: 0 });

  var plans = [
    { name: "方案 A\n渐进式扩展", effort: "S-M", risk: "低", pros: ["复用现有代码量最大", "最快让老师用起来"], cons: ["体验可能不够完整"] },
    { name: "方案 B\n完整平台构建", effort: "XL", risk: "中高", pros: ["一次构建完整体验", "架构清晰无技术债"], cons: ["3-4月周期长", "远程模式验证风险"] },
    { name: "方案 C\n分阶段验证", effort: "M", risk: "低", tag: "推荐", pros: ["2-3周快速验证", "基于真实反馈迭代"], cons: ["阶段1手动记录"] }
  ];

  plans.forEach(function(plan, i) {
    var x = 0.5 + i * 3.1;
    var isRecommended = i === 2;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x, y: 1.5, w: 2.9, h: 3.6, fill: { color: isRecommended ? theme.primary : "F5F9FA" }, rectRadius: 0.1, line: isRecommended ? { color: theme.accent, width: 2 } : undefined });
    if (isRecommended) {
      slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 1.8, y: 1.38, w: 1.0, h: 0.32, fill: { color: theme.accent }, rectRadius: 0.08 });
      slide.addText("推荐", { x: x + 1.8, y: 1.38, w: 1.0, h: 0.32, fontSize: 11, fontFace: "Microsoft YaHei", color: theme.primary, bold: true, align: "center", valign: "middle" });
    }
    var nc = isRecommended ? "FFFFFF" : theme.primary;
    slide.addText(plan.name, { x: x + 0.2, y: 1.65, w: 2.5, h: 0.7, fontSize: 16, fontFace: "Microsoft YaHei", color: nc, bold: true, margin: 0 });
    var mc = isRecommended ? "CCCCCC" : "737373";
    slide.addText("工作量: " + plan.effort + "    风险: " + plan.risk, { x: x + 0.2, y: 2.3, w: 2.5, h: 0.3, fontSize: 11, fontFace: "Microsoft YaHei", color: mc, margin: 0 });
    var pc = isRecommended ? "DDDDDD" : "404040";
    var proItems = plan.pros.map(function(p, idx) { return { text: p, options: { bullet: true, breakLine: idx < plan.pros.length - 1, fontSize: 12, color: pc } }; });
    slide.addText(proItems, { x: x + 0.2, y: 2.7, w: 2.5, h: 1.0, valign: "top" });
    var cc = isRecommended ? "AAAAAA" : "737373";
    var conItems = plan.cons.map(function(c, idx) { return { text: c, options: { bullet: true, breakLine: idx < plan.cons.length - 1, fontSize: 11, color: cc, italic: true } }; });
    slide.addText(conItems, { x: x + 0.2, y: 3.7, w: 2.5, h: 1.0, valign: "top" });
  });

  slide.addShape(pres.shapes.OVAL, { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fill: { color: theme.accent } });
  slide.addText("7", { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fontSize: 12, fontFace: "Arial", color: "FFFFFF", bold: true, align: "center", valign: "middle" });
  return slide;
}

if (require.main === module) {
  var pres = new pptxgen(); pres.layout = 'LAYOUT_16x9';
  var theme = { primary: "264653", secondary: "2a9d8f", accent: "e9c46a", light: "f4a261", bg: "FFFFFF" };
  createSlide(pres, theme);
  pres.writeFile({ fileName: "slide-07-preview.pptx" });
}
module.exports = { createSlide: createSlide, slideConfig: slideConfig };
