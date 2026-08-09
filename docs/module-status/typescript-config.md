# @strict-rag/typescript-config · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `packages/typescript-config` |
| 成熟度 | **生产向**（全仓共享的 tsconfig 预设；无业务完成度故事） |
| 最近更新 | 2026-08-05 |

## 一句话状态

Monorepo 共享 TypeScript 配置：`base` · `node` · `nextjs` · `react-library` 四套预设，构成全仓 strict 模式基线。

## 证据

- `packages/typescript-config/package.json`（exports）
- `packages/typescript-config/base.json` · `node.json` · `nextjs.json` · `react-library.json`
