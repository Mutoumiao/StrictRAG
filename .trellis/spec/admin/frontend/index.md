# @strict-rag/admin · 管理端前端

> 路径：`apps/admin` · 目标端口 **3006**  
> 现状：**S2c 薄运营页**（登录 · 壳 · 文档/审批/成员最小 UI）；**非**完整运营台（设置/供应商/部门/面板等见 backlog）。

---

## Pre-Development Checklist

- [ ] 是否管理端能力（KB/成员/文档/审批/评测）而非用户 ask 主路径？  
- [ ] 权限码 / 菜单是否来自 `@strict-rag/admin-catalog`？  
- [ ] API 类型是否来自 `@strict-rag/contracts`？  
- [ ] UI 是否优先 `@strict-rag/ui`（`cn` / theme）？  
- [ ] 壳准入是否按 **`admin.shell`**（非旧 role 公式），且不靠前端藏路由？  
- [ ] 菜单裁剪是否 `filterMenuByCodes` + 落地 href 白名单？  

## Quality Check

- [ ] 无密钥、无服务端 DB URL  
- [ ] 按钮可见 ≠ API 已授权（双罪禁止）  
- [ ] `pnpm --filter @strict-rag/admin check-types` · `lint`  

---

## 指南索引

| 指南 | 说明 |
|------|------|
| [directory-structure](./directory-structure.md) | 现状布局 |
| [quality-guidelines](./quality-guidelines.md) | 质量与 RBAC UI |

## 依赖

`@strict-rag/admin-catalog` · `@strict-rag/contracts` · `@strict-rag/ui`

## PRD 映射

- `prds/00-product/05-frontend-ia.md`  
- `product.pen`  
- ADR-045（经 **051** 修订为 `admin.shell`）· ADR-051 · ADR-056  
- IS：`docs/module-status/admin.md`
