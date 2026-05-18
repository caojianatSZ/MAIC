---
name: prisma-migrate
description: 生成并应用 Prisma 数据库迁移。支持创建新迁移、应用迁移、重置数据库等操作。
disable-model-invocation: true
---

# Prisma Migrate

帮助管理 Prisma 数据库迁移。

## 使用方式

用户通过 `/prisma-migrate` 调用。

## 操作类型

### 创建新迁移
```bash
pnpm prisma:generate
pnpm prisma db push
```

### 查看数据库状态
```bash
pnpm db:studio
```

### 重置数据库（谨慎使用）
```bash
pnpm prisma db push --force-reset
```

## 注意事项

- 生产环境操作前始终备份数据库
- 使用 `--force-reset` 会清空所有数据
- 迁移前先检查 schema.prisma 变更
