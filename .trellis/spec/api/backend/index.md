# @strict-rag/api · Hono HTTP 后端

> 路径：`apps/api` · 目标端口 **4000**  
> 现状：**P0/P1 入库** + **S2 最小 ask** + **B1 分片只读** + **B2 知识库设置** + **B3 模型供应商/平台绑定最小** + **B4 平台用户/角色授码最小**（`user.manage` / `role.perm.manage`）+ 身份/授权骨架。  
> 默认：`RETRIEVE_ES_MODE=mock` · `AUTH_ENFORCE=false` · `SESSION_REWRITE_ENABLED=false`（强制）· Gateway 缺 URL→mock（**运行时仍 env，未读 DB 绑定**）· **JWT 未读 DB user_roles**。

---

## Pre-Development Checklist

- [ ] 任务是否属于已批准范围？（勿把 backlog B1–B11 静默塞进已关 S2 epic）  
- [ ] DTO/错误码是否来自 `@strict-rag/contracts`，且对外 code 为 **PRD §4 短名**？  
- [ ] 触及 ask / 检索 / 验证时是否读 [quality-redlines](../../guides/quality-redlines.md) + [ask-pipeline](./ask-pipeline.md)？  
- [ ] 权限是否 **以码为准**（读 [auth-authorization](./auth-authorization.md)）？  
- [ ] ask / sessions / members / **chunks** / **kb settings** / **model-gateway** / **users·roles** 是否 **始终**验码（与 `AUTH_ENFORCE` 无关）？平台码无 kb 成员闸  
- [ ] 新登录/refresh/会话/ask 字段是否改 contracts + 双端 http？  
- [ ] DB 是否经 `@strict-rag/db`（禁止 app 私有 schema）？  
- [ ] 是否避免 route 内 SQL / ES DSL / 长 Prompt？  
- [ ] 是否误开 `SESSION_REWRITE_ENABLED` 或宣称生产 ES？  
- [ ] 密钥是否仅服务端 env（JWT 禁止 prod 默认 dev-only）？  

## Quality Check

- [ ] `pnpm --filter @strict-rag/api check-types` · `lint` · `test`  
- [ ] 鉴权改动含 resolve / token rotation 测试  
- [ ] ask 改动含 graph/route 拒答与成员 403 断言  
- [ ] 改 AI SDK 流路径时：是否有 **execute throw → data-ask-final + internal_guard** 回归测？  
- [ ] 新增/已有 `*QuerySchema` 是否在对应 GET route `safeParse`（禁止契约死代码）？  
- [ ] 提交说明写清 S2 最小 / mock / 未做项；禁止「全文 Phase 2 完成」  

---

## 指南索引

| 指南 | 说明 |
|------|------|
| [directory-structure](./directory-structure.md) | 现状布局 |
| [ask-pipeline](./ask-pipeline.md) | **Ask 信任路径 code-spec**（图 · AI SDK 流 · 检索 · Gateway · env） |
| [quality-guidelines](./quality-guidelines.md) | 质量与禁项 |
| [error-handling](./error-handling.md) | 错误与信封 |
| [logging-guidelines](./logging-guidelines.md) | Pino 上下文 |
| [auth-authorization](./auth-authorization.md) | 身份双 token + 权限码 |
| [chunk-readonly](./chunk-readonly.md) | **B1 分片只读** list/detail · `chunk.view` · UTF-8 64KiB |
| [kb-settings](./kb-settings.md) | **B2 知识库设置** GET/PATCH · `kb.config.write` · 质量只读 · rewrite 锁 |
| [model-gateway](./model-gateway.md) | **B3 模型供应商/平台绑定** · `model.gateway.manage` · Key 不回显 · 类型/042 闸 |
| [platform-users-roles](./platform-users-roles.md) | **B4 用户/角色** · `user.manage` / `role.perm.manage` · 最后超管 · codes ⊆ catalog |

## 依赖（package.json）

`@strict-rag/contracts` · `@strict-rag/db` · `@strict-rag/admin-catalog`

## PRD 映射

- `prds/05-api/01-http-api-hono.md`  
- `prds/04-pipelines/02-online-ask-langgraph.md`  
- `prds/07-models` · `prds/08-quality` · `prds/09-security`  
- IS：`docs/module-status/api.md`
