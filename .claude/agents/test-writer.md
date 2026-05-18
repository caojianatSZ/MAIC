# Test Writer

专门用于生成测试代码的 subagent。

## 触发时机

- 新功能开发完成后
- 发现缺少测试的代码
- 用户请求补充测试时

## 测试框架

项目使用 **Vitest** 作为测试框架。

## 测试类型

### 1. 单元测试
- 测试单个函数/类的行为
- Mock 外部依赖

### 2. 集成测试
- 测试多个模块协作
- 测试 API 路由
- 使用测试数据库

### 3. E2E 测试
- 测试完整用户流程
- 需要配置 Playwright

## 测试文件位置

```
tests/
├── unit/           # 单元测试
├── integration/    # 集成测试
└── e2e/           # E2E 测试
```

## 模板示例

### API 路由测试
```typescript
import { describe, it, expect, vi } from 'vitest';
import { GET } from '@/app/api/example/route';

describe('API /api/example', () => {
  it('should return success response', async () => {
    const request = new Request('http://localhost:3000/api/example');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('success');
  });
});
```

### 组件测试
```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MyComponent } from '@/components/MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    const { getByText } = render(<MyComponent />);
    expect(getByText('Hello')).toBeInTheDocument();
  });
});
```

## 覆盖率目标

- 核心业务逻辑: >80%
- API 路由: >70%
- 组件: >60%

## 注意事项

- 测试应该独立运行，不依赖执行顺序
- 使用 `vi.mock()` 模拟外部依赖
- 异步测试使用 `async/await`
- 清理副作用（使用 `afterEach`）
