# @strict-rag/admin-catalog · 权限与菜单 SSOT

> 路径：`packages/admin-catalog`  
> ADR-056：权限码 + admin 菜单树 **前后端同源**  
> 现状：已种子 **权限码 + 角色模板 + 菜单树**（ADR-051/056）；DB upsert 同步仍属 P2 后续。

---

## Pre-Development Checklist

- [ ] 新权限码是否只在本包 `PERMISSION_DEFINITIONS` 注册？  
- [ ] 角色默认能力是否改 `ROLE_TEMPLATES` 而非 apps 内写死？  
- [ ] 菜单树是否引用同一 `PermissionCode`？  
- [ ] api `requirePermission` / admin 裁剪是否仍指向本包？  
- [ ] 是否读过 [catalog-ssot](./catalog-ssot.md) 七段契约？  

## Quality Check

- [ ] 无 React 依赖（本包保持数据-only）  
- [ ] `pnpm --filter @strict-rag/admin-catalog check-types` · `lint` · `test`  
- [ ] 新测例是否落在 `tests/<能力>/`、文件头含目标/需求、并已写入 `tests/index.md`？（HOW：[testing](../../guides/testing.md)）  

---

## 指南索引

| 指南 | 说明 |
|------|------|
| [directory-structure](./directory-structure.md) | 现状 |
| [catalog-ssot](./catalog-ssot.md) | SSOT 规则与消费者 |

## PRD 映射

- `prds/09-security/01-auth-acl-compliance.md`  
- ADR-051 权限码 · ADR-056 catalog
