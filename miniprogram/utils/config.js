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

/**
 * 格式化日期
 * @param {string|Date} date 日期
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date)
  const year = d.getFullYear()
  const month = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  const hours = d.getHours().toString().padStart(2, '0')
  const minutes = d.getMinutes().toString().padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

module.exports = {
  getBaseUrl,
  getApiUrl,
  formatDate
}
