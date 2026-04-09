/**
 * 微信小程序环境配置
 * 自动根据运行环境切换配置
 */

// 环境配置
const ENV_CONFIG = {
  // 开发环境
  development: {
    baseUrl: 'http://localhost:3000',
    apiPath: 'api',
    enableDebug: true,
    logLevel: 'debug',
    timeout: 10000
  },

  // 体验环境
  staging: {
    baseUrl: 'https://staging-api.yourdomain.com',
    apiPath: 'api',
    enableDebug: true,
    logLevel: 'info',
    timeout: 10000
  },

  // 生产环境
  production: {
    baseUrl: 'https://api.yourdomain.com', // 需要替换为实际域名
    apiPath: 'api',
    enableDebug: false,
    logLevel: 'error',
    timeout: 8000
  }
}

/**
 * 获取当前环境配置
 */
function getEnvConfig() {
  try {
    // 获取小程序版本信息
    const accountInfo = wx.getAccountInfoSync()
    const envVersion = accountInfo.miniProgram.envVersion

    // 根据版本环境选择配置
    switch (envVersion) {
      case 'develop':
        return ENV_CONFIG.development
      case 'trial':
        return ENV_CONFIG.staging
      case 'release':
        return ENV_CONFIG.production
      default:
        return ENV_CONFIG.development
    }
  } catch (e) {
    console.warn('获取环境配置失败，使用开发环境配置', e)
    return ENV_CONFIG.development
  }
}

/**
 * 获取完整的API URL
 */
function getApiUrl(path) {
  const config = getEnvConfig()
  const fullPath = path.startsWith('/') ? path.slice(1) : path
  return `${config.baseUrl}/${config.apiPath}/${fullPath}`
}

/**
 * 日志输出工具
 */
function log(message, level = 'info') {
  const config = getEnvConfig()

  // 生产环境不输出debug日志
  if (config.logLevel === 'error' && level !== 'error') {
    return
  }

  const timestamp = new Date().toISOString()
  const prefix = `[${config.logLevel.toUpperCase()}] [${timestamp}]`

  switch (level) {
    case 'error':
      console.error(prefix, message)
      break
    case 'warn':
      console.warn(prefix, message)
      break
    case 'debug':
      console.debug(prefix, message)
      break
    default:
      console.log(prefix, message)
  }
}

/**
 * 错误处理工具
 */
function handleError(error, context = '') {
  log(`错误: ${context} - ${error.message || error}`, 'error')

  // 开发环境显示详细错误
  const config = getEnvConfig()
  if (config.enableDebug) {
    wx.showModal({
      title: '错误提示',
      content: `${context}\n${error.message || error}`,
      showCancel: false
    })
  }
}

module.exports = {
  ENV_CONFIG,
  getEnvConfig,
  getApiUrl,
  log,
  handleError
}
