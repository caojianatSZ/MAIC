// components/growth-chart/growth-chart.js
import * as echarts from '../../libs/ec-canvas/echarts'

const chartColors = {
  primary: '#6366F1',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  pink: '#ec4899'
}

Component({
  /**
   * 组件属性
   */
  properties: {
    // 图表标题
    title: {
      type: String,
      value: ''
    },
    // 副标题
    subtitle: {
      type: String,
      value: ''
    },
    // 图表数据
    chartData: {
      type: Object,
      value: null
    },
    // 图表类型：line, bar
    chartType: {
      type: String,
      value: 'line'
    },
    // 是否显示图例
    showLegend: {
      type: Boolean,
      value: true
    },
    // 提示文本
    tip: {
      type: String,
      value: ''
    }
  },

  /**
   * 组件数据
   */
  data: {
    ec: {
      onInit: null
    },
    legendData: []
  },

  /**
   * 组件生命周期
   */
  lifetimes: {
    attached() {
      this.initChart()
    }
  },

  /**
   * 属性观察器
   */
  observers: {
    'chartData': function(newData) {
      if (newData && this.chart) {
        this.updateChart(newData)
      }
    }
  },

  /**
   * 组件方法
   */
  methods: {
    /**
     * 初始化图表
     */
    initChart() {
      this.setData({
        ec: {
          onInit: this.initEcharts.bind(this)
        }
      })
    },

    /**
     * 初始化 ECharts
     */
    initEcharts(canvas, width, height, dpr) {
      const chart = echarts.init(canvas, null, {
        width: width,
        height: height,
        devicePixelRatio: dpr
      })

      canvas.setChart(chart)
      this.chart = chart

      // 如果有数据，立即渲染
      if (this.data.chartData) {
        this.updateChart(this.data.chartData)
      }

      return chart
    },

    /**
     * 更新图表
     */
    updateChart(data) {
      if (!this.chart || !data) return

      const option = this.generateOption(data)
      this.chart.setOption(option)
    },

    /**
     * 生成图表配置
     */
    generateOption(data) {
      const { chartType } = this.data

      // 基础配置
      const option = {
        color: [chartColors.primary, chartColors.success, chartColors.warning],
        tooltip: {
          trigger: 'axis',
          confine: true,
          formatter: this.tooltipFormatter.bind(this)
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          top: '10%',
          containLabel: true
        },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: data.dates || [],
          axisLabel: {
            fontSize: 10
          }
        },
        yAxis: {
          type: 'value',
          axisLabel: {
            formatter: '{value}%'
          },
          min: 0,
          max: 100
        }
      }

      // 根据图表类型配置系列
      if (chartType === 'line') {
        option.series = this.generateLineSeries(data)
      } else if (chartType === 'bar') {
        option.series = this.generateBarSeries(data)
      }

      // 更新图例数据
      if (data.series && data.series.length > 0) {
        this.setData({
          legendData: data.series.map((s, index) => ({
            name: s.name,
            color: [chartColors.primary, chartColors.success, chartColors.warning][index]
          }))
        })
      }

      return option
    },

    /**
     * 生成折线图系列
     */
    generateLineSeries(data) {
      if (!data.series || data.series.length === 0) {
        // 单系列默认配置
        return [{
          name: '掌握度',
          type: 'line',
          smooth: true,
          data: data.values || [],
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [{
                offset: 0,
                color: 'rgba(99, 102, 241, 0.3)'
              }, {
                offset: 1,
                color: 'rgba(99, 102, 241, 0.05)'
              }]
            }
          },
          lineStyle: {
            width: 3,
            color: chartColors.primary
          },
          itemStyle: {
            color: chartColors.primary
          }
        }]
      }

      // 多系列配置
      return data.series.map((series, index) => {
        const colors = [chartColors.primary, chartColors.success, chartColors.warning]
        const color = colors[index % colors.length]

        return {
          name: series.name,
          type: 'line',
          smooth: true,
          data: series.data || [],
          areaStyle: index === 0 ? {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [{
                offset: 0,
                color: `${color}4D` // 30% opacity
              }, {
                offset: 1,
                color: `${color}0D` // 5% opacity
              }]
            }
          } : null,
          lineStyle: {
            width: 3,
            color
          },
          itemStyle: {
            color
          }
        }
      })
    },

    /**
     * 生成柱状图系列
     */
    generateBarSeries(data) {
      if (!data.series || data.series.length === 0) {
        return [{
          name: '掌握度',
          type: 'bar',
          data: data.values || [],
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [{
                offset: 0,
                color: chartColors.primary
              }, {
                offset: 1,
                color: '#818cf8'
              }]
            }
          },
          barWidth: '60%'
        }]
      }

      return data.series.map((series, index) => {
        const colors = [chartColors.primary, chartColors.success, chartColors.warning]
        const color = colors[index % colors.length]

        return {
          name: series.name,
          type: 'bar',
          data: series.data || [],
          itemStyle: {
            color
          },
          barWidth: '60%'
        }
      })
    },

    /**
     * 格式化提示框
     */
    tooltipFormatter(params) {
      if (!params || params.length === 0) return ''

      let result = `${params[0].name}<br/>`

      params.forEach(param => {
        const marker = `<span style="display:inline-block;margin-right:4px;border-radius:10px;width:10px;height:10px;background-color:${param.color};"></span>`
        result += `${marker}${param.seriesName}: ${param.value}%<br/>`
      })

      return result
    }
  }
})
