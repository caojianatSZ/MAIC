// components/knowledge-graph/knowledge-graph.js
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    title: {
      type: String,
      value: '知识图谱'
    },
    subtitle: {
      type: String,
      value: '基于你的诊断结果生成'
    },
    nodes: {
      type: Array,
      value: []
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    showDetail: false,
    selectedNode: null,
    masteryLabels: {
      mastered: '已掌握',
      partial: '部分掌握',
      weak: '薄弱',
      locked: '未解锁'
    }
  },

  /**
   * 组件生命周期
   */
  lifetimes: {
    attached() {
      this.initCanvas()
    }
  },

  /**
   * 监听属性变化
   */
  observers: {
    'nodes': function(nodes) {
      // 当 nodes 数据更新时，重新绘制图谱
      if (nodes && nodes.length > 0 && this.ctx) {
        console.log('知识图谱数据更新，节点数:', nodes.length)
        this.drawGraph()
      }
    }
  },

  /**
   * 组件的方法列表
   */
  methods: {
    /**
     * 初始化Canvas
     */
    initCanvas() {
      const query = this.createSelectorQuery()
      query.select('#knowledgeGraphCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res[0]) return

          const canvas = res[0].node
          const ctx = canvas.getContext('2d')

          // 设置canvas尺寸
          const dpr = wx.getSystemInfoSync().pixelRatio
          canvas.width = res[0].width * dpr
          canvas.height = res[0].height * dpr
          ctx.scale(dpr, dpr)

          this.canvas = canvas
          this.ctx = ctx
          this.canvasWidth = res[0].width
          this.canvasHeight = res[0].height

          // 绘制知识图谱
          this.drawGraph()
        })
    },

    /**
     * 绘制知识图谱
     */
    drawGraph() {
      if (!this.ctx) return

      const ctx = this.ctx
      const nodes = this.data.nodes

      // 清空画布
      ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)

      // 定义节点位置（简单的层次布局）
      const levels = this.calculateNodePositions(nodes)

      // 绘制连线
      this.drawEdges(ctx, nodes, levels)

      // 绘制节点
      this.drawNodes(ctx, nodes, levels)
    },

    /**
     * 计算节点位置
     */
    calculateNodePositions(nodes) {
      const levels = {}

      nodes.forEach((node, index) => {
        const level = node.level || 0
        if (!levels[level]) {
          levels[level] = []
        }
        levels[level].push(node)
      })

      return levels
    },

    /**
     * 绘制连线
     */
    drawEdges(ctx, nodes, levels) {
      ctx.strokeStyle = '#E5E7EB'
      ctx.lineWidth = 2

      nodes.forEach(node => {
        if (node.parents && node.parents.length > 0) {
          node.parents.forEach(parentId => {
            const parent = nodes.find(n => n.id === parentId)
            if (parent) {
              const fromPos = this.getNodePosition(parent, levels)
              const toPos = this.getNodePosition(node, levels)

              ctx.beginPath()
              ctx.moveTo(fromPos.x, fromPos.y)
              ctx.lineTo(toPos.x, toPos.y)
              ctx.stroke()
            }
          })
        }
      })
    },

    /**
     * 绘制节点
     */
    drawNodes(ctx, nodes, levels) {
      nodes.forEach(node => {
        const pos = this.getNodePosition(node, levels)
        const radius = 40

        // 绘制节点圆形
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI)

        // 根据掌握程度设置颜色
        const color = this.getMasteryColor(node.masteryLevel)
        ctx.fillStyle = color
        ctx.fill()

        // 绘制边框
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 3
        ctx.stroke()

        // 绘制节点文字（简短）
        ctx.fillStyle = '#FFFFFF'
        ctx.font = '14px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        const shortName = node.name.length > 4 ? node.name.substring(0, 4) : node.name
        ctx.fillText(shortName, pos.x, pos.y)

        // 保存节点位置用于点击检测
        node.x = pos.x
        node.y = pos.y
        node.radius = radius
      })
    },

    /**
     * 获取节点位置
     */
    getNodePosition(node, levels) {
      const level = node.level || 0
      const levelNodes = levels[level] || []
      const index = levelNodes.indexOf(node)

      const levelCount = Object.keys(levels).length
      const verticalSpacing = this.canvasHeight / (levelCount + 1)

      const x = ((index + 1) / (levelNodes.length + 1)) * this.canvasWidth
      const y = verticalSpacing * (level + 1)

      return { x, y }
    },

    /**
     * 获取掌握程度颜色
     */
    getMasteryColor(level) {
      const colors = {
        mastered: '#10B981',
        partial: '#F59E0B',
        weak: '#EF4444',
        locked: '#E5E7EB'
      }
      return colors[level] || colors.locked
    },

    /**
     * 处理触摸开始
     */
    handleTouchStart(e) {
      const touch = e.touches[0]
      const x = touch.x
      const y = touch.y

      // 检测点击了哪个节点
      const nodes = this.data.nodes
      for (let node of nodes) {
        const distance = Math.sqrt(
          Math.pow(x - node.x, 2) + Math.pow(y - node.y, 2)
        )

        if (distance <= node.radius) {
          this.showNodeDetail(node)
          break
        }
      }
    },

    /**
     * 处理触摸移动（用于拖拽）
     */
    handleTouchMove(e) {
      // TODO: 实现拖拽功能
    },

    /**
     * 处理触摸结束
     */
    handleTouchEnd(e) {
      // TODO: 处理拖拽结束
    },

    /**
     * 显示节点详情
     */
    showNodeDetail(node) {
      this.setData({
        showDetail: true,
        selectedNode: node
      })
    },

    /**
     * 关闭节点详情
     */
    closeDetail() {
      this.setData({
        showDetail: false,
        selectedNode: null
      })
    },

    /**
     * 开始学习
     */
    startLearning() {
      this.closeDetail()

      // 触发学习事件
      this.triggerEvent('learn', {
        node: this.data.selectedNode
      })

      // 引导登录
      wx.showModal({
        title: '开始学习',
        content: '登录后即可开始个性化学习',
        confirmText: '去登录',
        success(res) {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/login/login'
            })
          }
        }
      })
    }
  }
})
