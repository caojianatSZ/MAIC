// slide-14.js — Key Decisions
var pptxgen = require("pptxgenjs");
var slideConfig = { type: 'content', index: 14, title: '关键决策' };

function createSlide(pres, theme) {
  var slide = pres.addSlide();
  slide.background = { color: theme.bg };
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.05, fill: { color: theme.primary } });
  slide.addText("关键决策与采纳", { x: 0.6, y: 0.3, w: 4, h: 0.5, fontSize: 11, fontFace: "Microsoft YaHei", color: theme.secondary, bold: true, margin: 0 });
  slide.addText("设计过程中的关键决策", { x: 0.6, y: 0.7, w: 8.5, h: 0.7, fontSize: 32, fontFace: "Microsoft YaHei", color: theme.primary, bold: true, margin: 0 });

  var decisions = [
    { label: "AI 驱动全部能力", detail: "LLM 课程生成、视觉识别诊断、多智能体知识图谱、AI 辅助运营沟通。AI 是底座，不是功能。" },
    { label: "课程生成进阶段1", detail: "远程课学生参与度低的根本解是 AI 生成的互动内容。与试课、约课并列第一阶段交付。" },
    { label: "排课移到阶段1", detail: "Codex 审查指出：远程教育没有约课无法运作。即使支付手动，课程预约也是核心数据。" },
    { label: "班型 1V1~1V*", detail: "支持 1V1/1V2/1V3/1V4/1V*，容量由班型决定。预约时应用层检查，先到先得。" },
    { label: "老师是平台运营者", detail: "不是SaaS用户，不需要自助注册。角色通过 User.role 区分，同一个小程序内动态切换。" }
  ];

  decisions.forEach(function(d, i) {
    var y = 1.6 + i * 0.72;
    var bgC = i % 2 === 0 ? "F5F9FA" : "FFFFFF";
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.4, y: y, w: 9.2, h: 0.62, fill: { color: bgC }, rectRadius: 0.06 });
    slide.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: y, w: 0.05, h: 0.62, fill: { color: theme.secondary } });
    slide.addText(d.label, { x: 0.7, y: y + 0.04, w: 3.0, h: 0.28, fontSize: 13, fontFace: "Microsoft YaHei", color: theme.primary, bold: true, margin: 0 });
    slide.addText(d.detail, { x: 0.7, y: y + 0.3, w: 8.6, h: 0.28, fontSize: 10, fontFace: "Microsoft YaHei", color: "525252", margin: 0 });
  });

  slide.addShape(pres.shapes.OVAL, { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fill: { color: theme.accent } });
  slide.addText("14", { x: 9.3, y: 5.1, w: 0.4, h: 0.4, fontSize: 12, fontFace: "Arial", color: "FFFFFF", bold: true, align: "center", valign: "middle" });
  return slide;
}

if (require.main === module) {
  var pres = new pptxgen(); pres.layout = 'LAYOUT_16x9';
  var theme = { primary: "264653", secondary: "2a9d8f", accent: "e9c46a", light: "f4a261", bg: "FFFFFF" };
  createSlide(pres, theme);
  pres.writeFile({ fileName: "slide-14-preview.pptx" });
}
module.exports = { createSlide: createSlide, slideConfig: slideConfig };
