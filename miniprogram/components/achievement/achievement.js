// components/achievement/achievement.js
Component({
  /**
   * 组件属性
   */
  properties: {
    // 成就ID
    achievementId: {
      type: String,
      value: ''
    },
    // 成就等级：bronze, silver, gold, diamond, king
    level: {
      type: String,
      value: 'bronze'
    },
    // 进度 0-100
    progress: {
      type: Number,
      value: 0
    },
    // 成就名称
    name: {
      type: String,
      value: ''
    },
    // 成就描述
    description: {
      type: String,
      value: ''
    },
    // 是否已解锁
    unlocked: {
      type: Boolean,
      value: false
    },
    // 解锁时间
    unlockedAt: {
      type: String,
      value: ''
    },
    // 是否显示等级
    showLevel: {
      type: Boolean,
      value: true
    },
    // 是否是新解锁的
    isNew: {
      type: Boolean,
      value: false
    },
    // 是否显示详细信息
    showInfo: {
      type: Boolean,
      value: false
    }
  },

  /**
   * 组件数据
   */
  data: {
    // 等级配置
    levelConfig: {
      bronze: { icon: '🥉', color: '#CD7F32', name: '青铜', class: 'level-bronze' },
      silver: { icon: '🥈', color: '#C0C0C0', name: '白银', class: 'level-silver' },
      gold: { icon: '🥇', color: '#FFD700', name: '黄金', class: 'level-gold' },
      diamond: { icon: '💎', color: '#B9F2FF', name: '钻石', class: 'level-diamond' },
      king: { icon: '👑', color: '#FF6B6B', name: '王者', class: 'level-king' }
    },
    levelClass: '',
    showUnlockAnimation: false
  },

  /**
   * 组件生命周期
   */
  lifetimes: {
    attached() {
      this.updateLevelClass()
    }
  },

  /**
   * 属性观察器
   */
  observers: {
    'level': function(level) {
      this.updateLevelClass()
    },
    'unlocked': function(unlocked) {
      if (unlocked && this.properties.isNew) {
        this.showUnlockAnimation()
      }
    }
  },

  /**
   * 组件方法
   */
  methods: {
    /**
     * 更新等级样式类
     */
    updateLevelClass() {
      const level = this.properties.level
      const config = this.data.levelConfig[level]
      this.setData({
        levelClass: config ? config.class : 'level-bronze'
      })
    },

    /**
     * 显示解锁动画
     */
    showUnlockAnimation() {
      this.setData({ showUnlockAnimation: true })

      // 播放音效（可选）
      // wx.playBackgroundAudio() 或使用 wx.createInnerAudioContext()

      // 触觉反馈
      wx.vibrateShort({
        type: 'light'
      })

      // 3秒后隐藏动画
      setTimeout(() => {
        this.setData({ showUnlockAnimation: false })
      }, 3000)
    },

    /**
     * 点击事件
     */
    onTap() {
      this.triggerEvent('tap', {
        achievementId: this.properties.achievementId,
        level: this.properties.level,
        name: this.properties.name,
        unlocked: this.properties.unlocked
      })
    }
  }
})
