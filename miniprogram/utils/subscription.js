/**
 * 订阅消息工具
 */

/**
 * 请求订阅消息权限
 * @param {string} tmplId - 模板ID
 * @returns {Promise<boolean>} 是否授权成功
 */
function requestSubscribeMessage(tmplId) {
  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: [tmplId],
      success: (res) => {
        if (res[tmplId] === 'accept') {
          resolve(true)
        } else {
          resolve(false)
        }
      },
      fail: (err) => {
        console.error('请求订阅消息失败:', err)
        resolve(false)
      }
    })
  })
}

/**
 * 发送成就解锁通知
 * @param {string} userId - 用户ID
 * @param {object} achievement - 成就信息
 */
async function sendAchievementNotification(userId, achievement) {
  const app = getApp()

  try {
    // 1. 获取access_token（实际应该从后端获取）
    const accessToken = await getAccessToken()

    // 2. 获取家长的openId（这里简化处理，实际应该从用户关系表中查询）
    const parentOpenId = await getParentOpenId(userId)

    if (!parentOpenId) {
      console.log('未绑定家长账号，无法发送通知')
      return
    }

    // 3. 发送通知
    const result = await wx.request({
      url: `${app.globalData.baseUrl}/api/notify/achievement`,
      method: 'POST',
      data: {
        userId,
        achievementId: achievement.id,
        openId: parentOpenId,
        accessToken
      }
    })

    return result.statusCode === 200
  } catch (error) {
    console.error('发送成就通知失败:', error)
    return false
  }
}

/**
 * 获取access_token（简化实现）
 * 注意：实际项目中应该从后端获取，不能在小程序中直接调用
 */
async function getAccessToken() {
  // TODO: 从后端API获取access_token
  // 这里返回一个模拟值
  return 'mock_access_token'
}

/**
 * 获取家长openId（简化实现）
 */
async function getParentOpenId(userId) {
  // TODO: 从用户关系表查询家长openId
  // 这里返回null，实际需要实现家长绑定功能
  return null
}

module.exports = {
  requestSubscribeMessage,
  sendAchievementNotification
}
