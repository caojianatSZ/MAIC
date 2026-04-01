/**
 * 用户相关工具函数
 */

/**
 * 获取当前用户ID
 * @returns {string} 用户ID
 */
function getUserId() {
  const app = getApp()
  return app.globalData.userId || 'demo_user_id'
}

/**
 * 获取用户信息
 * @returns {object|null} 用户信息
 */
function getUserInfo() {
  const app = getApp()
  return app.globalData.userInfo || null
}

/**
 * 检查用户是否已登录
 * @returns {boolean} 是否已登录
 */
function isLoggedIn() {
  const app = getApp()
  return !!(app.globalData.userInfo && app.globalData.token)
}

/**
 * 获取Token
 * @returns {string|null} Token
 */
function getToken() {
  const app = getApp()
  return app.globalData.token || null
}

module.exports = {
  getUserId,
  getUserInfo,
  isLoggedIn,
  getToken
}
