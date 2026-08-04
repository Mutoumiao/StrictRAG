# @strict-rag/contracts · 共享契约库

> 路径：`packages/contracts`  
> 现状：骨架阶段 **唯一有实质代码** 的业务相关包。

---

## Pre-Development Checklist

- [ ] 新错误码 / DTO 是否应放本包（前后端共用）？  
- [ ] 对外 `error.code` 是否等于 **PRD §4 短名**（或经本包唯一映射输出短名）？  
- [ ] 是否按域分文件（`common/` · `system/` · `auth/` · `ingest/` …）？  
- [ ] 鉴权 DTO 是否在 `auth/session.contract.ts` 而非 apps 内复制？  
- [ ] 导出是否走 `src/index.ts` 且使用 `.js` 扩展名（NodeNext）？  
- [ ] 是否避免在 apps 内再定义平行 BizCode 字符串？  

## Quality Check

- [ ] `pnpm --filter @strict-rag/contracts check-types`  
- [ ] `pnpm --filter @strict-rag/contracts lint`  
- [ ] 无 `any` 泄漏到公共导出类型  

---

## 指南索引

| 指南 | 说明 |
|------|------|
| [directory-structure](./directory-structure.md) | 目录与导出 |
| [contracts-patterns](./contracts-patterns.md) | BizCode · ApiResponse · Zod；与 PRD 错误码对齐 |
| （交叉）[api error-handling](../../api/backend/error-handling.md) | HTTP 映射与过渡表 |

## PRD 映射

- HTTP 信封与错误：`prds/05-api/01-http-api-hono.md`  
- 工程边界：`prds/02-engineering/01-clhoria-template-alignment.md`
