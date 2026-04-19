// lib/textin/katex-renderer.ts
/**
 * 使用 KaTeX 将 LaTeX 公式转换为 SVG 图片
 * 用于小程序显示数学公式
 */

import katex from 'katex';
import { createLogger } from '@/lib/logger';
import { latexToUnicode } from './latex-converter';

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
 * LaTeX 符号到 Unicode 的映射表（简化版，用于后备）
 */
const LATEX_TO_UNICODE: Record<string, string> = {
  '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
  '\\theta': 'θ', '\\pi': 'π', '\\phi': 'φ', '\\omega': 'ω',
  '\\cdot': '·', '\\times': '×', '\\div': '÷',
  '\\leq': '≤', '\\geq': '≥', '\\neq': '≠', '\\approx': '≈',
  '\\infty': '∞', '\\partial': '∂',
  '\\rightarrow': '→', '\\leftarrow': '←',
  '\\circ': '°', '\\perp': '⊥',
  '\\int': '∫', '\\sum': '∑', '\\prod': '∏',
  '\\sqrt': '√',
};

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', 'n': 'ⁿ',
};

const SUBSCRIPT: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋',
};

/**
 * 简单的 LaTeX 到 Unicode 转换（用于后备）
 */
function simpleLatexToUnicode(latex: string): string {
  let result = latex;

  // 基本符号
  for (const [latexSym, unicode] of Object.entries(LATEX_TO_UNICODE)) {
    result = result.replaceAll(latexSym, unicode);
  }

  // 上标 ^{...}
  result = result.replace(/\^\{([^}]+)\}/g, (_, content) => {
    let sup = '';
    for (const c of content) sup += SUPERSCRIPT[c] || c;
    return sup;
  });

  // 简单上标 ^x
  result = result.replace(/\^([a-zA-Z0-9+\-])/g, (_, c) => SUPERSCRIPT[c] || `^${c}`);

  // 下标 _{...}
  result = result.replace(/_\{([^}]+)\}/g, (_, content) => {
    let sub = '';
    for (const c of content) sub += SUBSCRIPT[c] || c;
    return sub;
  });

  // 简单下标 _x
  result = result.replace(/_([a-zA-Z0-9+\-])/g, (_, c) => SUBSCRIPT[c] || `_${c}`);

  // 分数
  result = result.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/$2');

  return result;
}

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
    // 返回 Unicode 格式作为后备
    const unicode = simpleLatexToUnicode(latex);
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
 * 处理文本中的所有 LaTeX 公式
 * 将 $...$ 格式的公式转换为 Unicode 文本（兼容性最好）
 */
export function convertFormulasToUnicode(text: string): string {
  if (!text) return '';

  let result = text;

  // 替换 $...$ 格式的行内公式
  result = result.replace(/\$([^$]+)\$/g, (_, formula) => {
    try {
      return simpleLatexToUnicode(formula.trim());
    } catch (error) {
      log.warn('公式转换失败', { formula });
      return formula;
    }
  });

  // 替换 $$...$$ 格式的块级公式
  result = result.replace(/\$\$([^$]+)\$\$/g, (_, formula) => {
    try {
      return simpleLatexToUnicode(formula.trim());
    } catch (error) {
      log.warn('公式转换失败', { formula });
      return formula;
    }
  });

  return result;
}

/**
 * 处理题目内容，转换公式为 Unicode 并清理 HTML
 */
export function processQuestionContent(content: string): string {
  if (!content) return '';

  let result = content;

  // 首先处理双重转义的反斜杠 (TextIn 返回的格式)
  result = result.replace(/\\\\([a-zA-Z]+)/g, (_, cmd) => {
    const unicode = LATEX_TO_UNICODE['\\' + cmd];
    return unicode !== undefined ? unicode : `\\${cmd}`;
  });

  // 转换 LaTeX 公式为 Unicode（兼容性最好）
  result = convertFormulasToUnicode(result);

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
