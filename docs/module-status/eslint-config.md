# @strict-rag/eslint-config · 模块状态

| 字段 | 内容 |
|------|------|
| 路径 | `packages/eslint-config` |
| 成熟度 | **生产向**（全仓共享的 lint 预设；无业务完成度故事） |
| 最近更新 | 2026-08-05 |

## 一句话状态

Monorepo 共享 ESLint 配置，导出 `base` · `next-js` · `react-internal` 三套预设，供 apps / packages 引用。

## 证据

- `packages/eslint-config/package.json`（exports）
- `packages/eslint-config/base.js` · `next.js` · `react-internal.js`
