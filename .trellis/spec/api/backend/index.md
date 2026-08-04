# @strict-rag/api · Hono HTTP 后端

> 路径：`apps/api` · 目标端口 **4000**  
> 现状：Phase 0 health/ready + Phase 1 入库 API + **身份/授权骨架**（双 token 过渡 · 权限码求值）；SQL 在 `services/`。

---

## Pre-Development Checklist

- [ ] 任务是否属于已批准 Phase？  
- [ ] DTO/错误码是否来自 `@strict-rag/contracts`，且对外 code 为 **PRD §4 短名**？  
- [ ] 权限是否 **以码为准**（读 [auth-authorization](./auth-authorization.md)）？  
- [ ] 新登录/refresh/会话字段是否改 contracts + 双端 http？  
- [ ] `AUTH_ENFORCE` / demo-ingest 影响是否评估？  
- [ ] DB 是否经 `@strict-rag/db`（禁止 app 私有 schema）？  
- [ ] 是否避免 route 内 SQL / ES DSL / 长 Prompt？  
- [ ] 密钥是否仅服务端 env（JWT 禁止 prod 默认 dev-only）？  

## Quality Check

- [ ] `pnpm --filter @strict-rag/api check-types` · `lint` · `test`  
- [ ] 鉴权改动含 resolve / token rotation 测试  
- [ ] 未实现业务却声称「可问答/可入库」  

---

## 指南索引

| 指南 | 说明 |
|------|------|
| [directory-structure](./directory-structure.md) | 现状与目标布局 |
| [quality-guidelines](./quality-guidelines.md) | 质量与禁项 |
| [error-handling](./error-handling.md) | 错误与信封 |
| [logging-guidelines](./logging-guidelines.md) | Pino 上下文 |
| [auth-authorization](./auth-authorization.md) | 身份双 token + 权限码（参考 partner） |

## 依赖（package.json）

`@strict-rag/contracts` · `@strict-rag/db` · `@strict-rag/admin-catalog`

## PRD 映射

- `prds/05-api/01-http-api-hono.md`  
- `prds/02-engineering/01-clhoria-template-alignment.md`  
- Phase 0：`prds/10-delivery/01-phased-roadmap.md`
