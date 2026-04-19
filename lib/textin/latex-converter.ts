// lib/textin/latex-converter.ts
/**
 * LaTeX 到 Unicode 的简单转换
 * 用于在小程序 rich-text 组件中显示数学公式
 */

/**
 * LaTeX 符号到 Unicode 的映射表
 */
const LATEX_TO_UNICODE: Record<string, string> = {
  // 希腊字母
  '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
  '\\epsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ',
  '\\iota': 'ι', '\\kappa': 'κ', '\\lambda': 'λ', '\\mu': 'μ',
  '\\nu': 'ν', '\\xi': 'ξ', '\\pi': 'π', '\\rho': 'ρ',
  '\\sigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ', '\\phi': 'φ',
  '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',

  // 大写希腊字母
  '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ',
  '\\Lambda': 'Λ', '\\Xi': 'Ξ', '\\Pi': 'Π',
  '\\Sigma': 'Σ', '\\Phi': 'Φ', '\\Psi': 'Ψ', '\\Omega': 'Ω',

  // 运算符
  '\\cdot': '·', '\\times': '×', '\\div': '÷',
  '\\pm': '±', '\\mp': '∓', '\\leq': '≤', '\\geq': '≥',
  '\\neq': '≠', '\\approx': '≈', '\\equiv': '≡',
  '\\infty': '∞', '\\partial': '∂', '\\nabla': '∇',

  // 箭头
  '\\rightarrow': '→', '\\leftarrow': '←', '\\leftrightarrow': '↔',
  '\\Rightarrow': '⇒', '\\Leftarrow': '⇐', '\\Leftrightarrow': '⇔',

  // 其他符号
  '\\circ': '°', '\\degree': '°', '\\angle': '∠',
  '\\perp': '⊥', '\\parallel': '∥', '\\triangle': '△',
  '\\square': '□', '\\int': '∫', '\\sum': '∑', '\\prod': '∏',
  '\\sqrt': '√', '\\sqrt[3]': '∛',
};

/**
 * 上标和下标的数字映射
 */
const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'n': 'ⁿ',
};

const SUBSCRIPT: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  'a': 'ₐ', 'e': 'ₑ', 'i': 'ᵢ', 'j': 'ⱼ', 'k': 'ₖ',
  'm': 'ₘ', 'n': 'ₙ', 'o': 'ₒ', 'p': 'ₚ', 'r': 'ᵣ',
  's': 'ₛ', 't': 'ₜ', 'u': 'ᵤ', 'v': 'ᵥ',
};

/**
 * 将 LaTeX 公式转换为 Unicode 文本
 */
export function latexToUnicode(latex: string): string {
  if (!latex) return '';

  let result = latex;

  // 转换基本符号
  for (const [latexSym, unicode] of Object.entries(LATEX_TO_UNICODE)) {
    result = result.replaceAll(latexSym, unicode);
  }

  // 处理上标 ^{...}
  result = result.replace(/\^\{([^}]+)\}/g, (_, content) => {
    return toSuperscript(content);
  });

  // 处理简单上标 ^x
  result = result.replace(/\^([a-zA-Z0-9+\-=()])/g, (_, char) => {
    return SUPERSCRIPT[char] || `^${char}`;
  });

  // 处理下标 _{...}
  result = result.replace(/_\{([^}]+)\}/g, (_, content) => {
    return toSubscript(content);
  });

  // 处理简单下标 _x
  result = result.replace(/_([a-zA-Z0-9+\-=()])/g, (_, char) => {
    return SUBSCRIPT[char] || `_${char}`;
  });

  // 处理分数 \frac{a}{b} → a/b
  result = result.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/$2');

  // 移除剩余的反斜杠
  result = result.replace(/\\([a-zA-Z]+)/g, '$1');

  return result;
}

/**
 * 转换为上标
 */
function toSuperscript(text: string): string {
  let result = '';
  for (const char of text) {
    result += SUPERSCRIPT[char] || char;
  }
  return result;
}

/**
 * 转换为下标
 */
function toSubscript(text: string): string {
  let result = '';
  for (const char of text) {
    result += SUBSCRIPT[char] || char;
  }
  return result;
}

/**
 * 处理 TextIn markdown 中的公式
 * 将 $...$ 格式的公式转换为 Unicode
 */
export function convertFormulasInMarkdown(markdown: string): string {
  if (!markdown) return '';

  // 处理行内公式 $...$
  return markdown.replace(/\$([^$]+)\$/g, (_, formula) => {
    return latexToUnicode(formula);
  });
}

/**
 * 处理题目内容中的公式
 * 同时处理 LaTeX 和 HTML 实体
 */
export function convertFormulasInText(text: string): string {
  if (!text) return '';

  let result = text;

  // 处理 $...$ 公式
  result = result.replace(/\$([^$]+)\$/g, (_, formula) => {
    return latexToUnicode(formula);
  });

  // 处理双重转义的反斜杠 (TextIn 返回的格式)
  result = result.replace(/\\\\([a-zA-Z]+)/g, (_, cmd) => {
    const unicode = LATEX_TO_UNICODE['\\' + cmd];
    return unicode || cmd;
  });

  // 清理多余的 HTML 注释
  result = result.replace(/<!--[\s\S]*?-->/g, '');

  return result;
}
