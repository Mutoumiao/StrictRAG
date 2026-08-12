# @strict-rag/web · 用户端前端

> 路径：`apps/web` · 目标端口 **3005**  
> 现状：**S2 最小 ask UI**（登录 · 会话壳 · AI SDK 流 / 同步 · 三态）+ **B13** 答案旁反馈提交（`createAskFeedback`）；**无**完整多轮 rewrite。

---

## Pre-Development Checklist

- [ ] 是否用户问答 / 会话路径（非管理壳）？  
- [ ] 类型与错误码是否来自 `@strict-rag/contracts`？默认不建平行 wire `types.ts`？  
- [ ] UI 是否用 `@strict-rag/ui`（组件 + Soft Bento token）？禁止大面积内联 style？  
- [ ] 拒答是否用 **abstain** 语义色（非 destructive 系统红）？  

- [ ] options 是否白名单，且 `scope` 走顶层（不进 options）？  
- [ ] 流式是否 **只信 `data-ask-final`**（schema 校验），进度用 `data-status`？  
- [ ] 是否禁止自写 SSE 分帧（须 `@ai-sdk/react` + transport）？  
- [ ] 拒答/错误「重试」是否用 `lastQuestion`（不依赖提交后已空的输入框）？  
- [ ] 反馈是否走 `src/api/feedback.ts` → `POST /api/v1/ask/:requestId/feedback`（类型来自 contracts）？  
- [ ] 会话存储 key 是否仅为 `strict-rag:web:client-session`？  
- [ ] 业务 HTTP / path 是否只在 `src/api/*` 或 `auth/api`，传输在 `lib/http`？  
- [ ] services（若有）是否禁止写 URL、只调 api？hooks 是否不与 services 双轨编排？  
- [ ] `page.tsx` 是否薄组合？store/types/空目录是否按需？  
- [ ] 是否未为对称提前拆碎 `src/api` 或空建 features？  
- [ ] services/hooks 是否不做权限引擎；鉴权/成员约束是否以 **API** 为准？  
- [ ] 抽公共是否对照 [module-layering §12.1](./module-layering.md) / [admin §12.1](../../admin/frontend/module-layering.md)（A 欠抽 / B 过抽）？  

## Quality Check

- [ ] 无服务端密钥  
- [ ] 不把会话历史当「证据」展示逻辑写死为可 citation  
- [ ] 拒答态可见 reason/userMessage；禁止伪装成功答案  
- [ ] 流：只信 `data-ask-final`；`ready` 且仍 loading 有 error 兜底（见 [quality-guidelines](./quality-guidelines.md) 状态机）  
- [ ] 重试用 `lastQuestion`（非已空 `question`）  
- [ ] 分层符合 [module-layering](./module-layering.md)  
- [ ] **抽公共**：有无 A 类欠抽 / B 类过抽？ask 流与会话壳是否被错误合成上帝 hook？见 [§12.1](./module-layering.md)  
- [ ] 改 ask/重试/session → 红线测仍绿（P0 R1–R4/R10 · `docs/testing/p0-redlines.md`）；fixture 满足 `AuthSession`  
- [ ] ask final 是否来自 `@strict-rag/contracts/testing`（禁止手抄双份）？  
- [ ] `pnpm --filter @strict-rag/web check-types` · `lint` · `test` · `build`（`next build --webpack`）  


---

## 指南索引

| 指南 | 说明 |
|------|------|
| [directory-structure](./directory-structure.md) | 现状布局 · API 放置策略 |
| [module-layering](./module-layering.md) | **page / api / services / hooks / store 分层纪要**（强制） |
| [quality-guidelines](./quality-guidelines.md) | 质量与 ask UI |

## 依赖

`@strict-rag/contracts` · `@strict-rag/ui` · `ai` · `@ai-sdk/react`  
（**无** admin-catalog — 管理菜单不在此包）

## PRD 映射

- `prds/04-pipelines/02-online-ask-langgraph.md`  
- `prds/05-api` · 前端 IA  
- 流双路径：ADR-030（实现映射 AI SDK data parts；见 ask-pipeline PRD 漂移债）  
- IS：`docs/module-status/web.md`
