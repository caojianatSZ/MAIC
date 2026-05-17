// slide-12.js — Phase 2
var pptxgen = require("pptxgenjs");
var slideConfig = { type: 'content', index: 12, title: '阶段 2：完整商业能力' };

function createSlide(pres, theme) {
  var slide = pres.addSlide();
  slide.background = { color: theme.bg };
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.05, fill: { color: theme.primary } });
  slide.addText("阶段 2", { x: 0.6, y: 0.3, w: 3, h: 0.5, fontSize: 11, fontFace: "Microsoft YaHei", color: theme.secondary, bold: true, margin: 0 });
  slide.addText("完整商业能力", { x: 0.6, y: 0.7, w: 8.5, h: 0.7, fontSize: 32, fontFace: "Microsoft YaHei", color: theme.primary, bold: true, margin: 0 });
  slide.addText("4-6 周 · 阶段1验证后启动 · 基于真实反馈调整", { x: 0.6, y: 1.25, w: 8.5, h: 0.3, fontSize: 14, fontFace: "Microsoft YaHei", color: "737373", margin: 0 });

  var features = [
    { title: "在线支付集成", desc: "接入第三方支付供应商", items: ["微信支付 + 支付宝", "课程套餐定价和购买", "支付确认 + 退款处理"] },
    { title: "完整约课系统", desc: "从简单预约到智能排课", items: ["课程模板 / 批量排课", "冲突检测 / 自动提醒", "课前微信订阅消息通知"] },
    { title: "学生生命周期", desc: "量化运营数据", items: ["线索→试课→付费→续费漏斗", "转化率 / 续费率统计", "流失预警 / 续费提醒"] }
  ];

  features.forEach(function(f, i) {
    var x = 0.4 + i * 3.15;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x, y: 1.75, w: 2.95, h: 3.0, fill: { color: i === 1 ? theme.primary : "F5F9FA" }, rectRadius: 0.1 });
    slide.addText(f.title, { x: x + 0.25, y: 1.95, w: 2.5, h: 0.4, fontSize: 18, fontFace: "Microsoft YaHei", color: i === 1 ? theme.accent : theme.primary, bold: true, margin: 0 });
    slide.addText(f.desc, { x: x + 0.25, y: 2.35, w: 2.5, h: 0.3, fontSize: 11, fontFace: "Microsoft YaHei", color: i === 1 ? "BBBBBB" : "737373", margin: 0 });
    var items = f.items.map(function(item, idx) { return { text: item, options: { bullet: true, breakLine: idx < f.items.length - 1, fontSize: 12, color: i === 1 ? "DDDDDD" : "404040" } }; });
    slide.addText(items, { x: x + 0.25, y: 2.75, w: 2.5, h: 1.8, valign: "top" });
  });

  slide.addText("前置条件：阶段1验证通过 + 支付供应商接口确认 + 商户资质审核完成", { x: 0.5, y: 4.95, w: 8.8, h: 0.3, fontSize: 11, fontFace: "Microsoft YaHei", color: theme.secondary, margin: 0 });
  slide.addShape(pres.shapes.OVAL, { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fill: { color: theme.accent } });
  slide.addText("12", { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fontSize: 12, fontFace: "Arial", color: "FFFFFF", bold: true, align: "center", valign: "middle" });
  return slide;
}

if (require.main === module) {
  var pres = new pptxgen(); pres.layout = 'LAYOUT_16x9';
  var theme = { primary: "264653", secondary: "2a9d8f", accent: "e9c46a", light: "f4a261", bg: "FFFFFF" };
  createSlide(pres, theme);
  pres.writeFile({ fileName: "slide-12-preview.pptx" });
}
module.exports = { createSlide: createSlide, slideConfig: slideConfig };
