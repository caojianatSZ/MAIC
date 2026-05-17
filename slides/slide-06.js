// slide-06.js — Role Architecture
var pptxgen = require("pptxgenjs");
var slideConfig = { type: 'content', index: 6, title: '角色与组织架构' };

function createSlide(pres, theme) {
  var slide = pres.addSlide();
  slide.background = { color: theme.bg };
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.05, fill: { color: theme.primary } });
  slide.addText("角色与组织架构", { x: 0.6, y: 0.25, w: 4, h: 0.4, fontSize: 11, fontFace: "Microsoft YaHei", color: theme.secondary, bold: true, margin: 0 });
  slide.addText("三层角色分工", { x: 0.6, y: 0.6, w: 8.5, h: 0.6, fontSize: 28, fontFace: "Microsoft YaHei", color: theme.primary, bold: true, margin: 0 });

  // 3 role cards
  var roles = [
    { title: "总部运营", desc: "全局数据监控\n城市/老师管理\n收入分析", color: theme.primary, textColor: "FFFFFF", width: 8.8, x: 0.6, y: 1.45, height: 1.0 },
    { title: "城市合伙人", desc: "获客 · 线索跟进 · 安排试课\n家长沟通 · 转化追踪\n(不教学)", color: theme.secondary, textColor: "FFFFFF", width: 4.3, x: 0.6, y: 2.7, height: 1.45 },
    { title: "老师", desc: "AI 课程生成\n远程教学 · 诊断批改\n进度报告", color: "F5F9FA", textColor: theme.primary, width: 4.3, x: 5.1, y: 2.7, height: 1.45 }
  ];

  roles.forEach(function(r) {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: r.x, y: r.y, w: r.width, h: r.height, fill: { color: r.color }, rectRadius: 0.08 });
    slide.addShape(pres.shapes.RECTANGLE, { x: r.x, y: r.y, w: 0.06, h: r.height, fill: { color: theme.accent } });
    slide.addText(r.title, { x: r.x + 0.3, y: r.y + 0.12, w: r.width - 0.6, h: 0.35, fontSize: 18, fontFace: "Microsoft YaHei", color: r.textColor === "FFFFFF" ? "FFFFFF" : theme.primary, bold: true, margin: 0 });
    slide.addText(r.desc, { x: r.x + 0.3, y: r.y + 0.5, w: r.width - 0.6, h: r.height - 0.6, fontSize: 13, fontFace: "Microsoft YaHei", color: r.textColor === "FFFFFF" ? "DDDDDD" : "525252", valign: "top", margin: 0 });
  });

  // Connection arrows
  slide.addText("管理", { x: 0.6, y: 2.4, w: 1.0, h: 0.25, fontSize: 9, fontFace: "Microsoft YaHei", color: theme.secondary, align: "center", margin: 0 });
  slide.addText("安排试课", { x: 2.3, y: 3.15, w: 1.0, h: 0.2, fontSize: 9, fontFace: "Microsoft YaHei", color: theme.secondary, align: "center", margin: 0 });

  // Bottom: Student + Parent
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 4.45, w: 8.8, h: 0.005, fill: { color: theme.secondary } });
  slide.addText("学生：上课 + 完成诊断         家长：查看报告 + 续费决策", { x: 0.6, y: 4.55, w: 8.8, h: 0.3, fontSize: 12, fontFace: "Microsoft YaHei", color: theme.secondary, margin: 0 });
  slide.addText("近200名老师储备 · 前期2-3个试点城市 · 每城市1合伙人+2-5老师", { x: 0.6, y: 4.85, w: 8.8, h: 0.25, fontSize: 10, fontFace: "Microsoft YaHei", color: "888888", margin: 0 });

  slide.addShape(pres.shapes.OVAL, { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fill: { color: theme.accent } });
  slide.addText("6", { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fontSize: 12, fontFace: "Arial", color: "FFFFFF", bold: true, align: "center", valign: "middle" });
  return slide;
}

if (require.main === module) {
  var pres = new pptxgen(); pres.layout = 'LAYOUT_16x9';
  var theme = { primary: "264653", secondary: "2a9d8f", accent: "e9c46a", light: "f4a261", bg: "FFFFFF" };
  createSlide(pres, theme);
  pres.writeFile({ fileName: "slide-06-preview.pptx" });
}
module.exports = { createSlide: createSlide, slideConfig: slideConfig };
