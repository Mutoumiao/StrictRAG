# @strict-rag/contracts · 共享契约库

> 路径：`packages/contracts`  
> 现状：BizCode/信封 + health + auth + ingest（含 **chunk 只读**）+ **ask 域** + **kb 设置** + **model-gateway** + **platform 用户/角色** + **departments** + **dashboard summary（B6）** 均已落地。

---

## Pre-Development Checklist

- [ ] **本接口全部 wire 类型是否已在本包**（body + 成功 data + **query** + 流 data parts）？  
- [ ] 前后端是否共用**同一** export（禁止 apps 平行 type）？  
- [ ] 新 `*QuerySchema` 是否已在对应 GET route `safeParse`（禁止契约死代码）？  
- [ ] 新错误码 / DTO 是否应放本包？  
- [ ] 对外 `error.code` 是否等于 **PRD §4 短名**？  
- [ ] 是否按域分文件（`common/` · `system/` · `auth/` · `ingest/` · `ask/` …）？  
- [ ] ask options 是否 **strict 白名单**；scope 是否顶层？  
- [ ] 前端是否用 contracts 类型，且 **path 只落在** 模块 `api.ts`（admin）或 `src/api/*`（web），而非页面/services 内联？  
- [ ] 导出是否走 `src/index.ts` 且使用 `.js` 扩展名（NodeNext）？  
- [ ] 测试专用工厂是否走 **`@strict-rag/contracts/testing`**（不进主 index）？  
- [ ] 改 `AskResponse` 是否同步 `ask/fixtures` + R10 schema 测？  
- [ ] 新测例是否落在 `tests/<能力>/`、文件头含目标/需求、并已写入 `tests/index.md`？（HOW：[testing](../../guides/testing.md)）  

## Quality Check

- [ ] `pnpm --filter @strict-rag/contracts check-types` · `lint` · `test`  
- [ ] 无 `any` 泄漏到公共导出类型  
- [ ] ask 契约变更同步 api/web 单测  
- [ ] 新增 Query Schema 时 api 路由有绑定与非法 query 断言  

---

## 指南索引

| 指南 | 说明 |
|------|------|
| [directory-structure](./directory-structure.md) | 目录与导出（含 ask 域 · **`./testing`**） |
| [contracts-patterns](./contracts-patterns.md) | BizCode · ApiResponse · Zod · testing 工厂；与 PRD 错误码对齐 |
| （交叉）[api ask-pipeline](../../api/backend/ask-pipeline.md) | ask HTTP/图消费本包 schema |
| （交叉）[api error-handling](../../api/backend/error-handling.md) | HTTP 映射与过渡表 |

## PRD 映射

- HTTP 信封与错误：`prds/05-api/01-http-api-hono.md`  
- 工程边界：`prds/02-engineering/01-clhoria-template-alignment.md`  
- IS：`docs/module-status/contracts.md`
