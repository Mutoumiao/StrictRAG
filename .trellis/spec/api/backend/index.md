# @strict-rag/api · Hono HTTP 后端

> 路径：`apps/api` · 目标端口 **4000**  
> 现状：Phase 0 health/ready + Phase 1 入库 API（无鉴权演示）；SQL 在 `services/`。

---

## Pre-Development Checklist

- [ ] 任务是否属于已批准 Phase（默认 Phase 0：health/ready/env）？  
- [ ] DTO/错误码是否来自 `@strict-rag/contracts`，且对外 code 为 **PRD §4 短名**？  
- [ ] 权限是否 **以码为准**（壳 = `admin.shell`，非旧 role 公式）？  
- [ ] ask 是否区分 `options` 白名单与顶层 `scope`？  
- [ ] DB 是否经 `@strict-rag/db`（禁止 app 私有 schema）？  
- [ ] 是否避免 route 内 SQL / ES DSL / 长 Prompt？  
- [ ] 密钥是否仅服务端 env？  

## Quality Check

- [ ] `pnpm --filter @strict-rag/api check-types` · `lint`  
- [ ] 未实现业务却声称「可问答/可入库」  

---

## 指南索引

| 指南 | 说明 |
|------|------|
| [directory-structure](./directory-structure.md) | 现状与目标布局 |
| [quality-guidelines](./quality-guidelines.md) | 质量与禁项 |
| [error-handling](./error-handling.md) | 错误与信封 |
| [logging-guidelines](./logging-guidelines.md) | Pino 上下文 |

## 依赖（package.json）

`@strict-rag/contracts` · `@strict-rag/db` · `@strict-rag/admin-catalog`

## PRD 映射

- `prds/05-api/01-http-api-hono.md`  
- `prds/02-engineering/01-clhoria-template-alignment.md`  
- Phase 0：`prds/10-delivery/01-phased-roadmap.md`
