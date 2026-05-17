// slide-15.js — Success Criteria (v4: ops metrics)
var pptxgen = require("pptxgenjs");
var slideConfig = { type: 'content', index: 15, title: '成功标准' };

function createSlide(pres, theme) {
  var slide = pres.addSlide();
  slide.background = { color: theme.bg };
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.05, fill: { color: theme.primary } });
  slide.addText("成功标准", { x: 0.6, y: 0.25, w: 3, h: 0.4, fontSize: 11, fontFace: "Microsoft YaHei", color: theme.secondary, bold: true, margin: 0 });
  slide.addText("系统 + 运营双维度指标", { x: 0.6, y: 0.6, w: 8.5, h: 0.6, fontSize: 28, fontFace: "Microsoft YaHei", color: theme.primary, bold: true, margin: 0 });

  // System metrics
  var sysMetrics = [
    { label: "角色工作台", detail: "3个角色各有一个独立可用工作台，数据隔离正确" },
    { label: "全流程闭环", detail: "录线索→分配老师→上课→诊断→支付，全流程系统内完成" },
    { label: "AI 课程生成", detail: "老师可用 AI 生成教案+随堂题，≥2位老师周均使用" }
  ];

  sysMetrics.forEach(function(m, i) {
    var y = 1.35 + i * 0.55;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.4, y: y, w: 9.2, h: 0.45, fill: { color: "F5F9FA" }, rectRadius: 0.06 });
    slide.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: y, w: 0.05, h: 0.45, fill: { color: theme.secondary } });
    slide.addText(m.label, { x: 0.7, y: y + 0.06, w: 1.8, h: 0.32, fontSize: 13, fontFace: "Microsoft YaHei", color: theme.primary, bold: true, margin: 0 });
    slide.addText(m.detail, { x: 2.5, y: y + 0.06, w: 6.8, h: 0.32, fontSize: 12, fontFace: "Microsoft YaHei", color: "525252", margin: 0 });
  });

  // Ops metrics header
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 3.15, w: 9.2, h: 0.005, fill: { color: theme.secondary } });
  slide.addText("运营指标（7月检验）", { x: 0.6, y: 3.25, w: 4, h: 0.35, fontSize: 13, fontFace: "Microsoft YaHei", color: theme.secondary, bold: true, margin: 0 });

  var opsMetrics = [
    { label: "试点城市", target: "≥ 2 个城市正式运营", highlight: false },
    { label: "试课线索", target: "总线索 > 100 条", highlight: false },
    { label: "到场率", target: "试课到场率 > 60%", highlight: false },
    { label: "转化率", target: "线索→付费转化率 > 30%", highlight: true }
  ];

  opsMetrics.forEach(function(m, i) {
    var x = 0.4 + i * 2.35;
    var y = 3.65;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x, y: y, w: 2.15, h: 1.0, fill: { color: m.highlight ? theme.primary : "F5F9FA" }, rectRadius: 0.08 });
    slide.addText(m.label, { x: x + 0.15, y: y + 0.1, w: 1.85, h: 0.3, fontSize: 13, fontFace: "Microsoft YaHei", color: m.highlight ? theme.accent : theme.primary, bold: true, align: "center", margin: 0 });
    slide.addText(m.target, { x: x + 0.15, y: y + 0.45, w: 1.85, h: 0.4, fontSize: 14, fontFace: "Microsoft YaHei", color: m.highlight ? "FFFFFF" : theme.secondary, bold: true, align: "center", margin: 0 });
  });

  slide.addText("关键决策点：7月底根据运营数据决定是否启动阶段 2", { x: 0.5, y: 4.9, w: 8.8, h: 0.25, fontSize: 11, fontFace: "Microsoft YaHei", color: theme.secondary, bold: true, margin: 0 });

  slide.addShape(pres.shapes.OVAL, { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fill: { color: theme.accent } });
  slide.addText("15", { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fontSize: 12, fontFace: "Arial", color: "FFFFFF", bold: true, align: "center", valign: "middle" });
  return slide;
}

if (require.main === module) {
  var pres = new pptxgen(); pres.layout = 'LAYOUT_16x9';
  var theme = { primary: "264653", secondary: "2a9d8f", accent: "e9c46a", light: "f4a261", bg: "FFFFFF" };
  createSlide(pres, theme);
  pres.writeFile({ fileName: "slide-15-preview.pptx" });
}
module.exports = { createSlide: createSlide, slideConfig: slideConfig };
