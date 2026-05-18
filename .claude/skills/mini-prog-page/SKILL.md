---
name: mini-prog-page
description: 创建微信小程序页面及路由配置。自动生成 js/wxml/wxss/json 四个文件并注册到 app.json。
disable-model-invocation: true
---

# 微信小程序页面生成器

快速创建微信小程序页面，自动生成所需文件并注册路由。

## 使用方式

用户通过 `/mini-prog-page <页面名称>` 调用。

## 文件结构

创建的页面包含四个文件：
```
miniprogram/pages/<pageName>/
├── <pageName>.js    # 页面逻辑
├── <pageName>.wxml  # 页面结构
├── <pageName>.wxss  # 页面样式
└── <pageName>.json  # 页面配置
```

## 自动注册

自动在 `miniprogram/app.json` 的 `pages` 数组中添加新页面路径。

## 模板内容

### .js 模板
```javascript
Page({
  data: {},
  onLoad(options) {
    // 页面加载
  },
  onReady() {
    // 页面渲染完成
  },
  onShow() {
    // 页面显示
  },
  onHide() {
    // 页面隐藏
  },
  onUnload() {
    // 页面卸载
  }
})
```

### .wxml 模板
```xml
<view class="container">
  <!-- 页面内容 -->
</view>
```

### .wxss 模板
```css
.container {
  padding: 32rpx;
}
```

### .json 模板
```json
{
  "navigationBarTitleText": "<页面标题>",
  "usingComponents": {}
}
```

## 注意事项

- 页面名称使用 kebab-case（如 `user-profile`）
- 检查页面是否已存在，避免覆盖
- app.json 中 pages 数组第一个页面为小程序首页
