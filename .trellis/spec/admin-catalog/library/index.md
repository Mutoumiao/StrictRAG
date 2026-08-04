# @strict-rag/admin-catalog · 权限与菜单 SSOT

> 路径：`packages/admin-catalog`  
> ADR-056：权限码 + admin 菜单树 **前后端同源**  
> 现状：空数组占位。

---

## Pre-Development Checklist

- [ ] 新权限码是否只在本包注册？  
- [ ] 菜单树是否引用同一码表？  
- [ ] api 启动同步 / admin import 是否仍指向本包？  

## Quality Check

- [ ] 无 React 依赖（本包保持数据-only）  
- [ ] `pnpm --filter @strict-rag/admin-catalog check-types` · `lint`  

---

## 指南索引

| 指南 | 说明 |
|------|------|
| [directory-structure](./directory-structure.md) | 现状 |
| [catalog-ssot](./catalog-ssot.md) | SSOT 规则与消费者 |

## PRD 映射

- `prds/09-security/01-auth-acl-compliance.md`  
- ADR-051 权限码 · ADR-056 catalog
