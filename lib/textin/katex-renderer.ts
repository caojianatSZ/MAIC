// lib/textin/katex-renderer.ts
/**
 * 使用 KaTeX 将 LaTeX 公式转换为 SVG 图片
 * 用于小程序显示数学公式
 */

import katex from 'katex';
import { createLogger } from '@/lib/logger';
import { latexToUnicode, convertFormulasInText } from './latex-converter';

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
    // 返回 Unicode 格式作为后备（使用 latex-converter.ts 中的完整转换）
    const unicode = latexToUnicode(latex);
    return `<span style="font-family: serif;">${unicode}</span>`;
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
 * 处理题目内容，转换公式为 Unicode 并清理 HTML
 * 使用 latex-converter.ts 中的完整转换逻辑
 */
export function processQuestionContent(content: string): string {
  if (!content) return '';

  // 使用 latex-converter.ts 中的完整转换逻辑
  let result = convertFormulasInText(content);

  // 清理多余的 HTML 注释
  result = result.replace(/<!--[\s\S]*?-->/g, '');

  // 清理多余的空白（但保留换行用于题目格式）
  result = result.replace(/[ \t]+/g, ' ').trim();

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
