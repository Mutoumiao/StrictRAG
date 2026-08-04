# @strict-rag/web · 用户端前端

> 路径：`apps/web` · 目标端口 **3005**  
> 现状：Next 空壳首页；无 ask/SSE。

---

## Pre-Development Checklist

- [ ] 是否用户问答 / 会话路径（非管理壳）？  
- [ ] 类型与错误码是否来自 `@strict-rag/contracts`？  
- [ ] UI 是否用 `@strict-rag/ui`？  
- [ ] SSE/HTTP 是否只传 options 白名单，且 `scope` 走顶层（不进 options）？  

## Quality Check

- [ ] 无服务端密钥  
- [ ] 不把会话历史当「证据」展示逻辑写死为可 citation  
- [ ] `pnpm --filter @strict-rag/web check-types` · `lint`  

---

## 指南索引

| 指南 | 说明 |
|------|------|
| [directory-structure](./directory-structure.md) | 现状与目标 |
| [quality-guidelines](./quality-guidelines.md) | 质量与 ask UI |

## 依赖

`@strict-rag/contracts` · `@strict-rag/ui`  
（**无** admin-catalog — 管理菜单不在此包）

## PRD 映射

- `prds/04-pipelines/02-online-ask-langgraph.md`  
- `prds/05-api` · 前端 IA  
- SSE 双路径：ADR-030
