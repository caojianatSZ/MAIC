// lib/textin/katex-renderer.ts
/**
 * 使用 KaTeX 将 LaTeX 公式转换为 SVG 图片
 * 用于小程序显示数学公式
 */

import katex from 'katex';
import { createLogger } from '@/lib/logger';

const log = createLogger('KaTeXRenderer');

/**
 * KaTeX 渲染选项
 */
const RENDER_OPTIONS = {
  throwOnError: false,
  displayMode: false,
  strict: false,
};

/**
 * 将 LaTeX 公式渲染为 SVG
 */
export function renderLatexToSvg(latex: string, displayMode: boolean = false): string {
  try {
    const options = { ...RENDER_OPTIONS, displayMode };
    const html = katex.renderToString(latex, options);

    // 提取 SVG 内容
    const svgMatch = html.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
    if (svgMatch) {
      return svgMatch[0];
    }

    return html;
  } catch (error) {
    log.warn('KaTeX 渲染失败', { latex, error });
    // 返回原始公式作为后备
    return `<span style="font-family: serif;">${latex}</span>`;
  }
}

/**
 * 将 LaTeX 公式渲染为 base64 图片 URL
 * 用于小程序的 image 组件
 */
export function renderLatexToDataUrl(latex: string, displayMode: boolean = false): string {
  const svg = renderLatexToSvg(latex, displayMode);

  // 将 SVG 转换为 base64
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

/**
 * 处理文本中的所有 LaTeX 公式
 * 将 $...$ 格式的公式转换为 SVG 图片标签
 */
export function convertFormulasToImages(text: string): string {
  if (!text) return '';

  // 替换 $...$ 格式的行内公式
  let result = text.replace(/\$([^$]+)\$/g, (_, formula) => {
    try {
      const dataUrl = renderLatexToDataUrl(formula.trim(), false);
      return `<img src="${dataUrl}" style="display:inline;vertical-align:middle;height:1.2em;" />`;
    } catch (error) {
      log.warn('公式转换失败', { formula });
      return `$${formula}$`;
    }
  });

  // 替换 $$...$$ 格式的块级公式
  result = result.replace(/\$\$([^$]+)\$\$/g, (_, formula) => {
    try {
      const dataUrl = renderLatexToDataUrl(formula.trim(), true);
      return `<img src="${dataUrl}" style="display:block;width:100%;margin:10px 0;" />`;
    } catch (error) {
      log.warn('公式转换失败', { formula });
      return `$$${formula}$$`;
    }
  });

  // 处理双重转义的反斜杠 (TextIn 返回的格式)
  result = result.replace(/\\\\([a-zA-Z]+)/g, (_, cmd) => {
    return `$\\${cmd}$`;
  });

  // 再次处理可能产生的公式
  result = result.replace(/\$\\([a-zA-Z]+)\$/g, (_, formula) => {
    try {
      const dataUrl = renderLatexToDataUrl(formula, false);
      return `<img src="${dataUrl}" style="display:inline;vertical-align:middle;height:1.2em;" />`;
    } catch {
      return `$${formula}$`;
    }
  });

  return result;
}

/**
 * 处理题目内容，转换公式并清理 HTML
 */
export function processQuestionContent(content: string): string {
  if (!content) return '';

  let result = content;

  // 转换 LaTeX 公式为图片
  result = convertFormulasToImages(result);

  // 清理多余的 HTML 注释
  result = result.replace(/<!--[\s\S]*?-->/g, '');

  // 清理多余的空白
  result = result.replace(/\s+/g, ' ').trim();

  return result;
}

/**
 * 批量处理题目列表
 */
export function processQuestions(questions: Array<{
  id: string;
  content: string;
  type: 'choice' | 'fill_blank' | 'essay';
  options?: string[];
}>): Array<{
  id: string;
  content: string;
  type: 'choice' | 'fill_blank' | 'essay';
  options?: string[];
}> {
  return questions.map(q => ({
    ...q,
    content: processQuestionContent(q.content),
    options: q.options?.map(opt => processQuestionContent(opt))
  }));
}
