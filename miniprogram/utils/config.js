/**
 * 配置相关工具函数
 */

/**
 * 获取API基础URL
 * @returns {string} API基础URL
 */
function getBaseUrl() {
  const app = getApp()
  return app.globalData.baseUrl || 'http://localhost:3000'
}

/**
 * 获取完整API路径
 * @param {string} path API路径（不包含斜杠前缀）
 * @returns {string} 完整API URL
 */
function getApiUrl(path) {
  const baseUrl = getBaseUrl()
  return `${baseUrl}/api/${path}`
}

module.exports = {
  getBaseUrl,
  getApiUrl
}
