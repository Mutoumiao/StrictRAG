# @strict-rag/contracts · 共享契约库

> 路径：`packages/contracts`  
> 现状：BizCode/信封 + health + auth + ingest + **ask 域**（request/response/reason/session/feedback/member）均已落地。

---

## Pre-Development Checklist

- [ ] 新错误码 / DTO 是否应放本包（前后端共用）？  
- [ ] 对外 `error.code` 是否等于 **PRD §4 短名**（或经本包唯一映射输出短名）？  
- [ ] 是否按域分文件（`common/` · `system/` · `auth/` · `ingest/` · `ask/` …）？  
- [ ] ask options 是否 **strict 白名单**；scope 是否顶层？  
- [ ] 鉴权 DTO 是否在 `auth/session.contract.ts` 而非 apps 内复制？  
- [ ] 导出是否走 `src/index.ts` 且使用 `.js` 扩展名（NodeNext）？  
- [ ] 是否避免在 apps 内再定义平行 BizCode / Ask DTO？  

## Quality Check

- [ ] `pnpm --filter @strict-rag/contracts check-types` · `lint` · `test`  
- [ ] 无 `any` 泄漏到公共导出类型  
- [ ] ask 契约变更同步 api/web 单测  

---

## 指南索引

| 指南 | 说明 |
|------|------|
| [directory-structure](./directory-structure.md) | 目录与导出（含 ask 域） |
| [contracts-patterns](./contracts-patterns.md) | BizCode · ApiResponse · Zod；与 PRD 错误码对齐 |
| （交叉）[api ask-pipeline](../../api/backend/ask-pipeline.md) | ask HTTP/图消费本包 schema |
| （交叉）[api error-handling](../../api/backend/error-handling.md) | HTTP 映射与过渡表 |

## PRD 映射

- HTTP 信封与错误：`prds/05-api/01-http-api-hono.md`  
- 工程边界：`prds/02-engineering/01-clhoria-template-alignment.md`  
- IS：`docs/module-status/contracts.md`
