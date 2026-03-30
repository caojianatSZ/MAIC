// pages/player/player.js
const app = getApp()

Page({
  data: {
    // 视频相关
    currentVideoUrl: '',
    currentPoster: '',
    isPlaying: false,
    showOverlay: true,
    currentTime: 0,
    duration: 0,

    // 课程信息
    classroomInfo: {},

    // 场景列表
    scenes: [],
    currentSceneIndex: 0,
    currentScene: {},
    allCompleted: false,

    // 传入参数
    classroomId: null,
    shareToken: null
  },

  onLoad(options) {
    console.log('播放页面加载', options)

    const { classroomId, shareToken } = options

    if (!classroomId && !shareToken) {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }

    this.setData({ classroomId, shareToken })
    this.loadClassroomData()
  },

  /**
   * 加载课程数据
   */
  async loadClassroomData() {
    wx.showLoading({
      title: '加载中...',
      mask: true
    })

    try {
      // TODO: 从API加载课程数据
      // const baseUrl = app.globalData.baseUrl || 'http://localhost:3000'
      // const res = await wx.request({
      //   url: `${baseUrl}/api/organization-classrooms/${this.data.shareToken}`,
      // })

      // 临时模拟数据
      setTimeout(() => {
        this.setData({
          classroomInfo: {
            title: '分数的认识',
            description: '学习分数的基本概念和加减运算',
            subject: '数学',
            grade: '三年级',
            duration: '10分钟'
          },
          scenes: [
            {
              id: 'scene-1',
              title: '什么是分数',
              duration: '5:00',
              completed: false,
              knowledgePoints: ['分数', '数学概念'],
              content: {
                text: '分数是把一个整体平均分成若干份，表示这样的一份或几份的数。例如，把一个蛋糕平均分成4份，每份就是四分之一，写作1/4。'
              }
            },
            {
              id: 'scene-2',
              title: '分数的加减法',
              duration: '5:00',
              completed: false,
              knowledgePoints: ['加法', '运算'],
              content: {
                text: '同分母分数相加减，分母不变，分子相加减。例如：1/5 + 2/5 = 3/5。注意：只有分母相同的分数才能直接相加减。'
              }
            }
          ],
          currentScene: {
            title: '什么是分数',
            duration: '5:00',
            knowledgePoints: ['分数', '数学概念'],
            content: {
              text: '分数是把一个整体平均分成若干份，表示这样的一份或几份的数。'
            }
          },
          currentVideoUrl: '', // 实际项目中填写视频URL
          currentPoster: '' // 封面图URL
        })

        wx.hideLoading()
      }, 1000)
    } catch (error) {
      console.error('加载失败:', error)
      wx.hideLoading()
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  /**
   * 视频播放事件
   */
  onVideoPlay() {
    this.setData({
      isPlaying: true,
      showOverlay: false
    })
  },

  /**
   * 视频暂停事件
   */
  onVideoPause() {
    this.setData({
      isPlaying: false,
      showOverlay: true
    })
  },

  /**
   * 视频播放结束
   */
  onVideoEnd() {
    this.setData({
      isPlaying: false,
      showOverlay: true
    })

    // 自动跳到下一场景
    this.playNextScene()
  },

  /**
   * 视频错误
   */
  onVideoError(e) {
    console.error('视频播放错误:', e)
    wx.showToast({
      title: '视频加载失败',
      icon: 'none'
    })
  },

  /**
   * 时间更新
   */
  onTimeUpdate(e) {
    const { currentTime, duration } = e.detail
    this.setData({
      currentTime,
      duration
    })
  },

  /**
   * 播放/暂停切换
   */
  onPlayToggle() {
    const videoContext = wx.createVideoContext('classroomVideo', this)

    if (this.data.isPlaying) {
      videoContext.pause()
    } else {
      videoContext.play()
    }
  },

  /**
   * 选择场景
   */
  onSceneSelect(e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      currentSceneIndex: index,
      currentScene: this.data.scenes[index]
    })

    // TODO: 加载并播放对应场景的视频
    wx.showToast({
      title: `切换到第${index + 1}节`,
      icon: 'none'
    })
  },

  /**
   * 播放下一场景
   */
  playNextScene() {
    const { currentSceneIndex, scenes } = this.data

    if (currentSceneIndex < scenes.length - 1) {
      const nextIndex = currentSceneIndex + 1

      // 标记当前场景为已完成
      const updatedScenes = [...scenes]
      updatedScenes[currentSceneIndex].completed = true

      this.setData({
        scenes: updatedScenes,
        currentSceneIndex: nextIndex,
        currentScene: scenes[nextIndex]
      })

      wx.showToast({
        title: '播放下一节',
        icon: 'success'
      })
    } else {
      // 所有场景都已播放完毕
      this.setData({
        allCompleted: true
      })

      wx.showToast({
        title: '🎉 课程完成！',
        icon: 'success'
      })
    }
  },

  /**
   * 标记课程完成
   */
  onCompleteCourse() {
    if (this.data.allCompleted) {
      wx.showToast({
        title: '已经完成了',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '确认完成',
      content: '确定要标记本课程为已完成吗？',
      success: (res) => {
        if (res.confirm) {
          // 标记所有场景为已完成
          const completedScenes = this.data.scenes.map(scene => ({
            ...scene,
            completed: true
          }))

          this.setData({
            scenes: completedScenes,
            allCompleted: true
          })

          wx.showToast({
            title: '✅ 已标记完成',
            icon: 'success'
          })

          // TODO: 调用API保存学习记录
          this.saveLearningRecord()
        }
      }
    })
  },

  /**
   * 保存学习记录
   */
  async saveLearningRecord() {
    try {
      // TODO: 调用后端API
      // const baseUrl = app.globalData.baseUrl || 'http://localhost:3000'
      // await wx.request({
      //   url: `${baseUrl}/api/miniprogram/learning-records`,
      //   method: 'POST',
      //   header: {
      //     'Authorization': `Bearer ${wx.getStorageSync('token')}`
      //   },
      //   data: {
      //     classroomId: this.data.classroomId,
      //     completed: true
      //   }
      // })

      console.log('学习记录已保存')
    } catch (error) {
      console.error('保存学习记录失败:', error)
    }
  },

  /**
   * 分享课程
   */
  onShareAppMessage() {
    return {
      title: this.data.classroomInfo.title || '精彩课程',
      path: `/pages/player/player?shareToken=${this.data.shareToken}`,
      imageUrl: this.data.currentPoster || ''
    }
  }
})
