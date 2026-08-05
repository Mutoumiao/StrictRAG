# @strict-rag/web · 用户端前端

> 路径：`apps/web` · 目标端口 **3005**  
> 现状：**S2 最小 ask UI**（登录 · 会话壳 · SSE/同步 · answered/abstained/error 三态）；**无**完整多轮 rewrite / 反馈控件必达。

---

## Pre-Development Checklist

- [ ] 是否用户问答 / 会话路径（非管理壳）？  
- [ ] 类型与错误码是否来自 `@strict-rag/contracts`？  
- [ ] UI 是否用 `@strict-rag/ui`？  
- [ ] SSE/HTTP 是否只传 options 白名单，且 `scope` 走顶层（不进 options）？  
- [ ] SSE 是否 **只信 `final` 事件** 更新答案（中间事件不覆盖终态）？  
- [ ] 会话存储 key 是否仅为 `strict-rag:web:client-session`？  

## Quality Check

- [ ] 无服务端密钥  
- [ ] 不把会话历史当「证据」展示逻辑写死为可 citation  
- [ ] 拒答态可见 reason/userMessage；禁止伪装成功答案  
- [ ] `pnpm --filter @strict-rag/web check-types` · `lint` · `test`  

---

## 指南索引

| 指南 | 说明 |
|------|------|
| [directory-structure](./directory-structure.md) | 现状布局 |
| [quality-guidelines](./quality-guidelines.md) | 质量与 ask UI |

## 依赖

`@strict-rag/contracts` · `@strict-rag/ui`  
（**无** admin-catalog — 管理菜单不在此包）

## PRD 映射

- `prds/04-pipelines/02-online-ask-langgraph.md`  
- `prds/05-api` · 前端 IA  
- SSE 双路径：ADR-030  
- IS：`docs/module-status/web.md`
