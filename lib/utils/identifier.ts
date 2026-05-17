// 生成唯一标识符工具

const ADJECTIVES = [
  'happy', 'brave', 'calm', 'eager', 'fair', 'gentle', 'honest', 'jolly',
  'kind', 'lively', 'nice', 'proud', 'silly', 'witty', 'zealous', 'able',
  'bold', 'bright', 'clever', 'diligent', 'elegant', 'fancy', 'gentle'
]

const NOUNS = [
  'panda', 'tiger', 'eagle', 'dolphin', 'lion', 'wolf', 'fox', 'bear',
  'hawk', 'owl', 'deer', 'whale', 'shark', 'rabbit', 'horse', 'zebra'
]

/**
 * 生成可读的题目标识符 (e.g., "happy-panda-1234")
 */
export function generateIdentifier(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  const suffix = Math.floor(Math.random() * 9000) + 1000
  return `${adj}-${noun}-${suffix}`
}

/**
 * 生成 6 位试卷码 (大写字母+数字)
 */
export function generatePaperCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 排除易混淆字符
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}
